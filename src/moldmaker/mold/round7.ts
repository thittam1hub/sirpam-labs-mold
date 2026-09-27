// @ts-nocheck — Manifold WASM objects are untyped here, same as generateMold.ts
import * as THREE from 'three';
import type { Axis } from '../types';
import { lateralAxisIndices, primaryAxisIndex } from './moldBox';
import { scanColumns, axialCylinder } from './proFeatures';

/**
 * Round-7 rigid mold features: engraved casting-volume label, engraved
 * watermark text, casting feet, gap filler under the model, 3/4-piece molds.
 * All optional; omitted = legacy output.
 */
export interface Round7Extras {
  /** Text engraved on the top of the top piece (e.g. "42 ML"). */
  volumeLabel?: string;
  /** Text engraved on the underside of the bottom piece. */
  watermark?: string;
  moldFeet?: boolean;
  gapFiller?: boolean;
  pieceCount?: 2 | 3 | 4;
}

type V3 = [number, number, number];
function w(axis: Axis, a: number, b: number, p: number): V3 {
  const [la, lb] = lateralAxisIndices(axis);
  const out: V3 = [0, 0, 0];
  out[primaryAxisIndex(axis)] = p; out[la] = a; out[lb] = b;
  return out;
}
function box(wasm: any, axis: Axis, a0: number, a1: number, b0: number, b1: number, p0: number, p1: number) {
  const lo = w(axis, Math.min(a0, a1), Math.min(b0, b1), Math.min(p0, p1));
  const hi = w(axis, Math.max(a0, a1), Math.max(b0, b1), Math.max(p0, p1));
  const s = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
  if (s.some(v => v <= 1e-6)) return null;
  return wasm.Manifold.cube(s, false).translate(lo);
}

// 5×7 pixel font, rows top→bottom, '1' = filled.
const FONT: Record<string, string[]> = {
  A: ['01110','10001','10001','11111','10001','10001','10001'], B: ['11110','10001','10001','11110','10001','10001','11110'],
  C: ['01111','10000','10000','10000','10000','10000','01111'], D: ['11110','10001','10001','10001','10001','10001','11110'],
  E: ['11111','10000','10000','11110','10000','10000','11111'], F: ['11111','10000','10000','11110','10000','10000','10000'],
  G: ['01111','10000','10000','10011','10001','10001','01111'], H: ['10001','10001','10001','11111','10001','10001','10001'],
  I: ['11111','00100','00100','00100','00100','00100','11111'], J: ['00111','00010','00010','00010','00010','10010','01100'],
  K: ['10001','10010','10100','11000','10100','10010','10001'], L: ['10000','10000','10000','10000','10000','10000','11111'],
  M: ['10001','11011','10101','10101','10001','10001','10001'], N: ['10001','11001','10101','10011','10001','10001','10001'],
  O: ['01110','10001','10001','10001','10001','10001','01110'], P: ['11110','10001','10001','11110','10000','10000','10000'],
  Q: ['01110','10001','10001','10001','10101','10010','01101'], R: ['11110','10001','10001','11110','10100','10010','10001'],
  S: ['01111','10000','10000','01110','00001','00001','11110'], T: ['11111','00100','00100','00100','00100','00100','00100'],
  U: ['10001','10001','10001','10001','10001','10001','01110'], V: ['10001','10001','10001','10001','10001','01010','00100'],
  W: ['10001','10001','10001','10101','10101','10101','01010'], X: ['10001','10001','01010','00100','01010','10001','10001'],
  Y: ['10001','10001','01010','00100','00100','00100','00100'], Z: ['11111','00001','00010','00100','01000','10000','11111'],
  0: ['01110','10011','10101','10101','10101','11001','01110'], 1: ['00100','01100','00100','00100','00100','00100','01110'],
  2: ['01110','10001','00001','00010','00100','01000','11111'], 3: ['11110','00001','00001','01110','00001','00001','11110'],
  4: ['00010','00110','01010','10010','11111','00010','00010'], 5: ['11111','10000','11110','00001','00001','10001','01110'],
  6: ['00110','01000','10000','11110','10001','10001','01110'], 7: ['11111','00001','00010','00100','01000','01000','01000'],
  8: ['01110','10001','10001','01110','10001','10001','01110'], 9: ['01110','10001','10001','01111','00001','00010','01100'],
  '.': ['00000','00000','00000','00000','00000','01100','01100'], '-': ['00000','00000','00000','11111','00000','00000','00000'],
  '&': ['01100','10010','10100','01000','10101','10010','01101'], '@': ['01110','10001','10111','10101','10111','10000','01110'],
  ' ': ['00000','00000','00000','00000','00000','00000','00000'],
};

