import { describe, it, expect } from 'vitest';
import { checkCompatibility, worstLevel } from './materialCompat';

const base = { moldMode: 'silicone' as const, siliconeType: 'blockTwoPart' as const, printMaterial: 'pla' as const };

describe('checkCompatibility', () => {
  it('blocks chocolate in a rigid printed mold (food safety)', () => {
    const r = checkCompatibility({ ...base, moldMode: 'rigid', castingMaterial: 'chocolate' });
    expect(r.level).toBe('blocked');
    expect(r.detail).toMatch(/food/i);
  });

  it('blocks hot wax in a PLA rigid mold', () => {
    expect(checkCompatibility({ ...base, moldMode: 'rigid', castingMaterial: 'wax' }).level).toBe('blocked');
  });

  it('blocks hot soap in a PLA rigid mold', () => {
    expect(checkCompatibility({ ...base, moldMode: 'rigid', castingMaterial: 'soap' }).level).toBe('blocked');
  });

  it('allows wax in a resin-printed rigid mold', () => {
    expect(checkCompatibility({ ...base, moldMode: 'rigid', printMaterial: 'resin', castingMaterial: 'wax' }).level).toBe('ok');
  });

  it('cautions epoxy in PLA (exotherm)', () => {
    expect(checkCompatibility({ ...base, moldMode: 'rigid', castingMaterial: 'epoxy' }).level).toBe('caution');
  });

  it('cautions resin-printed masters under silicone (cure inhibition)', () => {
    const r = checkCompatibility({ ...base, printMaterial: 'resin', castingMaterial: 'pu_resin' });
    expect(r.level).toBe('caution');
    expect(r.detail).toMatch(/inhibit/i);
  });

  it('cautions silicone-into-silicone without a barrier', () => {
    expect(checkCompatibility({ ...base, castingMaterial: 'silicone_cast' }).level).toBe('caution');
  });

  it('cautions concrete in a thin skin-core mold', () => {
    expect(checkCompatibility({ ...base, siliconeType: 'skinCore', castingMaterial: 'concrete' }).level).toBe('caution');
  });

  it('passes PU resin in a platinum silicone block mold', () => {
    expect(checkCompatibility({ ...base, castingMaterial: 'pu_resin' }).level).toBe('ok');
  });

  it('every result has a non-empty title and detail', () => {
    const mats = ['pu_resin', 'epoxy', 'plaster', 'concrete', 'wax', 'soap', 'chocolate', 'silicone_cast'] as const;
    for (const castingMaterial of mats) {
      for (const moldMode of ['rigid', 'silicone'] as const) {
        const r = checkCompatibility({ castingMaterial, moldMode, siliconeType: 'blockTwoPart', printMaterial: 'pla' });
        expect(r.title.length).toBeGreaterThan(0);
        expect(r.detail.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('worstLevel', () => {
  it('ranks blocked > caution > ok', () => {
    expect(worstLevel('ok', 'blocked')).toBe('blocked');
    expect(worstLevel('caution', 'ok')).toBe('caution');
    expect(worstLevel('ok', 'ok')).toBe('ok');
  });
});
