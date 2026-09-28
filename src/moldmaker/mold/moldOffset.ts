// @ts-nocheck — upstream mold-maker code; type-checked under its own repo tsconfig
import * as THREE from 'three';
import type { Axis } from '../types';
import type { MoldEnvelope } from './moldBox';
import { windingVotes } from './meshFix';

/**
 * Shared outward-offset helper for "form fit" shells and skin molds.
 *
 * Why this module exists: siliconeMold.ts grew a private `offsetOutward`
 * for its skin/glove mold path, and the form-fit shell feature (rigid +
 * silicone block molds whose outer wall hugs the model instead of being a
 * box) needs the exact same operation. Keeping it here avoids a copy-paste
 * fork of a numerically delicate helper.
 */

export type OffsetMethod = 'exact' | 'distanceField' | 'simplified' | 'scaled';

/** Minkowski budget: above this the exact sphere sum gets too slow. */
const EXACT_MAX_TRI = 20000;
/** Grid memory cap (cells) for the distance-field offset. */
const MAX_CELLS = 6_000_000;

/**
 * Grow a manifold outward by `t` in every direction.
 *
 * <= 20k triangles: exact Minkowski sum with a sphere (legacy, unchanged).
 * Heavier meshes try, in order: a distance-field offset (winding-vote grid +
 * Euclidean distance transform + Manifold.levelSet), then an exact offset of
 * a simplified copy, and only as a last resort the old uniform bbox scale.
 * Every candidate must be a non-empty solid that fully contains the input.
 */
export function offsetOutward(wasm: any, m: any, t: number, bbox: THREE.Box3): any {
  return offsetOutwardEx(wasm, m, t, bbox).solid;
}

export function offsetOutwardEx(wasm: any, m: any, t: number, bbox: THREE.Box3): { solid: any; method: OffsetMethod } {
  const { Manifold } = wasm;
  let triCount = Infinity;
  try {
    triCount = m.numTri();
  } catch {
    /* older builds: leave as Infinity so we take the cheap path */
  }

  if (t > 0 && triCount <= EXACT_MAX_TRI) {
    try {
      return { solid: m.minkowskiSum(Manifold.sphere(t, 12)), method: 'exact' };
    } catch (e) {
      console.warn('Minkowski offset failed, falling back to scaled offset', e);
    }
  }

  if (t > 0 && triCount > EXACT_MAX_TRI && Number.isFinite(triCount)) {
    try {
      const df = distanceFieldOffset(wasm, m, t, bbox);
      if (df && acceptOffset(m, df)) return { solid: df, method: 'distanceField' };
    } catch (e) {
      console.warn('Distance-field offset failed', e);
    }
    try {
      if (typeof m.simplify === 'function') {
        const simp = m.simplify(Math.max(t * 0.25, 0.05));
        if (simp && !simp.isEmpty() && simp.numTri() <= EXACT_MAX_TRI) {
          const s = simp.minkowskiSum(Manifold.sphere(t, 12));
          if (acceptOffset(m, s)) return { solid: s, method: 'simplified' };
        }
      }
    } catch (e) {
      console.warn('Simplified offset failed', e);
    }
  }

  const size = new THREE.Vector3();
  bbox.getSize(size);
  const center = new THREE.Vector3();
  bbox.getCenter(center);
  const minExtent = Math.max(Math.min(size.x, size.y, size.z), 1e-6);
  const k = 1 + (2 * t) / minExtent;
  const solid = m
    .translate([-center.x, -center.y, -center.z])
    .scale([k, k, k])
    .translate([center.x, center.y, center.z]);
  return { solid, method: 'scaled' };
}

/** Candidate must be non-empty and contain the original entirely. */
function acceptOffset(orig: any, cand: any): boolean {
  try {
    if (!cand || cand.isEmpty()) return false;
    const leftover = orig.subtract(cand);
    const v = leftover.volume ? leftover.volume() : leftover.getProperties?.().volume ?? 0;
    const ov = orig.volume ? orig.volume() : orig.getProperties?.().volume ?? 1;
    return v <= Math.max(1e-6, ov * 1e-4);
  } catch {
    return false;
  }
}

/** 1D squared Euclidean distance transform (Felzenszwalb & Huttenlocher). */
function edt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array) {
  let k = 0;
  v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s: number;
    for (;;) {
      const r = v[k]!;
      s = ((f[q]! + q * q) - (f[r]! + r * r)) / (2 * q - 2 * r);
      if (s <= z[k]!) { k--; if (k < 0) { k = 0; break; } } else break;
    }
    k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1]! < q) k++;
    const r = v[k]!;
    d[q] = (q - r) * (q - r) + f[r]!;
  }
}

