// Sirpam 3D Labs Mold — auto draft (taper) for the master model.
// Moving away from the split plane, every point is pulled toward the model's
// centre line by distance × tan(angle). Straight walls gain that draft angle,
// so casts slide out instead of dragging. Runs on the page thread and goes
// through replaceModel (undoable), so the mold pipeline is untouched.
import * as THREE from 'three';
import type { Axis } from '../types';

const IDX: Record<Axis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };

export function addDraft(
  model: THREE.BufferGeometry, bbox: THREE.Box3, axis: Axis, offset: number, angleDeg: number,
): THREE.BufferGeometry {
  const a = Math.min(5, Math.max(0.25, angleDeg));
  const t = Math.tan((a * Math.PI) / 180);
  const out = model.clone();
  const pos = out.getAttribute('position') as THREE.BufferAttribute;
  const k = IDX[axis];
  const [u, v] = [0, 1, 2].filter(i => i !== k) as [number, number];
  const min = bbox.min.toArray(), max = bbox.max.toArray();
  const split = min[k]! + (max[k]! - min[k]!) * offset;
  const cu = (min[u]! + max[u]!) / 2, cv = (min[v]! + max[v]!) / 2;
  const arr = pos.array as Float32Array;
  for (let i = 0; i < pos.count; i++) {
    const o = i * 3;
    const d = Math.abs(arr[o + k]! - split);
    const du = arr[o + u]! - cu, dv = arr[o + v]! - cv;
    const r = Math.hypot(du, dv);
    if (r < 1e-6) continue;
    const nr = Math.max(r - d * t, r * 0.2);
    arr[o + u] = cu + (du * nr) / r;
    arr[o + v] = cv + (dv * nr) / r;
  }
  pos.needsUpdate = true;
  out.computeVertexNormals();
  out.computeBoundingBox();
  return out;
}