export function sanitizeText(t: string): string {
  return (t || '').toUpperCase().split('').filter(c => FONT[c]).join('').trim().slice(0, 24);
}

/**
 * Engrave text into the flat outer face of a piece (top face = 'top' at
 * p = face, reading from above; 'bottom' reads from below, so it's mirrored).
 * Text sits in the band [b0,b1] across [a0,a1].
 */
export function engraveText(
  wasm: any, piece: any, text: string,
  o: { axis: Axis; side: 'top' | 'bottom'; face: number; a0: number; a1: number; b0: number; b1: number; depth: number },
) {
  const t = sanitizeText(text);
  if (!t) return piece;
  const cols = t.length * 6 - 1;
  const px = Math.min((o.a1 - o.a0) / cols, (o.b1 - o.b0) / 7);
  if (px < 0.35) return piece; // too small to print legibly
  const ca = (o.a0 + o.a1) / 2, cb = (o.b0 + o.b1) / 2;
  const startA = ca - (cols * px) / 2;
  const topB = cb + (7 * px) / 2;
  const mirror = o.side === 'bottom';
  const p0 = o.side === 'top' ? o.face - o.depth : o.face - 1;
  const p1 = o.side === 'top' ? o.face + 1 : o.face + o.depth;
  const cubes: any[] = [];
  const s = px * 1.02; // slight overlap so pixels fuse
  for (let ci = 0; ci < t.length; ci++) {
    const g = FONT[t[ci]!]!;
    for (let r = 0; r < 7; r++) {
      const row = g[r]!;
      let c = 0;
      while (c < 5) {
        if (row[c] !== '1') { c++; continue; }
        let e = c; while (e + 1 < 5 && row[e + 1] === '1') e++;
        let a0 = startA + (ci * 6 + c) * px, a1 = startA + (ci * 6 + e) * px + s;
        if (mirror) { const m0 = 2 * ca - a1, m1 = 2 * ca - a0; a0 = m0; a1 = m1; }
        const bb1 = topB - r * px, bb0 = bb1 - s;
        const cube = box(wasm, o.axis, a0, a1, bb0, bb1, p0, p1);
        if (cube) cubes.push(cube);
        c = e + 1;
      }
    }
  }
  if (!cubes.length) return piece;
  return piece.subtract(wasm.Manifold.union(cubes));
}

/** Four short round feet under the bottom face so small molds sit steady. */
export function buildFeet(wasm: any, o: { axis: Axis; envMin: THREE.Vector3; envMax: THREE.Vector3 }) {
  const [la, lb] = lateralAxisIndices(o.axis);
  const pi = primaryAxisIndex(o.axis);
  const a0 = o.envMin.getComponent(la), a1 = o.envMax.getComponent(la);
  const b0 = o.envMin.getComponent(lb), b1 = o.envMax.getComponent(lb);
  const p = o.envMin.getComponent(pi);
  const r = Math.max(2.5, Math.min(8, Math.min(a1 - a0, b1 - b0) * 0.08));
  const inset = r * 1.4;
  const h = Math.max(2, r * 0.6);
  const feet = [[a0 + inset, b0 + inset], [a1 - inset, b0 + inset], [a0 + inset, b1 - inset], [a1 - inset, b1 - inset]]
    .map(([a, b]) => axialCylinder(wasm, o.axis, a!, b!, p + 0.4, p - h, r, r * 0.8, 24)).filter(Boolean);
  return feet.length ? wasm.Manifold.union(feet) : null;
}

/**
 * Solid that fills the gaps under overhangs, from the model's lowest point up
 * to its underside in every column, so the bottom half has no undercuts.
 */
