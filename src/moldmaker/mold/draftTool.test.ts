import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { addDraft } from './draftTool';

describe('addDraft', () => {
  it('tapers a straight cylinder away from the split plane', () => {
    const g = new THREE.CylinderGeometry(10, 10, 40, 32, 8).rotateX(Math.PI / 2); // along z
    g.computeBoundingBox();
    const out = addDraft(g, g.boundingBox!, 'z', 0.5, 2);
    const p = out.getAttribute('position');
    let topR = 0, midR = 0;
    for (let i = 0; i < p.count; i++) {
      const r = Math.hypot(p.getX(i), p.getY(i));
      if (Math.abs(p.getZ(i) - 20) < 1e-3) topR = Math.max(topR, r);
      if (Math.abs(p.getZ(i)) < 1e-3) midR = Math.max(midR, r);
    }
    expect(midR).toBeCloseTo(10, 3);
    expect(topR).toBeCloseTo(10 - 20 * Math.tan((2 * Math.PI) / 180), 2);
    expect(g.getAttribute('position').getX(0)).not.toBe(undefined); // source untouched
  });
});
