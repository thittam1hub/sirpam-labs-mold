// Sirpam 3D Labs Mold — "will it come out of the mold?" analysis.
//
// For each triangle we ask: does its face point away from the split plane, on
// the side of the plane it sits on? A face on the upper piece that faces up
// (or a lower-piece face that faces down) releases cleanly. A face that
// points back toward the split is an undercut and will lock the cast in.
//
// score = side × (faceNormal · planeNormal), side = ±1 from the centroid.
//   score > 0.2  → green  (clear release)
//   0 < score ≤ 0.2 → yellow (near-vertical wall, needs draft)
//   score ≤ 0    → red    (undercut)
import * as THREE from 'three';
import type { Axis } from '../types';
import { planeFromBox, type PlaneEquation } from './planeGeometry';

export const DRAFT_OK_THRESHOLD = 0.2;
export const DRAFT_UNDERCUT_THRESHOLD = 0.0;
/** Stricter cut-off used when counting undercuts, so vertical walls don't count. */
export const STRICT_UNDERCUT_THRESHOLD = -0.05;

export const DRAFT_COLORS = {
  green: new THREE.Color('#4ade80'),
  yellow: new THREE.Color('#facc15'),
  red: new THREE.Color('#ef4444'),
} as const;

export type DraftClass = keyof typeof DRAFT_COLORS;

export function classifyScore(score: number): DraftClass {
  return score > DRAFT_OK_THRESHOLD ? 'green' : score > DRAFT_UNDERCUT_THRESHOLD ? 'yellow' : 'red';
}

const expanded = new WeakMap<THREE.BufferGeometry, Float32Array>();

/** Triangle-soup positions for a geometry (cached for indexed input). */
export function getNonIndexedPositions(source: THREE.BufferGeometry): Float32Array {
  if (!source.index) return source.getAttribute('position').array as Float32Array;
  let p = expanded.get(source);
  if (!p) {
    p = source.toNonIndexed().getAttribute('position').array as Float32Array;
    expanded.set(source, p);
  }
  return p;
}

/** Release score for every triangle. */
function scores(p: Float32Array, plane: PlaneEquation): Float32Array {
  const [nx, ny, nz] = plane.normal;
  const out = new Float32Array(Math.floor(p.length / 9));
  for (let t = 0; t < out.length; t++) {
    const o = t * 9;
    const ax = p[o]!, ay = p[o + 1]!, az = p[o + 2]!;
    const ux = p[o + 3]! - ax, uy = p[o + 4]! - ay, uz = p[o + 5]! - az;
    const vx = p[o + 6]! - ax, vy = p[o + 7]! - ay, vz = p[o + 8]! - az;
    let fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    const len = Math.hypot(fx, fy, fz);
    if (len > 0) { fx /= len; fy /= len; fz /= len; }
    const cx = (ax + p[o + 3]! + p[o + 6]!) / 3;
    const cy = (ay + p[o + 4]! + p[o + 7]!) / 3;
    const cz = (az + p[o + 5]! + p[o + 8]!) / 3;
    const side = Math.sign(cx * nx + cy * ny + cz * nz - plane.originOffset);
    out[t] = side * (fx * nx + fy * ny + fz * nz);
  }
  return out;
}

/** Copy of the model with a green/yellow/red colour per face. */
export function buildDraftHeatmapGeometry(
  source: THREE.BufferGeometry, axis: Axis, offset: number, bbox: THREE.Box3, cutAngle = 0,
): THREE.BufferGeometry {
  if (!source.getAttribute('position')) throw new Error('Source geometry has no position attribute.');
  const p = getNonIndexedPositions(source);
  const s = scores(p, planeFromBox(bbox, axis, offset, cutAngle));
  const colors = new Float32Array(s.length * 9);
  s.forEach((score, t) => {
    const c = DRAFT_COLORS[classifyScore(score)];
    for (let k = 0; k < 3; k++) colors.set([c.r, c.g, c.b], t * 9 + k * 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

export function summarizeClassification(
  source: THREE.BufferGeometry, axis: Axis, offset: number, bbox: THREE.Box3, cutAngle = 0,
): { green: number; yellow: number; red: number; total: number } {
  const s = scores(getNonIndexedPositions(source), planeFromBox(bbox, axis, offset, cutAngle));
  const r = { green: 0, yellow: 0, red: 0, total: s.length };
  for (const v of s) r[classifyScore(v)]++;
  return r;
}

/** Share of faces (0..1) that are true undercuts for this split. */
export function undercutFraction(
  source: THREE.BufferGeometry, axis: Axis, offset: number, bbox: THREE.Box3, cutAngle = 0,
): number {
  const s = scores(getNonIndexedPositions(source), planeFromBox(bbox, axis, offset, cutAngle));
  if (s.length === 0) return 0;
  let n = 0;
  for (const v of s) if (v < STRICT_UNDERCUT_THRESHOLD) n++;
  return n / s.length;
}
