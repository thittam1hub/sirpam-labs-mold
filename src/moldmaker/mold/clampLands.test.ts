import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { generateMold } from './generateMold';
import { meshVolumeCm3 } from '../utils/costEstimate';

const vol = (r: any) => r.pieces.reduce((s: number, p: THREE.BufferGeometry) =>
  s + meshVolumeCm3(p.getAttribute('position').array as Float32Array, p.index ? p.index.array : null), 0);

describe('clamp seats', () => {
  it('adds material around bolts only when turned on', async () => {
    const run = async (lands: boolean) => {
      const g = new THREE.SphereGeometry(15, 32, 24); g.computeBoundingBox();
      return generateMold(g, g.boundingBox!, 'z', 0.5, { extras: { clampBoltMm: 4, ...(lands ? { clampLands: true } : {}) } } as any);
    };
    const off = await run(false), on = await run(true);
    expect(on.pieces.length).toBe(2);
    expect(vol(on)).toBeGreaterThan(vol(off) + 0.1);
  }, 120000);
});
