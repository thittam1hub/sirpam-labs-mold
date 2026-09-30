// @ts-nocheck — Manifold WASM objects are untyped here, same as generateMold.ts
import * as THREE from 'three';
import type { Axis } from '../types';
import { geometryToManifold } from './manifoldBridge';
import { lateralAxisIndices, primaryAxisIndex } from './moldBox';

/**
 * Round-6 mold features (rigid molds): curved split that follows the model,
 * clamp wings with bolt holes, automatic air vents at trapped-air high points,
 * stand-fins, and three extra mold styles (relief tray, press mold, plaster
 * slip-cast kit). All optional; omitted = legacy output.
 */
export type MoldStyle = 'standard' | 'reliefTray' | 'pressMold' | 'slipCast';

export interface Round6Extras {
  curvedSplit?: boolean | undefined;
  clampBoltMm?: 0 | 3 | 4 | 5 | undefined;
  /** Raised round seats around each clamp bolt so washers/clamps press evenly. */
  clampLands?: boolean | undefined;
  autoVents?: boolean | undefined;
  standFins?: boolean | undefined;
  style?: MoldStyle | undefined;
}

type V3 = [number, number, number];

/** World point from lateral (a,b) + primary value p. */
function w(axis: Axis, a: number, b: number, p: number): V3 {
  const [la, lb] = lateralAxisIndices(axis);
  const out: V3 = [0, 0, 0];
  out[primaryAxisIndex(axis)] = p; out[la] = a; out[lb] = b;
  return out;
}

/** Rotation (degrees) that turns +Z into +axis. */
function zTo(axis: Axis): V3 {
  return axis === 'x' ? [0, 90, 0] : axis === 'y' ? [-90, 0, 0] : [0, 0, 0];
}

/** Cylinder along the primary axis from p0 to p1 at lateral (a,b). */
export function axialCylinder(wasm: any, axis: Axis, a: number, b: number, p0: number, p1: number, r0: number, r1 = r0, seg = 20) {
  const lo = Math.min(p0, p1), hi = Math.max(p0, p1);
  if (hi - lo < 1e-4) return null;
  const [rl, rh] = p0 <= p1 ? [r0, r1] : [r1, r0];
  return wasm.Manifold.cylinder(hi - lo, rl, rh, seg).rotate(zTo(axis)).translate(w(axis, a, b, lo));
}

function boxAB(wasm: any, axis: Axis, a0: number, a1: number, b0: number, b1: number, p0: number, p1: number) {
  const lo = w(axis, Math.min(a0, a1), Math.min(b0, b1), Math.min(p0, p1));
  const hi = w(axis, Math.max(a0, a1), Math.max(b0, b1), Math.max(p0, p1));
  const s = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
  if (s.some(v => v <= 1e-6)) return null;
  return wasm.Manifold.cube(s, false).translate(lo);
}

// ─── Column scan (per lateral cell: min/max of the model along the axis) ───

export interface ColumnScan {
  a0: number; b0: number; cell: number; nu: number; nv: number;
  lo: Float64Array; hi: Float64Array; // NaN where empty
}

