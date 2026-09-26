// @ts-nocheck — Manifold WASM objects are untyped here, same as generateMold.ts
import * as THREE from 'three';
import type { Axis } from '../types';
import { lateralAxisIndices, primaryAxisIndex } from './moldBox';

/**
 * Tier-2 mold features shared by the rigid and silicone pipelines.
 * Everything here is optional and additive: with `extras` omitted the
 * generators produce byte-identical output to before.
 */
export type SealType = 'pins' | 'tongueGroove';

export interface MoldExtras {
  /** How the two halves register and seal. 'pins' = legacy keyed pins,
   *  'tongueGroove' = continuous perimeter tongue + groove (leak-tight). */
  seal?: SealType;
  /** Cut screwdriver pry slots into the parting line on two sides. */
  pryPockets?: boolean;
  /** Split every piece radially around the parting axis (3, 4 or 6). */
  radialSegments?: 0 | 3 | 4 | 6;
  /** Silicone block molds: per-side silicone thickness (mm, 0 = use uniform). */
  siliconeMargins?: { top: number; bottom: number; sides: number };
  /** Multi-cavity tray: lateral (a,b) centre of every cavity (one sprue each). */
  cavityCenters?: Array<{ a: number; b: number }>;
}

function box(wasm: any, min: THREE.Vector3, max: THREE.Vector3) {
  const s = new THREE.Vector3().subVectors(max, min);
  if (s.x <= 0 || s.y <= 0 || s.z <= 0) return null;
  return wasm.Manifold.cube([s.x, s.y, s.z], false).translate([min.x, min.y, min.z]);
}

/** Rectangular band (ring) in the lateral plane, spanning [p0,p1] on the primary axis. */
function lateralBand(
  wasm: any, axis: Axis,
  innerMin: THREE.Vector3, innerMax: THREE.Vector3, width: number,
  p0: number, p1: number,
) {
  const pi = primaryAxisIndex(axis);
  const oMin = innerMin.clone().subScalar(width);
  const oMax = innerMax.clone().addScalar(width);
  const iMin = innerMin.clone();
  const iMax = innerMax.clone();
  for (const v of [oMin, iMin]) v.setComponent(pi, p0);
  for (const v of [oMax, iMax]) v.setComponent(pi, p1);
  // Inner cutout is taller than the band so the subtraction is clean.
  iMin.setComponent(pi, p0 - 1);
  iMax.setComponent(pi, p1 + 1);
  const outer = box(wasm, oMin, oMax);
  const inner = box(wasm, iMin, iMax);
  if (!outer || !inner) return null;
  return outer.subtract(inner);
}

/**
 * Continuous tongue-and-groove seal. The tongue rides on the top half and
 * drops into a groove in the bottom half, running around the full perimeter
 * inside the shell wall. Industry standard for leak-free two-part molds
 * (resin, silicone and wax); the groove is oversized by `clearance`.
 *
 * Returns null when the wall is too thin to host the seal (caller falls back
 * to pins) — we never let the ring break into the cavity or the outer skin.
 */
export function applyTongueGroove(
  wasm: any,
  top: any, bottom: any,
  opts: {
    axis: Axis;
    cavityBox: THREE.Box3;      // inner (cavity) extent incl. clearance/margin
    envMin: THREE.Vector3; envSize: THREE.Vector3; // outer shell AABB
    splitPos: number;
    wallThickness: number;
    clearance: number;
  },
): [any, any] | null {
  const { axis, cavityBox, envMin, envSize, splitPos, wallThickness, clearance } = opts;
  const [la, lb] = lateralAxisIndices(axis);
  const envMax = envMin.clone().add(envSize);

  // Lateral gap between cavity and outer wall on the tightest side.
  const gap = Math.min(
    cavityBox.min.getComponent(la) - envMin.getComponent(la),
    cavityBox.min.getComponent(lb) - envMin.getComponent(lb),
    envMax.getComponent(la) - cavityBox.max.getComponent(la),
    envMax.getComponent(lb) - cavityBox.max.getComponent(lb),
  );
  const width = Math.max(1.2, gap * 0.3);
  const inset = gap * 0.3;
  if (gap < width + inset + clearance * 2 + 1) return null;

  const innerMin = cavityBox.min.clone().subScalar(inset);
  const innerMax = cavityBox.max.clone().addScalar(inset);
  const h = Math.max(1.5, Math.min(wallThickness * 0.5, width * 1.5));

  const tongue = lateralBand(wasm, axis, innerMin, innerMax, width, splitPos - h, splitPos + 0.01);
  const groove = lateralBand(
    wasm, axis,
    innerMin.clone().subScalar(-clearance), innerMax.clone().addScalar(-clearance),
    width + clearance * 2,
    splitPos - h - clearance, splitPos + 0.01,
  );
  if (!tongue || !groove) return null;
  return [top.add(tongue), bottom.subtract(groove)];
}

