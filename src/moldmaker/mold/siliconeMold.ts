// @ts-nocheck — upstream mold-maker code; type-checked under its own repo tsconfig
import * as THREE from 'three';
import type { Axis, MoldBoxShape, SiliconeMoldType } from '../types';
import {
  WALL_THICKNESS_RATIO,
  CLEARANCE_MM,
  SPRUE_DIAMETER_MM,
  PIN_RADIUS_RATIO,
  PIN_HEIGHT_RATIO,
  ENABLE_OBLIQUE_PLANES,
} from './constants';
import { clampCutAngle, getPlaneEquation } from './planeGeometry';
import { getManifold, geometryToManifold, manifoldToGeometry } from './manifoldBridge';
import { validateMesh, type MeshRepairLog } from './validateMesh';
import { capOpenBoundaries } from './capOpenBoundaries';
import {
  getRegistrationPinPositionsForEnvelope,
  getRotationForAxis,
} from './channelPlacement';
import {
  computeMoldEnvelope,
  createMoldBoxManifold,
  primaryAxisIndex,
  lateralAxisIndices,
} from './moldBox';
import { envelopeAroundManifold, offsetOutward } from './moldOffset';

/**
 * Silicone mold generation — the three workflows the casting industry
 * actually uses, all driven from the same master model:
 *
 *   • blockOneWay ("one-piece block mold" / open-pour box)
 *       A printed open-top containment box. You glue the master to the
 *       floor, pour silicone over it, let it cure, then cut a single relief
 *       slit to demold. Cheapest and most forgiving; good for shapes with
 *       no deep undercuts and one flat-ish side.
 *
 *   • blockTwoPart ("two-part block mold")
 *       A closed containment box split on the parting plane, with keyed
 *       registration, a pour sprue and air vents. Standard for figures and
 *       parts that need a clean seam on both sides. Silicone is poured in
 *       two stages (or in one, for the box-and-cut variant).
 *
 *   • skinCore ("skin / glove mold with mother mold")
 *       A thin silicone skin of a controlled thickness held by a rigid
 *       two-part mother mold. The mother-mold cavity is the master offset
 *       outwards by the skin thickness, so the gap between master and
 *       shell IS the silicone. Industry standard for large parts where a
 *       solid silicone block would be prohibitively expensive.
 *
 * Every dimension the caster cares about (silicone margin, skin thickness,
 * pour diameter, key clearance) is an absolute millimetre value, matching
 * how silicone datasheets and shop practice are written.
 */

export interface SiliconeMoldOptions {
  type: SiliconeMoldType;
  /** Silicone thickness around the master for block molds, mm. */
  siliconeMarginMm?: number;
  /** Skin thickness for skin/glove molds, mm. */
  skinThicknessMm?: number;
  /** Rigid shell wall thickness, as fraction of max bbox extent. */
  wallThicknessRatio?: number;
  /** Clearance on keys / mating surfaces, mm. */
  clearanceMm?: number;
  /** Pour opening diameter, mm. */
  sprueDiameterMm?: number;
  /** Outer shell silhouette. */
  moldBoxShape?: MoldBoxShape;
  /** Parting-plane tilt, degrees. */
  cutAngle?: number;
  /** Include the printable master/core piece in the output (skin molds). */
  includeCore?: boolean;
  /** Cap open boundary loops before CSG (open vessels). */
  isHollow?: boolean;
  /**
   * Form-fit shell for the block workflows: the containment wall hugs the
   * model (offset outward) instead of being a box/cylinder. Ignored for
   * skinCore — its mother mold already hugs the inflated model.
   */
  formFit?: boolean;
}

export interface SiliconeMoldResult {
  pieces: THREE.BufferGeometry[];
  /** Export filename suffixes, parallel to `pieces`. */
  labels: string[];
  repairs: MeshRepairLog;
  /** Estimated silicone volume in cm³ — what the caster actually buys. */
  siliconeVolumeCm3: number;
}

/** Default silicone wall around a master for a block mold: 10 mm is the
 *  common shop minimum, but never thinner than 8% of the part. */
function defaultMargin(maxExtent: number): number {
  return Math.max(10, maxExtent * 0.08);
}

/** Default skin thickness for glove molds: 5 mm holds detail without
 *  tearing; scaled up a little for big parts. */
function defaultSkin(maxExtent: number): number {
  return Math.max(4, maxExtent * 0.04);
}

/** Axis-aligned cylinder helper: builds along Z, rotates onto `axis`. */
function axialCylinder(
  wasm: any,
  axis: Axis,
  height: number,
  rLow: number,
  rHigh: number,
  segments: number,
  pos: [number, number, number],
) {
  return wasm.Manifold.cylinder(height, rLow, rHigh, segments, true)
    .rotate(getRotationForAxis(axis))
    .translate(pos);
}

function expandedBox(bbox: THREE.Box3, by: number): THREE.Box3 {
  return bbox.clone().expandByScalar(by);
}

