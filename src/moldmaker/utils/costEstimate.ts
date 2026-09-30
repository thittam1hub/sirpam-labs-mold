// Sirpam 3D Labs Mold — rough material weight, print time and cost per piece.

export type PrintMaterial = 'pla' | 'resin';

export interface MaterialSpec {
  label: string;
  densityGPerCm3: number;
  /** Typical deposition/cure throughput; a ballpark, not a slicer. */
  cm3PerHour: number;
}

export const MATERIALS: Record<PrintMaterial, MaterialSpec> = {
  pla: { label: 'PLA (filament)', densityGPerCm3: 1.24, cm3PerHour: 12 },
  resin: { label: 'Resin (MSLA)', densityGPerCm3: 1.1, cm3PerHour: 5 },
};

const SILICONE_DENSITY = 1.1;

/** Enclosed volume (cm³) of a closed mesh in mm, via summed signed tetrahedra. */
export function meshVolumeCm3(positions: Float32Array, index?: ArrayLike<number> | null): number {
  const n = index ? index.length : positions.length / 3;
  const max = positions.length - 3;
  let sum = 0;
  for (let t = 0; t + 2 < n; t += 3) {
    const a = 3 * (index ? index[t]! : t);
    const b = 3 * (index ? index[t + 1]! : t + 1);
    const c = 3 * (index ? index[t + 2]! : t + 2);
    if (a > max || b > max || c > max) continue;
    const [ax, ay, az] = [positions[a]!, positions[a + 1]!, positions[a + 2]!];
    const [bx, by, bz] = [positions[b]!, positions[b + 1]!, positions[b + 2]!];
    const [cx, cy, cz] = [positions[c]!, positions[c + 1]!, positions[c + 2]!];
    // a · (b × c)
    sum += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  const cm3 = Math.abs(sum) / 6000;
  return Number.isFinite(cm3) ? cm3 : 0;
}

export interface CostEstimate { volumeCm3: number; grams: number; hours: number; cost: number }

const price = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0);

export function estimatePieceCost(volumeCm3: number, material: PrintMaterial, pricePerKg: number): CostEstimate {
  const m = MATERIALS[material];
  const grams = volumeCm3 * m.densityGPerCm3;
  return { volumeCm3, grams, hours: Math.max(0.25, volumeCm3 / m.cm3PerHour), cost: (grams / 1000) * price(pricePerKg) };
}

/** Silicone is bought by the litre; cure time isn't machine time, so hours = 0. */
export function estimateSiliconeCost(siliconeVolumeCm3: number, pricePerLiter: number): CostEstimate {
  return {
    volumeCm3: siliconeVolumeCm3,
    grams: siliconeVolumeCm3 * SILICONE_DENSITY,
    hours: 0,
    cost: (siliconeVolumeCm3 / 1000) * price(pricePerLiter),
  };
}
