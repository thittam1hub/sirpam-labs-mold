// @ts-nocheck — Manifold wasm handles are untyped here, like the rest of the engine
import type { Axis } from '../types';
import { lateralAxisIndices, primaryAxisIndex } from './moldBox';

/**
 * Lock positions for form-fit shells.
 *
 * The box-mold lock placer uses the envelope's bounding-box corners. A
 * form-fit shell hugs the model, so those corners are empty air: pins
 * floated and sockets cut nothing. Here we slice the actual shell at the
 * split, shrink that ring by the lock radius + fit gap + a margin, and
 * put each lock in the middle of the outermost wall along evenly spaced
 * directions from the model's centre.
 *
 * Returns 3D positions (on the split plane). Fewer than requested means the
 * wall is too thin there; callers must tell the user.
 */
export function fitFormFitLocks(
  wasm: any,
  shell: any,
  axis: Axis,
  splitPos: number,
  center: { a: number; b: number },
  lockR: number,
  clearance: number,
  count: number,
): number[][] {
  const pi = primaryAxisIndex(axis);
  const [la, lb] = lateralAxisIndices(axis);
  // Cyclic permutation (a proper rotation): new = (p[la], p[lb], p[pi]).
  // Column-major 4x4 (Manifold's transform takes a full Mat4).
  const M = new Array(16).fill(0);
  M[la * 4 + 0] = 1; // column la, row 0
  M[lb * 4 + 1] = 1; // column lb, row 1
  M[pi * 4 + 2] = 1; // column pi, row 2
  M[15] = 1;
  let polys: number[][][] = [];
  try {
    const section = shell.transform(M).slice(splitPos);
    const safe = section.offset(-(lockR + clearance + 0.4), 'Round');
    polys = safe.toPolygons().map((poly: any) => Array.from(poly, (pt: any) => [pt[0] ?? pt.x, pt[1] ?? pt.y]));
  } catch (e) {
    console.warn('Form-fit lock slice failed', e);
    return [];
  }
  if (polys.length === 0) return [];

  const inside = (x: number, y: number) => {
    let c = false;
    for (const poly of polys) {
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i]!, [xj, yj] = poly[j]!;
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
      }
    }
    return c;
  };

  let maxR = 0;
  for (const poly of polys) for (const [x, y] of poly) maxR = Math.max(maxR, Math.hypot(x - center.a, y - center.b));
  const step = Math.max(0.1, maxR / 600);
  const out: number[][] = [];
  const start = Math.PI / 4;
  for (let k = 0; k < count; k++) {
    const th = start + (k * 2 * Math.PI) / count;
    const dx = Math.cos(th), dy = Math.sin(th);
    // Outermost contiguous run of safe material along the ray.
    let runStart = -1, bestA = -1, bestB = -1;
    for (let s = 0; s <= maxR + step; s += step) {
      const ok = inside(center.a + dx * s, center.b + dy * s);
      if (ok && runStart < 0) runStart = s;
      if (!ok && runStart >= 0) { bestA = runStart; bestB = s - step; runStart = -1; }
    }
    if (runStart >= 0) { bestA = runStart; bestB = maxR; }
    if (bestA < 0) continue;
    const s = (bestA + bestB) / 2;
    const p = [0, 0, 0];
    p[la] = center.a + dx * s; p[lb] = center.b + dy * s; p[pi] = splitPos;
    out.push(p);
  }
  return out;
}
