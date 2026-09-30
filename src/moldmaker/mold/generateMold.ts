// Sirpam 3D Labs Mold — rigid mold builder.
//
// Pipeline (every step is a Manifold boolean, so pieces are always solids):
//   1. clean the model (drop broken triangles, optionally close holes)
//   2. shell: a block (box / rounded / cylinder) or a hug shell that follows
//      the model, minus the model → hollow shell
//   3. split the shell into two halves on the split plane (or a curved seam)
//   4. seal: tongue & groove, or alignment locks (pins/sockets, magnets…)
//   5. pour hole and air vents drilled through the upper half
//   6. optional extras: engraving, feet, pry slots, extra splits
// Anything that has to be skipped or swapped adds a plain-language notice.
/* eslint-disable @typescript-eslint/no-explicit-any -- Manifold wasm handles */
import * as THREE from 'three';
import type { Axis, MoldBoxShape } from '../types';
import {
  WALL_THICKNESS_RATIO, CLEARANCE_MM, PIN_RADIUS_RATIO, PIN_HEIGHT_RATIO,
  SPRUE_TOP_MULTIPLIER, VENT_RADIUS_RATIO, VENT_TAPER_RATIO, ENABLE_OBLIQUE_PLANES,
  suggestedSprueDiameterMm,
} from './constants';
import { clampCutAngle, getPlaneEquation } from './planeGeometry';
import { getManifold, geometryToManifold, manifoldToGeometry } from './manifoldBridge';
import { validateMesh, type MeshRepairLog } from './validateMesh';
import { undercutFraction } from './draftAnalysis';
import { capOpenBoundaries } from './capOpenBoundaries';
import {
  getRegistrationPinPositionsForEnvelope, getRotationForAxis, computeChannelPositionsForEnvelope,
} from './channelPlacement';
import { computeMoldEnvelope, createMoldBoxManifold, primaryAxisIndex, lateralAxisIndices, type MoldEnvelope } from './moldBox';
import { envelopeAroundManifold, offsetOutwardEx } from './moldOffset';
import { buildPartingFlange, planHugLocks, flangeBoltCutters } from './formFitLocks';
import {
  type MoldExtras, applyTongueGroove, applyPryPockets, applyRadialSplit, lateralToWorld,
  buildHollowCore, buildRunners,
} from './moldFeatures';
import {
  type Round6Extras, buildCurvedSplit, applyClampWings, buildStandFins, trappedAirPoints,
  axialCylinder, buildStyleMold,
} from './proFeatures';
import { buildGapFiller, buildFeet, engraveText, splitIntoParts, type Round7Extras } from './round7';

export interface GenerateMoldOptions {
  /** Wall as a fraction of the model's largest side (ignored if extras.wallMm is set). */
  wallThicknessRatio?: number;
  clearanceMm?: number;
  sprueDiameterMm?: number;
  moldBoxShape?: MoldBoxShape;
  /** Split tilt in degrees. */
  cutAngle?: number;
  /** Manual pour-hole position on the two lateral axes. */
  sprueOverride?: { a: number; b: number };
  /** Further flat cuts applied to every piece after the main split. */
  additionalPlanes?: Array<{ axis: Axis; offset: number; cutAngle?: number }>;
  /** Close open holes first (hollow vessels). */
  isHollow?: boolean;
  /** Hug shell that follows the model instead of a block. */
  formFit?: boolean;
  extras?: MoldExtras;
}

export interface GenerateMoldResult {
  pieces: THREE.BufferGeometry[];
  repairs: MeshRepairLog;
  labels?: string[];
  notices?: string[];
}

type Solid = any;
type P3 = [number, number, number];

/** Turn a Manifold import failure into advice the user can act on. */
function importError(e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e);
  if (/table index|out of bounds/i.test(msg)) {
    return new Error('The model has overlapping or tangled faces. Use "Repair broken model" in the Model step, or fix it in Blender or Meshmixer.');
  }
  if (/manifold/i.test(msg)) {
    return new Error('The model has holes or edges shared by more than two faces. Use "Repair broken model" in the Model step, or run Mesh > Clean Up in Blender.');
  }
  return new Error('The model is not a closed solid, so a mold cannot be cut from it.');
}

