// Sirpam 3D Labs Mold — where the pour hole, air vents and alignment pins go.
//
// Pour hole (sprue): above the area-weighted centre of the model's upper
// surface, so metal/resin lands in the thickest part. If that spot isn't
// over the model (e.g. a ring), move to the nearest upper-surface face.
// Vents: at upper-surface points farthest from the pour hole (where air gets
// trapped last), spread apart, 2 to 4 of them.
// Pins: just outside the model footprint at the four corners (or four
// compass points on a round mold), sitting on the split plane.
import * as THREE from 'three';
import type { Axis } from '../types';
import {
  PIN_INSET_RATIO, VENT_CANDIDATE_SAMPLE_CAP, VENT_MIN_SPACING_RATIO, MAX_VENTS, MIN_VENTS, dbg,
} from './constants';
import type { MoldEnvelope } from './moldBox';
import { lateralAxisIndices, primaryAxisIndex } from './moldBox';
import { planeFromBox, primaryAxisValueOnPlane, signedDistance, type PlaneEquation } from './planeGeometry';

type P3 = [number, number, number];

/** Split context: flat position along the axis, or a tilted plane. */
interface Split {
  axis: Axis;
  p: 0 | 1 | 2;
  a: number;
  b: number;
  pos: number;
  plane: PlaneEquation | null;
}

function makeSplit(bbox: THREE.Box3, axis: Axis, splitPos: number, cutAngle: number): Split {
  const p = primaryAxisIndex(axis);
  const [a, b] = lateralAxisIndices(axis);
  let plane: PlaneEquation | null = null;
  if (cutAngle !== 0) {
    const lo = bbox.min.getComponent(p), span = bbox.max.getComponent(p) - lo;
    plane = planeFromBox(bbox, axis, span > 0 ? (splitPos - lo) / span : 0, cutAngle);
  }
  return { axis, p, a, b, pos: splitPos, plane };
}

/** Build a point from lateral coords, placing it on the split surface. */
function onSplit(s: Split, la: number, lb: number): P3 {
  const pt: P3 = [0, 0, 0];
  pt[s.a] = la; pt[s.b] = lb;
  pt[s.p] = s.plane ? primaryAxisValueOnPlane(s.plane, s.axis, pt) : s.pos;
  return pt;
}

function isUpper(s: Split, x: number, y: number, z: number): boolean {
  if (s.plane) return signedDistance([x, y, z], s.plane) >= 0;
  return [x, y, z][s.p]! >= s.pos;
}

/** Keep a lateral point inside the mold outline with `margin` to spare. */
export function clampToMoldInterior(latA: number, latB: number, env: MoldEnvelope, margin: number): [number, number] {
  if (env.shape === 'cylinder') {
    const ca = env.cylinderCenterLatA ?? 0, cb = env.cylinderCenterLatB ?? 0;
    const limit = Math.max(0, (env.cylinderRadius ?? 0) - margin);
    const da = latA - ca, db = latB - cb, d = Math.hypot(da, db);
    if (d <= limit || d < 1e-9) return [latA, latB];
    return [ca + (da * limit) / d, cb + (db * limit) / d];
  }
  const m = env.shape === 'roundedRect' ? Math.max(margin, env.cornerRadius ?? 0) : margin;
  const [ia, ib] = lateralAxisIndices(env.axis);
  const clamp = (v: number, i: number) => {
    const lo = env.moldMin.getComponent(i), size = env.moldSize.getComponent(i);
    return lo + m <= lo + size - m ? Math.min(Math.max(v, lo + m), lo + size - m) : lo + size / 2;
  };
  return [clamp(latA, ia), clamp(latB, ib)];
}

/** Four spare vent spots used when too few natural ones are found. */
export function fallbackVentSeeds(env: MoldEnvelope, bbox: THREE.Box3, margin: number): [number, number][] {
  if (env.shape === 'cylinder') {
    const ca = env.cylinderCenterLatA ?? 0, cb = env.cylinderCenterLatB ?? 0;
    const d = Math.max(0, (env.cylinderRadius ?? 0) - margin) * Math.SQRT1_2 * 0.99;
    return [[ca + d, cb + d], [ca - d, cb + d], [ca - d, cb - d], [ca + d, cb - d]];
  }
  const [ia, ib] = lateralAxisIndices(env.axis);
  const lo = bbox.min, hi = bbox.max;
  const seeds: [number, number][] = [
    [lo.getComponent(ia), lo.getComponent(ib)], [hi.getComponent(ia), hi.getComponent(ib)],
    [lo.getComponent(ia), hi.getComponent(ib)], [hi.getComponent(ia), lo.getComponent(ib)],
  ];
  return seeds.map(([x, y]) => clampToMoldInterior(x, y, env, margin));
}