export function scanColumns(geo: THREE.BufferGeometry, axis: Axis, a0: number, a1: number, b0: number, b1: number, cells = 72): ColumnScan {
  const src = geo.index ? geo.toNonIndexed() : geo;
  const p = src.attributes.position.array as ArrayLike<number>;
  const [la, lb] = lateralAxisIndices(axis);
  const pi = primaryAxisIndex(axis);
  const cell = Math.max(a1 - a0, b1 - b0) / cells;
  const nu = Math.max(2, Math.ceil((a1 - a0) / cell)), nv = Math.max(2, Math.ceil((b1 - b0) / cell));
  const lo = new Float64Array(nu * nv).fill(NaN), hi = new Float64Array(nu * nv).fill(NaN);
  const put = (i: number, j: number, z: number) => {
    if (i < 0 || j < 0 || i >= nu || j >= nv) return;
    const k = i * nv + j;
    if (!(lo[k]! <= z)) lo[k] = z;
    if (!(hi[k]! >= z)) hi[k] = z;
  };
  for (let t = 0; t < p.length; t += 9) {
    const au = p[t + la]!, av = p[t + lb]!, aa = p[t + pi]!;
    const bu = p[t + 3 + la]!, bv = p[t + 3 + lb]!, ba = p[t + 3 + pi]!;
    const cu = p[t + 6 + la]!, cv = p[t + 6 + lb]!, ca = p[t + 6 + pi]!;
    // Vertices always count (catches triangles smaller than a cell).
    put(Math.floor((au - a0) / cell), Math.floor((av - b0) / cell), aa);
    put(Math.floor((bu - a0) / cell), Math.floor((bv - b0) / cell), ba);
    put(Math.floor((cu - a0) / cell), Math.floor((cv - b0) / cell), ca);
    const d = (bu - au) * (cv - av) - (cu - au) * (bv - av);
    if (Math.abs(d) < 1e-12) continue;
    const i0 = Math.max(0, Math.ceil((Math.min(au, bu, cu) - a0) / cell - 0.5)), i1 = Math.min(nu - 1, Math.floor((Math.max(au, bu, cu) - a0) / cell - 0.5));
    const j0 = Math.max(0, Math.ceil((Math.min(av, bv, cv) - b0) / cell - 0.5)), j1 = Math.min(nv - 1, Math.floor((Math.max(av, bv, cv) - b0) / cell - 0.5));
    for (let i = i0; i <= i1; i++) {
      const x = a0 + (i + 0.5) * cell;
      for (let j = j0; j <= j1; j++) {
        const y = b0 + (j + 0.5) * cell;
        const w1 = ((bu - x) * (cv - y) - (cu - x) * (bv - y)) / d;
        const w2 = ((cu - x) * (av - y) - (au - x) * (cv - y)) / d;
        const w3 = 1 - w1 - w2;
        if (w1 < 0 || w2 < 0 || w3 < 0) continue;
        put(i, j, w1 * aa + w2 * ba + w3 * ca);
      }
    }
  }
  return { a0, b0, cell, nu, nv, lo, hi };
}

// ─── Curved split ───

export interface CurvedSplit {
  cutter: any;               // solid ABOVE the parting surface (→ top piece)
  heightAt: (a: number, b: number) => number;
}

/**
 * Parting surface that follows the model: in every column it passes through
 * the middle of the model, so each half only has to pull straight out of its
 * own side (no step undercut at the flat plane). Empty columns are filled by
 * smoothing toward the neighbours; the surface is kept inside the shell so
 * both halves keep a solid rim.
 */
