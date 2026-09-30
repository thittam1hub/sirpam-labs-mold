import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { riskScore, riskLevel, demoldRisk, airTrapPoints } from './castRisk';

function box() { const g = new THREE.BoxGeometry(20, 20, 20); g.computeBoundingBox(); return g; }

describe('castRisk', () => {
  it('scores and levels', () => {
    expect(riskScore(0, 0)).toBe(0);
    expect(riskScore(1, 1)).toBe(100);
    expect(riskLevel(10)).toBe('low');
    expect(riskLevel(40)).toBe('medium');
    expect(riskLevel(80)).toBe('high');
  });
  it('sphere split at the middle is low risk', () => {
    const g = new THREE.SphereGeometry(10, 32, 16); g.computeBoundingBox();
    const r = demoldRisk(g, 'y', 0.5, g.boundingBox!);
    expect(r.undercutPct).toBe(0);
    expect(r.level).not.toBe('high');
  });
  it('sphere split near the bottom has undercuts and suggests another axis', () => {
    const g = new THREE.SphereGeometry(10, 32, 16); g.computeBoundingBox();
    const r = demoldRisk(g, 'y', 0.1, g.boundingBox!);
    expect(r.undercutPct).toBeGreaterThan(0.05);
    expect(r.betterAxis).not.toBeNull();
  });
  it('flat-topped box has no air traps', () => {
    const g = box();
    expect(airTrapPoints(g, 'y', g.boundingBox!)).toHaveLength(0);
  });
});
