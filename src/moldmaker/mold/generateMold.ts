// @ts-nocheck — upstream mold-maker code; type-checked under its own repo tsconfig
import { buildGapFiller, buildFeet, engraveText, splitIntoParts, type Round7Extras } from './round7';
import * as THREE from 'three';
import type { Axis, MoldBoxShape } from '../types';
import {
  WALL_THICKNESS_RATIO,
  CLEARANCE_MM,
  SPRUE_DIAMETER_MM,
  PIN_RADIUS_RATIO,
  PIN_HEIGHT_RATIO,
  SPRUE_TOP_MULTIPLIER,
  VENT_RADIUS_RATIO,
  VENT_TAPER_RATIO,
  ENABLE_OBLIQUE_PLANES,
} from './constants';
import { clampCutAngle, getPlaneEquation } from './planeGeometry';
import {
  getManifold,
  geometryToManifold,
  manifoldToGeometry,
} from './manifoldBridge';
import { validateMesh, type MeshRepairLog } from './validateMesh';
import { undercutFraction } from './draftAnalysis';
import { capOpenBoundaries } from './capOpenBoundaries';
import {
  getRegistrationPinPositionsForEnvelope,
  getRotationForAxis,
  computeChannelPositionsForEnvelope,
} from './channelPlacement';
import { computeMoldEnvelope, createMoldBoxManifold } from './moldBox';
import { envelopeAroundManifold, offsetOutwardEx } from './moldOffset';
import { primaryAxisIndex } from './moldBox';
import {
  type MoldExtras,
  applyTongueGroove,
  applyPryPockets,
  applyRadialSplit,
  lateralToWorld,
  buildHollowCore,
  buildRunners,
} from './moldFeatures';
import { lateralAxisIndices } from './moldBox';
import {
  type Round6Extras,
  buildCurvedSplit,
  applyClampWings,
  buildStandFins,
  trappedAirPoints,
  axialCylinder,
  buildStyleMold,
} from './proFeatures';

/**
 * Optional overrides for tunables that are otherwise read from ./constants.
 * Any field left undefined falls back to the module-level constant — so
 * existing call sites keep working without churn.
 */
export interface GenerateMoldOptions {
  /** Wall thickness as a fraction of max bbox extent. Defaults to WALL_THICKNESS_RATIO. */
  wallThicknessRatio?: number;
  /** Clearance between mating surfaces in absolute mm. Defaults to CLEARANCE_MM.
   *  Roadmap #13 swapped this from a ratio-of-wall-thickness to absolute mm so
   *  casters can dial known-good values (e.g. 0.15 mm FDM tight-fit, 0.05 mm
   *  resin tight-fit) without having them silently rescale with model size. */
  clearanceMm?: number;
  /** Sprue top-diameter in absolute mm. Defaults to SPRUE_DIAMETER_MM. The
   *  cavity end (gate) radius is derived via SPRUE_TOP_MULTIPLIER (2:1 taper),
   *  so the user sees one number — the pour-opening diameter — and the
   *  narrower gate end scales with it. */
  sprueDiameterMm?: number;
  /** Outer shell shape. Defaults to 'rect' for backwards compatibility. */
  moldBoxShape?: MoldBoxShape;
  /**
   * Tilt of the parting plane around its hinge axis, in degrees.
   * 0 = axis-aligned (legacy behaviour). Range: [-30, 30]; anything
   * outside is clamped. Defaults to 0. Ignored while
   * ENABLE_OBLIQUE_PLANES is false — silently treated as 0.
   */
  cutAngle?: number;
  /**
   * Optional user-specified lateral sprue position. When provided, the
   * automatic centroid-and-snap placement is skipped and the sprue is
   * planted at these lateral coords (primary-axis coord is still lifted
   * onto the parting plane). Cavity verification is NOT performed — the
   * user's choice wins. See `computeChannelPositions` for full semantics.
   */
  sprueOverride?: { a: number; b: number };
  /**
   * Additional parting planes applied AFTER the primary plane. Each
   * additional plane cuts every existing piece into two — so 1 primary +
   * 2 additional planes can yield up to 8 pieces (2 × 2 × 2). Planes that
   * miss a piece entirely (the piece lies fully on one side) leave that
   * piece intact rather than producing an empty manifold.
   *
   * The PRIMARY plane (axis/offset/cutAngle args) is the one the sprue,
   * vents, and registration pins attach to — it represents the main
   * "top vs bottom" parting surface. Additional planes are pure cuts:
   * no sprue, no pins. This matches users' mental model — they think of
   * the first cut as the main split and any additional cuts as further
   * subdivision of the resulting pieces.
   *
   * Empty array (default) reproduces the legacy 2-piece behavior exactly.
   */
  additionalPlanes?: Array<{
    axis: Axis;
    /** 0..1 normalized along the chosen axis. */
    offset: number;
    /** Tilt around hinge axis in degrees, default 0. */
    cutAngle?: number;
  }>;
  /**
   * Hollow-vessel mode (plant pots, jars, cups). When true, open boundary
   * loops in the input mesh are capped before CSG so a non-watertight rim
   * doesn't hard-fail geometryToManifold.
   *
   * Phase 1 scope: this ONLY makes the mesh watertight (so the tool stops
   * crashing on open vessels). It does NOT yet generate a core to form the
   * interior cavity — that's Phase 2. With Phase 1 alone, a hollow vessel
   * produces a mold that casts a SOLID version of its exterior. The number
   * of holes closed is reported back via the repair log.
   */
  isHollow?: boolean;
  /**
   * Form-fit shell: when true, the outer mold wall is the model offset
   * outward by (clearance + wallThickness) instead of a box/cylinder/
   * roundedRect envelope. Saves print material on organic shapes. The
   * `moldBoxShape` option is ignored while this is on. CSG cost is higher
   * (Minkowski offset), so the UI warns that generation takes longer.
   */
  formFit?: boolean;
  /** Tier-2 extras: seal type, pry pockets, radial split, multi-cavity sprues. */
  extras?: MoldExtras;
}