export function buildCurvedSplit(
  wasm: any, geo: THREE.BufferGeometry, axis: Axis,
  envMin: THREE.Vector3, envMax: THREE.Vector3, splitPos: number, wall: number,
): CurvedSplit {
  const [la, lb] = lateralAxisIndices(axis);
  const pi = primaryAxisIndex(axis);
  const pad = Math.max(2, wall * 0.5);
  const a0 = envMin.getComponent(la) - pad, a1 = envMax.getComponent(la) + pad;
  const b0 = envMin.getComponent(lb) - pad, b1 = envMax.getComponent(lb) + pad;
  const sc = scanColumns(geo, axis, a0, a1, b0, b1, 72);
  const { nu, nv, cell } = sc;
  const N = nu * nv;
  const h = new Float64Array(N).fill(splitPos);
  const fixed = new Uint8Array(N);
  for (let k = 0; k < N; k++) if (!Number.isNaN(sc.lo[k]!)) { h[k] = (sc.lo[k]! + sc.hi[k]!) / 2; fixed[k] = 1; }
  // Fill empty columns (Jacobi), then a light smooth that keeps each model
  // column strictly inside its own interval.
  const tmp = new Float64Array(N);
  const relax = (iters: number, all: boolean) => {
    for (let it = 0; it < iters; it++) {
      for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
        const k = i * nv + j;
        if (fixed[k] && !all) { tmp[k] = h[k]!; continue; }
        let s = h[k]!, c = 1;
        if (i > 0) { s += h[k - nv]!; c++; } if (i < nu - 1) { s += h[k + nv]!; c++; }
        if (j > 0) { s += h[k - 1]!; c++; } if (j < nv - 1) { s += h[k + 1]!; c++; }
        tmp[k] = s / c;
      }
      h.set(tmp);
      if (all) for (let k = 0; k < N; k++) if (fixed[k]) {
        const r = sc.hi[k]! - sc.lo[k]!;
        h[k] = Math.min(sc.hi[k]! - r * 0.15, Math.max(sc.lo[k]! + r * 0.15, h[k]!));
      }
    }
  };
  relax(Math.max(nu, nv) * 2, false);
  relax(3, true);
  const pMin = envMin.getComponent(pi) + wall * 0.4, pMax = envMax.getComponent(pi) - wall * 0.4;
  for (let k = 0; k < N; k++) h[k] = Math.min(pMax, Math.max(pMin, h[k]!));

  // Corner heights = average of touching cells.
  const cH = (i: number, j: number) => {
    let s = 0, c = 0;
    for (const [di, dj] of [[-1, -1], [-1, 0], [0, -1], [0, 0]]) {
      const ii = i + di!, jj = j + dj!;
      if (ii >= 0 && jj >= 0 && ii < nu && jj < nv) { s += h[ii * nv + jj]!; c++; }
    }
    return s / c;
  };
  const top = envMax.getComponent(pi) + 5;
  const tris: number[] = [];
  // Quad in (a,b,p), oriented so its normal points along `out`.
  const quad = (q: number[][], out: number[]) => {
    const [A, B, C] = q as [number[], number[], number[]];
    const u = [B[0]! - A[0]!, B[1]! - A[1]!, B[2]! - A[2]!], v = [C[0]! - A[0]!, C[1]! - A[1]!, C[2]! - A[2]!];
    const n = [u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!];
    const order = n[0]! * out[0]! + n[1]! * out[1]! + n[2]! * out[2]! >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
    for (const o of order) { const P = q[o]!; tris.push(...w(axis, P[0]!, P[1]!, P[2]!)); }
  };
  const A = (i: number) => a0 + i * cell, Bv = (j: number) => b0 + j * cell;
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    quad([[A(i), Bv(j), cH(i, j)], [A(i + 1), Bv(j), cH(i + 1, j)], [A(i + 1), Bv(j + 1), cH(i + 1, j + 1)], [A(i), Bv(j + 1), cH(i, j + 1)]], [0, 0, -1]);
    quad([[A(i), Bv(j), top], [A(i + 1), Bv(j), top], [A(i + 1), Bv(j + 1), top], [A(i), Bv(j + 1), top]], [0, 0, 1]);
  }
  for (let i = 0; i < nu; i++) {
    quad([[A(i), Bv(0), cH(i, 0)], [A(i + 1), Bv(0), cH(i + 1, 0)], [A(i + 1), Bv(0), top], [A(i), Bv(0), top]], [0, -1, 0]);
    quad([[A(i), Bv(nv), cH(i, nv)], [A(i + 1), Bv(nv), cH(i + 1, nv)], [A(i + 1), Bv(nv), top], [A(i), Bv(nv), top]], [0, 1, 0]);
  }
  for (let j = 0; j < nv; j++) {
    quad([[A(0), Bv(j), cH(0, j)], [A(0), Bv(j + 1), cH(0, j + 1)], [A(0), Bv(j + 1), top], [A(0), Bv(j), top]], [-1, 0, 0]);
    quad([[A(nu), Bv(j), cH(nu, j)], [A(nu), Bv(j + 1), cH(nu, j + 1)], [A(nu), Bv(j + 1), top], [A(nu), Bv(j), top]], [1, 0, 0]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tris), 3));
  const cutter = geometryToManifold(wasm, g);
  const heightAt = (a: number, b: number) => {
    const i = Math.min(nu - 1, Math.max(0, Math.floor((a - a0) / cell)));
    const j = Math.min(nv - 1, Math.max(0, Math.floor((b - b0) / cell)));
    return h[i * nv + j]!;
  };
  return { cutter, heightAt };
}