/**
 * Pry pockets: small rectangular notches straddling the parting line on two
 * opposite outer faces, so a flat screwdriver can crack the halves apart
 * without gouging the cavity.
 */
export function applyPryPockets(
  wasm: any,
  pieces: any[],
  opts: { axis: Axis; envMin: THREE.Vector3; envSize: THREE.Vector3; splitPos: number; wallThickness: number },
): any[] {
  const { axis, envMin, envSize, splitPos, wallThickness } = opts;
  const pi = primaryAxisIndex(axis);
  const [la, lb] = lateralAxisIndices(axis);
  const depth = Math.max(2, wallThickness * 0.4);
  const width = Math.min(20, Math.max(6, envSize.getComponent(lb) * 0.2));
  const height = Math.max(2, wallThickness * 0.35);
  const midB = envMin.getComponent(lb) + envSize.getComponent(lb) / 2;

  const cutters: any[] = [];
  for (const side of [0, 1]) {
    const min = new THREE.Vector3();
    const max = new THREE.Vector3();
    const faceA = side === 0 ? envMin.getComponent(la) : envMin.getComponent(la) + envSize.getComponent(la);
    min.setComponent(la, side === 0 ? faceA - 1 : faceA - depth);
    max.setComponent(la, side === 0 ? faceA + depth : faceA + 1);
    min.setComponent(lb, midB - width / 2);
    max.setComponent(lb, midB + width / 2);
    min.setComponent(pi, splitPos - height);
    max.setComponent(pi, splitPos + height);
    const c = box(wasm, min, max);
    if (c) cutters.push(c);
  }
  return pieces.map(p => cutters.reduce((acc, c) => acc.subtract(c), p));
}

/** Drop pieces that a cut left empty. */
function nonEmpty(m: any): boolean {
  try { return m.getMesh().triVerts.length > 0; } catch { return false; }
}

/**
 * Radial split: cut every piece into N wedges around the parting axis,
 * centred on the shell. Used for tall/round parts (vases, busts) where a
 * single parting plane cannot release the part. Returns pieces plus a
 * parallel list of suffix indices.
 */
export function applyRadialSplit(
  pieces: any[],
  opts: { axis: Axis; center: THREE.Vector3; segments: number },
): { pieces: any[]; sourceIndex: number[]; segmentIndex: number[] } {
  const { axis, center, segments } = opts;
  const [la, lb] = lateralAxisIndices(axis);
  const out: any[] = [];
  const sourceIndex: number[] = [];
  const segmentIndex: number[] = [];
  const planeFor = (theta: number) => {
    // Normal points to the LEFT of the ray at angle theta.
    const n = [0, 0, 0];
    n[la] = -Math.sin(theta);
    n[lb] = Math.cos(theta);
    const off = n[0] * center.x + n[1] * center.y + n[2] * center.z;
    return { n, off };
  };
  const step = (Math.PI * 2) / segments;
  const start = step / 2; // keep seams off the lateral axes (pins sit there)
  pieces.forEach((piece, pIdx) => {
    for (let i = 0; i < segments; i++) {
      const a = planeFor(start + i * step);
      const b = planeFor(start + (i + 1) * step);
      const [leftOfA] = piece.splitByPlane(a.n, a.off);
      if (!nonEmpty(leftOfA)) continue;
      const [, rightOfB] = leftOfA.splitByPlane(b.n, b.off);
      if (!nonEmpty(rightOfB)) continue;
      out.push(rightOfB);
      sourceIndex.push(pIdx);
      segmentIndex.push(i);
    }
  });
  return { pieces: out, sourceIndex, segmentIndex };
}

/** Asymmetric cavity box for per-side silicone thickness. */
export function asymmetricCavityBox(
  bbox: THREE.Box3, axis: Axis, m: { top: number; bottom: number; sides: number },
): THREE.Box3 {
  const pi = primaryAxisIndex(axis);
  const [la, lb] = lateralAxisIndices(axis);
  const b = bbox.clone();
  for (const i of [la, lb]) {
    b.min.setComponent(i, b.min.getComponent(i) - m.sides);
    b.max.setComponent(i, b.max.getComponent(i) + m.sides);
  }
  b.min.setComponent(pi, b.min.getComponent(pi) - m.bottom);
  b.max.setComponent(pi, b.max.getComponent(pi) + m.top);
  return b;
}

/** Map (a,b) lateral coords to a world position with a fixed primary coordinate. */
export function lateralToWorld(axis: Axis, a: number, b: number, primaryValue: number): [number, number, number] {
  const [la, lb] = lateralAxisIndices(axis);
  const p: [number, number, number] = [0, 0, 0];
  p[primaryAxisIndex(axis)] = primaryValue;
  p[la] = a;
  p[lb] = b;
  return p;
}
