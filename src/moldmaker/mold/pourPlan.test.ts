import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { leakCheck, pourPlan } from './pourPlan';
import { CASTING_MATERIALS } from '../utils/tier2';

describe('pourPlan', () => {
  const g = new THREE.BoxGeometry(20, 20, 20); g.computeBoundingBox();
  it('seal land equals wall for a box split mid-height', () => {
    const r = leakCheck(g, 'y', 0.5, g.boundingBox!, 8);
    expect(r.landMm).toBeCloseTo(8, 3);
    expect(r.level).toBe('ok');
  });
  it('thin wall flags a leak', () => {
    expect(leakCheck(g, 'y', 0.5, g.boundingBox!, 2).level).toBe('leak');
    expect(leakCheck(g, 'y', 0.5, g.boundingBox!, 4).level).toBe('caution');
  });
  it('plan exists for every material', () => {
    for (const m of CASTING_MATERIALS) expect(pourPlan(m.id, 100)).toHaveLength(5);
    expect(pourPlan('pu_resin', 100)[1]!.detail).toContain('115 g');
  });
});