// ─── Clamp wings ───

/** Bolt-on flanges on two opposite sides of the split, with through holes. */
export function applyClampWings(
  wasm: any, top: any, bottom: any,
  o: { axis: Axis; envMin: THREE.Vector3; envMax: THREE.Vector3; splitPos: number; wall: number; boltMm: number; cavityCut: any; lands?: boolean },
): [any, any] {
  const { axis, envMin, envMax, splitPos, wall, boltMm, cavityCut, lands } = o;
  const [la, lb] = lateralAxisIndices(axis);
  // Wings stick out of the two long sides.
  const sa = envMax.getComponent(la) - envMin.getComponent(la), sb = envMax.getComponent(lb) - envMin.getComponent(lb);
  const alongA = sb >= sa; // wings on ±a sides, spread along b
  const [ia, ib] = alongA ? [la, lb] : [lb, la];
  const mapAB = (x: number, y: number) => (alongA ? [x, y] : [y, x]);
  const T = Math.max(3.5, wall * 0.7);
  const out = boltMm * 2 + 8;
  const width = boltMm * 3 + 6;
  const cA = (envMin.getComponent(ia) + envMax.getComponent(ia)) / 2;
  const span = envMax.getComponent(ib) - envMin.getComponent(ib);
  const cB = (envMin.getComponent(ib) + envMax.getComponent(ib)) / 2;
  const bs = span > width * 3 ? [cB - span * 0.3, cB + span * 0.3] : [cB];
  let t = top, b = bottom;
  const holes: any[] = [];
  for (const side of [-1, 1]) {
    const edge = side < 0 ? envMin.getComponent(ia) : envMax.getComponent(ia);
    for (const y of bs) {
      const x0 = cA, x1 = edge + side * out;
      const [a0, b0] = mapAB(x0, y - width / 2), [a1, b1] = mapAB(x1, y + width / 2);
      const up = boxAB(wasm, axis, a0, a1, b0, b1, splitPos, splitPos + T);
      const dn = boxAB(wasm, axis, a0, a1, b0, b1, splitPos - T, splitPos);
      if (up) t = t.add(up.subtract(cavityCut));
      if (dn) b = b.add(dn.subtract(cavityCut));
      const [ha, hb] = mapAB(edge + side * (out / 2 + 1), y);
      const hole = axialCylinder(wasm, axis, ha, hb, splitPos - T - 1, splitPos + T + 1, boltMm / 2 + 0.2, boltMm / 2 + 0.2, 20);
      if (hole) holes.push(hole);
      if (lands) {
        const lr = boltMm * 1.6 + 1, lh = Math.max(1.2, T * 0.4);
        const su = axialCylinder(wasm, axis, ha, hb, splitPos + T - 0.01, splitPos + T + lh, lr, lr, 28);
        const sd = axialCylinder(wasm, axis, ha, hb, splitPos - T - lh, splitPos - T + 0.01, lr, lr, 28);
        if (su) t = t.add(su);
        if (sd) b = b.add(sd);
      }
    }
  }
  for (const hole of holes) { t = t.subtract(hole); b = b.subtract(hole); }
  return [t, b];
}

// ─── Wall ribs ───

/** A box wall wider than this bulges under the weight of poured silicone. */
export const RIB_SPAN_THRESHOLD_MM = 120;

/**
 * Vertical stiffening ribs on the outside of any box wall wider than
 * RIB_SPAN_THRESHOLD_MM. Ribs are one wall thick, two walls deep, run the
 * full height of the box, and are spaced about 50 mm apart. Returns the
 * outer solid with ribs unioned on, or null when no wall needs them.
 */
