// Sirpam 3D Labs Mold — split plane maths.
// A split plane is described as n·p = d. It is chosen by an axis, a position
// along that axis (0..1 of the model's size) and an optional tilt that swings
// the plane around a fixed perpendicular "hinge" axis.
import type { Axis } from '../types';

export const MAX_CUT_ANGLE_DEGREES = 30;

export type Vec3 = readonly [number, number, number];

export interface PlaneEquation {
  /** Unit normal pointing toward the "upper" piece. */
  normal: Vec3;
  /** d in n·p = d. */
  originOffset: number;
}

export interface BboxLike {
  readonly min: { readonly x: number; readonly y: number; readonly z: number };
  readonly max: { readonly x: number; readonly y: number; readonly z: number };
}

const AXIS_INDEX: Record<Axis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };

/** Axis the plane swings around when tilted (x→y, y→z, z→x). */
const HINGE: Record<Axis, Axis> = { x: 'y', y: 'z', z: 'x' };

/**
 * Direction of positive tilt for each axis. Kept fixed so saved projects and
 * the on-screen plane agree: +tilt on Z leans the normal toward -Y, on X
 * toward -Z, on Y toward +X.
 */
const TILT_SIGN: Record<Axis, 1 | -1> = { x: 1, y: -1, z: 1 };

export function hingeAxisFor(axis: Axis): Axis {
  return HINGE[axis];
}

export function clampCutAngle(tiltAngle: number): number {
  if (!Number.isFinite(tiltAngle)) return 0;
  return Math.max(-MAX_CUT_ANGLE_DEGREES, Math.min(MAX_CUT_ANGLE_DEGREES, tiltAngle));
}

/** Rotate a basis vector about a basis axis (right-hand rule). */
function rotateAboutAxis(v: Vec3, about: Axis, rad: number): Vec3 {
  const c = Math.cos(rad), s = Math.sin(rad);
  const [x, y, z] = v;
  if (about === 'x') return [x, c * y - s * z, s * y + c * z];
  if (about === 'y') return [c * x + s * z, y, -s * x + c * z];
  return [c * x - s * y, s * x + c * y, z];
}

export function getPlaneNormal(axis: Axis, tiltAngle = 0): Vec3 {
  const base: [number, number, number] = [0, 0, 0];
  base[AXIS_INDEX[axis]] = 1;
  if (tiltAngle === 0) return base;
  const rad = (TILT_SIGN[axis] * tiltAngle * Math.PI) / 180;
  const r = rotateAboutAxis(base, HINGE[axis], rad);
  // Scrub -0 / 1e-17 noise from exact zero components.
  return r.map(n => (Math.abs(n) < 1e-15 ? 0 : n)) as unknown as Vec3;
}

export function getPlaneEquation(
  bboxMin: Vec3, bboxMax: Vec3, axis: Axis, offset: number, tiltAngle = 0,
): PlaneEquation {
  const i = AXIS_INDEX[axis];
  // The plane pivots about the box centre, moved along the axis to `offset`.
  const pivot: [number, number, number] = [
    (bboxMin[0] + bboxMax[0]) / 2, (bboxMin[1] + bboxMax[1]) / 2, (bboxMin[2] + bboxMax[2]) / 2,
  ];
  pivot[i] = bboxMin[i] + (bboxMax[i] - bboxMin[i]) * offset;
  const normal = getPlaneNormal(axis, clampCutAngle(tiltAngle));
  return { normal, originOffset: dot(normal, pivot) };
}

export function planeFromBox(bbox: BboxLike, axis: Axis, offset: number, tiltAngle = 0): PlaneEquation {
  return getPlaneEquation(
    [bbox.min.x, bbox.min.y, bbox.min.z],
    [bbox.max.x, bbox.max.y, bbox.max.z],
    axis, offset, tiltAngle,
  );
}

/** Positive above the plane (normal side), negative below. */
export function signedDistance(point: Vec3, plane: PlaneEquation): number {
  return dot(plane.normal, point) - plane.originOffset;
}

/**
 * Solve the plane for the coordinate along `axis`, given the other two
 * coordinates of `lateralPoint`. Returns 0 if the plane is (nearly) parallel
 * to the axis, which the tilt cap prevents in practice.
 */
export function primaryAxisValueOnPlane(plane: PlaneEquation, axis: Axis, lateralPoint: Vec3): number {
  const i = AXIS_INDEX[axis];
  const ni = plane.normal[i];
  if (Math.abs(ni) < 1e-9) return 0;
  let rest = 0;
  for (let k = 0; k < 3; k++) if (k !== i) rest += plane.normal[k]! * lateralPoint[k]!;
  return (plane.originOffset - rest) / ni;
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
