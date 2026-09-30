import { describe, expect, it } from 'vitest';
import { estimateMoldLife, costPerCast, recommendPrintSettings } from './moldLife';

describe('moldLife', () => {
  it('silicone outlasts PLA for wax', () => {
    expect(estimateMoldLife('silicone', 'wax').min).toBeGreaterThan(estimateMoldLife('rigid-pla', 'wax').max);
  });
  it('ranges are sane for every combo', () => {
    for (const k of ['rigid-pla', 'rigid-resin', 'silicone'] as const)
      for (const c of ['pu_resin', 'epoxy', 'plaster', 'concrete', 'wax', 'soap', 'chocolate', 'silicone_cast'] as const) {
        const l = estimateMoldLife(k, c);
        expect(l.min).toBeGreaterThan(0); expect(l.max).toBeGreaterThanOrEqual(l.min); expect(l.note.length).toBeGreaterThan(5);
      }
  });
  it('cost per cast spreads mold cost', () => {
    expect(costPerCast(1000, 20, { min: 10, max: 30, note: '' })).toBeCloseTo(70);
    expect(costPerCast(NaN, -5, { min: 1, max: 1, note: '' })).toBe(0);
  });
  it('print settings', () => {
    expect(recommendPrintSettings('resin', [50, 50, 50], 'rigid').infillPct).toBe(100);
    const p = recommendPrintSettings('pla', [200, 100, 80], 'rigid');
    expect(p.walls).toBe(4); expect(p.infillPct).toBe(25);
  });
});