/**
 * Pure CSG pipeline: given a part geometry and a split plane, produce the
 * two mold halves. No React, no DOM — exists as a standalone function so it
 * can run inside a Web Worker (P1) or be called directly from the main thread.
 *
 * Notes:
 *   • Manifold WASM is a singleton inside whatever context loads it (main
 *     thread or worker). It's NOT safe to run multiple generateMold calls
 *     concurrently in the same context.
 *   • Throws if Manifold can't form a valid manifold from the input mesh
 *     (usually means non-watertight geometry).
 */
export interface GenerateMoldResult {
  /**
   * The mold pieces, in a stable order:
   *   [0] = "top half" of the primary parting plane (carries the sprue
   *         and vent holes)
   *   [1] = "bottom half" of the primary parting plane (carries the
   *         registration-pin sockets)
   *   [2..] = subdivisions produced by additional planes, in the order
   *           those planes were applied. Each additional plane cuts every
   *           existing piece into two; pieces a plane misses are left intact.
   *
   * For the legacy 1-plane case (no additionalPlanes) this is always a
   * 2-element array: [top, bottom].
   */
  pieces: THREE.BufferGeometry[];
  /** Mesh validation log — populated even on success. Callers can read this
   *  to surface a "we auto-repaired your mesh" toast, or ignore it entirely
   *  if the input was clean. See validateMesh.ts for what gets reported. */
  repairs: MeshRepairLog;
}

