// Sirpam 3D Labs Mold — pre-flight clean-up of an uploaded mesh.
// Drops triangles that would break the solid-geometry engine: ones with
// NaN/Infinity coordinates, ones where two corners are the same point, and
// ones with (near) zero area. The repair counts are reported to the user.
import * as THREE from 'three';

export interface MeshRepairLog {
  nonFiniteTriangles: number;
  collapsedTriangles: number;
  degenerateTriangles: number;
  /** Filled in by the hole-capping step, not here. */
  closedHoles: number;
  inputTriangles: number;
  outputTriangles: number;
}

export interface MeshValidationResult {
  geometry: THREE.BufferGeometry;
  repairs: MeshRepairLog;
}

/** Triangles with less area than this (model units²) are dropped. */
const AREA_FLOOR = 1e-12;

type Reason = 'ok' | 'nonFinite' | 'collapsed' | 'degenerate';

function classify(p: ArrayLike<number>, o: number): Reason {
  for (let k = 0; k < 9; k++) if (!Number.isFinite(p[o + k]!)) return 'nonFinite';
  const same = (i: number, j: number) =>
    p[o + i] === p[o + j] && p[o + i + 1] === p[o + j + 1] && p[o + i + 2] === p[o + j + 2];
  if (same(0, 3) || same(3, 6) || same(0, 6)) return 'collapsed';
  const ex = p[o + 3]! - p[o]!, ey = p[o + 4]! - p[o + 1]!, ez = p[o + 5]! - p[o + 2]!;
  const fx = p[o + 6]! - p[o]!, fy = p[o + 7]! - p[o + 1]!, fz = p[o + 8]! - p[o + 2]!;
  const cx = ey * fz - ez * fy, cy = ez * fx - ex * fz, cz = ex * fy - ey * fx;
  return Math.hypot(cx, cy, cz) / 2 < AREA_FLOOR ? 'degenerate' : 'ok';
}

export function validateMesh(geometry: THREE.BufferGeometry): MeshValidationResult {
  const soup = geometry.index ? geometry.toNonIndexed() : geometry;
  const p = soup.getAttribute('position').array as ArrayLike<number>;
  const tris = Math.floor(p.length / 9);
  const repairs: MeshRepairLog = {
    nonFiniteTriangles: 0, collapsedTriangles: 0, degenerateTriangles: 0,
    closedHoles: 0, inputTriangles: tris, outputTriangles: 0,
  };
  const kept = new Float32Array(tris * 9);
  let n = 0;
  for (let t = 0; t < tris; t++) {
    const o = t * 9;
    const r = classify(p, o);
    if (r === 'nonFinite') repairs.nonFiniteTriangles++;
    else if (r === 'collapsed') repairs.collapsedTriangles++;
    else if (r === 'degenerate') repairs.degenerateTriangles++;
    else { for (let k = 0; k < 9; k++) kept[n++] = p[o + k]!; }
  }
  repairs.outputTriangles = n / 9;
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(n === kept.length ? kept : kept.slice(0, n), 3));
  if (soup !== geometry) soup.dispose();
  return { geometry: out, repairs };
}

export function hasRepairs(log: MeshRepairLog): boolean {
  return log.nonFiniteTriangles + log.collapsedTriangles + log.degenerateTriangles + log.closedHoles > 0;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** One plain-language sentence describing what was fixed, or null. */
export function summarizeRepairs(log: MeshRepairLog): string | null {
  if (!hasRepairs(log)) return null;
  const parts: string[] = [];
  const dropped = log.nonFiniteTriangles + log.collapsedTriangles + log.degenerateTriangles;
  if (dropped > 0) {
    const why: string[] = [];
    if (log.nonFiniteTriangles) why.push(`${log.nonFiniteTriangles} with invalid coordinates`);
    if (log.collapsedTriangles) why.push(`${log.collapsedTriangles} collapsed to a line`);
    if (log.degenerateTriangles) why.push(`${log.degenerateTriangles} with almost no area`);
    parts.push(`removed ${plural(dropped, 'broken triangle')} (${why.join(', ')})`);
  }
  if (log.closedHoles > 0) parts.push(`closed ${plural(log.closedHoles, 'open hole')} so the model is a solid`);
  return `We fixed your model: ${parts.join('; ')}. If this keeps happening, clean up the file in your 3D modelling app.`;
}