/** Alignment pin centres for a box-shaped mold (four outside corners). */
export function getRegistrationPinPositions(
  bbox: THREE.Box3, axis: Axis, splitPos: number, wallThickness: number, cutAngle = 0,
): P3[] {
  const s = makeSplit(bbox, axis, splitPos, cutAngle);
  const inset = wallThickness * PIN_INSET_RATIO;
  const loA = bbox.min.getComponent(s.a) - inset, hiA = bbox.max.getComponent(s.a) + inset;
  const loB = bbox.min.getComponent(s.b) - inset, hiB = bbox.max.getComponent(s.b) + inset;
  // For the Y axis the lateral pair is (z, x); list corners in (x, z) order
  // so pin order is the same on every axis: (-,-), (+,-), (-,+), (+,+).
  const corners: [number, number][] = axis === 'y'
    ? [[loB, loA], [hiB, loA], [loB, hiA], [hiB, hiA]]
    : [[loA, loB], [hiA, loB], [loA, hiB], [hiA, hiB]];
  return corners.map(([u, v]) => (axis === 'y' ? onSplit(s, v, u) : onSplit(s, u, v)));
}

/** Pin centres for any mold shape. Round molds use four compass points. */
export function getRegistrationPinPositionsForEnvelope(
  env: MoldEnvelope, bbox: THREE.Box3, splitPos: number, cutAngle = 0,
): P3[] {
  if (env.shape !== 'cylinder') {
    return getRegistrationPinPositions(bbox, env.axis, splitPos, env.wallThickness, cutAngle);
  }
  const s = makeSplit(bbox, env.axis, splitPos, cutAngle);
  const size = bbox.getSize(new THREE.Vector3());
  const r = Math.hypot(size.getComponent(s.a) / 2, size.getComponent(s.b) / 2)
    + env.wallThickness * (1 - PIN_INSET_RATIO);
  const ca = env.cylinderCenterLatA ?? 0, cb = env.cylinderCenterLatB ?? 0;
  return [[1, 0], [0, 1], [-1, 0], [0, -1]].map(([u, v]) => onSplit(s, ca + u! * r, cb + v! * r));
}

/** Euler rotation (degrees) that turns a +Z cylinder onto `axis`. */
export function getRotationForAxis(axis: Axis): P3 {
  return axis === 'x' ? [0, 90, 0] : axis === 'y' ? [-90, 0, 0] : [0, 0, 0];
}

export interface ComputeChannelOpts {
  sprueOverride?: { a: number; b: number };
}

interface ChannelLayout {
  spruePos: P3;
  sprueHeight: number;
  ventPositions: P3[];
  rotation: P3;
}

/** Iterate triangles (indexed or not) as three corner indices. */
function forEachTri(g: THREE.BufferGeometry, fn: (i: number, j: number, k: number) => void): void {
  const idx = g.index;
  const n = idx ? idx.count / 3 : g.getAttribute('position').count / 3;
  for (let t = 0; t < n; t++) {
    if (idx) fn(idx.getX(3 * t), idx.getX(3 * t + 1), idx.getX(3 * t + 2));
    else fn(3 * t, 3 * t + 1, 3 * t + 2);
  }
}

/**
 * Is lateral point (la, lb) directly over an upper-half face? If not,
 * also return the nearest upper-half face centre to move to.
 */
function overUpperSurface(
  g: THREE.BufferGeometry, pos: ArrayLike<number>, s: Split, la: number, lb: number,
): { inside: boolean; a: number; b: number } {
  let best = Infinity, ba = la, bb = lb;
  let inside = false;
  const c = (i: number, k: number) => pos[3 * i + k]!;
  forEachTri(g, (i, j, k) => {
    if (inside) return;
    const mx = (c(i, 0) + c(j, 0) + c(k, 0)) / 3;
    const my = (c(i, 1) + c(j, 1) + c(k, 1)) / 3;
    const mz = (c(i, 2) + c(j, 2) + c(k, 2)) / 3;
    if (!isUpper(s, mx, my, mz)) return;
    // Barycentric test in the lateral plane.
    const ax = c(i, s.a), ay = c(i, s.b);
    const e1x = c(k, s.a) - ax, e1y = c(k, s.b) - ay;
    const e2x = c(j, s.a) - ax, e2y = c(j, s.b) - ay;
    const qx = la - ax, qy = lb - ay;
    const d11 = e1x * e1x + e1y * e1y, d12 = e1x * e2x + e1y * e2y, d22 = e2x * e2x + e2y * e2y;
    const q1 = e1x * qx + e1y * qy, q2 = e2x * qx + e2y * qy;
    const den = d11 * d22 - d12 * d12;
    if (den !== 0) {
      const u = (d22 * q1 - d12 * q2) / den, v = (d11 * q2 - d12 * q1) / den;
      if (u >= 0 && v >= 0 && u + v <= 1) { inside = true; return; }
    }
    const m = [mx, my, mz];
    const d = (m[s.a]! - la) ** 2 + (m[s.b]! - lb) ** 2;
    if (d < best) { best = d; ba = m[s.a]!; bb = m[s.b]!; }
  });
  return inside ? { inside, a: la, b: lb } : { inside, a: ba, b: bb };
}