export async function generateMold(
  geometry: THREE.BufferGeometry,
  boundingBox: THREE.Box3,
  axis: Axis,
  offset: number, // 0-1 normalized
  options: GenerateMoldOptions = {},
): Promise<GenerateMoldResult> {
  const wasm = await getManifold();
  const { Manifold } = wasm;

  // Resolve option overrides against module defaults. `??` (not `||`) so that
  // an explicit 0 isn't silently replaced with the default — a 0 ratio is
  // nonsensical for wall thickness but we let downstream CSG fail loudly
  // rather than hide the bad input here.
  const wallThicknessRatio = options.wallThicknessRatio ?? WALL_THICKNESS_RATIO;
  const clearanceMm = options.clearanceMm ?? CLEARANCE_MM;
  const sprueDiameterMm = options.sprueDiameterMm ?? SPRUE_DIAMETER_MM;
  const moldBoxShape: MoldBoxShape = options.moldBoxShape ?? 'rect';

  // cutAngle: accepted in the API for forward compat but force-zeroed until
  // the feature flag flips. Once ENABLE_OBLIQUE_PLANES is true this feeds
  // into the plane-equation helper used by the CSG / channel / heatmap paths.
  // Clamp defensively — user-facing UI clamps too, but the worker protocol
  // allows arbitrary values and we'd rather fail soft than CSG-fail hard.
  const cutAngle = ENABLE_OBLIQUE_PLANES ? clampCutAngle(options.cutAngle ?? 0) : 0;

  // Compute actual split position
  const bboxSize = new THREE.Vector3();
  const bboxMin = boundingBox.min.clone();
  const bboxMax = boundingBox.max.clone();
  boundingBox.getSize(bboxSize);

  // Defensive: a zero-extent bbox along any axis means the input is flat or
  // malformed. Downstream code (offsetFromSplitPos, wall-thickness math) would
  // silently treat this as "0 along that axis" and produce nonsense. Fail loud
  // with a message the UI error path can surface verbatim rather than hiding
  // behind a generic CSG failure later.
  if (bboxSize.x <= 0 || bboxSize.y <= 0 || bboxSize.z <= 0) {
    throw new Error(
      `Cannot generate mold: input bounding box is degenerate ` +
      `(size = [${bboxSize.x}, ${bboxSize.y}, ${bboxSize.z}]). ` +
      `The model may be flat or malformed.`,
    );
  }

  const axisIdx = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
  const splitPos = bboxMin.getComponent(axisIdx) +
    (bboxMax.getComponent(axisIdx) - bboxMin.getComponent(axisIdx)) * offset;

  // Wall thickness is scale-relative (still a ratio — see constants.ts for
  // why it stays ratio-based). Clearance is ABSOLUTE mm (roadmap #13).
  const maxExtent = Math.max(bboxSize.x, bboxSize.y, bboxSize.z);
  const wallThickness = options.extras?.wallMm && options.extras.wallMm > 0
    ? options.extras.wallMm
    : maxExtent * wallThicknessRatio;
  const clearance = clearanceMm;

  // Mold outer envelope — shape-aware. AABB fields are still used by the
  // channel placement below (it reasons about the bounding region, not the
  // shell silhouette). For non-rect shapes, the envelope's AABB is the
  // circumscribing box of the actual shell.
  let envelope = computeMoldEnvelope(boundingBox, moldBoxShape, axis, wallThickness);

  // Pre-flight mesh validation. Drops NaN/Infinity vertices, zero-edge
  // slivers, and degenerate (near-zero-area) triangles that would otherwise
  // cause Manifold to throw cryptic WASM errors like "table index is out of
  // bounds." `repairs` is returned to the caller so the UI can show a
  // "fixed N triangles" toast — silent repair would deny users the chance
  // to clean up their source files upstream.
  const validated = validateMesh(geometry);
  const repairs = validated.repairs;
  let cleanGeometry = validated.geometry;

  // Hollow-vessel mode (Phase 1): cap open boundary loops so a non-watertight
  // rim (the defining feature of an open pot/jar) doesn't hard-fail Manifold.
  // Runs AFTER validateMesh so capping operates on already-cleaned geometry
  // (no NaN/degenerate triangles to corrupt the boundary-edge counts). The
  // count of holes closed is folded into the same repair log the UI toasts.
  if (options.isHollow) {
    const capped = capOpenBoundaries(cleanGeometry);
    repairs.closedHoles = capped.holesClosed;
    cleanGeometry = capped.geometry;
  }

  // Convert the model to a Manifold. Errors here are classified so users get
  // an actionable message instead of a generic "may not be watertight" line.
  // Common Manifold-time failure modes:
  //   • "table index out of bounds" — corrupted indices or non-manifold edges
  //     surviving the merge step. Often caused by self-intersecting surfaces.
  //   • "not manifold" / "manifold check failed" — the input has 3+ faces
  //     sharing an edge, or holes the merge couldn't close.
  // We can't repair these (would change the user's geometry meaningfully) so
  // we surface them as targeted hints. Anything else falls back to the
  // historical "may not be watertight" message.
  let modelManifold;
  try {
    modelManifold = geometryToManifold(wasm, cleanGeometry);
  } catch (e) {
    console.error('Failed to create manifold from geometry:', e);
    const msg = e instanceof Error ? e.message : String(e);
    if (/table index/i.test(msg) || /out of bounds/i.test(msg)) {
      throw new Error(
        'Mesh has corrupted topology (likely self-intersecting faces or ' +
        'non-manifold edges). Try repairing the model in Blender or ' +
        'Meshmixer before importing.',
      );
    }
    if (/manifold/i.test(msg)) {
      throw new Error(
        'Mesh has non-manifold edges (an edge shared by 3 or more faces, ' +
        'or holes the auto-merge could not close). Repair the model in ' +
        'Blender (Mesh > Clean Up) before importing.',
      );
    }
    throw new Error('Could not convert geometry to manifold. The model may not be watertight.');
  }

  // Create the full outer shell and subtract the part to form the cavity.
  //
  // Form-fit mode: instead of an analytic envelope (box / cylinder /
  // roundedRect), the shell is the model offset outward by clearance + wall
  // and the cavity is the model offset by clearance alone — the wall hugs
  // the part at a uniform distance, which saves a lot of print material on
  // organic shapes. The envelope (used downstream only for its AABB, by pin
  // and channel placement) becomes the offset solid's own bounding box.
  const extras: MoldExtras = options.extras ?? {};
  const r6: Round6Extras = extras;

  // Extra mold styles (relief tray, press mold, plaster slip-cast kit) use
  // their own simple geometry — no split, pins or sprue.
  if (r6.style && r6.style !== 'standard') {
    const pi = primaryAxisIndex(axis);
    const [la, lb] = lateralAxisIndices(axis);
    const pos = cleanGeometry.attributes.position.array;
    let hiP = -Infinity, hiA = 0, hiB = 0;
    for (let i = 0; i < pos.length; i += 3) if (pos[i + pi] > hiP) { hiP = pos[i + pi]; hiA = pos[i + la]; hiB = pos[i + lb]; }
    const res = buildStyleMold(wasm, r6.style, modelManifold, boundingBox, axis, wallThickness, { a: hiA, b: hiB });
    return { pieces: res.pieces.map(p => manifoldToGeometry(p)), repairs, labels: res.labels };
  }

  let moldCavity;
  let cavityCut = modelManifold;
  // Features that had to fall back or switch off; shown to the user.
  const notices: string[] = [];
  if (options.formFit) {
    const cav = offsetOutwardEx(wasm, modelManifold, clearance, boundingBox);
    // Heavy meshes: keep the cavity at full detail (the grid offset is
    // coarser than a typical 0.2 mm clearance) — only the outer wall uses it.
    const cavitySolid = cav.method === 'exact' ? cav.solid : modelManifold;
    const outer = offsetOutwardEx(wasm, modelManifold, clearance + wallThickness, boundingBox);
    const fullBox = outer.solid;
    if (outer.method === 'scaled' && modelManifold.numTri?.() > 20000) {
      notices.push('This model is very detailed, so the form-fit wall was sized by stretching the model. Wall thickness may vary; check thin spots before printing.');
    }
    envelope = envelopeAroundManifold(fullBox, axis, wallThickness);
    moldCavity = fullBox.subtract(cavitySolid);
    cavityCut = cavitySolid;
  } else {
    const fullBox = createMoldBoxManifold(wasm, envelope);
    const r7g: Round7Extras = extras;
    const filler = r7g.gapFiller ? buildGapFiller(wasm, cleanGeometry, axis, boundingBox) : null;
    if (filler) cavityCut = modelManifold.add(filler);
    moldCavity = fullBox.subtract(cavityCut);
  }

  // Split the cavity into top and bottom halves along the parting plane
  // (Manifold.splitByPlane returns [above, below]; "above" = top half).
  // Curved split: cut with a surface that runs through the middle of the
  // model in every column instead of a flat plane.
  const curved = r6.curvedSplit && cutAngle === 0
    ? buildCurvedSplit(wasm, cleanGeometry, axis, envelope.moldMin,
        envelope.moldMin.clone().add(envelope.moldSize), splitPos, wallThickness)
    : null;
  let topHalf, bottomHalf;
  if (curved) {
    topHalf = moldCavity.intersect(curved.cutter);
    bottomHalf = moldCavity.subtract(curved.cutter);
  } else {
    const plane = getPlaneEquation(
      [bboxMin.x, bboxMin.y, bboxMin.z],
      [bboxMax.x, bboxMax.y, bboxMax.z],
      axis, offset, cutAngle,
    );
    [topHalf, bottomHalf] = moldCavity.splitByPlane(
      plane.normal as [number, number, number],
      plane.originOffset,
    );
  }

  // Add registration pins/keys to help alignment
  const pinRadius = wallThickness * PIN_RADIUS_RATIO;
  const pinHeight = wallThickness * PIN_HEIGHT_RATIO;
  const pinPositions = getRegistrationPinPositionsForEnvelope(envelope, boundingBox, splitPos, cutAngle);

  let topResult = topHalf;
  let bottomResult = bottomHalf;

  // Seal type (Tier 2). Tongue & groove needs an axis-aligned plane and an
  // analytic wall; otherwise we silently fall back to keyed pins.
  const cavityCenters = extras.cavityCenters ?? [];
  // A curved split is self-registering (the halves nest), so no pins/seal.
  let sealed = !!curved;
  if (!curved && extras.seal === 'tongueGroove' && cutAngle === 0 && !options.formFit) {
    const res = applyTongueGroove(wasm, topResult, bottomResult, {
      axis,
      cavityBox: boundingBox.clone().expandByScalar(clearance),
      envMin: envelope.moldMin, envSize: envelope.moldSize,
      splitPos, wallThickness, clearance,
    });
    if (res) { [topResult, bottomResult] = res; sealed = true; }
  }

  // Round 8: user lock size/count/style. Omitted = legacy round pins.
  const lockStyle = extras.lockStyle ?? 'round';
  const lockR = extras.lockDiameterMm && extras.lockDiameterMm > 0
    ? Math.min(extras.lockDiameterMm / 2, lockStyle === 'magnet' ? wallThickness * 0.45 + 2 : wallThickness * 0.4)
    : pinRadius;
  const lockPositions = extras.lockCount === 2
    ? (envelope.shape === 'cylinder' ? [pinPositions[0], pinPositions[2]] : [pinPositions[0], pinPositions[3]]).filter(Boolean)
    : pinPositions;
  const rot = getRotationForAxis(axis);
  for (const pinPos of (sealed ? [] : lockPositions)) {
    if (lockStyle === 'magnet' && cutAngle === 0) {
      // Matching pockets in both faces for disc magnets (glue them in).
      const [la, lb] = lateralAxisIndices(axis);
      const d = 3.2; // 3 mm magnet + glue gap
      const pr = lockR + 0.1;
      const up = axialCylinder(wasm, axis, pinPos[la]!, pinPos[lb]!, splitPos, splitPos + d, pr, pr, 32);
      const dn = axialCylinder(wasm, axis, pinPos[la]!, pinPos[lb]!, splitPos - d, splitPos, pr, pr, 32);
      if (up) topResult = topResult.subtract(up);
      if (dn) bottomResult = bottomResult.subtract(dn);
      continue;
    }
    // Registration pins MUST span the parting plane (centered): half inside
    // the top body, half protruding into the bottom, which gets a matching
    // socket enlarged by the fit clearance.
    const h = pinHeight, c = clearance;
    let pin, socket;
    if (lockStyle === 'cone') {
      // Narrow end points into the bottom half so the halves self-guide.
      pin = Manifold.cylinder(h, lockR * 0.45, lockR, 24, true);
      socket = Manifold.cylinder(h + c * 2, lockR * 0.45 + c, lockR + c, 24, true);
    } else if (lockStyle === 'square') {
      pin = Manifold.cube([lockR * 2, lockR * 2, h], true);
      socket = Manifold.cube([lockR * 2 + c * 2, lockR * 2 + c * 2, h + c * 2], true);
    } else {
      pin = Manifold.cylinder(h, lockR, lockR, 16, true);
      socket = Manifold.cylinder(h + c * 2, lockR + c, lockR + c, 16, true);
    }
    topResult = topResult.add(pin.rotate(rot).translate(pinPos));
    bottomResult = bottomResult.subtract(socket.rotate(rot).translate(pinPos));
  }

  // Clamp wings + stand-fins (flat, untilted split only). Added before the
  // channels are drilled so they never refill a sprue or vent.
  const flatSplit = !curved && cutAngle === 0;
  const envMaxV = envelope.moldMin.clone().add(envelope.moldSize);
  if (flatSplit && r6.clampBoltMm) {
    [topResult, bottomResult] = applyClampWings(wasm, topResult, bottomResult, {
      axis, envMin: envelope.moldMin, envMax: envMaxV, splitPos, wall: wallThickness,
      boltMm: r6.clampBoltMm, cavityCut,
    });
  }
  if (flatSplit && r6.standFins) {
    const fins = buildStandFins(wasm, { axis, envMin: envelope.moldMin, envMax: envMaxV, splitPos, wall: wallThickness, cavityCut });
    if (fins) bottomResult = bottomResult.add(fins);
  }

  // ── Pour sprue, runner, gate, and vent system ──
  //
  // Engineering principles (from injection molding & casting best practices):
  //
  // SPRUE: Tapered funnel from outer surface into the mold. Gate diameter
  //   should be ~1.5x the thickest wall section. Conservative taper since
  //   these are cast, not injected.
  //
  // GATE: Where sprue meets cavity. Placed at the thickest section so
  //   material flows thick→thin (reduces shrinkage voids). For gravity
  //   casting, placed high so material flows down.
  //
  // VENTS: Placed at highest points and extremities of the cavity —
  //   wherever air would get trapped last as material fills. For a two-part
  //   mold, vents go at points farthest from the gate AND at local high points.
  //
  // SIZING: Sprue gate ~1.5x estimated wall thickness. Vents much smaller
  //   (enough for air, not material leakage). Sprue tapers wider at top.

  // Sprue sizing — roadmap #13 switched from wall-thickness-derived to an
  // absolute user-configurable top diameter. SPRUE_TOP_MULTIPLIER still
  // governs the gate-to-top taper (narrower at the cavity to reduce material
  // waste and aid mold release). The tiny safety minimum protects against a
  // user dragging the slider to 0 and producing a zero-radius cylinder.
  const sprueTopRadius = Math.max(sprueDiameterMm / 2, 1.0);
  const sprueGateRadius = sprueTopRadius / SPRUE_TOP_MULTIPLIER;
  const ventRadius = extras.ventDiameterMm && extras.ventDiameterMm > 0
    ? extras.ventDiameterMm / 2
    : sprueGateRadius * VENT_RADIUS_RATIO;

  // Clearance margins: how much material must remain between each channel's
  // outer radius and the shell's outer wall. Without these, the sprue and
  // vents can CSG-subtract through the side of the mold — producing visible
  // "pour hole drilled through the side" artifacts on cylinder molds, and
  // sometimes a degenerate empty manifold after the subtract.
  //
  // Biased asymmetric: the sprue gets a bigger safety wall (0.5× wall) than
  // vents (0.3× wall) because the sprue is the larger hole and the visible
  // one — a small vent punching a tiny scar near an extremity is more
  // forgivable than the pour spout doing the same. These ratios are
  // empirical: large enough to avoid visible wall breakouts on curved
  // cylinders at the default WALL_THICKNESS_RATIO, small enough that
  // channels still land near the part's actual thickest section and
  // extremities on typical geometry.
  const sprueMargin = sprueTopRadius + wallThickness * 0.5;
  const ventMargin = ventRadius + wallThickness * 0.3;

  // Hollow core (Tier 3): printable inner core for vases/cups (single cavity only).
  const hollow = extras.hollowCore && cavityCenters.length <= 1
    ? buildHollowCore(wasm, {
        model: modelManifold, axis, envMin: envelope.moldMin, envSize: envelope.moldSize,
        wallMm: extras.hollowCore.wallMm, opening: extras.hollowCore.opening,
        flangeMm: Math.max(2, wallThickness * 0.5),
      })
    : null;
  const useRunner = !!extras.runner && cavityCenters.length > 1;
  const trayHub = {
    a: cavityCenters.reduce((t, c) => t + c.a, 0) / Math.max(1, cavityCenters.length),
    b: cavityCenters.reduce((t, c) => t + c.b, 0) / Math.max(1, cavityCenters.length),
  };
  const channels = computeChannelPositionsForEnvelope(
    envelope, boundingBox, splitPos, geometry,
    { sprueMargin, ventMargin },
    cutAngle,
    hollow
      ? { sprueOverride: hollow.sprueLateral }
      : cavityCenters.length > 1
      ? { sprueOverride: useRunner ? trayHub : cavityCenters[0] }
      : options.sprueOverride ? { sprueOverride: options.sprueOverride } : {},
  );

  // Guard against degenerate sprue heights. If the parting plane is pushed
  // all the way to the top of the bbox (offset ≈ 1), sprueHeight shrinks to
  // just wallThickness — and if it ever drops below a quarter of that, the
  // tapered cylinder becomes numerically unstable and the subtract can
  // collapse the top half to an empty manifold. Skip channels in that case
  // rather than produce a useless mold. Users get a clear "move the parting
  // plane" hint via the EmptyManifoldError surfaced from manifoldToGeometry
  // if the split is even more extreme than that.
  const MIN_CHANNEL_HEIGHT = wallThickness * 0.25;
  const channelsViable = channels.sprueHeight >= MIN_CHANNEL_HEIGHT;

  if (channelsViable) {
    // Sprue: tapered cylinder — wider at pour end, narrower at cavity
    const sprue = Manifold.cylinder(
      channels.sprueHeight,
      sprueGateRadius,
      sprueTopRadius,
      24,
    ).rotate(channels.rotation).translate(channels.spruePos);

    topResult = topResult.subtract(sprue);
    if (curved) bottomResult = bottomResult.subtract(sprue);

    // Vent holes at extremities and high points
    if (extras.ventCount !== undefined) channels.ventPositions = channels.ventPositions.slice(0, Math.max(0, extras.ventCount));
    for (const ventPos of channels.ventPositions) {
      const vent = Manifold.cylinder(
        channels.sprueHeight,
        ventRadius,
        ventRadius * VENT_TAPER_RATIO,
        12,
      ).rotate(channels.rotation).translate(ventPos);

      topResult = topResult.subtract(vent);
      if (curved) bottomResult = bottomResult.subtract(vent);
    }

    // Curved split: the channels start on the flat reference plane, so link
    // each one down/up to where the curved surface actually meets the cavity.
    if (curved) {
      const [la, lb] = lateralAxisIndices(axis);
      for (const [pos, r] of [[channels.spruePos, sprueGateRadius], ...channels.ventPositions.map(v => [v, ventRadius])] as Array<[number[], number]>) {
        const a = pos[la]!, b = pos[lb]!;
        const link = axialCylinder(wasm, axis, a, b, curved.heightAt(a, b), splitPos, r, r, 16);
        if (link) { topResult = topResult.subtract(link); bottomResult = bottomResult.subtract(link); }
      }
    }

    // Multi-cavity tray: one sprue per extra cavity, same depth/taper.
    for (const c of useRunner ? [] : cavityCenters.slice(1)) {
      const pos = lateralToWorld(axis, c.a, c.b, channels.spruePos[primaryAxisIndex(axis)]);
      topResult = topResult.subtract(
        Manifold.cylinder(channels.sprueHeight, sprueGateRadius, sprueTopRadius, 24)
          .rotate(channels.rotation).translate(pos),
      );
    }
  }

  // Automatic air vents at the model's trapped-air high points.
  if (r6.autoVents) {
    const [la, lb] = lateralAxisIndices(axis);
    const pts = trappedAirPoints(geometry, axis, boundingBox,
      [[channels.spruePos[la]!, channels.spruePos[lb]!]], sprueTopRadius * 3);
    const envTop = envelope.moldMin.getComponent(primaryAxisIndex(axis)) + envelope.moldSize.getComponent(primaryAxisIndex(axis)) + 1;
    const vr = Math.max(0.75, ventRadius);
    for (const q of pts) {
      const v = axialCylinder(wasm, axis, q.a, q.b, q.p - 0.3, envTop, vr, vr * 1.3, 12);
      if (v) { topResult = topResult.subtract(v); bottomResult = bottomResult.subtract(v); }
    }
  }

  // ── Additional sequential cuts ──
  //
  // After the primary plane has been applied (and sprue/pins/vents added),
  // each additional plane cuts every existing piece into two. Pieces that
  // lie fully on one side of a plane are returned intact rather than
  // producing an empty manifold — splitByPlane returns [whole, empty] or
  // [empty, whole] in those cases, and we filter empties out.
  //
  // Why this happens AFTER sprue/pin work, not before: the sprue and pins
  // are physically anchored to the primary parting surface. Splitting first
  // would leave additional pieces with no clear "top" to attach features
  // to, and would change the meaning of "top half" mid-pipeline. By doing
  // primary-plus-features first, the sequential cuts become a pure topology
  // operation on already-finished mold geometry.
  if (useRunner) {
    const runners = buildRunners(wasm, {
      axis, hub: trayHub, centers: cavityCenters, splitPos, radius: Math.max(1.5, sprueGateRadius),
    });
    if (runners) {
      topResult = topResult.subtract(runners);
      bottomResult = bottomResult.subtract(runners);
    }
  }
  if (hollow) {
    topResult = topResult.subtract(hollow.column);
    bottomResult = bottomResult.subtract(hollow.column);
  }
  // Round 7: feet, engraved volume label + watermark (untilted splits only).
  const r7: Round7Extras = extras;
  if (cutAngle === 0 && (r7.moldFeet || r7.volumeLabel || r7.watermark)) {
    const [la7, lb7] = lateralAxisIndices(axis);
    const pi7 = primaryAxisIndex(axis);
    const eMax = envelope.moldMin.clone().add(envelope.moldSize);
    const a0 = envelope.moldMin.getComponent(la7), a1 = eMax.getComponent(la7);
    const b0 = envelope.moldMin.getComponent(lb7), b1 = eMax.getComponent(lb7);
    const m = Math.min(a1 - a0, b1 - b0) * 0.08;
    const depth = Math.max(0.6, Math.min(1.2, wallThickness * 0.25));
    if (r7.volumeLabel && !options.formFit) {
      // Band along the lower edge of the top face, clear of the sprue.
      topResult = engraveText(wasm, topResult, r7.volumeLabel, {
        axis, side: 'top', face: eMax.getComponent(pi7), a0: a0 + m, a1: a1 - m,
        b0: b0 + m, b1: b0 + m + (b1 - b0) * 0.18, depth,
      });
    }
    if (r7.watermark && !options.formFit) {
      bottomResult = engraveText(wasm, bottomResult, r7.watermark, {
        axis, side: 'bottom', face: envelope.moldMin.getComponent(pi7), a0: a0 + m * 2.5, a1: a1 - m * 2.5,
        b0: (b0 + b1) / 2 - (b1 - b0) * 0.12, b1: (b0 + b1) / 2 + (b1 - b0) * 0.12, depth,
      });
    }
    if (r7.moldFeet && !r6.standFins && !options.formFit) {
      const feet = buildFeet(wasm, { axis, envMin: envelope.moldMin, envMax: eMax });
      if (feet) bottomResult = bottomResult.add(feet);
    }
  }
  let pieces: any[] = [topResult, bottomResult];

  // Pry pockets (Tier 2) on the primary parting line.
  if (extras.pryPockets && !curved) {
    pieces = applyPryPockets(wasm, pieces, {
      axis, envMin: envelope.moldMin, envSize: envelope.moldSize, splitPos, wallThickness,
    });
  }

  if ((r7.pieceCount === 3 || r7.pieceCount === 4) && !curved && cutAngle === 0) {
    pieces = splitIntoParts(pieces, {
      axis, envMin: envelope.moldMin, envMax: envelope.moldMin.clone().add(envelope.moldSize), count: r7.pieceCount,
    });
  }

  if (options.additionalPlanes && options.additionalPlanes.length > 0) {
    for (const plane of options.additionalPlanes) {
      const planeAngle = ENABLE_OBLIQUE_PLANES ? clampCutAngle(plane.cutAngle ?? 0) : 0;
      const planeEq = getPlaneEquation(
        [bboxMin.x, bboxMin.y, bboxMin.z],
        [bboxMax.x, bboxMax.y, bboxMax.z],
        plane.axis, plane.offset, planeAngle,
      );

      const next: any[] = [];
      for (const piece of pieces) {
        const [above, below] = piece.splitByPlane(
          planeEq.normal as [number, number, number],
          planeEq.originOffset,
        );
        // splitByPlane always returns two manifolds. When the plane misses
        // the piece entirely, one of them is empty (zero triangles). We
        // skip empties — they'd serialize as zero-vertex BufferGeometries
        // and render as nothing, which is a far worse UX than just keeping
        // the original piece intact when the plane doesn't bisect it.
        const aboveMesh = above.getMesh();
        const belowMesh = below.getMesh();
        if (aboveMesh.triVerts.length > 0) next.push(above);
        if (belowMesh.triVerts.length > 0) next.push(below);

        // Defensive: if BOTH sides came back empty (shouldn't happen for a
        // non-empty input but Manifold can produce surprises on degenerate
        // inputs), keep the original piece so we don't silently drop it.
        if (aboveMesh.triVerts.length === 0 && belowMesh.triVerts.length === 0) {
          next.push(piece);
        }
      }
      pieces = next;
    }
  }

  // Convert all pieces to BufferGeometries. manifoldToGeometry throws an
  // EmptyManifoldError for zero-tri inputs — but we filtered those above,
  // so any throw here is a real failure (e.g. CSG collapsed the primary
  // halves) that should propagate.
  // Radial split (Tier 2): wedge every piece around the parting axis.
  const radial = extras.radialSegments ?? 0;
  if (radial >= 3) {
    const center = new THREE.Vector3().copy(envelope.moldMin).addScaledVector(envelope.moldSize, 0.5);
    pieces = applyRadialSplit(pieces, { axis, center, segments: radial }).pieces;
  }

  pieces = pieces.filter(p => !p.isEmpty());
  if (hollow) pieces.push(hollow.core);
  const pieceGeos = pieces.map(p => manifoldToGeometry(p));

  return { pieces: pieceGeos, repairs };
}

