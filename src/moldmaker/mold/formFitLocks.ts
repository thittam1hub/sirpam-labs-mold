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
  inset: number = lockR + clearance + 0.4,
  startAngle: number = Math.PI / 4,
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
    const safe = section.offset(-inset, 'Round');
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
  const start = startAngle;
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

function permMats(axis: Axis) {
  const pi = primaryAxisIndex(axis);
  const [la, lb] = lateralAxisIndices(axis);
  const M = new Array(16).fill(0), Mi = new Array(16).fill(0);
  M[la * 4 + 0] = 1; M[lb * 4 + 1] = 1; M[pi * 4 + 2] = 1; M[15] = 1;
  // Inverse of a permutation = transpose.
  Mi[0 * 4 + la] = 1; Mi[1 * 4 + lb] = 1; Mi[2 * 4 + pi] = 1; Mi[15] = 1;
  return { M, Mi };
}

/**
 * Parting flange for hug molds: a flat plate around the split that follows
 * the shell's outline, `widthMm` wider than it, `thicknessMm` thick (half
 * above, half below the split). `solidOuter` is the outer shell INCLUDING
 * the cavity (no hole), so the flange never intrudes into the cavity.
 * Returns the flange minus `solidOuter`, or null if it could not be built.
 */
export function buildPartingFlange(
  wasm: any, solidOuter: any, axis: Axis, splitPos: number, widthMm: number, thicknessMm: number,
): any | null {
  try {
    const { M, Mi } = permMats(axis);
    const section = solidOuter.transform(M).slice(splitPos).offset(widthMm, 'Round');
    const plate = (typeof section.extrude === 'function'
      ? section.extrude(thicknessMm)
      : wasm.Manifold.extrude(section, thicknessMm))
      .translate([0, 0, splitPos - thicknessMm / 2])
      .transform(Mi);
    const out = plate.subtract(solidOuter);
    return out.isEmpty?.() ? null : out;
  } catch (e) {
    console.warn('Parting flange failed', e);
    return null;
  }
}

export interface HugLockPlan {
  positions: number[][];
  lockR: number;
  /** Pads to add (straddling the split) when the wall is too thin. */
  pads: { at: number[]; r: number; halfHeight: number }[];
  notices: string[];
}

/**
 * Shared lock planner for hug shells (rigid and silicone): try full-size
 * locks in the real wall, shrink them, then fall back to pads, and report
 * every fallback in plain language.
 */
export function planHugLocks(
  wasm: any, shell: any, axis: Axis, splitPos: number, center: { a: number; b: number },
  baseR: number, clearance: number, want: number, pinHeight: number,
  opts: { square?: boolean; magnet?: boolean } = {},
): HugLockPlan {
  const notices: string[] = [];
  const eff = (r: number) => (opts.square ? r * Math.SQRT2 : r);
  let fitted: number[][] = [];
  let lockR = baseR;
  for (const f of [1, 0.75, 0.55]) {
    const r = Math.max(0.75, baseR * f);
    fitted = fitFormFitLocks(wasm, shell, axis, splitPos, center, eff(r), clearance, want);
    lockR = r;
    if (fitted.length >= want || r === 0.75) break;
  }
  const pads: HugLockPlan['pads'] = [];
  if (fitted.length < want) {
    lockR = baseR;
    fitted = fitFormFitLocks(wasm, shell, axis, splitPos, center, 0, 0, want, 0.3);
    const r = eff(lockR) + clearance + 1.6;
    const halfHeight = Math.max(pinHeight / 2 + clearance + 1.2, opts.magnet ? 4.4 : 0);
    for (const at of fitted) pads.push({ at, r, halfHeight });
    if (fitted.length) notices.push('The form-fit wall is thinner than the locks, so small round pads were added on the outside of the split to hold them. A parting flange gives a cleaner result.');
  } else if (lockR < baseR) {
    notices.push(`The form-fit wall is thin, so the locks were made smaller (${(lockR * 2).toFixed(1)} mm across) to fit inside it.`);
  }
  if (fitted.length < want) {
    notices.push(fitted.length === 0
      ? 'No room for locks on this form-fit shell, so this mold has none. Increase the wall thickness, add a parting flange, or use a box shell.'
      : `Only ${fitted.length} of ${want} locks fit on this form-fit shell. Increase the wall thickness or add a parting flange for more.`);
  }
  return { positions: fitted, lockR, pads, notices };
}

/** Highest points of a mesh along the pour axis, spread apart laterally. */
export function cavityHighPoints(positions: ArrayLike<number>, axis: Axis, count: number, minSpacing: number): number[][] {
  const pi = primaryAxisIndex(axis);
  const [la, lb] = lateralAxisIndices(axis);
  const cell = Math.max(minSpacing, 1e-3);
  const best = new Map<string, number[]>();
  for (let i = 0; i < positions.length; i += 3) {
    const p = [positions[i]!, positions[i + 1]!, positions[i + 2]!];
    const key = `${Math.floor(p[la]! / cell)},${Math.floor(p[lb]! / cell)}`;
    const cur = best.get(key);
    if (!cur || p[pi]! > cur[pi]!) best.set(key, p);
  }
  const sorted = [...best.values()].sort((u, v) => v[pi]! - u[pi]!);
  const out: number[][] = [];
  for (const p of sorted) {
    if (out.every(q => Math.hypot(q[la]! - p[la]!, q[lb]! - p[lb]!) >= minSpacing)) out.push(p);
    if (out.length >= count) break;
  }
  return out;
}

