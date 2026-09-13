import * as THREE from 'three';
import { MERGE_TOLERANCE } from './constants';

/**
 * Close open boundaries (holes) in a triangle mesh so it becomes watertight.
 *
 * Why this exists: Manifold WASM requires watertight input. An open-topped
 * vessel (a plant pot, a jar, a cup) is non-watertight at the rim, so it
 * fails `geometryToManifold` with a "not manifold" error before any mold
 * logic runs. This is the first, riskiest step of hollow-vessel support
 * (see the hollow-object plan): make the open mesh watertight by detecting
 * the boundary loops and capping them.
 *
 * How it works:
 *   1. Weld vertices by position. STL stores each triangle with its own 3
 *      vertices, so shared edges look distinct until we merge coincident
 *      points. We reuse the same tolerance bucketing as geometryToManifold.
 *   2. Count how many triangles use each undirected edge. An edge used by
 *      exactly ONE triangle is a boundary edge (interior edges are shared by
 *      two triangles in a closed mesh).
 *   3. Chain the boundary edges (kept as DIRECTED half-edges) into closed
 *      loops by following shared endpoints.
 *   4. Fan-triangulate each loop from its centroid and append the new caps.
 *
 * Limitations (acceptable for the plant-pot / jar MVP):
 *   • Fan-from-centroid assumes each loop is roughly planar and convex-ish.
 *     A rim that is wildly non-planar or strongly concave can produce a cap
 *     with slightly overlapping triangles, but Manifold's merge tolerates
 *     minor imperfection and the result is still watertight enough to mold.
 *   • Nested/branching boundaries (a hole within a cap) aren't handled — each
 *     loop is capped independently.
 *
 * Pure function: returns a fresh non-indexed BufferGeometry plus a count of
 * holes closed. Does not mutate the input.
 */

export interface CapResult {
  geometry: THREE.BufferGeometry;
  /** Number of distinct boundary loops that were capped. 0 → input was
   *  already watertight (or had no detectable open boundary). */
  holesClosed: number;
}

/** Quantize a coordinate to the merge grid so coincident verts share a key. */
function keyFor(x: number, y: number, z: number): string {
  const q = MERGE_TOLERANCE;
  return `${Math.round(x / q)},${Math.round(y / q)},${Math.round(z / q)}`;
}

/**
 * Cap all open boundary loops in the geometry. See module doc for the
 * algorithm. Returns the original geometry untouched (as a fresh clone) with
 * `holesClosed: 0` when nothing needed capping.
 */
