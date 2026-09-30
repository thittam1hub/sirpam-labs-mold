// Mold engine v3 extras: printable helper pieces that sit alongside the mold.
// Each returns null when it cannot be built; the caller adds a notice.
/* eslint-disable @typescript-eslint/no-explicit-any -- Manifold wasm handles */
import type * as THREE from 'three';
import type { Axis } from '../types';
import { axialCylinder } from './proFeatures';
import { primaryAxisIndex, lateralAxisIndices } from './moldBox';

export interface V3Extras {
  /** Printable pour funnel whose spout plugs into the pour hole. */
  pourFunnel?: boolean | undefined;
  /** Printable sleeve that slides over the seam and holds both halves shut. */
  clampJig?: boolean | undefined;
}

/** Funnel: hollow cone with a spout that plugs the pour hole. Printed spout-up. */
export function buildPourFunnel(wasm: any, o: { axis: Axis; a: number; b: number; base: number; mouthR: number; clearance: number }) {
  const spoutR = Math.max(1, o.mouthR - o.clearance);
  const wall = 1.6;
  const spoutLen = Math.max(5, o.mouthR * 1.5);
  const coneH = Math.max(15, o.mouthR * 4);
  const topR = Math.max(12, o.mouthR * 3);
  const p0 = o.base + 5, p1 = p0 + spoutLen, p2 = p1 + coneH;
  const spout = axialCylinder(wasm, o.axis, o.a, o.b, p0, p1 + 0.5, spoutR, spoutR, 32);
  const cone = axialCylinder(wasm, o.axis, o.a, o.b, p1, p2, spoutR + wall, topR, 48);
  const bore = axialCylinder(wasm, o.axis, o.a, o.b, p0 - 1, p1 + 0.6, Math.max(0.6, spoutR - wall), Math.max(0.6, spoutR - wall), 32);
  const cup = axialCylinder(wasm, o.axis, o.a, o.b, p1 + 0.5, p2 + 0.1, Math.max(0.6, spoutR - wall), topR - wall, 48);
  if (!spout || !cone || !bore || !cup) return null;
  const f = spout.add(cone).subtract(bore).subtract(cup);
  return f.isEmpty() ? null : f;
}

/** Sleeve straddling the split line: inner = mold outline + clearance. */
export function buildClampJig(wasm: any, o: {
  axis: Axis; shape: string; envMin: THREE.Vector3; envMax: THREE.Vector3; splitPos: number; clearance: number;
}) {
  const p = primaryAxisIndex(o.axis);
  const [la, lb] = lateralAxisIndices(o.axis);
  const wall = 3, half = 6, c = Math.max(0.3, o.clearance);
  const p0 = o.splitPos - half, p1 = o.splitPos + half;
  if (p0 < o.envMin.getComponent(p) || p1 > o.envMax.getComponent(p)) return null;
  const a0 = o.envMin.getComponent(la), a1 = o.envMax.getComponent(la);
  const b0 = o.envMin.getComponent(lb), b1 = o.envMax.getComponent(lb);
  const ca = (a0 + a1) / 2, cb = (b0 + b1) / 2;
  if (o.shape === 'cylinder') {
    const r = Math.max(a1 - a0, b1 - b0) / 2;
    const outer = axialCylinder(wasm, o.axis, ca, cb, p0, p1, r + c + wall, r + c + wall, 64);
    const inner = axialCylinder(wasm, o.axis, ca, cb, p0 - 1, p1 + 1, r + c, r + c, 64);
    return outer && inner ? outer.subtract(inner) : null;
  }
  // 'rounded' boxes fit a square sleeve too (the rounded corners just leave a small gap).
  if (o.shape !== 'rect' && o.shape !== 'roundedRect') return null;
  const box = (ea: number, eb: number, lo: number, hi: number) => {
    const size = [0, 0, 0], at = [0, 0, 0];
    size[la] = a1 - a0 + 2 * ea; size[lb] = b1 - b0 + 2 * eb; size[p] = hi - lo;
    at[la] = a0 - ea; at[lb] = b0 - eb; at[p] = lo;
    return wasm.Manifold.cube(size, false).translate(at);
  };
  return box(c + wall, c + wall, p0, p1).subtract(box(c, c, p0 - 1, p1 + 1));
}
