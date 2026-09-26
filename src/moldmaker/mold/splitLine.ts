// @ts-nocheck — upstream mold-maker code; type-checked under its own repo tsconfig
import * as THREE from 'three';
import type { Axis } from '../types';
import { planeFromBox, signedDistance } from './planeGeometry';
import { getNonIndexedPositions } from './draftAnalysis';

/**
 * Split-line preview — computes the polyline where the parting plane cuts
 * through the model surface, so the user sees exactly where the seam will
 * land BEFORE committing to a multi-second CSG run.
 *
 * The math is the classic plane/mesh intersection: for every triangle, find
 * the edges whose two endpoints sit on opposite sides of the plane (signed
 * distance sign flip) and lerp the crossing point. A triangle that the plane
 * genuinely crosses contributes exactly two such points → one line segment.
 * Degenerate cases (a vertex exactly ON the plane) contribute 0 or 1 —
 * harmless: they just don't draw, and neighbors cover the gap.
 *
 * Linear in triangle count and shares the non-indexed-positions cache with
 * the heatmap, so it's cheap enough to rebuild on every slider tick.
 */

export function buildSplitLineGeometry(
  source: THREE.BufferGeometry,
  axis: Axis,
  offset: number,
  bbox: THREE.Box3,
  cutAngle = 0,
): THREE.BufferGeometry {
  const positions = getNonIndexedPositions(source);
  const triCount = positions.length / 9;
  const plane = planeFromBox(bbox, axis, offset, cutAngle);

  // Worst case: every triangle crossed → 2 points per triangle. We trim via
  // setDrawRange so unused capacity never draws.
  const out = new Float32Array(triCount * 6);
  let seg = 0;

  const d = [0, 0, 0];
  const px = [0, 0, 0];

  for (let t = 0; t < triCount; t++) {
    const i0 = t * 9;

    // Signed distance of each vertex to the plane.
    for (let v = 0; v < 3; v++) {
      const vi = i0 + v * 3;
      const p: [number, number, number] = [
        positions[vi], positions[vi + 1], positions[vi + 2],
      ];
      d[v] = signedDistance(p, plane);
      px[v] = vi;
    }

    // Walk the three edges; collect crossing points.
    const crossings: number[] = []; // flattened x,y,z
    for (let e = 0; e < 3; e++) {
      const a = e;
      const b = (e + 1) % 3;
      if ((d[a] > 0 && d[b] < 0) || (d[a] < 0 && d[b] > 0)) {
        const tCross = d[a] / (d[a] - d[b]);
        const ai = px[a];
        const bi = px[b];
        crossings.push(
          positions[ai] + (positions[bi] - positions[ai]) * tCross,
          positions[ai + 1] + (positions[bi + 1] - positions[ai + 1]) * tCross,
          positions[ai + 2] + (positions[bi + 2] - positions[ai + 2]) * tCross,
        );
      }
    }

    if (crossings.length >= 6) {
      const o = seg * 6;
      out[o] = crossings[0]; out[o + 1] = crossings[1]; out[o + 2] = crossings[2];
      out[o + 3] = crossings[3]; out[o + 4] = crossings[4]; out[o + 5] = crossings[5];
      seg++;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(out, 3));
  geo.setDrawRange(0, seg * 2);
  return geo;
}