export function buildWallRibs(
  wasm: any, outer: any, o: { axis: Axis; envMin: THREE.Vector3; envSize: THREE.Vector3; wall: number },
): { solid: any; ribbedFaces: number } | null {
  const { axis, envMin, envSize, wall } = o;
  const [la, lb] = lateralAxisIndices(axis);
  const pi = primaryAxisIndex(axis);
  const p0 = envMin.getComponent(pi), p1 = p0 + envSize.getComponent(pi);
  if (p1 - p0 < 8) return null;
  const t = Math.max(2.4, wall);
  const depth = t * 2;
  const spacing = 50;
  const ribs: any[] = [];
  let ribbedFaces = 0;
  for (const faceAxis of [la, lb]) {
    const span = envSize.getComponent(faceAxis);
    if (span < RIB_SPAN_THRESHOLD_MM) continue;
    const along = faceAxis === la ? lb : la;
    const a0 = envMin.getComponent(along) + t, a1 = a0 + envSize.getComponent(along) - 2 * t;
    const count = Math.max(1, Math.floor((a1 - a0) / spacing));
    for (const side of [-1, 1]) {
      const face = side < 0 ? envMin.getComponent(faceAxis) : envMin.getComponent(faceAxis) + span;
      const f0 = side < 0 ? face - depth : face;
      for (let k = 0; k <= count; k++) {
        const c = a0 + ((a1 - a0) * k) / count;
        const mk = (fa: number, al: number, pv: number) => {
          const out: V3 = [0, 0, 0];
          out[faceAxis] = fa; out[along] = al; out[pi] = pv;
          return out;
        };
        const lo = mk(f0, c - t / 2, p0), hi = mk(f0 + depth, c + t / 2, p1);
        const s = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
        if (s.some(v => v <= 1e-6)) continue;
        ribs.push(wasm.Manifold.cube(s, false).translate(lo));
      }
      ribbedFaces++;
    }
  }
  if (!ribs.length) return null;
  return { solid: outer.add(wasm.Manifold.union(ribs)), ribbedFaces };
}

// ─── Stand-fins ───

/** Four fins on the bottom piece so a curved (form-fit) shell stands level. */
export function buildStandFins(
  wasm: any, o: { axis: Axis; envMin: THREE.Vector3; envMax: THREE.Vector3; splitPos: number; wall: number; cavityCut: any },
) {
  const { axis, envMin, envMax, splitPos, wall, cavityCut } = o;
  const [la, lb] = lateralAxisIndices(axis);
  const pi = primaryAxisIndex(axis);
  const p0 = envMin.getComponent(pi), p1 = splitPos - Math.max(1, wall * 0.3);
  if (p1 - p0 < 2) return null;
  const ca = (envMin.getComponent(la) + envMax.getComponent(la)) / 2, cb = (envMin.getComponent(lb) + envMax.getComponent(lb)) / 2;
  const ha = (envMax.getComponent(la) - envMin.getComponent(la)) / 2, hb = (envMax.getComponent(lb) - envMin.getComponent(lb)) / 2;
  const t = Math.max(2, wall * 0.5);
  const reachA = ha * 1.25, reachB = hb * 1.25;
  const fins = [
    boxAB(wasm, axis, ca, ca + reachA, cb - t / 2, cb + t / 2, p0, p1),
    boxAB(wasm, axis, ca - reachA, ca, cb - t / 2, cb + t / 2, p0, p1),
    boxAB(wasm, axis, ca - t / 2, ca + t / 2, cb, cb + reachB, p0, p1),
    boxAB(wasm, axis, ca - t / 2, ca + t / 2, cb - reachB, cb, p0, p1),
  ].filter(Boolean);
  if (!fins.length) return null;
  return wasm.Manifold.union(fins).subtract(cavityCut);
}

// ─── Automatic air vents ───

