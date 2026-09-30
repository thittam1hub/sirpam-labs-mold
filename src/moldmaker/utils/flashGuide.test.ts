import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { splitLineLengthMm, buildFlashGuide } from './flashGuide';

function box(w = 20, h = 20, d = 20) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.computeBoundingBox();
  return g;
}

describe('splitLineLengthMm', () => {
  it('measures the seam of a 20 mm cube split through the middle as ~80 mm perimeter', () => {
    const g = box();
    const len = splitLineLengthMm(g, 'z', 0.5, g.boundingBox!);
    expect(len).toBeGreaterThan(70);
    expect(len).toBeLessThan(90);
  });

  it('is near zero when the plane misses the model', () => {
    const g = box();
    const len = splitLineLengthMm(g, 'z', 100, g.boundingBox!);
    expect(len).toBeLessThan(0.001);
  });
});

describe('buildFlashGuide', () => {
  it('returns a seam length, percentages and material-specific tips', () => {
    const g = box();
    const r = buildFlashGuide(g, 'z', 0.5, g.boundingBox!, 0, 'epoxy', 'rigid');
    expect(r.seamMm).toBeGreaterThan(70);
    expect(r.undercutPct).toBeGreaterThanOrEqual(0);
    expect(r.tips.length).toBeGreaterThanOrEqual(3);
    expect(r.tips.join(' ')).toMatch(/Epoxy flash/);
  });

  it('adds a clamping tip for rigid molds and a strap tip for silicone', () => {
    const g = box();
    expect(buildFlashGuide(g, 'z', 0.5, g.boundingBox!, 0, 'wax', 'rigid').tips.join(' ')).toMatch(/Bolt or clamp/);
    expect(buildFlashGuide(g, 'z', 0.5, g.boundingBox!, 0, 'wax', 'silicone').tips.join(' ')).toMatch(/rubber bands/);
  });
});