/**
 * Through-holes for clamp bolts in a parting flange, placed between the
 * locks (rotated 45 degrees from them). Returns cutters to subtract from
 * both halves, and how many fitted.
 */
export function flangeBoltCutters(
  wasm: any, shellWithFlange: any, axis: Axis, splitPos: number, center: { a: number; b: number },
  boltMm: number, flangeThickness: number, count: number,
): any[] {
  const r = boltMm / 2 + 0.2;
  const at = fitFormFitLocks(wasm, shellWithFlange, axis, splitPos, center, r, 0, count, r + 1.2, 0);
  const pi = primaryAxisIndex(axis);
  const { Mi } = permMats(axis);
  return at.map(p => {
    const [la, lb] = lateralAxisIndices(axis);
    return wasm.Manifold.cylinder(flangeThickness + 4, r, r, 24, true)
      .translate([p[la]!, p[lb]!, p[pi]!]).transform(Mi);
  });
}

/**
 * Skin registration rim: a thin ring sticking out of the silicone skin at
 * the split, so the skin keys into a groove in the mother mold and cannot
 * slip. Returns the ring solid (add it to the skin volume) or null.
 */
export function skinRim(wasm: any, skin: any, axis: Axis, splitPos: number, widthMm: number, heightMm: number): any | null {
  try {
    const { M, Mi } = permMats(axis);
    const sec = skin.transform(M).slice(splitPos);
    const ring = sec.offset(widthMm, 'Round').subtract(sec);
    const solid = (typeof ring.extrude === 'function' ? ring.extrude(heightMm) : wasm.Manifold.extrude(ring, heightMm))
      .translate([0, 0, splitPos - heightMm / 2]).transform(Mi);
    return solid.isEmpty?.() ? null : solid;
  } catch (e) {
    console.warn('Skin rim failed', e);
    return null;
  }
}

/**
 * Parting board for two-part silicone block molds: a flat plate that fills
 * the cavity just below the split, with the model's outline cut out and
 * hemispherical key bumps on top. The caster sets the master in it, pours
 * the first half, and the bumps leave key sockets in that silicone.
 */
export function partingBoard(
  wasm: any, cavity: any, master: any, axis: Axis, splitPos: number, center: { a: number; b: number },
  thicknessMm: number, keyR: number, clearance: number,
): { board: any; keys: number } | null {
  try {
    const { M, Mi } = permMats(axis);
    const sec = cavity.transform(M).slice(splitPos).offset(-clearance, 'Round');
    let board = (typeof sec.extrude === 'function' ? sec.extrude(thicknessMm) : wasm.Manifold.extrude(sec, thicknessMm))
      .translate([0, 0, splitPos - thicknessMm]).transform(Mi);
    board = board.subtract(master);
    // Keys sit in the silicone zone: between the model and the cavity wall.
    const ringSolid = board;
    const at = fitFormFitLocks(wasm, ringSolid, axis, splitPos - thicknessMm / 2, center, keyR, 0, 4, keyR + 1);
    const pi = primaryAxisIndex(axis);
    const [la, lb] = lateralAxisIndices(axis);
    for (const p of at) {
      const pos = [0, 0, 0]; pos[pi] = splitPos; pos[la] = p[la]!; pos[lb] = p[lb]!;
      const ball = wasm.Manifold.sphere(keyR, 24).translate(pos);
      const half = ball.intersect(board.boundingBox ? wasm.Manifold.cube([1e4, 1e4, 1e4], true).translate(pos.map((v: number, i: number) => i === pi ? v + 5e3 : v)) : ball);
      board = board.add(half);
    }
    return board.isEmpty?.() ? null : { board, keys: at.length };
  } catch (e) {
    console.warn('Parting board failed', e);
    return null;
  }
}

/**
 * Flat-base core seat for skin molds: if the model has a flat bottom, fill the
 * skin gap under it with a footprint-shaped platform and add a thin collar of
 * `lipMm` gripping the bottom edge. The skin's bottom stays
 * open as the casting fill hole. Returns null when the bottom is not flat.
 */
export function flatBaseSeat(wasm: any, master: any, axis: Axis, skinMm: number, floorMm: number, lipMm = 1.5): any | null {
  try {
    const { M, Mi } = permMats(axis);
    const m = master.transform(M);
    const bb = m.boundingBox();
    const z0 = bb.min[2] as number, z1 = bb.max[2] as number;
    const foot = m.slice(z0 + Math.min(0.3, (z1 - z0) * 0.02));
    const mid = m.slice((z0 + z1) / 2);
    const fa = foot.area(), ma = mid.area();
    if (!(fa > 25 && fa > ma * 0.3)) return null;
    const ext = (cs: any, h: number) => (typeof cs.extrude === 'function' ? cs.extrude(h) : wasm.Manifold.extrude(cs, h));
    const platform = ext(foot, skinMm + 0.6).translate([0, 0, z0 - skinMm - 0.5]);
    const ring = foot.offset(lipMm, 'Round').subtract(foot);
    const collar = ext(ring, Math.min(2, skinMm) + 0.5).translate([0, 0, z0 - 0.5]);
    void floorMm;
    return { platform: platform.transform(Mi), collar: collar.transform(Mi) };
  } catch (e) {
    console.warn('Flat base seat failed', e);
    return null;
  }
}
