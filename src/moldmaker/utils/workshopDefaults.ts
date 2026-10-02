import type { CastingMaterialId } from './tier2';

export type MixRatio = readonly [partA: number, partB: number];

export interface WorkshopMaterialProfile {
  /** Representative planning ratio only. The selected product TDS always wins. */
  mixByWeight: MixRatio | null;
  workingMinutesAt25C: readonly [min: number, max: number] | null;
}

/**
 * Conservative planning references for an unbranded material. These are not
 * product specifications and must never replace the material supplier's TDS.
 */
export const WORKSHOP_MATERIAL_PROFILES: Record<CastingMaterialId, WorkshopMaterialProfile> = {
  pu_resin: { mixByWeight: [1, 1], workingMinutesAt25C: [5, 15] },
  epoxy: { mixByWeight: [2, 1], workingMinutesAt25C: [30, 45] },
  plaster: { mixByWeight: [100, 70], workingMinutesAt25C: [8, 15] },
  concrete: { mixByWeight: null, workingMinutesAt25C: null },
  wax: { mixByWeight: null, workingMinutesAt25C: null },
  soap: { mixByWeight: null, workingMinutesAt25C: null },
  chocolate: { mixByWeight: null, workingMinutesAt25C: null },
  silicone_cast: { mixByWeight: [1, 1], workingMinutesAt25C: [30, 45] },
};

export const REFERENCE_TEMPERATURE_C = 25;
export const SILICONE_MOLD_DENSITY_G_CM3 = 1.15;
export const SILICONE_MOLD_WALL_MM = 12;
export const HANDLING_ALLOWANCE = 0.15;
export const SILICONE_MOLD_WORK_MINUTES_AT_25C = [30, 45] as const;
export const SILICONE_MOLD_CURE_HOURS_AT_25C = [16, 24] as const;

export function temperatureGuidance(tempC: number): string {
  if (tempC >= 30) return 'Warm workshop: working time may be shorter. Mix smaller batches and check the product TDS.';
  if (tempC <= 20) return 'Cool workshop: cure may be slower. Keep the material within its supplier-approved temperature range.';
  return 'Reference conditions: confirm the exact working and demold times in the product TDS.';
}

export function splitByWeight(totalG: number, ratio: MixRatio | null): readonly [number, number] | null {
  if (!ratio) return null;
  const totalParts = ratio[0] + ratio[1];
  if (!(totalG >= 0) || !(totalParts > 0)) return null;
  return [totalG * ratio[0] / totalParts, totalG * ratio[1] / totalParts];
}