/**
 * Auto-detect the best parting plane by analyzing the geometry.
 *
 * Scoring philosophy (changed 2026-05: undercut-aware).
 * Experienced mold-makers choose a parting plane primarily to AVOID
 * undercuts — geometry that locks the part into the mold so you physically
 * can't pull it out without destroying the part or the mold. A perfectly
 * balanced 50/50 split through a shape with lock-in is worse than a lopsided
 * split that demolds cleanly. So the TRUE-undercut fraction is a heavily-
 * weighted PENALTY; balance, centeredness, axis preference, and extent only
 * decide between planes of similar demoldability.
 *
 * "True undercut" here means draftAnalysis.undercutFraction — faces pointing
 * back toward the mold (score < 0), NOT the vertical silhouette walls that
 * every convex shape has. That distinction matters: using the heatmap's red
 * bucket (which includes silhouette walls) would penalize convex shapes for
 * their unavoidable parting-line edges and pick bizarre thin-axis splits.
 * For a convex part undercutFraction is 0 on every axis, so scoring cleanly
 * falls back to the original balance/extent heuristic.
 *
 * Cost: O(candidates × triangles). 57 candidates (3 axes × 19 offsets) each
 * do one full face-classification pass. This runs on a button click, not a
 * slider drag, so a few hundred ms on a large mesh is acceptable.
 *
 * Pure function — no CSG, no WASM. Fast enough to stay on the main thread.
 */
