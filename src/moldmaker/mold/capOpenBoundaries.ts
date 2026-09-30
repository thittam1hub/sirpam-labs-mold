// Sirpam 3D Labs Mold — close open holes in a mesh (e.g. the mouth of a
// hollow vase) so it becomes a solid the mold engine can subtract.
//
// Method: weld vertices, find edges used by only one triangle (the rim of a
// hole), chain those edges into loops, and fill every loop with a triangle
// fan around its centre. The fan is wound opposite to the rim edges so the
// new faces point the same way as the rest of the surface.
import * as THREE from 'three';
import { MERGE_TOLERANCE } from './constants';

export interface CapResult {
  geometry: THREE.BufferGeometry;
  holesClosed: number;
}

export function capOpenBoundaries(geometry: THREE.BufferGeometry): CapResult {
  const soup = geometry.index ? geometry.toNonIndexed() : geometry;
  const src = soup.getAttribute('position').array as ArrayLike<number>;
  const cornerCount = Math.floor(src.length / 3);

  // 1. Weld: snap each corner to a grid of MERGE_TOLERANCE and share ids.
  const idOf = new Map<string, number>();
  const verts: number[] = [];
  const corner = new Int32Array(cornerCount);
  for (let i = 0; i < cornerCount; i++) {
    const x = src[3 * i]!, y = src[3 * i + 1]!, z = src[3 * i + 2]!;
    const k = `${Math.round(x / MERGE_TOLERANCE)}|${Math.round(y / MERGE_TOLERANCE)}|${Math.round(z / MERGE_TOLERANCE)}`;
    let id = idOf.get(k);
    if (id === undefined) { id = verts.length / 3; idOf.set(k, id); verts.push(x, y, z); }
    corner[i] = id;
  }
  const V = verts.length / 3;

  // 2. Count uses of every undirected edge; remember each directed edge.
  const uses = new Map<number, number>();
  const edges: number[] = [];
  const ukey = (a: number, b: number) => (a < b ? a * V + b : b * V + a);
  for (let t = 0; t + 2 < cornerCount; t += 3) {
    const a = corner[t]!, b = corner[t + 1]!, c = corner[t + 2]!;
    if (a === b || b === c || a === c) continue;
    for (const [p, q] of [[a, b], [b, c], [c, a]] as const) {
      uses.set(ukey(p, q), (uses.get(ukey(p, q)) ?? 0) + 1);
      edges.push(p, q);
    }
  }

  // 3. Rim edges (used once) → successor map, then walk loops.
  const next = new Map<number, number>();
  for (let i = 0; i < edges.length; i += 2) {
    const p = edges[i]!, q = edges[i + 1]!;
    if (uses.get(ukey(p, q)) === 1 && !next.has(p)) next.set(p, q);
  }

  const copy = () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(src), 3));
    return g;
  };
  if (next.size === 0) {
    const g = copy();
    if (soup !== geometry) soup.dispose();
    return { geometry: g, holesClosed: 0 };
  }

  const seen = new Set<number>();
  const loops: number[][] = [];
  for (const start of next.keys()) {
    if (seen.has(start)) continue;
    const loop: number[] = [];
    let v: number | undefined = start;
    while (v !== undefined && !seen.has(v)) {
      seen.add(v);
      loop.push(v);
      v = next.get(v);
    }
    if (loop.length >= 3) loops.push(loop);
  }

  // 4. Fan-fill each loop from its centroid, reversed winding.
  const fill: number[] = [];
  const at = (v: number, k: number) => verts[3 * v + k]!;
  for (const loop of loops) {
    const c = [0, 1, 2].map(k => loop.reduce((s, v) => s + at(v, k), 0) / loop.length) as [number, number, number];
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i]!, b = loop[(i + 1) % loop.length]!;
      fill.push(c[0], c[1], c[2], at(b, 0), at(b, 1), at(b, 2), at(a, 0), at(a, 1), at(a, 2));
    }
  }

  const out = new Float32Array(src.length + fill.length);
  out.set(src as ArrayLike<number>, 0);
  out.set(fill, src.length);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(out, 3));
  if (soup !== geometry) soup.dispose();
  return { geometry: g, holesClosed: loops.length };
}
