import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { getManifold } from './manifoldBridge';
import { offsetOutwardEx } from './moldOffset';

const box = (s: number) => new THREE.Box3(new THREE.Vector3(-s, -s, -s), new THREE.Vector3(s, s, s));

describe('offsetOutwardEx', () => {
  it('keeps the exact method for light meshes', async () => {
    const wasm = await getManifold();
    const m = wasm.Manifold.sphere(10, 32);
    expect(m.numTri()).toBeLessThanOrEqual(20000);
    const r = offsetOutwardEx(wasm, m, 3, box(10));
    expect(r.method).toBe('exact');
  });

  it('gives an even wall on a dense mesh (distance field)', async () => {
    const wasm = await getManifold();
    // Long thin capsule-ish shape: the old stretch method badly distorts it.
    const m = wasm.Manifold.sphere(5, 200).scale([4, 1, 1]);
    expect(m.numTri()).toBeGreaterThan(50000);
    const bb = new THREE.Box3(new THREE.Vector3(-20, -5, -5), new THREE.Vector3(20, 5, 5));
    const t0 = performance.now();
    const r = offsetOutwardEx(wasm, m, 3, bb);
    const ms = performance.now() - t0;
    expect(r.method).toBe('distanceField');
    const b = r.solid.boundingBox();
    // Wall along each axis within +-15% of 3 mm.
    const walls = [b.max[0] - 20, b.max[1] - 5, b.max[2] - 5, -20 - b.min[0], -5 - b.min[1]];
    for (const w of walls) { expect(w).toBeGreaterThan(2.55); expect(w).toBeLessThan(3.45); }
    console.log('distance-field offset ms', Math.round(ms), 'walls', walls.map(w => w.toFixed(2)));
  }, 120000);
});
