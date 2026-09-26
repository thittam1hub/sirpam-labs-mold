// @ts-nocheck — upstream mold-maker code; type-checked under its own repo tsconfig
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

export function suggestBestParting(
  geometry: THREE.BufferGeometry,
  bbox: THREE.Box3,
): SuggestResult {
  const axes: Axis[] = ['x', 'y', 'z'];
  let best: SuggestResult | null = null;
  let bestScore = Infinity;
  let evaluated = 0;

  for (const axis of axes) {
    for (const offset of OFFSETS) {
      for (const cutAngle of TILTS) {
        const undercut = undercutFraction(geometry, axis, offset, bbox, cutAngle);
        // Primary: fewer true undercuts. Secondary: prefer centered splits
        // (balanced halves). Tertiary: prefer no tilt.
        const score =
          undercut +
          0.02 * Math.abs(offset - 0.5) +
          Math.abs(cutAngle) * 0.0005;
        evaluated++;
        if (score < bestScore) {
          bestScore = score;
          best = { axis, offset, cutAngle, undercut, evaluated };
        }
      }
    }
  }

  if (!best) {
    // Unreachable with a non-empty grid, but keep a sane fallback.
    return { axis: 'z', offset: 0.5, cutAngle: 0, undercut: 0, evaluated: 0 };
  }
  return best;
}
