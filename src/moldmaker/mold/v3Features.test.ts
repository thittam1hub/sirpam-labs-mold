import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { generateMold } from './generateMold';
import { widestOutlineOffset } from './suggestParting';

describe('v3 helper pieces', () => {
  it('adds funnel and clamp sleeve as extra pieces only when ticked', async () => {
    const g = new THREE.SphereGeometry(15, 32, 24); g.computeBoundingBox();
    const off = await generateMold(g, g.boundingBox!, 'z', 0.5, {} as any);
    const on = await generateMold(g, g.boundingBox!, 'z', 0.5, { extras: { pourFunnel: true, clampJig: true } } as any);
    expect(on.pieces.length).toBe(off.pieces.length + 2);
    expect(off.notices ?? []).toHaveLength(0);
  }, 120000);
});

describe('widest outline', () => {
  it('finds the belly of a lathe shape', () => {
    const pts = [0, 4, 10, 4, 0].map((r, i) => new THREE.Vector2(r, i * 10));
    const g = new THREE.LatheGeometry(pts, 24); g.computeBoundingBox();
    expect(Math.abs(widestOutlineOffset(g, 'y', g.boundingBox!) - 0.5)).toBeLessThan(0.1);
  });
});