export function capOpenBoundaries(geometry: THREE.BufferGeometry): CapResult {
  const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry;
  const positions = nonIndexed.attributes.position.array as Float32Array | Float64Array;
  const triCount = positions.length / 9;

  // ── 1. Weld vertices by position ──
  // weldId[i] maps the i-th raw vertex (0..3*triCount-1) to a canonical
  // welded vertex index. uniquePos stores one representative position per
  // welded vertex.
  const keyToWelded = new Map<string, number>();
  const uniquePos: number[] = []; // flat x,y,z per welded vertex
  const rawCount = positions.length / 3;
  const weldId = new Int32Array(rawCount);

  for (let i = 0; i < rawCount; i++) {
    const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
    const key = keyFor(x, y, z);
    let id = keyToWelded.get(key);
    if (id === undefined) {
      id = uniquePos.length / 3;
      keyToWelded.set(key, id);
      uniquePos.push(x, y, z);
    }
    weldId[i] = id;
  }

  // ── 2. Count undirected edges; remember directed half-edges ──
  // edgeCount keys an undirected edge "min,max". For boundary chaining we
  // also store the DIRECTED edge (a→b in the triangle's winding) so the cap
  // can be wound consistently (opposite the boundary, i.e. facing outward).
  const edgeCount = new Map<string, number>();
  // directed half-edge a→b, only the ones we'll later confirm are boundary.
  const directed: Array<[number, number]> = [];

  const undirKey = (a: number, b: number) => (a < b ? `${a},${b}` : `${b},${a}`);

  for (let t = 0; t < triCount; t++) {
    const v0 = weldId[t * 3], v1 = weldId[t * 3 + 1], v2 = weldId[t * 3 + 2];
    // Skip welded-degenerate triangles (two corners merged to the same vert);
    // they contribute no real edges and would corrupt boundary counts.
    if (v0 === v1 || v1 === v2 || v0 === v2) continue;
    const tris: Array<[number, number]> = [[v0, v1], [v1, v2], [v2, v0]];
    for (const [a, b] of tris) {
      const k = undirKey(a, b);
      edgeCount.set(k, (edgeCount.get(k) ?? 0) + 1);
      directed.push([a, b]);
    }
  }

  // Boundary half-edges: those whose undirected edge is used exactly once.
  const boundaryNext = new Map<number, number>(); // a → b along the boundary
  for (const [a, b] of directed) {
    if (edgeCount.get(undirKey(a, b)) === 1) {
      // A well-formed single boundary loop visits each start vertex once.
      // If a vertex starts two boundary edges (pinch point), we keep the
      // first — good enough for the simple rims this targets.
      if (!boundaryNext.has(a)) boundaryNext.set(a, b);
    }
  }

  if (boundaryNext.size === 0) {
    // Already watertight (or no detectable boundary). Return a fresh copy so
    // callers can treat the output uniformly without aliasing the input.
    const clone = new THREE.BufferGeometry();
    clone.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array(positions), 3,
    ));
    if (nonIndexed !== geometry) nonIndexed.dispose();
    return { geometry: clone, holesClosed: 0 };
  }

  // ── 3. Chain boundary half-edges into closed loops ──
  const visited = new Set<number>();
  const loops: number[][] = [];
  for (const startVert of boundaryNext.keys()) {
    if (visited.has(startVert)) continue;
    const loop: number[] = [];
    let cur = startVert;
    // Walk until we return to the start or hit a dead end / already-visited.
    while (cur !== undefined && !visited.has(cur)) {
      visited.add(cur);
      loop.push(cur);
      const next = boundaryNext.get(cur);
      if (next === undefined) break; // open chain (shouldn't happen on a real rim)
      cur = next;
      if (cur === startVert) break; // closed the loop
    }
    // A valid cappable loop needs at least 3 vertices.
    if (loop.length >= 3) loops.push(loop);
  }

  // ── 4. Fan-triangulate each loop and append caps ──
  const newTris: number[] = [];
  for (const loop of loops) {
    // Centroid of the loop.
    let cx = 0, cy = 0, cz = 0;
    for (const v of loop) {
      cx += uniquePos[v * 3]; cy += uniquePos[v * 3 + 1]; cz += uniquePos[v * 3 + 2];
    }
    cx /= loop.length; cy /= loop.length; cz /= loop.length;

    // Fan: centroid + each consecutive boundary pair. The boundary half-edges
    // are wound along the open edge of the existing surface; the cap triangle
    // (centroid, b, a) is wound opposite so its normal faces outward, away
    // from the solid — consistent with the rest of the shell.
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i];
      const b = loop[(i + 1) % loop.length];
      const ax = uniquePos[a * 3], ay = uniquePos[a * 3 + 1], az = uniquePos[a * 3 + 2];
      const bx = uniquePos[b * 3], by = uniquePos[b * 3 + 1], bz = uniquePos[b * 3 + 2];
      newTris.push(cx, cy, cz, bx, by, bz, ax, ay, az);
    }
  }

  // Concatenate original positions + new cap triangles into one buffer.
  const out = new Float32Array(positions.length + newTris.length);
  out.set(positions, 0);
  out.set(newTris, positions.length);

  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.BufferAttribute(out, 3));
  if (nonIndexed !== geometry) nonIndexed.dispose();

  return { geometry: result, holesClosed: loops.length };
}