/** Local high points of the model's upper surface (where air gets trapped). */
export function trappedAirPoints(geo: THREE.BufferGeometry, axis: Axis, bbox: THREE.Box3, avoid: Array<[number, number]>, avoidR: number, max = 6): Array<{ a: number; b: number; p: number }> {
  const [la, lb] = lateralAxisIndices(axis);
  const pi = primaryAxisIndex(axis);
  const sc = scanColumns(geo, axis, bbox.min.getComponent(la), bbox.max.getComponent(la), bbox.min.getComponent(lb), bbox.max.getComponent(lb), 24);
  const { nu, nv, hi, cell, a0, b0 } = sc;
  const top = bbox.max.getComponent(pi), range = top - bbox.min.getComponent(pi);
  const pts: Array<{ a: number; b: number; p: number }> = [];
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const z = hi[i * nv + j]!;
    if (Number.isNaN(z)) continue;
    let peak = true;
    for (let di = -2; di <= 2 && peak; di++) for (let dj = -2; dj <= 2; dj++) {
      if (!di && !dj) continue;
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= nu || jj >= nv) continue;
      const q = hi[ii * nv + jj]!;
      if (!Number.isNaN(q) && q > z + 1e-6) { peak = false; break; }
    }
    if (!peak || z > top - range * 0.02) continue; // the very top is served by the sprue
    const a = a0 + (i + 0.5) * cell, b = b0 + (j + 0.5) * cell;
    if (avoid.some(([x, y]) => Math.hypot(x - a, y - b) < avoidR)) continue;
    if (pts.some(q => Math.hypot(q.a - a, q.b - b) < cell * 3)) continue;
    pts.push({ a, b, p: z });
  }
  return pts.sort((x, y) => y.p - x.p).slice(0, max);
}

// ─── Extra mold styles ───

export interface StyleResult { pieces: any[]; labels: string[] }

export function buildStyleMold(
  wasm: any, style: MoldStyle, model: any, bbox: THREE.Box3, axis: Axis, wall: number,
  highPoint: { a: number; b: number },
): StyleResult {
  const [la, lb] = lateralAxisIndices(axis);
  const pi = primaryAxisIndex(axis);
  const aMin = bbox.min.getComponent(la), aMax = bbox.max.getComponent(la);
  const bMin = bbox.min.getComponent(lb), bMax = bbox.max.getComponent(lb);
  const pMin = bbox.min.getComponent(pi), pMax = bbox.max.getComponent(pi);
  const range = pMax - pMin;
  const minLat = Math.min(aMax - aMin, bMax - bMin);

  if (style === 'reliefTray' || style === 'pressMold') {
    const m = Math.max(4, wall * (style === 'pressMold' ? 1.4 : 1));
    const base = Math.max(3, wall);
    // Rim a hair under the top so the open face is cut cleanly.
    const tray = boxAB(wasm, axis, aMin - m, aMax + m, bMin - m, bMax + m, pMin - base, pMax - range * 1e-3);
    let piece = tray.subtract(model);
    if (style === 'pressMold') {
      const r = Math.min(20, Math.max(6, minLat * 0.18));
      const grip = axialCylinder(wasm, axis, (aMin + aMax) / 2, (bMin + bMax) / 2, pMin - base - 22, pMin - base + 0.5, r * 1.25, r, 40);
      if (grip) piece = piece.add(grip);
      return { pieces: [piece], labels: ['press_mold'] };
    }
    return { pieces: [piece], labels: ['relief_tray'] };
  }

  // Plaster slip-cast kit: master with a pour spare + an open pour frame.
  const r = Math.min(30, Math.max(5, minLat * 0.25));
  const spareH = range * 0.25 + 10;
  const spare = axialCylinder(wasm, axis, highPoint.a, highPoint.b, pMax - Math.min(2, range * 0.05), pMax + spareH, r, r * 1.6, 48);
  const master = spare ? model.add(spare) : model;
  const plaster = Math.max(20, range * 0.3);
  const t = 3;
  const ia0 = aMin - plaster, ia1 = aMax + plaster, ib0 = bMin - plaster, ib1 = bMax + plaster;
  const floor0 = pMin - plaster;
  const topP = pMax + spareH;
  const outer = boxAB(wasm, axis, ia0 - t, ia1 + t, ib0 - t, ib1 + t, floor0 - t, topP);
  const inner = boxAB(wasm, axis, ia0, ia1, ib0, ib1, floor0, topP + 1);
  return { pieces: [master, outer.subtract(inner)], labels: ['master_with_spare', 'plaster_pour_frame'] };
}