export async function generateMold(
  geometry: THREE.BufferGeometry,
  boundingBox: THREE.Box3,
  axis: Axis,
  offset: number,
  options: GenerateMoldOptions = {},
): Promise<GenerateMoldResult> {
  const wasm = await getManifold();
  const { Manifold } = wasm;
  const extras: MoldExtras = options.extras ?? {};
  const r6: Round6Extras = extras;
  const r7: Round7Extras = extras;
  const notices: string[] = [];

  const clearance = options.clearanceMm ?? CLEARANCE_MM;
  const cutAngle = ENABLE_OBLIQUE_PLANES ? clampCutAngle(options.cutAngle ?? 0) : 0;
  const size = boundingBox.getSize(new THREE.Vector3());
  if (!(size.x > 0 && size.y > 0 && size.z > 0)) {
    throw new Error(`This model is flat in at least one direction (${size.x} × ${size.y} × ${size.z}), so it can't be molded.`);
  }
  // 0/omitted = auto: size the pour hole to the model, like a shop would.
  const sprueDiameter = options.sprueDiameterMm && options.sprueDiameterMm > 0
    ? options.sprueDiameterMm
    : suggestedSprueDiameterMm(Math.max(size.x, size.y, size.z));
  const p = primaryAxisIndex(axis);
  const [la, lb] = lateralAxisIndices(axis);
  const lo = boundingBox.min.getComponent(p);
  const splitPos = lo + (boundingBox.max.getComponent(p) - lo) * offset;
  const wall = extras.wallMm && extras.wallMm > 0
    ? extras.wallMm
    : Math.max(size.x, size.y, size.z) * (options.wallThicknessRatio ?? WALL_THICKNESS_RATIO);
  const box3 = (b: THREE.Box3): [P3, P3] => [[b.min.x, b.min.y, b.min.z], [b.max.x, b.max.y, b.max.z]];

  // ── 1. Clean model ──
  const { geometry: cleaned, repairs } = validateMesh(geometry);
  let clean = cleaned;
  if (options.isHollow) {
    const cap = capOpenBoundaries(clean);
    repairs.closedHoles = cap.holesClosed;
    clean = cap.geometry;
  }
  let model: Solid;
  try { model = geometryToManifold(wasm, clean); } catch (e) { throw importError(e); }

  // Special mold styles (relief, press, slip-cast) have their own builder.
  if (r6.style && r6.style !== 'standard') {
    const pos = clean.getAttribute('position').array as ArrayLike<number>;
    let top = -Infinity, ta = 0, tb = 0;
    for (let i = 0; i < pos.length; i += 3) {
      if (pos[i + p]! > top) { top = pos[i + p]!; ta = pos[i + la]!; tb = pos[i + lb]!; }
    }
    const res = buildStyleMold(wasm, r6.style, model, boundingBox, axis, wall, { a: ta, b: tb });
    return { pieces: res.pieces.map((s: Solid) => manifoldToGeometry(s)), repairs, labels: res.labels };
  }

  // ── 2. Shell ──
  let env: MoldEnvelope = computeMoldEnvelope(boundingBox, options.moldBoxShape ?? 'rect', axis, wall);
  let shell: Solid;
  let cavityCut: Solid = model;
  let flangeBuilt = false;
  if (options.formFit) {
    const inner = offsetOutwardEx(wasm, model, clearance, boundingBox);
    const cavity = inner.method === 'exact' ? inner.solid : model;
    const outer = offsetOutwardEx(wasm, model, clearance + wall, boundingBox);
    if (outer.method === 'scaled' && model.numTri?.() > 20000) {
      notices.push('This model is very detailed, so the form-fit wall was sized by stretching the model. Wall thickness may vary; check thin spots before printing.');
    }
    env = envelopeAroundManifold(outer.solid, axis, wall);
    shell = outer.solid.subtract(cavity);
    cavityCut = cavity;
    if (wall < 2.4) {
      notices.push(`The form-fit wall is ${wall.toFixed(1)} mm. Below about 2.4 mm, filament-printed hug molds can crack or leak; consider a thicker wall.`);
    }
    if ((extras.flangeMm ?? 0) > 0) {
      const canFlange = cutAngle === 0 && !r6.curvedSplit;
      const flange = canFlange
        ? buildPartingFlange(wasm, outer.solid, axis, splitPos, extras.flangeMm!, Math.max(6, wall * 2))
        : null;
      if (flange) { shell = shell.add(flange); flangeBuilt = true; }
      else notices.push(canFlange
        ? 'The parting flange could not be built for this shape, so it was left off.'
        : 'The parting flange needs a flat, untilted split, so it was left off.');
    }
  } else {
    const filler = r7.gapFiller ? buildGapFiller(wasm, clean, axis, boundingBox) : null;
    if (filler) cavityCut = model.add(filler);
    shell = createMoldBoxManifold(wasm, env).subtract(cavityCut);
  }
  const envMax = env.moldMin.clone().add(env.moldSize);

  // ── 3. Split ──
  const curved = r6.curvedSplit && cutAngle === 0
    ? buildCurvedSplit(wasm, clean, axis, env.moldMin, envMax.clone(), splitPos, wall)
    : null;
  let top: Solid, bottom: Solid;
  if (curved) {
    top = shell.intersect(curved.cutter);
    bottom = shell.subtract(curved.cutter);
  } else {
    const plane = getPlaneEquation(...box3(boundingBox), axis, offset, cutAngle);
    [top, bottom] = shell.splitByPlane(plane.normal as P3, plane.originOffset);
  }
  const flat = !curved && cutAngle === 0;

  // ── 4. Seal / locks ──
  let sealed = !!curved;
  if (extras.seal === 'tongueGroove') {
    if (flat && !options.formFit) {
      const tg = applyTongueGroove(wasm, top, bottom, {
        axis, cavityBox: boundingBox.clone().expandByScalar(clearance),
        envMin: env.moldMin, envSize: env.moldSize, splitPos, wallThickness: wall, clearance,
      });
      if (tg) { [top, bottom] = tg; sealed = true; }
      else notices.push('Tongue & groove could not be built around this cavity (the wall is too thin at the split), so keyed pins were used instead.');
    } else {
      notices.push(curved
        ? 'Tongue & groove is not used with the curved split: the halves nest into each other and align themselves.'
        : cutAngle !== 0
          ? 'Tongue & groove needs a flat, untilted split, so keyed pins were used instead.'
          : 'Tongue & groove needs a box shell, not a form-fit shell, so keyed pins were used instead.');
    }
  }

  const pinHeight = wall * PIN_HEIGHT_RATIO;
  const lockStyle = extras.lockStyle ?? 'round';
  let lockR = extras.lockDiameterMm && extras.lockDiameterMm > 0
    ? Math.min(extras.lockDiameterMm / 2, lockStyle === 'magnet' ? wall * 0.45 + 2 : wall * 0.4)
    : wall * PIN_RADIUS_RATIO;
  const corners = getRegistrationPinPositionsForEnvelope(env, boundingBox, splitPos, cutAngle);
  let locks: P3[] = extras.lockCount === 2
    ? [corners[0], corners[env.shape === 'cylinder' ? 2 : 3]].filter((q): q is P3 => !!q)
    : corners;
  const centre = boundingBox.getCenter(new THREE.Vector3());
  const lateralCentre = { a: centre.getComponent(la), b: centre.getComponent(lb) };

  if (options.formFit && !sealed) {
    if (cutAngle === 0) {
      const plan = planHugLocks(wasm, shell, axis, splitPos, lateralCentre, lockR, clearance,
        extras.lockCount === 2 ? 2 : 4, pinHeight,
        { square: lockStyle === 'square', magnet: lockStyle === 'magnet' });
      lockR = plan.lockR;
      for (const pad of plan.pads) {
        const q = pad.at;
        const up = axialCylinder(wasm, axis, q[la]!, q[lb]!, splitPos, splitPos + pad.halfHeight, pad.r, pad.r, 32);
        const dn = axialCylinder(wasm, axis, q[la]!, q[lb]!, splitPos - pad.halfHeight, splitPos, pad.r, pad.r, 32);
        if (up) top = top.add(up.subtract(cavityCut));
        if (dn) bottom = bottom.add(dn.subtract(cavityCut));
      }
      notices.push(...plan.notices);
      locks = plan.positions as P3[];
      if (flangeBuilt && (extras.flangeBoltMm ?? 0) > 0) {
        const holes = flangeBoltCutters(wasm, shell, axis, splitPos, lateralCentre, extras.flangeBoltMm!, Math.max(6, wall * 2), 4);
        for (const h of holes) { top = top.subtract(h); bottom = bottom.subtract(h); }
        if (holes.length < 4) notices.push(`Only ${holes.length} of 4 bolt holes fit in the flange. Make the flange wider for more.`);
      }
    } else {
      locks = [];
      notices.push('Locks on a form-fit shell need a flat, untilted split, so this mold has none. Set the tilt to 0 or use a box shell.');
    }
  }

  const rot = getRotationForAxis(axis);
  for (const at of sealed ? [] : locks) {
    if (lockStyle === 'magnet' && cutAngle === 0) {
      // Matching 3 mm-deep pockets in both halves for press-fit magnets.
      const depth = 3.2, r = lockR + 0.1;
      const up = axialCylinder(wasm, axis, at[la]!, at[lb]!, splitPos, splitPos + depth, r, r, 32);
      const dn = axialCylinder(wasm, axis, at[la]!, at[lb]!, splitPos - depth, splitPos, r, r, 32);
      if (up) top = top.subtract(up);
      if (dn) bottom = bottom.subtract(dn);
      continue;
    }
    const h = pinHeight, c = clearance;
    let pin: Solid, socket: Solid;
    if (lockStyle === 'cone') {
      pin = Manifold.cylinder(h, lockR * 0.45, lockR, 24, true);
      socket = Manifold.cylinder(h + 2 * c, lockR * 0.45 + c, lockR + c, 24, true);
    } else if (lockStyle === 'square') {
      pin = Manifold.cube([2 * lockR, 2 * lockR, h], true);
      socket = Manifold.cube([2 * (lockR + c), 2 * (lockR + c), h + 2 * c], true);
    } else {
      pin = Manifold.cylinder(h, lockR, lockR, 16, true);
      socket = Manifold.cylinder(h + 2 * c, lockR + c, lockR + c, 16, true);
    }
    top = top.add(pin.rotate(rot).translate(at));
    bottom = bottom.subtract(socket.rotate(rot).translate(at));
  }

  if (flat && r6.clampBoltMm) {
    [top, bottom] = applyClampWings(wasm, top, bottom, {
      axis, envMin: env.moldMin, envMax, splitPos, wall, boltMm: r6.clampBoltMm, cavityCut,
      ...(r6.clampLands ? { lands: true } : {}),
    });
  }
  if (flat && r6.standFins) {
    const fins = buildStandFins(wasm, { axis, envMin: env.moldMin, envMax, splitPos, wall, cavityCut });
    if (fins) bottom = bottom.add(fins);
  }

  // ── 5. Pour hole and vents ──
  const mouthR = Math.max(sprueDiameter / 2, 1);
  const gateR = mouthR / SPRUE_TOP_MULTIPLIER;
  const ventR = extras.ventDiameterMm && extras.ventDiameterMm > 0 ? extras.ventDiameterMm / 2 : gateR * VENT_RADIUS_RATIO;
  const cavities = extras.cavityCenters ?? [];
  const hollow = extras.hollowCore && cavities.length <= 1
    ? buildHollowCore(wasm, {
        model, axis, envMin: env.moldMin, envSize: env.moldSize,
        wallMm: extras.hollowCore.wallMm, opening: extras.hollowCore.opening,
        flangeMm: Math.max(2, wall * 0.5),
      })
    : null;
  const useRunner = !!extras.runner && cavities.length > 1;
  const hub = {
    a: cavities.reduce((s, c) => s + c.a, 0) / Math.max(1, cavities.length),
    b: cavities.reduce((s, c) => s + c.b, 0) / Math.max(1, cavities.length),
  };
  const sprueAt = hollow ? hollow.sprueLateral
    : cavities.length > 1 ? (useRunner ? hub : cavities[0])
    : options.sprueOverride;
  const ch = computeChannelPositionsForEnvelope(
    env, boundingBox, splitPos, geometry,
    { sprueMargin: mouthR + wall * 0.5, ventMargin: ventR + wall * 0.3 },
    cutAngle, sprueAt ? { sprueOverride: sprueAt } : {},
  );

  // Skip channels if the split sits so close to the top there's no wall to drill.
  if (ch.sprueHeight >= wall * 0.25) {
    const drill = (s: Solid) => { top = top.subtract(s); if (curved) bottom = bottom.subtract(s); };
    drill(Manifold.cylinder(ch.sprueHeight, gateR, mouthR, 24).rotate(ch.rotation).translate(ch.spruePos));
    if (extras.ventCount !== undefined) ch.ventPositions = ch.ventPositions.slice(0, Math.max(0, extras.ventCount));
    for (const v of ch.ventPositions) {
      drill(Manifold.cylinder(ch.sprueHeight, ventR, ventR * VENT_TAPER_RATIO, 12).rotate(ch.rotation).translate(v));
    }
    if (curved) {
      // Carry each channel down through the curved seam to the flat split.
      const links: Array<[P3, number]> = [[ch.spruePos, gateR], ...ch.ventPositions.map(v => [v, ventR] as [P3, number])];
      for (const [q, r] of links) {
        const link = axialCylinder(wasm, axis, q[la]!, q[lb]!, curved.heightAt(q[la]!, q[lb]!), splitPos, r, r, 16);
        if (link) { top = top.subtract(link); bottom = bottom.subtract(link); }
      }
    }
    for (const c of useRunner ? [] : cavities.slice(1)) {
      const q = lateralToWorld(axis, c.a, c.b, ch.spruePos[p]);
      top = top.subtract(Manifold.cylinder(ch.sprueHeight, gateR, mouthR, 24).rotate(ch.rotation).translate(q));
    }
  }
  if (r6.autoVents) {
    const pts = trappedAirPoints(geometry, axis, boundingBox, [[ch.spruePos[la]!, ch.spruePos[lb]!]], mouthR * 3);
    const roof = envMax.getComponent(p) + 1;
    const r = Math.max(0.75, ventR);
    for (const q of pts) {
      const v = axialCylinder(wasm, axis, q.a, q.b, q.p - 0.3, roof, r, r * 1.3, 12);
      if (v) { top = top.subtract(v); bottom = bottom.subtract(v); }
    }
  }
  if (useRunner) {
    const runners = buildRunners(wasm, { axis, hub, centers: cavities, splitPos, radius: Math.max(1.5, gateR) });
    if (runners) { top = top.subtract(runners); bottom = bottom.subtract(runners); }
  }
  if (hollow) { top = top.subtract(hollow.column); bottom = bottom.subtract(hollow.column); }
  let corePin: Solid | null = null;
  if ((extras.corePinMm ?? 0) > 0) {
    const r = extras.corePinMm! / 2;
    const lo = env.moldMin.getComponent(p) - 1, hi = envMax.getComponent(p) + 1;
    const hole = axialCylinder(wasm, axis, lateralCentre.a, lateralCentre.b, lo, hi, r + clearance, r + clearance, 32);
    const pin = axialCylinder(wasm, axis, lateralCentre.a, lateralCentre.b, lo - 2, hi + 2, r, r, 32);
    if (hole && pin) {
      top = top.subtract(hole); bottom = bottom.subtract(hole); corePin = pin;
      notices.push(`A ${extras.corePinMm} mm core pin was added as its own piece. Push it through both halves before pouring and pull it out after — the cast gets a through-hole.`);
    }
  }

  // ── 6. Extras ──
  if (cutAngle === 0 && (r7.moldFeet || r7.volumeLabel || r7.watermark)) {
    if (options.formFit) {
      const off = [r7.volumeLabel && 'volume label', r7.watermark && 'watermark', r7.moldFeet && !r6.standFins && 'mold feet'].filter(Boolean);
      if (off.length) notices.push(`The ${off.join(', ')} ${off.length > 1 ? 'need' : 'needs'} a box shell, so ${off.length > 1 ? 'they were' : 'it was'} left off this form-fit mold.`);
    } else {
      const a0 = env.moldMin.getComponent(la), a1 = envMax.getComponent(la);
      const b0 = env.moldMin.getComponent(lb), b1 = envMax.getComponent(lb);
      const m = Math.min(a1 - a0, b1 - b0) * 0.08;
      const depth = Math.max(0.6, Math.min(1.2, wall * 0.25));
      if (r7.volumeLabel) {
        top = engraveText(wasm, top, r7.volumeLabel, {
          axis, side: 'top', face: envMax.getComponent(p), a0: a0 + m, a1: a1 - m,
          b0: b0 + m, b1: b0 + m + (b1 - b0) * 0.18, depth,
        });
      }
      if (r7.watermark) {
        const mid = (b0 + b1) / 2, half = (b1 - b0) * 0.12;
        bottom = engraveText(wasm, bottom, r7.watermark, {
          axis, side: 'bottom', face: env.moldMin.getComponent(p), a0: a0 + m * 2.5, a1: a1 - m * 2.5,
          b0: mid - half, b1: mid + half, depth,
        });
      }
      if (r7.moldFeet && !r6.standFins) {
        const feet = buildFeet(wasm, { axis, envMin: env.moldMin, envMax });
        if (feet) bottom = bottom.add(feet);
      }
    }
  }

  let pieces: Solid[] = [top, bottom];
  if (extras.pryPockets && !curved) {
    pieces = applyPryPockets(wasm, pieces, { axis, envMin: env.moldMin, envSize: env.moldSize, splitPos, wallThickness: wall });
  }
  if ((r7.pieceCount === 3 || r7.pieceCount === 4) && flat) {
    pieces = splitIntoParts(pieces, { axis, envMin: env.moldMin, envMax, count: r7.pieceCount });
  }
  for (const extra of options.additionalPlanes ?? []) {
    const angle = ENABLE_OBLIQUE_PLANES ? clampCutAngle(extra.cutAngle ?? 0) : 0;
    const eq = getPlaneEquation(...box3(boundingBox), extra.axis, extra.offset, angle);
    pieces = pieces.flatMap(piece => {
      const halves = piece.splitByPlane(eq.normal as P3, eq.originOffset).filter((h: Solid) => !h.isEmpty());
      return halves.length ? halves : [piece];
    });
  }
  if ((extras.radialSegments ?? 0) >= 3) {
    const center = env.moldMin.clone().addScaledVector(env.moldSize, 0.5);
    pieces = applyRadialSplit(pieces, { axis, center, segments: extras.radialSegments! }).pieces;
  }
  pieces = pieces.filter(s => !s.isEmpty());
  if (hollow) pieces.push(hollow.core);
  if (corePin) pieces.push(corePin);

  const out = pieces.map(s => manifoldToGeometry(s));
  return notices.length ? { pieces: out, repairs, notices } : { pieces: out, repairs };
}