function volumeCm3(m: any): number {
  try {
    // Manifold volume is in model units³ (mm³ for these files).
    return Math.max(0, m.volume()) / 1000;
  } catch {
    return 0;
  }
}

export async function generateSiliconeMold(
  geometry: THREE.BufferGeometry,
  boundingBox: THREE.Box3,
  axis: Axis,
  offset: number,
  options: SiliconeMoldOptions,
): Promise<SiliconeMoldResult> {
  const wasm = await getManifold();
  const { Manifold } = wasm;

  const bboxSize = new THREE.Vector3();
  boundingBox.getSize(bboxSize);
  if (bboxSize.x <= 0 || bboxSize.y <= 0 || bboxSize.z <= 0) {
    throw new Error(
      'Cannot generate silicone mold: the model bounding box is degenerate ' +
      '(flat or malformed geometry).',
    );
  }

  const maxExtent = Math.max(bboxSize.x, bboxSize.y, bboxSize.z);
  const wallThickness = maxExtent * (options.wallThicknessRatio ?? WALL_THICKNESS_RATIO);
  const clearance = options.clearanceMm ?? CLEARANCE_MM;
  const sprueRadius = Math.max((options.sprueDiameterMm ?? SPRUE_DIAMETER_MM) / 2, 1.5);
  const shape: MoldBoxShape = options.moldBoxShape ?? 'rect';
  const cutAngle = ENABLE_OBLIQUE_PLANES ? clampCutAngle(options.cutAngle ?? 0) : 0;

  // ── Pre-flight mesh cleanup, identical contract to the rigid pipeline ──
  const validated = validateMesh(geometry);
  const repairs = validated.repairs;
  let cleanGeometry = validated.geometry;
  if (options.isHollow) {
    const capped = capOpenBoundaries(cleanGeometry);
    repairs.closedHoles = capped.holesClosed;
    cleanGeometry = capped.geometry;
  }

  let master: any;
  try {
    master = geometryToManifold(wasm, cleanGeometry);
  } catch (e) {
    console.error('Failed to create manifold from geometry:', e);
    throw new Error(
      'Could not convert the model to a solid. It may not be watertight — ' +
      'repair it in Blender (Mesh > Clean Up) and try again.',
    );
  }

  const primary = primaryAxisIndex(axis);
  const [latA, latB] = lateralAxisIndices(axis);

  const pieces: any[] = [];
  const labels: string[] = [];
  let siliconeVolumeCm3 = 0;

  /** Drill the pour sprue and two vents down through the top face. */
  const addPourSystem = (solid: any, env: any, cavityBox: THREE.Box3) => {
    const outerTop = env.moldMin.getComponent(primary) + env.moldSize.getComponent(primary);
    const holeHeight = wallThickness * 6;
    const center = new THREE.Vector3();
    cavityBox.getCenter(center);

    const spruePos: [number, number, number] = [0, 0, 0];
    spruePos[primary] = outerTop - holeHeight / 2 + wallThickness;
    spruePos[latA] = center.getComponent(latA);
    spruePos[latB] = center.getComponent(latB);

    let out = solid.subtract(
      axialCylinder(wasm, axis, holeHeight, sprueRadius * 0.7, sprueRadius, 24, spruePos),
    );

    // Two vents at opposite lateral corners of the cavity — air escapes at
    // the extremities last, so that's where they belong.
    const ventR = Math.max(sprueRadius * 0.25, 0.8);
    const inset = wallThickness * 0.6;
    const corners: Array<[number, number]> = [
      [cavityBox.min.getComponent(latA) + inset, cavityBox.min.getComponent(latB) + inset],
      [cavityBox.max.getComponent(latA) - inset, cavityBox.max.getComponent(latB) - inset],
    ];
    for (const [a, b] of corners) {
      const p: [number, number, number] = [0, 0, 0];
      p[primary] = spruePos[primary];
      p[latA] = a;
      p[latB] = b;
      out = out.subtract(axialCylinder(wasm, axis, holeHeight, ventR, ventR * 1.2, 12, p));
    }
    return out;
  };

  /** Split a shell on the parting plane and key the two halves together. */
  const splitAndKey = (solid: any, env: any, refBox: THREE.Box3) => {
    const planeEq = getPlaneEquation(
      [refBox.min.x, refBox.min.y, refBox.min.z],
      [refBox.max.x, refBox.max.y, refBox.max.z],
      axis, offset, cutAngle,
    );
    const [above, below] = solid.splitByPlane(
      planeEq.normal as [number, number, number],
      planeEq.originOffset,
    );

    const splitPos = refBox.min.getComponent(primary) +
      (refBox.max.getComponent(primary) - refBox.min.getComponent(primary)) * offset;
    const pinRadius = wallThickness * PIN_RADIUS_RATIO;
    const pinHeight = wallThickness * PIN_HEIGHT_RATIO;
    const pinPositions = getRegistrationPinPositionsForEnvelope(env, refBox, splitPos, cutAngle);

    let top = above;
    let bottom = below;
    for (const pinPos of pinPositions) {
      top = top.add(
        axialCylinder(wasm, axis, pinHeight, pinRadius, pinRadius, 16, pinPos),
      );
      bottom = bottom.subtract(
        axialCylinder(
          wasm, axis,
          pinHeight + clearance * 2,
          pinRadius + clearance,
          pinRadius + clearance,
          16,
          pinPos,
        ),
      );
    }
    return [top, bottom];
  };

  if (options.type === 'blockOneWay' || options.type === 'blockTwoPart') {
    const margin = options.siliconeMarginMm ?? defaultMargin(maxExtent);

    // Form-fit: cavity and outer wall hug the master via outward offsets
    // instead of an analytic box. The envelope (used only for its AABB by
    // the pour system and split/key helpers) is the outer solid's own bbox.
    let outer: any;
    let cavitySolid: any;
    let cavityBox: THREE.Box3;
    let outerEnv: any;

    if (options.formFit) {
      cavitySolid = offsetOutward(wasm, master, margin, boundingBox);
      outer = offsetOutward(wasm, master, margin + wallThickness, boundingBox);
      cavityBox = expandedBox(boundingBox, margin);
      outerEnv = envelopeAroundManifold(outer, axis, wallThickness);
    } else {
      cavityBox = expandedBox(boundingBox, margin);
      const innerEnv = computeMoldEnvelope(cavityBox, shape, axis, 0);
      outerEnv = computeMoldEnvelope(cavityBox, shape, axis, wallThickness);
      outer = createMoldBoxManifold(wasm, outerEnv);
      cavitySolid = createMoldBoxManifold(wasm, innerEnv);
    }

    // Silicone usage = cavity volume minus the master that displaces it.
    siliconeVolumeCm3 = Math.max(0, volumeCm3(cavitySolid) - volumeCm3(master));

    if (options.type === 'blockOneWay') {
      // Open-top box: extend the cavity out through the top face so the
      // caster can lower the master in and pour. For form-fit the cavity is
      // the offset master, so we union it with a tall slab spanning the
      // cavity's lateral bbox — same "cut the top open" effect for a shell
      // that has no flat top face to extend through.
      let openCavity: any;
      if (options.formFit) {
        const slabMin = cavityBox.min.clone();
        slabMin.setComponent(primary, cavityBox.max.getComponent(primary));
        const slabSize = new THREE.Vector3();
        cavityBox.getSize(slabSize);
        slabSize.setComponent(primary, wallThickness * 6 + margin);
        openCavity = cavitySolid.add(
          Manifold.cube([slabSize.x, slabSize.y, slabSize.z], false)
            .translate([slabMin.x, slabMin.y, slabMin.z]),
        );
      } else {
        const openBox = cavityBox.clone();
        openBox.max.setComponent(
          primary,
          openBox.max.getComponent(primary) + wallThickness * 6,
        );
        openCavity = createMoldBoxManifold(
          wasm,
          computeMoldEnvelope(openBox, shape, axis, 0),
        );
      }
      const shell = outer.subtract(openCavity);
      pieces.push(shell);
      labels.push('pour_box');
    } else {
      // Closed, keyed, split box with a pour sprue and vents.
      let shell = outer.subtract(cavitySolid);
      shell = addPourSystem(shell, outerEnv, cavityBox);
      const [top, bottom] = splitAndKey(shell, outerEnv, cavityBox);
      pieces.push(top, bottom);
      labels.push('box_top', 'box_bottom');
    }
  } else {
    // ── Skin / glove mold with a rigid two-part mother mold ──
    const skin = options.skinThicknessMm ?? defaultSkin(maxExtent);
    const inflated = offsetOutward(wasm, master, skin, boundingBox);

    // Silicone usage = the shell of material between master and offset.
    siliconeVolumeCm3 = Math.max(0, volumeCm3(inflated) - volumeCm3(master));

    const shellBox = expandedBox(boundingBox, skin + wallThickness * 0.5);
    const outerEnv = computeMoldEnvelope(shellBox, shape, axis, wallThickness);
    let mother = createMoldBoxManifold(wasm, outerEnv).subtract(inflated);
    mother = addPourSystem(mother, outerEnv, shellBox);

    const [top, bottom] = splitAndKey(mother, outerEnv, shellBox);
    pieces.push(top, bottom);
    labels.push('mother_top', 'mother_bottom');

    if (options.includeCore !== false) {
      // The master itself, printable as the rigid core the skin is cast on.
      pieces.push(master);
      labels.push('core');
    }
  }

  const pieceGeos = pieces.map(p => manifoldToGeometry(p));
  return { pieces: pieceGeos, labels, repairs, siliconeVolumeCm3 };
}
