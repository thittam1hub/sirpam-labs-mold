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
  rebuilt?: boolean;
}

function triCountOf(g: THREE.BufferGeometry): number {
  return g.index ? g.index.count / 3 : g.attributes['position']!.count / 3;
}

/** Weld to indexed form with a grid tolerance. */
function weld(geo: THREE.BufferGeometry, tol: number): { pos: Float64Array; tris: Uint32Array; verts: number } {
  const src = geo.index ? geo.toNonIndexed() : geo;
  const p = src.attributes['position']!.array as ArrayLike<number>;
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

async function finishRepair(geo: THREE.BufferGeometry, tol: number, r: RepairReport, rebuildCell?: number): Promise<THREE.BufferGeometry> {
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
  if (!r.solidOk) {
    // Too damaged to patch: rebuild the surface from an inside/outside grid.
    g.computeBoundingBox();
    const maxDim = Math.max(...g.boundingBox!.getSize(new THREE.Vector3()).toArray());
    const cells = rebuildCell ? Math.min(260, Math.max(80, Math.round(maxDim / (rebuildCell * 1.6)))) : 180;
    const rebuilt = await voxelRebuild(g, cells);
    if (rebuilt) { g = rebuilt; r.solidOk = true; r.rebuilt = true; }
  }
  r.outputTris = triCountOf(g);
  g.computeBoundingBox();
  g.computeVertexNormals();
  return g;
}

const emptyReport = (g: THREE.BufferGeometry): RepairReport => ({
  inputTris: triCountOf(g), outputTris: 0, weldedVerts: 0, droppedBad: 0, droppedDuplicate: 0,
  droppedNonManifold: 0, flipped: 0, holesClosed: 0, solidOk: false,
});

/**
 * Rebuild as a watertight solid: winding-number rasterisation into a grid
 * (robust to overlapping shells, holes and self-intersections), then Manifold
 * levelSet. `cells` = grid resolution along the longest side.
 */
export async function voxelRebuild(geo: THREE.BufferGeometry, cells: number): Promise<THREE.BufferGeometry | null> {
  const src = geo.index ? geo.toNonIndexed() : geo;
  const p = src.attributes['position']!.array as ArrayLike<number>;
  src.computeBoundingBox();
  const bb = src.boundingBox!;
  const size = bb.getSize(new THREE.Vector3());
  const h = Math.max(size.x, size.y, size.z) / cells;
  if (!(h > 0)) return null;
  const ox = bb.min.x - 2 * h, oy = bb.min.y - 2 * h, oz = bb.min.z - 2 * h;
  const nx = Math.ceil(size.x / h) + 4, ny = Math.ceil(size.y / h) + 4, nz = Math.ceil(size.z / h) + 4;
  const hits: Array<Array<{ z: number; s: number }>> = new Array(nx * ny);
  for (let t = 0; t < p.length; t += 9) {
    const ax = p[t]!, ay = p[t + 1]!, az = p[t + 2]!, bx = p[t + 3]!, by = p[t + 4]!, bz = p[t + 5]!, cx = p[t + 6]!, cy = p[t + 7]!, cz = p[t + 8]!;
    const d = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay); // 2× signed xy area
    if (Math.abs(d) < 1e-14) continue;
    const i0 = Math.max(0, Math.ceil((Math.min(ax, bx, cx) - ox) / h - 0.5)), i1 = Math.min(nx - 1, Math.floor((Math.max(ax, bx, cx) - ox) / h - 0.5));
    const j0 = Math.max(0, Math.ceil((Math.min(ay, by, cy) - oy) / h - 0.5)), j1 = Math.min(ny - 1, Math.floor((Math.max(ay, by, cy) - oy) / h - 0.5));
    for (let i = i0; i <= i1; i++) {
      const x = ox + (i + 0.5) * h;
      for (let j = j0; j <= j1; j++) {
        const y = oy + (j + 0.5) * h;
        const w1 = ((bx - x) * (cy - y) - (cx - x) * (by - y)) / d;
        const w2 = ((cx - x) * (ay - y) - (ax - x) * (cy - y)) / d;
        const w3 = 1 - w1 - w2;
        if (w1 < 0 || w2 < 0 || w3 < 0) continue;
        const z = w1 * az + w2 * bz + w3 * cz;
        (hits[i * ny + j] ??= []).push({ z, s: d > 0 ? -1 : 1 }); // up-facing = leaving
      }
    }
  }
  const occ = new Float32Array(nx * ny * nz);
  for (let c = 0; c < nx * ny; c++) {
    const hs = hits[c];
    if (!hs) continue;
    const ev = hs.sort((a, b) => a.z - b.z);
    // Crossing a down-facing face enters (+1), an up-facing face leaves (−1).
    let w = 0, e = 0;
    for (let k = 0; k < nz; k++) {
      const z = oz + (k + 0.5) * h;
      while (e < ev.length && ev[e]!.z < z) { w += ev[e]!.s; e++; }
      if (w > 0) occ[c * nz + k] = 1;
    }
  }
  const val = (i: number, j: number, k: number) =>
    i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz ? 0 : occ[(i * ny + j) * nz + k]!;
  const sdf = (pt: number[]) => {
    const fx = (pt[0]! - ox) / h - 0.5, fy = (pt[1]! - oy) / h - 0.5, fz = (pt[2]! - oz) / h - 0.5;
    const i = Math.floor(fx), j = Math.floor(fy), k = Math.floor(fz);
    const u = fx - i, v = fy - j, w = fz - k;
    let s = 0;
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++)
      s += val(i + a, j + b, k + c) * (a ? u : 1 - u) * (b ? v : 1 - v) * (c ? w : 1 - w);
    return s - 0.5;
  };
  const wasm = await getManifold();
  const m = wasm.Manifold.levelSet(sdf, { min: [ox, oy, oz], max: [ox + nx * h, oy + ny * h, oz + nz * h] }, h, 0);
  if (m.isEmpty()) return null;
  // levelSet makes very dense uniform triangles; collapse flat areas.
  const sm = typeof m.simplify === 'function' ? m.simplify(h * 0.3) : m;
  const g = manifoldToGeometry(sm);
  if (sm !== m) sm.delete?.();
  m.delete?.();
  return g;
}

/** Deep repair: weld, drop bad/duplicate/over-shared faces, fix winding, close holes. */
export async function repairModel(geo: THREE.BufferGeometry): Promise<{ geometry: THREE.BufferGeometry; report: RepairReport }> {
  const r = emptyReport(geo);
  const geometry = await finishRepair(geo, diag(geo) * 1e-6, r);
  return { geometry, report: r };
}

export function surfaceArea(geo: THREE.BufferGeometry): number {
  const src = geo.index ? geo.toNonIndexed() : geo;
  const p = src.attributes['position']!.array as ArrayLike<number>;
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
  const geometry = await finishRepair(geo, cell, r, cell);
  return { geometry, report: r, cellMm: cell };
}

export type UpAxis = 'x' | 'y' | 'z';

/** Rotate (degrees, XYZ order), then optionally scale uniformly so the size along `axis` equals `sizeMm`. Re-seats on the bed (min z = 0, centred in X/Y). */
export function transformModel(geo: THREE.BufferGeometry, o: { rx: number; ry: number; rz: number; sizeMm?: number | undefined; axis: UpAxis }): THREE.BufferGeometry {
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
  if (r.rebuilt) parts.push('surface rebuilt as one clean solid');
  return parts.length ? parts.join(', ') : 'no problems found';
}
