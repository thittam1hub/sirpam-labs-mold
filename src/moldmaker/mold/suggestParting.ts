import * as THREE from 'three';
import type { Axis } from '../types';
import { undercutFraction } from './draftAnalysis';
import { ENABLE_OBLIQUE_PLANES } from './constants';
import { MAX_CUT_ANGLE_DEGREES } from './planeGeometry';

/**
 * Split advisor — sweeps candidate parting setups and scores each with the
 * strict undercut metric the draft heatmap already uses, so the suggestion
 * optimizes the same thing the user sees painted on the model.
 *
 * Grid: 3 axes × 5 offsets × 3 tilts = 45 candidates. Each scoring pass is
 * linear in triangles and shares the non-indexed-positions cache, so the
 * whole sweep stays well under a second even on detailed meshes — and it
 * runs in the mold worker anyway (see workerProtocol 'suggest').
 *
 * Scoring: minimize the fraction of TRUE undercuts (score < -0.05 — faces
 * that physically lock the part in the mold). A tiny balance term prefers
 * offsets near the middle so we don't recommend a sliver-thin top half.
 * Ties break toward smaller tilt: axis-aligned cuts print and seal better.
 */
export interface SuggestResult {
  axis: Axis;
  offset: number;
  cutAngle: number;
  /** Undercut fraction of the winner, 0..1 — surfaced to the user. */
  undercut: number;
  /** How many candidates were evaluated (for the status line). */
  evaluated: number;
}

const OFFSETS = [0.3, 0.4, 0.5, 0.6, 0.7];
const TILTS = ENABLE_OBLIQUE_PLANES
  ? [0, -Math.round(MAX_CUT_ANGLE_DEGREES * 0.4), Math.round(MAX_CUT_ANGLE_DEGREES * 0.4)]
  : [0];

const COARSE_TRI_BUDGET = 40000;

/** Every k-th triangle of the mesh — a fast stand-in for the coarse sweep. */
function subsample(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const src = geometry.index ? geometry.toNonIndexed() : geometry;
  const pos = src.getAttribute('position').array as Float32Array;
  const tris = pos.length / 9;
  if (tris <= COARSE_TRI_BUDGET) return src;
  const step = Math.ceil(tris / COARSE_TRI_BUDGET);
  const out = new Float32Array(Math.ceil(tris / step) * 9);
  let o = 0;
  for (let t = 0; t < tris; t += step) {
    out.set(pos.subarray(t * 9, t * 9 + 9), o);
    o += 9;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(out.subarray(0, o), 3));
  return g;
}

/**
 * Offset (0..1) of the widest cross-section along an axis — where a shop
 * would draw the parting line so neither half has to pass a wider section.
 */
export function widestOutlineOffset(geometry: THREE.BufferGeometry, axis: Axis, bbox: THREE.Box3): number {
  const i = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
  const [ja, jb] = i === 0 ? [1, 2] : i === 1 ? [0, 2] : [0, 1];
  const lo = bbox.min.getComponent(i), span = bbox.max.getComponent(i) - lo;
  if (span <= 0) return 0.5;
  const BINS = 40;
  const mnA = new Array(BINS).fill(Infinity), mxA = new Array(BINS).fill(-Infinity);
  const mnB = new Array(BINS).fill(Infinity), mxB = new Array(BINS).fill(-Infinity);
  const pos = geometry.getAttribute('position').array as ArrayLike<number>;
  for (let v = 0; v + 2 < pos.length; v += 3) {
    const k = Math.min(BINS - 1, Math.max(0, Math.floor(((pos[v + i]! - lo) / span) * BINS)));
    const a = pos[v + ja]!, b = pos[v + jb]!;
    if (a < mnA[k]) mnA[k] = a; if (a > mxA[k]) mxA[k] = a;
    if (b < mnB[k]) mnB[k] = b; if (b > mxB[k]) mxB[k] = b;
  }
  let best = -1, at = 0.5;
  for (let k = 0; k < BINS; k++) {
    if (!isFinite(mnA[k])) continue;
    const area = (mxA[k] - mnA[k]) * (mxB[k] - mnB[k]);
    if (area > best + 1e-9) { best = area; at = (k + 0.5) / BINS; }
  }
  return Math.round(Math.max(0.15, Math.min(0.85, at)) * 100) / 100;
}

const scoreOf = (undercut: number, offset: number, cutAngle: number) =>
  undercut + 0.02 * Math.abs(offset - 0.5) + Math.abs(cutAngle) * 0.0005;

/**
 * Coarse-to-fine: sweep the 45-candidate grid on a subsampled mesh (fast on
 * big STLs), then refine the top 3 on the full mesh with 2% offset steps and
 * finer tilts so the answer is more precise than the old 10% grid.
 */
export function suggestBestParting(
  geometry: THREE.BufferGeometry,
  bbox: THREE.Box3,
): SuggestResult {
  const axes: Axis[] = ['x', 'y', 'z'];
  const coarseGeo = subsample(geometry);
  const coarse: SuggestResult[] = [];
  let evaluated = 0;

  for (const axis of axes) {
    for (const offset of OFFSETS) {
      for (const cutAngle of TILTS) {
        const undercut = undercutFraction(coarseGeo, axis, offset, bbox, cutAngle);
        evaluated++;
        coarse.push({ axis, offset, cutAngle, undercut, evaluated: 0 });
      }
    }
  }
  if (coarse.length === 0) {
    return { axis: 'z', offset: 0.5, cutAngle: 0, undercut: 0, evaluated: 0 };
  }
  coarse.sort((a, b) => scoreOf(a.undercut, a.offset, a.cutAngle) - scoreOf(b.undercut, b.offset, b.cutAngle));

  let best: SuggestResult | null = null;
  let bestScore = Infinity;
  const maxTilt = ENABLE_OBLIQUE_PLANES ? MAX_CUT_ANGLE_DEGREES : 0;
  // Seed the fine pass with the widest-outline split on every axis too.
  const seeds = [...coarse.slice(0, 3)];
  for (const axis of axes) {
    const offset = widestOutlineOffset(geometry, axis, bbox);
    const undercut = undercutFraction(coarseGeo, axis, offset, bbox, 0);
    evaluated++;
    seeds.push({ axis, offset, cutAngle: 0, undercut, evaluated: 0 });
  }
  for (const seed of seeds) {
    const tilts = ENABLE_OBLIQUE_PLANES
      ? [...new Set([-5, 0, 5].map((d) => Math.max(-maxTilt, Math.min(maxTilt, seed.cutAngle + d))))]
      : [0];
    for (let d = -0.1; d <= 0.1001; d += 0.02) {
      const offset = Math.round(Math.max(0.15, Math.min(0.85, seed.offset + d)) * 100) / 100;
      for (const cutAngle of tilts) {
        const undercut = undercutFraction(geometry, seed.axis, offset, bbox, cutAngle);
        evaluated++;
        const score = scoreOf(undercut, offset, cutAngle);
        if (score < bestScore) {
          bestScore = score;
          best = { axis: seed.axis, offset, cutAngle, undercut, evaluated: 0 };
        }
      }
    }
  }
  const result = (best ?? coarse[0])!;
  return { ...result, evaluated };
}
