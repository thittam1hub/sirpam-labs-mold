// Sirpam 3D Labs Mold — the outer block the cavity is cut into.
// Three shapes: a plain box, a box with rounded vertical edges, and a
// cylinder standing along the split axis. The "envelope" is the block's size
// and position; the Manifold solid is built from it.
import * as THREE from 'three';
import type { Axis, MoldBoxShape } from '../types';
import { PIN_INSET_RATIO } from './constants';

export interface MoldEnvelope {
  shape: MoldBoxShape;
  axis: Axis;
  wallThickness: number;
  /** Minimum corner of the block's bounding box. */
  moldMin: THREE.Vector3;
  /** Size of the block's bounding box. */
  moldSize: THREE.Vector3;
  /** Cylinder only: radius and centre on the two lateral axes. */
  cylinderRadius?: number;
  cylinderCenterLatA?: number;
  cylinderCenterLatB?: number;
  /** Rounded box only: radius of the vertical edges. */
  cornerRadius?: number;
}

const ROUND_SEGMENTS = 64;

export function primaryAxisIndex(axis: Axis): 0 | 1 | 2 {
  return axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
}

/** The two axes perpendicular to `axis`, in cyclic order. */
export function lateralAxisIndices(axis: Axis): [number, number] {
  const i = primaryAxisIndex(axis);
  return [(i + 1) % 3, (i + 2) % 3];
}

/**
 * Edge radius for the rounded box. It must leave room for the alignment
 * pins, which sit PIN_INSET_RATIO of a wall in from the corner, and can't
 * exceed half the narrower side.
 */
export function pickCornerRadius(latSizeA: number, latSizeB: number, wallThickness: number): number {
  const limit = Math.min(Math.min(latSizeA, latSizeB) / 2, wallThickness * (1 - PIN_INSET_RATIO));
  return Math.max(0, limit);
}

export function computeMoldEnvelope(
  bbox: THREE.Box3, shape: MoldBoxShape, axis: Axis, wallThickness: number,
): MoldEnvelope {
  const size = bbox.getSize(new THREE.Vector3());
  const [a, b] = lateralAxisIndices(axis);

  if (shape !== 'cylinder') {
    const pad = new THREE.Vector3(wallThickness, wallThickness, wallThickness);
    const env: MoldEnvelope = {
      shape, axis, wallThickness,
      moldMin: bbox.min.clone().sub(pad),
      moldSize: size.clone().addScaledVector(pad, 2),
    };
    if (shape === 'roundedRect') {
      env.cornerRadius = pickCornerRadius(size.getComponent(a), size.getComponent(b), wallThickness);
    }
    return env;
  }

  // Cylinder: circle around the model's footprint, plus the wall.
  const p = primaryAxisIndex(axis);
  const center = bbox.getCenter(new THREE.Vector3());
  const radius = Math.hypot(size.getComponent(a) / 2, size.getComponent(b) / 2) + wallThickness;
  const moldMin = new THREE.Vector3();
  const moldSize = new THREE.Vector3();
  moldMin.setComponent(p, bbox.min.getComponent(p) - wallThickness);
  moldSize.setComponent(p, size.getComponent(p) + 2 * wallThickness);
  for (const k of [a, b]) {
    moldMin.setComponent(k, center.getComponent(k) - radius);
    moldSize.setComponent(k, 2 * radius);
  }
  return {
    shape, axis, wallThickness, moldMin, moldSize,
    cylinderRadius: radius,
    cylinderCenterLatA: center.getComponent(a),
    cylinderCenterLatB: center.getComponent(b),
  };
}

/**
 * Cross-section width, height and extrusion length when a profile drawn in
 * XY is extruded along Z and then turned to lie along `axis`.
 */
export function csDimsForAxis(axis: Axis, s: THREE.Vector3): { csX: number; csY: number; length: number } {
  if (axis === 'x') return { csX: s.z, csY: s.y, length: s.x };
  if (axis === 'y') return { csX: s.x, csY: s.z, length: s.y };
  return { csX: s.x, csY: s.y, length: s.z };
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- Manifold wasm */
export function createMoldBoxManifold(wasm: any, env: MoldEnvelope): any {
  const { Manifold, CrossSection } = wasm;
  const { moldMin: min, moldSize: size } = env;
  if (env.shape === 'rect') {
    return Manifold.cube([size.x, size.y, size.z], false).translate([min.x, min.y, min.z]);
  }

  // Build centred on the origin along +Z, turn onto the axis, then move.
  const { csX, csY, length } = csDimsForAxis(env.axis, size);
  let solid;
  if (env.shape === 'cylinder') {
    if (env.cylinderRadius === undefined) throw new Error('Cylinder mold needs a radius.');
    solid = Manifold.cylinder(length, env.cylinderRadius, env.cylinderRadius, ROUND_SEGMENTS, true);
  } else {
    if (env.cornerRadius === undefined) throw new Error('Rounded mold needs a corner radius.');
    const r = env.cornerRadius;
    const profile = r > 1e-6
      ? CrossSection.square([Math.max(1e-6, csX - 2 * r), Math.max(1e-6, csY - 2 * r)], true)
          .offset(r, 'Round', 2, ROUND_SEGMENTS)
      : CrossSection.square([csX, csY], true);
    solid = profile.extrude(length).translate([0, 0, -length / 2]);
  }
  if (env.axis === 'x') solid = solid.rotate([0, 90, 0]);
  if (env.axis === 'y') solid = solid.rotate([-90, 0, 0]);
  return solid.translate([min.x + size.x / 2, min.y + size.y / 2, min.z + size.z / 2]);
}