function distanceFieldOffset(wasm: any, m: any, t: number, bbox: THREE.Box3): any {
  const size = bbox.getSize(new THREE.Vector3());
  const longest = Math.max(size.x, size.y, size.z);
  let h = Math.max(t / 3, longest / 256);
  const dimsFor = (hh: number) => {
    const pad = t + 3 * hh;
    return [size.x, size.y, size.z].map(s => Math.ceil((s + 2 * pad) / hh)) as [number, number, number];
  };
  let N = dimsFor(h);
  while (N[0] * N[1] * N[2] > MAX_CELLS) { h *= 1.15; N = dimsFor(h); }
  const pad = t + 3 * h;
  const O = [bbox.min.x - pad, bbox.min.y - pad, bbox.min.z - pad];
  const [nx, ny, nz] = N;

  // Non-indexed triangle positions straight from the manifold.
  const mesh = m.getMesh();
  const np = mesh.numProp, vp = mesh.vertProperties, tv = mesh.triVerts;
  const p = new Float32Array(tv.length * 3);
  for (let i = 0; i < tv.length; i++) {
    const o = tv[i] * np;
    p[i * 3] = vp[o]; p[i * 3 + 1] = vp[o + 1]; p[i * 3 + 2] = vp[o + 2];
  }
  const votes = windingVotes(p, O, N, h);

  // Squared distance (in cells) from each cell to the nearest inside cell.
  const total = nx * ny * nz;
  const g = new Float64Array(total);
  for (let q = 0; q < total; q++) g[q] = votes[q]! >= 2 ? 0 : 1e20;
  const maxN = Math.max(nx, ny, nz);
  const f = new Float64Array(maxN), d = new Float64Array(maxN), v = new Int32Array(maxN), z = new Float64Array(maxN + 1);
  const strides = [ny * nz, nz, 1];
  for (let a = 0; a < 3; a++) {
    const n = N[a]!, st = strides[a]!;
    const [b, c] = [0, 1, 2].filter(x => x !== a) as [number, number];
    for (let i = 0; i < N[b]!; i++) for (let j = 0; j < N[c]!; j++) {
      const base = i * strides[b]! + j * strides[c]!;
      for (let k = 0; k < n; k++) f[k] = g[base + k * st]!;
      edt1d(f, n, d, v, z);
      for (let k = 0; k < n; k++) g[base + k * st] = d[k]!;
    }
  }
  // Field in mm: positive inside the offset surface.
  const field = new Float32Array(total);
  for (let q = 0; q < total; q++) field[q] = t + 0.5 * h - Math.sqrt(g[q]!) * h;

  const val = (i: number, j: number, k: number) =>
    i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz ? -t : field[(i * ny + j) * nz + k]!;
  const sdf = (pt: number[]) => {
    const fx = (pt[0]! - O[0]!) / h - 0.5, fy = (pt[1]! - O[1]!) / h - 0.5, fz = (pt[2]! - O[2]!) / h - 0.5;
    const i = Math.floor(fx), j = Math.floor(fy), k = Math.floor(fz);
    const u = fx - i, w2 = fy - j, w = fz - k;
    let s = 0;
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++)
      s += val(i + a, j + b, k + c) * (a ? u : 1 - u) * (b ? w2 : 1 - w2) * (c ? w : 1 - w);
    return s;
  };
  const out = wasm.Manifold.levelSet(sdf, { min: O, max: [O[0]! + nx * h, O[1]! + ny * h, O[2]! + nz * h] }, h, 0);
  if (!out || out.isEmpty()) return null;
  // Guarantee containment even where the grid rounded inward.
  return out.add(m);
}

/**
 * Build a MoldEnvelope from a manifold's own bounding box.
 *
 * Form-fit shells have no analytic silhouette (rect / cylinder / rounded) —
 * the outer wall IS the offset model. Downstream code (pin placement,
 * channel placement, plane sizing) only ever reasons about the envelope's
 * AABB fields, so we report `shape: 'rect'` with moldMin/moldSize set to
 * the offset solid's actual bounds. Nothing should call
 * `createMoldBoxManifold` on the result — the shell solid already exists.
 */
export function envelopeAroundManifold(
  m: any,
  axis: Axis,
  wallThickness: number,
): MoldEnvelope {
  const bb = m.boundingBox();
  return {
    shape: 'rect',
    axis,
    wallThickness,
    moldMin: new THREE.Vector3(bb.min[0], bb.min[1], bb.min[2]),
    moldSize: new THREE.Vector3(
      bb.max[0] - bb.min[0],
      bb.max[1] - bb.min[1],
      bb.max[2] - bb.min[2],
    ),
  };
}