/**
 * Quick split suggestion used on model load: try 19 positions on each axis
 * and score balance, centring, a slight preference for Z, and axis length,
 * minus a heavy penalty for undercuts.
 */
export async function autoDetectPlane(geometry: THREE.BufferGeometry): Promise<{ axis: Axis; offset: number }> {
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox!;
  const size = bbox.getSize(new THREE.Vector3());
  const longest = Math.max(size.x, size.y, size.z);
  const pos = geometry.getAttribute('position').array as ArrayLike<number>;
  const n = pos.length / 3;
  let best = { axis: 'z' as Axis, offset: 0.5, score: -Infinity };
  for (const axis of ['x', 'y', 'z'] as Axis[]) {
    const i = primaryAxisIndex(axis);
    const lo = bbox.min.getComponent(i), span = bbox.max.getComponent(i) - lo;
    for (let s = 1; s < 20; s++) {
      const offset = s / 20;
      const cut = lo + span * offset;
      let above = 0;
      for (let v = 0; v < n; v++) if (pos[3 * v + i]! >= cut) above++;
      const balance = 1 - Math.abs(2 * above - n) / n;
      const centred = 1 - Math.abs(offset - 0.5) * 2;
      const score = balance * 0.6 + centred * 0.2 + (axis === 'z' ? 0.05 : 0) + (span / longest) * 0.15
        - undercutFraction(geometry, axis, offset, bbox, 0) * 3;
      if (score > best.score) best = { axis, offset, score };
    }
  }
  return { axis: best.axis, offset: best.offset };
}