/** Area-weighted lateral centre of the model's upper-half faces. */
function upperCentroid(g: THREE.BufferGeometry, pos: ArrayLike<number>, s: Split, fallback: THREE.Vector3): [number, number] {
  let sa = 0, sb = 0, area = 0;
  const c = (i: number, k: number) => pos[3 * i + k]!;
  forEachTri(g, (i, j, k) => {
    const m = [0, 1, 2].map(q => (c(i, q) + c(j, q) + c(k, q)) / 3) as P3;
    if (!isUpper(s, m[0], m[1], m[2])) return;
    const ex = c(j, 0) - c(i, 0), ey = c(j, 1) - c(i, 1), ez = c(j, 2) - c(i, 2);
    const fx = c(k, 0) - c(i, 0), fy = c(k, 1) - c(i, 1), fz = c(k, 2) - c(i, 2);
    const w = Math.hypot(ey * fz - ez * fy, ez * fx - ex * fz, ex * fy - ey * fx) / 2;
    sa += m[s.a] * w; sb += m[s.b] * w; area += w;
  });
  return area > 0 ? [sa / area, sb / area] : [fallback.getComponent(s.a), fallback.getComponent(s.b)];
}

export function computeChannelPositionsForEnvelope(
  env: MoldEnvelope,
  bbox: THREE.Box3,
  splitPos: number,
  geometry: THREE.BufferGeometry,
  margins: { sprueMargin: number; ventMargin: number } = { sprueMargin: 0, ventMargin: 0 },
  cutAngle = 0,
  opts: ComputeChannelOpts = {},
): ChannelLayout {
  const s = makeSplit(bbox, env.axis, splitPos, cutAngle);
  const pos = geometry.getAttribute('position').array as ArrayLike<number>;
  const top = env.moldMin.getComponent(s.p) + env.moldSize.getComponent(s.p);

  // Pour hole.
  let la: number, lb: number;
  if (opts.sprueOverride) {
    [la, lb] = clampToMoldInterior(opts.sprueOverride.a, opts.sprueOverride.b, env, margins.sprueMargin);
    if (!overUpperSurface(geometry, pos, s, la, lb).inside) {
      dbg('Chosen pour-hole spot is not above the model; it may not reach the cavity.');
    }
  } else {
    [la, lb] = upperCentroid(geometry, pos, s, bbox.getCenter(new THREE.Vector3()));
    const hit = overUpperSurface(geometry, pos, s, la, lb);
    la = hit.a; lb = hit.b;
    [la, lb] = clampToMoldInterior(la, lb, env, margins.sprueMargin);
  }
  const spruePos = onSplit(s, la, lb);

  // Vents: sample upper-half vertices, farthest from the pour hole first.
  const count = pos.length / 3;
  const step = Math.max(1, Math.floor(count / VENT_CANDIDATE_SAMPLE_CAP));
  const cands: { d: number; a: number; b: number }[] = [];
  for (let i = 0; i < count; i += step) {
    const x = pos[3 * i]!, y = pos[3 * i + 1]!, z = pos[3 * i + 2]!;
    if (!isUpper(s, x, y, z)) continue;
    const a = pos[3 * i + s.a]!, b = pos[3 * i + s.b]!;
    cands.push({ d: Math.hypot(a - la, b - lb), a, b });
  }
  cands.sort((u, v) => v.d - u.d);
  const size = bbox.getSize(new THREE.Vector3());
  const spacing = Math.max(size.getComponent(s.a), size.getComponent(s.b)) * VENT_MIN_SPACING_RATIO;
  const vents: P3[] = [];
  for (const c of cands) {
    if (vents.length >= MAX_VENTS) break;
    const [a, b] = clampToMoldInterior(c.a, c.b, env, margins.ventMargin);
    if (vents.every(v => Math.hypot(v[s.a] - a, v[s.b] - b) >= spacing)) vents.push(onSplit(s, a, b));
  }
  for (const [a, b] of fallbackVentSeeds(env, bbox, margins.ventMargin)) {
    if (vents.length >= MIN_VENTS) break;
    vents.push(onSplit(s, a, b));
  }

  const sprueHeight = top - spruePos[s.p];
  dbg(`Sprue at [${spruePos.map(v => v.toFixed(1))}], ${vents.length} vents, height ${sprueHeight.toFixed(1)}`);
  return { spruePos, sprueHeight, ventPositions: vents, rotation: getRotationForAxis(env.axis) };
}

/** Same as above for a plain box given by its corner and size. */
export function computeChannelPositions(
  bbox: THREE.Box3, axis: Axis, splitPos: number, moldMin: THREE.Vector3, moldSize: THREE.Vector3,
  geometry: THREE.BufferGeometry, cutAngle = 0, opts: ComputeChannelOpts = {},
): ChannelLayout {
  const env: MoldEnvelope = { shape: 'rect', axis, wallThickness: 0, moldMin: moldMin.clone(), moldSize: moldSize.clone() };
  return computeChannelPositionsForEnvelope(env, bbox, splitPos, geometry, undefined, cutAngle, opts);
}