export function buildGapFiller(wasm: any, geo: THREE.BufferGeometry, axis: Axis, bbox: THREE.Box3) {
  const [la, lb] = lateralAxisIndices(axis);
  const pi = primaryAxisIndex(axis);
  const sc = scanColumns(geo, axis, bbox.min.getComponent(la), bbox.max.getComponent(la), bbox.min.getComponent(lb), bbox.max.getComponent(lb), 56);
  const { nu, nv, lo, cell, a0, b0 } = sc;
  const floor = bbox.min.getComponent(pi);
  const minGap = Math.max(0.3, (bbox.max.getComponent(pi) - floor) * 0.01);
  const boxes: any[] = [];
  for (let i = 0; i < nu; i++) {
    let j = 0;
    while (j < nv) {
      const z = lo[i * nv + j]!;
      if (Number.isNaN(z) || z - floor < minGap) { j++; continue; }
      let e = j, zMin = z;
      while (e + 1 < nv) {
        const q = lo[i * nv + e + 1]!;
        if (Number.isNaN(q) || q - floor < minGap || Math.abs(q - z) > cell) break;
        zMin = Math.min(zMin, q); e++;
      }
      // Pull the column in a touch so the filler never pokes out of the outline.
      const inA = cell * 0.15;
      const bx = box(wasm, axis, a0 + i * cell + inA, a0 + (i + 1) * cell - inA, b0 + j * cell + inA, b0 + (e + 1) * cell - inA, floor, zMin + 0.2);
      if (bx) boxes.push(bx);
      j = e + 1;
    }
  }
  return boxes.length ? wasm.Manifold.union(boxes) : null;
}

/** Split pieces down the middle of the long side: 3 = bottom only, 4 = both. */
export function splitIntoParts(pieces: any[], o: { axis: Axis; envMin: THREE.Vector3; envMax: THREE.Vector3; count: 3 | 4 }) {
  const [la, lb] = lateralAxisIndices(o.axis);
  const sa = o.envMax.getComponent(la) - o.envMin.getComponent(la);
  const sb = o.envMax.getComponent(lb) - o.envMin.getComponent(lb);
  const idx = sa >= sb ? la : lb;
  const n: V3 = [0, 0, 0]; n[idx] = 1;
  const c = (o.envMin.getComponent(idx) + o.envMax.getComponent(idx)) / 2;
  const out: any[] = [];
  pieces.forEach((p, k) => {
    if (o.count === 3 && k === 0) { out.push(p); return; }
    const [x, y] = p.splitByPlane(n, c);
    const xe = x.isEmpty(), ye = y.isEmpty();
    if (!xe) out.push(x);
    if (!ye) out.push(y);
    if (xe && ye) out.push(p);
  });
  return out;
}

// ─── Support-free printing check (main thread) ───

export interface OverhangResult { bestDown: string; overhangCm2: number; supportFree: boolean }

const DIRS: Array<[string, THREE.Vector3]> = [
  ['bottom (-Z) down', new THREE.Vector3(0, 0, -1)], ['top (+Z) down', new THREE.Vector3(0, 0, 1)],
  ['-Y side down', new THREE.Vector3(0, -1, 0)], ['+Y side down', new THREE.Vector3(0, 1, 0)],
  ['-X side down', new THREE.Vector3(-1, 0, 0)], ['+X side down', new THREE.Vector3(1, 0, 0)],
];

/** Area (cm²) that needs supports for the best of six flat orientations. */
export function overhangCheck(geo: THREE.BufferGeometry, maxDeg: number): OverhangResult {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const idx = geo.getIndex();
  const n = idx ? idx.count : pos.count;
  const get = (i: number, v: THREE.Vector3) => v.fromBufferAttribute(pos, idx ? idx.getX(i) : i);
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), N = new THREE.Vector3(), E = new THREE.Vector3();
  const lim = Math.cos(THREE.MathUtils.degToRad(90 - maxDeg)); // n·down above this = too steep
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  let best: OverhangResult = { bestDown: DIRS[0]![0], overhangCm2: Infinity, supportFree: false };
  for (const [name, d] of DIRS) {
    const bed = Math.min(bb.min.dot(d.clone().negate()) * -1, bb.max.dot(d) ) ; // not used directly
    void bed;
    // Bed plane: the extreme along d.
    const bedLevel = Math.max(bb.min.dot(d), bb.max.dot(d), new THREE.Vector3(bb.min.x, bb.max.y, bb.min.z).dot(d));
    let area = 0;
    for (let i = 0; i < n; i += 3) {
      get(i, A); get(i + 1, B); get(i + 2, C);
      N.subVectors(B, A).cross(E.subVectors(C, A));
      const a2 = N.length();
      if (a2 < 1e-12) continue;
      N.divideScalar(a2);
      if (N.dot(d) <= lim) continue;
      const onBed = Math.abs(A.dot(d) - bedLevel) < 0.2 && Math.abs(B.dot(d) - bedLevel) < 0.2 && Math.abs(C.dot(d) - bedLevel) < 0.2;
      if (onBed) continue;
      area += a2 / 2;
    }
    const cm2 = area / 100;
    if (cm2 < best.overhangCm2) best = { bestDown: name, overhangCm2: cm2, supportFree: cm2 < 0.5 };
  }
  return best;
}