export async function autoDetectPlane(
  geometry: THREE.BufferGeometry,
): Promise<{ axis: Axis; offset: number }> {
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox!;
  const bboxSize = new THREE.Vector3();
  bbox.getSize(bboxSize);

  const positions = geometry.attributes.position.array;
  const vertCount = positions.length / 3;

  let bestAxis: Axis = 'z';
  let bestOffset = 0.5;
  let bestScore = -Infinity;

  const axes: Axis[] = ['x', 'y', 'z'];
  const steps = 20;

  for (const axis of axes) {
    const axisIdx = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
    const min = bbox.min.getComponent(axisIdx);
    const max = bbox.max.getComponent(axisIdx);
    const range = max - min;

    for (let s = 1; s < steps; s++) {
      const offset = s / steps;
      const splitVal = min + range * offset;

      // Count vertices above and below
      let above = 0;
      let below = 0;
      for (let i = 0; i < vertCount; i++) {
        const v = positions[i * 3 + axisIdx];
        if (v >= splitVal) above++;
        else below++;
      }

      // ── True-undercut analysis (the dominant signal) ──
      // Fraction of faces that genuinely lock the part into this mold half
      // (score < 0 — pointing back toward the mold). Excludes vertical
      // silhouette walls. 0 for any convex shape, so convex parts fall back
      // to the balance/extent heuristic below. cutAngle=0 here: auto-detect
      // only proposes axis-aligned planes; the user tilts afterward with the
      // Cut Angle slider.
      const undercut = undercutFraction(geometry, axis, offset, bbox, 0);

      // Balance (50/50 split is ideal) — a tie-breaker, not the driver.
      const total = above + below;
      const balance = 1 - Math.abs(above - below) / total;

      // Penalize extreme positions
      const centeredness = 1 - Math.abs(offset - 0.5) * 2;

      // Slight preference for Z axis (conventional mold orientation)
      const axisPref = axis === 'z' ? 0.05 : 0;

      // Prefer the axis with the largest extent (more room for the mold)
      const extentNorm = range / Math.max(bboxSize.x, bboxSize.y, bboxSize.z);

      // The undercut PENALTY dominates at weight 3.0: even a few percent of
      // locking faces (0.03 × 3 = 0.09) outweighs the whole base heuristic
      // (balance + centeredness + axisPref + extent sum to <1.0 and are
      // typically near-equal across axes for a given shape). This makes
      // lock-in avoidance the deciding factor whenever it's present, while
      // leaving convex shapes (undercut=0) to the original balance logic.
      const base =
        balance * 0.6 +
        centeredness * 0.2 +
        axisPref +
        extentNorm * 0.15;
      const score = base - undercut * 3.0;

      if (score > bestScore) {
        bestScore = score;
        bestAxis = axis;
        bestOffset = offset;
      }
    }
  }

  return { axis: bestAxis, offset: bestOffset };
}
