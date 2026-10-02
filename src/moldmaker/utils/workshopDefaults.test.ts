import { describe, expect, it } from 'vitest';
import {
  HANDLING_ALLOWANCE,
  REFERENCE_TEMPERATURE_C,
  SILICONE_MOLD_CURE_HOURS_AT_25C,
  SILICONE_MOLD_WALL_MM,
  WORKSHOP_MATERIAL_PROFILES,
  splitByWeight,
  temperatureGuidance,
} from './workshopDefaults';

describe('workshop defaults', () => {
  it('uses conservative reference conditions and allowance', () => {
    expect(REFERENCE_TEMPERATURE_C).toBe(25);
    expect(SILICONE_MOLD_WALL_MM).toBeGreaterThanOrEqual(10);
    expect(HANDLING_ALLOWANCE).toBeGreaterThanOrEqual(0.1);
    expect(SILICONE_MOLD_CURE_HOURS_AT_25C[0]).toBeGreaterThanOrEqual(12);
  });

  it('splits planning weight using the material profile', () => {
    expect(splitByWeight(300, WORKSHOP_MATERIAL_PROFILES.epoxy.mixByWeight)).toEqual([200, 100]);
    expect(splitByWeight(100, null)).toBeNull();
  });

  it('warns about hot and cool workshops without inventing exact cure times', () => {
    expect(temperatureGuidance(32)).toContain('may be shorter');
    expect(temperatureGuidance(18)).toContain('may be slower');
    expect(temperatureGuidance(25)).toContain('product TDS');
  });
});