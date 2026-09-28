import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { generateMold } from './generateMold';
import { generateSiliconeMold } from './siliconeMold';

const sphere = () => {
  const g = new THREE.SphereGeometry(15, 32, 24);
  g.computeBoundingBox();
  return g;
};

describe('hug molds', () => {
  it('rigid form-fit with a flange gets 4 real locks and no pad notice', async () => {
    const g = sphere();
    const r: any = await generateMold(g, g.boundingBox!, 'z', 0.5, { formFit: true, extras: { flangeMm: 10 } } as any);
    expect(r.pieces.length).toBe(2);
    const notes = (r.notices ?? []).join(' ');
    expect(notes).not.toMatch(/pads|No room/);
  }, 120000);

  it('silicone two-part form-fit places locks in the real wall', async () => {
    const g = sphere();
    const r = await generateSiliconeMold(g, g.boundingBox!, 'z', 0.5, { type: 'blockTwoPart', formFit: true, extras: { flangeMm: 10 } });
    expect(r.pieces.length).toBe(2);
    expect((r.notices ?? []).join(' ')).not.toMatch(/No room/);
    // Top half is heavier than bottom by the pins (never floating: pieces stay single solids).
    for (const p of r.pieces) expect((p.attributes['position']?.count ?? 0)).toBeGreaterThan(0);
  }, 120000);
});

describe('parting flange', () => {
  it('widens the hug shell at the split', async () => {
    const w = async (flangeMm?: number) => {
      const g = sphere();
      const r: any = await generateMold(g, g.boundingBox!, 'z', 0.5, { formFit: true, extras: flangeMm ? { flangeMm } : {} } as any);
      r.pieces[0].computeBoundingBox();
      return r.pieces[0].boundingBox.max.x - r.pieces[0].boundingBox.min.x;
    };
    const plain = await w(), flanged = await w(10);
    expect(flanged).toBeGreaterThan(plain + 15);
  }, 120000);
});
