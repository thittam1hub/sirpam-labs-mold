import * as THREE from 'three';
import { capOpenBoundaries } from './capOpenBoundaries';
import { getManifold, geometryToManifold, manifoldToGeometry } from './manifoldBridge';

/**
 * Model-fix tools: deep auto-repair, detail reducer (vertex clustering) and
 * scale/rotate. Main-thread, never mutate input, return fresh geometry.
 */

export interface RepairReport {
  inputTris: number;
  outputTris: number;
  weldedVerts: number;
  droppedBad: number;
  droppedDuplicate: number;
  droppedNonManifold: number;
  flipped: number;
  holesClosed: number;
  solidOk: boolean;
}

function triCountOf(g: THREE.BufferGeometry): number {
  return g.index ? g.index.count / 3 : g.attributes.position!.count / 3;
}

/** Weld to indexed form with a grid tolerance. */
function weld(geo: THREE.BufferGeometry, tol: number): { pos: Float64Array; tris: Uint32Array; verts: number } {
  const src = geo.index ? geo.toNonIndexed() : geo;
  const p = src.attributes.position!.array as ArrayLike<number>;
  const n = p.length / 3;
  const map = new Map<string, number>();
  const out: number[] = [];
  const ids = new Uint32Array(n);
  const inv = 1 / tol;
  for (let i = 0; i < n; i++) {
    const x = p[i * 3]!, y = p[i * 3 + 1]!, z = p[i * 3 + 2]!;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) { ids[i] = 0xffffffff; continue; }
    const k = `${Math.round(x * inv)},${Math.round(y * inv)},${Math.round(z * inv)}`;
    let id = map.get(k);
    if (id === undefined) { id = out.length / 3; out.push(x, y, z); map.set(k, id); }
    ids[i] = id;
  }
  return { pos: Float64Array.from(out), tris: ids, verts: out.length / 3 };
}

/** Clean indexed triangles: drop bad/dup/non-manifold, orient consistently. */
function cleanTopology(pos: Float64Array, raw: Uint32Array, r: RepairReport): Uint32Array {
  const keep: number[] = [];
  const seen = new Set<string>();
  for (let t = 0; t < raw.length; t += 3) {
    const a = raw[t]!, b = raw[t + 1]!, c = raw[t + 2]!;
    if (a === 0xffffffff || b === 0xffffffff || c === 0xffffffff || a === b || b === c || a === c) { r.droppedBad++; continue; }
    const s = [a, b, c].sort((x, y) => x - y).join(',');
    if (seen.has(s)) { r.droppedDuplicate++; continue; }
    seen.add(s);
    keep.push(a, b, c);
  }
  // Non-manifold edges: keep at most 2 faces per edge.
  const edgeCount = new Map<string, number>();
  const ek = (u: number, v: number) => (u < v ? `${u}_${v}` : `${v}_${u}`);
  const tris: number[] = [];
  for (let t = 0; t < keep.length; t += 3) {
    const a = keep[t]!, b = keep[t + 1]!, c = keep[t + 2]!;
    const e = [ek(a, b), ek(b, c), ek(c, a)];
    if (e.some(k => (edgeCount.get(k) ?? 0) >= 2)) { r.droppedNonManifold++; continue; }
    for (const k of e) edgeCount.set(k, (edgeCount.get(k) ?? 0) + 1);
    tris.push(a, b, c);
  }
  // Consistent winding via BFS over shared edges.
  const T = tris.length / 3;
  const adj = new Map<string, number[]>();
  for (let t = 0; t < T; t++) for (let j = 0; j < 3; j++) {
    const k = ek(tris[t * 3 + j]!, tris[t * 3 + (j + 1) % 3]!);
    const l = adj.get(k); if (l) l.push(t); else adj.set(k, [t]);
  }
  const visited = new Uint8Array(T);
  const hasDirected = (t: number, u: number, v: number) => {
    for (let j = 0; j < 3; j++) if (tris[t * 3 + j] === u && tris[t * 3 + (j + 1) % 3] === v) return true;
    return false;
  };
  for (let s = 0; s < T; s++) {
    if (visited[s]) continue;
    visited[s] = 1;
    const stack = [s];
    const comp: number[] = [];
    while (stack.length) {
      const t = stack.pop()!;
      comp.push(t);
      for (let j = 0; j < 3; j++) {
        const u = tris[t * 3 + j]!, v = tris[t * 3 + (j + 1) % 3]!;
        for (const o of adj.get(ek(u, v)) ?? []) {
          if (o === t || visited[o]) continue;
          visited[o] = 1;
          // Neighbour must traverse the edge v→u; if it also has u→v, flip it.
          if (hasDirected(o, u, v)) {
            const tmp = tris[o * 3 + 1]!; tris[o * 3 + 1] = tris[o * 3 + 2]!; tris[o * 3 + 2] = tmp; r.flipped++;
          }
          stack.push(o);
        }
      }
    }
    // Make each shell point outward (positive signed volume).
    let vol = 0;
    for (const t of comp) {
      const a = tris[t * 3]! * 3, b = tris[t * 3 + 1]! * 3, c = tris[t * 3 + 2]! * 3;
      vol += pos[a]! * (pos[b + 1]! * pos[c + 2]! - pos[b + 2]! * pos[c + 1]!)
        - pos[a + 1]! * (pos[b]! * pos[c + 2]! - pos[b + 2]! * pos[c]!)
        + pos[a + 2]! * (pos[b]! * pos[c + 1]! - pos[b + 1]! * pos[c]!);
    }
    if (vol < 0) for (const t of comp) {
      const tmp = tris[t * 3 + 1]!; tris[t * 3 + 1] = tris[t * 3 + 2]!; tris[t * 3 + 2] = tmp; r.flipped++;
    }
  }
  return Uint32Array.from(tris);
}

