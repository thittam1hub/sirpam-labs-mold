// Sirpam 3D Labs Mold — the seam line where the split plane cuts the model.
// For every triangle that straddles the plane, the two edge crossings form
// one line segment. Result is a LineSegments-ready geometry.
import * as THREE from 'three';
import type { Axis } from '../types';
import { planeFromBox } from './planeGeometry';
import { getNonIndexedPositions } from './draftAnalysis';

export function buildSplitLineGeometry(
  source: THREE.BufferGeometry, axis: Axis, offset: number, bbox: THREE.Box3, cutAngle = 0,
): THREE.BufferGeometry {
  const p = getNonIndexedPositions(source);
  const { normal: [nx, ny, nz], originOffset } = planeFromBox(bbox, axis, offset, cutAngle);
  const tris = Math.floor(p.length / 9);
  const out = new Float32Array(tris * 6);
  let n = 0;
  const dist = [0, 0, 0];
  for (let t = 0; t < tris; t++) {
    const o = t * 9;
    for (let v = 0; v < 3; v++) {
      const i = o + v * 3;
      dist[v] = p[i]! * nx + p[i + 1]! * ny + p[i + 2]! * nz - originOffset;
    }
    const start = n;
    for (let e = 0; e < 3 && n - start < 6; e++) {
      const a = e, b = (e + 1) % 3;
      const da = dist[a]!, db = dist[b]!;
      if (!((da > 0 && db < 0) || (da < 0 && db > 0))) continue;
      const k = da / (da - db);
      const ia = o + a * 3, ib = o + b * 3;
      for (let c = 0; c < 3; c++) out[n++] = p[ia + c]! + (p[ib + c]! - p[ia + c]!) * k;
    }
    if (n - start < 6) n = start; // only one crossing — not a segment
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(out, 3));
  g.setDrawRange(0, n / 3);
  return g;
}
