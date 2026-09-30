// Sirpam 3D Labs Mold — mold life, cost per cast and print-settings advice.
// Pure rules, ballpark shop figures (not lab data); every range is shown to
// the user as a guide.
import type { CastingMaterialId } from './tier2';

export type LifeMoldKind = 'rigid-pla' | 'rigid-resin' | 'silicone';

export interface MoldLife { min: number; max: number; note: string }

/** Expected number of good casts before the mold wears out. */
export function estimateMoldLife(kind: LifeMoldKind, cast: CastingMaterialId): MoldLife {
  const hot = cast === 'wax' || cast === 'soap' || cast === 'chocolate';
  const abrasive = cast === 'concrete' || cast === 'plaster';
  const exo = cast === 'pu_resin' || cast === 'epoxy';
  if (kind === 'silicone') {
    if (exo) return { min: 25, max: 50, note: 'Resin slowly dries silicone out; use mold release every pour to reach the top of the range.' };
    if (abrasive) return { min: 50, max: 100, note: 'Plaster and concrete wear the surface; rinse the mold after each cast.' };
    if (cast === 'silicone_cast') return { min: 10, max: 30, note: 'Silicone into silicone needs a release agent every time or it bonds.' };
    return { min: 100, max: 200, note: 'Wax, soap and food casts are gentle on silicone.' };
  }
  const resin = kind === 'rigid-resin';
  if (hot) return resin
    ? { min: 30, max: 80, note: 'Keep pours under 70 °C; resin prints soften above that.' }
    : { min: 10, max: 30, note: 'PLA softens near 60 °C — pour wax and soap as cool as you can.' };
  if (exo) return resin
    ? { min: 5, max: 15, note: 'Resin sticks to resin prints; seal and wax the cavity first.' }
    : { min: 3, max: 10, note: 'Curing resin gets hot and can warp PLA; seal the cavity and cast small.' };
  if (abrasive) return resin
    ? { min: 20, max: 50, note: 'Brush on release; concrete scratches the cavity over time.' }
    : { min: 15, max: 40, note: 'Brush on release; concrete scratches the cavity over time.' };
  return { min: 5, max: 20, note: 'Use release agent on every cast.' };
}

/** Mold cost spread over its (midpoint) life, plus material for one cast. */
export function costPerCast(moldCost: number, castMaterialCost: number, life: MoldLife): number {
  const casts = Math.max(1, Math.round((life.min + life.max) / 2));
  const ok = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0);
  return ok(moldCost) / casts + ok(castMaterialCost);
}

export interface PrintSettings {
  layerMm: number;
  walls: number;
  infillPct: number;
  orientation: string;
  tips: string[];
}

/** Slicer settings for one mold piece. `heightMm` = size along the build direction. */
export function recommendPrintSettings(material: 'pla' | 'resin', sizeMm: [number, number, number], mode: 'rigid' | 'silicone'): PrintSettings {
  const largest = Math.max(...sizeMm);
  if (material === 'resin') {
    return {
      layerMm: largest > 120 ? 0.05 : 0.03,
      walls: 0, infillPct: 100,
      orientation: 'Tilt 30–45° with the parting face up, so no supports touch the cavity.',
      tips: ['Wash and fully post-cure — uncured resin stops silicone setting.', 'Solid print; do not hollow a mold piece.'],
    };
  }
  const detail = mode === 'rigid' || largest < 60;
  return {
    layerMm: detail ? (largest < 60 ? 0.12 : 0.16) : 0.2,
    walls: mode === 'rigid' ? 4 : 3,
    infillPct: mode === 'rigid' ? (largest > 150 ? 25 : 30) : 15,
    orientation: mode === 'rigid'
      ? 'Parting face flat on the bed — it prints perfectly flat and seals best.'
      : 'Open side up; the box needs no supports.',
    tips: mode === 'rigid'
      ? ['Use gyroid infill so the walls do not bow when clamped.', 'Sand or coat the cavity to hide layer lines in the cast.']
      : ['Seal seams with hot glue or clay before pouring silicone.'],
  };
}
