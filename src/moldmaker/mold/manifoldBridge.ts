// Sirpam 3D Labs Mold — conversion between three.js meshes and Manifold solids.
import * as THREE from 'three';
import { MERGE_TOLERANCE, dbg } from './constants';

/* eslint-disable @typescript-eslint/no-explicit-any -- manifold-3d's typings
   don't describe the Mesh constructor options we use. */
type ManifoldWasm = any;
type ManifoldSolid = any;

let wasmPromise: Promise<ManifoldWasm> | null = null;

/** Load the Manifold WebAssembly module once and reuse it. */
export function getManifold(): Promise<ManifoldWasm> {
  if (!wasmPromise) {
    wasmPromise = import('manifold-3d').then(async mod => {
      const wasm = await mod.default();
      wasm.setup?.();
      return wasm;
    });
    wasmPromise.catch(() => { wasmPromise = null; });
  }
  return wasmPromise;
}

/** Thrown when a boolean step leaves nothing behind. */
export class EmptyManifoldError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmptyManifoldError';
  }
}

/**
 * Weld coincident vertices of a triangle soup. Returns, for every vertex, the
 * index of the first vertex found at the same spot (or itself). Uses a grid
 * of cell size = tolerance and checks the 27 surrounding cells.
 */
function weldMap(pos: ArrayLike<number>, tol: number): Uint32Array {
  const n = pos.length / 3;
  const owner = new Uint32Array(n);
  const cells = new Map<number, number[]>();
  // Spatial hash (Teschner et al. 2003). Collisions only add candidates.
  const key3 = (a: number, b: number, c: number) => ((a * 73856093) ^ (b * 19349663) ^ (c * 83492791)) | 0;
  const tol2 = tol * tol;
  for (let v = 0; v < n; v++) {
    const x = pos[3 * v], y = pos[3 * v + 1], z = pos[3 * v + 2];
    const cx = Math.round(x / tol), cy = Math.round(y / tol), cz = Math.round(z / tol);
    let found = v;
    search: for (let a = cx - 1; a <= cx + 1; a++) {
      for (let b = cy - 1; b <= cy + 1; b++) {
        for (let c = cz - 1; c <= cz + 1; c++) {
          const list = cells.get(key3(a, b, c));
          if (!list) continue;
          for (const w of list) {
            const dx = pos[3 * w] - x, dy = pos[3 * w + 1] - y, dz = pos[3 * w + 2] - z;
            if (dx * dx + dy * dy + dz * dz < tol2) { found = w; break search; }
          }
        }
      }
    }
    owner[v] = found;
    const key = key3(cx, cy, cz);
    const list = cells.get(key);
    if (list) list.push(v); else cells.set(key, [v]);
  }
  return owner;
}

/** three.js geometry → Manifold solid (throws if not a closed solid). */
export function geometryToManifold(wasm: ManifoldWasm, geometry: THREE.BufferGeometry): ManifoldSolid {
  const soup = geometry.index ? geometry.toNonIndexed() : geometry;
  const pos = soup.attributes['position'].array as ArrayLike<number>;
  const n = pos.length / 3;
  const owner = weldMap(pos, MERGE_TOLERANCE);
  const from: number[] = [], to: number[] = [];
  for (let v = 0; v < n; v++) if (owner[v] !== v) { from.push(v); to.push(owner[v]); }
  dbg(`Mesh: ${n / 3} triangles, ${n} vertices, ${from.length} merge pairs`);
  const mesh = new wasm.Mesh({
    numProp: 3,
    vertProperties: Float32Array.from(pos),
    triVerts: Uint32Array.from({ length: n }, (_, i) => i),
    mergeFromVert: Uint32Array.from(from),
    mergeToVert: Uint32Array.from(to),
  });
  return wasm.Manifold.ofMesh(mesh);
}

/** Manifold solid → non-indexed three.js geometry with normals. */
export function manifoldToGeometry(solid: ManifoldSolid): THREE.BufferGeometry {
  const { vertProperties, triVerts, numProp } = solid.getMesh();
  if (triVerts.length === 0) {
    throw new EmptyManifoldError(
      'Mold generation produced an empty mesh. The split may be outside the model, ' +
      'the model may not be a closed solid, or the pour hole and vents may be too ' +
      'large for the wall thickness.',
    );
  }
  const out = new Float32Array(triVerts.length * 3);
  for (let i = 0; i < triVerts.length; i++) {
    const base = triVerts[i] * numProp;
    out[3 * i] = vertProperties[base];
    out[3 * i + 1] = vertProperties[base + 1];
    out[3 * i + 2] = vertProperties[base + 2];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(out, 3));
  g.computeVertexNormals();
  g.computeBoundingBox();
  return g;
}

/** Axis-aligned box with its minimum corner at (ox, oy, oz). */
export function createBox(
  wasm: ManifoldWasm, sx: number, sy: number, sz: number, ox = 0, oy = 0, oz = 0,
): ManifoldSolid {
  return wasm.Manifold.cube([sx, sy, sz], false).translate([ox, oy, oz]);
}