function toGeometry(pos: Float64Array, tris: Uint32Array): THREE.BufferGeometry {
  const out = new Float32Array(tris.length * 3);
  for (let i = 0; i < tris.length; i++) {
    const v = tris[i]! * 3;
    out[i * 3] = pos[v]!; out[i * 3 + 1] = pos[v + 1]!; out[i * 3 + 2] = pos[v + 2]!;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(out, 3));
  return g;
}

function diag(geo: THREE.BufferGeometry): number {
  geo.computeBoundingBox();
  return geo.boundingBox!.getSize(new THREE.Vector3()).length() || 1;
}

async function finishRepair(geo: THREE.BufferGeometry, tol: number, r: RepairReport): Promise<THREE.BufferGeometry> {
  const w = weld(geo, tol);
  r.weldedVerts = w.verts;
  let g = toGeometry(w.pos, cleanTopology(w.pos, w.tris, r));
  const cap = capOpenBoundaries(g);
  r.holesClosed = cap.holesClosed;
  g = cap.geometry;
  // Round-trip through the solid engine: success means the mold will build.
  try {
    const wasm = await getManifold();
    const m = geometryToManifold(wasm, g);
    if (!m.isEmpty()) { g = manifoldToGeometry(m); r.solidOk = true; }
    m.delete?.();
  } catch { r.solidOk = false; }
  r.outputTris = triCountOf(g);
  g.computeBoundingBox();
  g.computeVertexNormals();
  return g;
}

const emptyReport = (g: THREE.BufferGeometry): RepairReport => ({
  inputTris: triCountOf(g), outputTris: 0, weldedVerts: 0, droppedBad: 0, droppedDuplicate: 0,
  droppedNonManifold: 0, flipped: 0, holesClosed: 0, solidOk: false,
});

/** Deep repair: weld, drop bad/duplicate/over-shared faces, fix winding, close holes. */
export async function repairModel(geo: THREE.BufferGeometry): Promise<{ geometry: THREE.BufferGeometry; report: RepairReport }> {
  const r = emptyReport(geo);
  const geometry = await finishRepair(geo, diag(geo) * 1e-6, r);
  return { geometry, report: r };
}

export function surfaceArea(geo: THREE.BufferGeometry): number {
  const src = geo.index ? geo.toNonIndexed() : geo;
  const p = src.attributes.position!.array as ArrayLike<number>;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let s = 0;
  for (let i = 0; i < p.length; i += 9) {
    a.set(p[i]!, p[i + 1]!, p[i + 2]!); b.set(p[i + 3]!, p[i + 4]!, p[i + 5]!); c.set(p[i + 6]!, p[i + 7]!, p[i + 8]!);
    s += b.sub(a).cross(c.sub(a)).length() / 2;
  }
  return s;
}

/**
 * Detail reducer: vertex clustering to roughly `targetTris`, then deep repair
 * so the result is a clean solid. Works on broken meshes too.
 */
export async function reduceDetail(geo: THREE.BufferGeometry, targetTris: number): Promise<{ geometry: THREE.BufferGeometry; report: RepairReport; cellMm: number }> {
  const r = emptyReport(geo);
  // A uniform mesh with cell size h has ~2·A/h² triangles.
  const cell = Math.max(diag(geo) * 1e-5, Math.sqrt((2 * surfaceArea(geo)) / Math.max(1000, targetTris)));
  const geometry = await finishRepair(geo, cell, r);
  return { geometry, report: r, cellMm: cell };
}

export type UpAxis = 'x' | 'y' | 'z';

/** Rotate (degrees, XYZ order), then optionally scale uniformly so the size along `axis` equals `sizeMm`. Re-seats on the bed (min z = 0, centred in X/Y). */
export function transformModel(geo: THREE.BufferGeometry, o: { rx: number; ry: number; rz: number; sizeMm?: number; axis: UpAxis }): THREE.BufferGeometry {
  const g = geo.clone();
  const d = Math.PI / 180;
  g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(o.rx * d, o.ry * d, o.rz * d, 'XYZ')));
  g.computeBoundingBox();
  if (o.sizeMm && o.sizeMm > 0) {
    const size = g.boundingBox!.getSize(new THREE.Vector3())[o.axis];
    if (size > 1e-9) g.scale(o.sizeMm / size, o.sizeMm / size, o.sizeMm / size);
    g.computeBoundingBox();
  }
  const b = g.boundingBox!;
  g.translate(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, -b.min.z);
  g.computeBoundingBox();
  g.computeVertexNormals();
  return g;
}

export function describeRepair(r: RepairReport): string {
  const parts: string[] = [];
  if (r.droppedBad) parts.push(`${r.droppedBad.toLocaleString()} broken triangles removed`);
  if (r.droppedDuplicate) parts.push(`${r.droppedDuplicate.toLocaleString()} duplicates removed`);
  if (r.droppedNonManifold) parts.push(`${r.droppedNonManifold.toLocaleString()} overlapping faces removed`);
  if (r.flipped) parts.push(`${r.flipped.toLocaleString()} inside-out faces turned`);
  if (r.holesClosed) parts.push(`${r.holesClosed} holes closed`);
  return parts.length ? parts.join(', ') : 'no problems found';
}
