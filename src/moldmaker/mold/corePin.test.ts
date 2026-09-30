import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { generateMold } from './generateMold';

describe('core pin', () => {
  it('adds a separate pin piece only when set', async () => {
    const g = new THREE.SphereGeometry(15, 32, 24); g.computeBoundingBox();
    const off = await generateMold(g, g.boundingBox!, 'z', 0.5, {} as any);
    const on = await generateMold(g, g.boundingBox!, 'z', 0.5, { extras: { corePinMm: 3 } } as any);
    expect(on.pieces.length).toBe(off.pieces.length + 1);
    expect(on.notices?.some(n => n.includes('core pin'))).toBe(true);
  }, 120000);
});
