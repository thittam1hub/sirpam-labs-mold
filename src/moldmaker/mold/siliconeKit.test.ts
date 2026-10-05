import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { generateSiliconeMold } from './siliconeMold';
import { getManifold, geometryToManifold } from './manifoldBridge';

const model = () => {
  const g = new THREE.SphereGeometry(20, 24, 16);
  g.computeBoundingBox();
  return g;
};

async function check(type: 'blockOneWay' | 'blockTwoPart') {
  const g = model();
  const r = await generateSiliconeMold(g, g.boundingBox!, 'z', 0.5, { type, sprueDiameterMm: 10, extras: { shopKit: true } });
  const wasm = await getManifold();
  for (const piece of r.pieces) {
    const m = geometryToManifold(wasm, piece);
    expect(m.volume()).toBeGreaterThan(0);
  }
  return r;
}

describe('silicone bench-ready kit', () => {
  it('open pour box: base plate with stand cone + separate walls', async () => {
    const r = await check('blockOneWay');
    expect(r.labels).toEqual(['base_plate', 'box_walls']);
    expect(r.siliconeVolumeCm3).toBeGreaterThan(0);
  }, 60000);

  it('two-part: base, two frames, parting board, pour rods', async () => {
    const r = await check('blockTwoPart');
    expect(r.labels).toEqual(['base_plate', 'frame_bottom', 'frame_top', 'parting_board', 'pour_rods']);
  }, 60000);
});
