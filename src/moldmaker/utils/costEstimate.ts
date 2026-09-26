// @ts-nocheck — upstream mold-maker code; type-checked under its own repo tsconfig
/**
 * Material & cost estimator math.
 *
 * Pure functions over typed arrays — no THREE import needed, so the
 * ControlPanel (which is deliberately THREE-free) can call these directly on
 * the piece geometries' raw attribute arrays.
 *
 * Volume uses the divergence theorem: the signed volume of a closed triangle
 * mesh is Σ dot(v0, cross(v1, v2)) / 6. Model units are millimetres, so the
 * result is mm³ → divided by 1000 for cm³. Sign depends on winding
 * orientation; taking the absolute value handles both conventions.
 *
 * Print-time is a deliberately rough throughput rule of thumb (effective
 * cm³/hour of deposited/cured material including travel, layer changes, and
 * supports), not a slicer simulation — good enough to compare "is this job
 * 2 hours or 20?" and honest about being an estimate in the UI copy.
 */

export type PrintMaterial = 'pla' | 'resin';

export interface MaterialSpec {
  label: string;
  /** Density in g/cm³ — PLA 1.24, standard MSLA resin 1.10. */
  densityGPerCm3: number;
  /** Effective material throughput, cm³/hour, including supports/waste. */
  cm3PerHour: number;
}

export const MATERIALS: Record<PrintMaterial, MaterialSpec> = {
  pla: { label: 'PLA (filament)', densityGPerCm3: 1.24, cm3PerHour: 12 },
  resin: { label: 'Resin (MSLA)', densityGPerCm3: 1.1, cm3PerHour: 5 },
};

/**
 * Enclosed volume of a triangle mesh in cm³. Accepts raw position/index
 * arrays (indexed or non-indexed). Returns 0 for degenerate/NaN input
 * rather than propagating garbage into cost numbers.
 */
export function meshVolumeCm3(
  positions: Float32Array,
  index?: ArrayLike<number> | null,
): number {
  const count = index ? index.length : positions.length / 3;
  if (count < 3 || positions.length < 9) return 0;

  let vol6 = 0; // accumulated 6×signed volume
  for (let t = 0; t + 2 < count; t += 3) {
    const i0 = index ? index[t] * 3 : t * 3;
    const i1 = index ? index[t + 1] * 3 : (t + 1) * 3;
    const i2 = index ? index[t + 2] * 3 : (t + 2) * 3;
    if (i0 + 2 >= positions.length || i1 + 2 >= positions.length || i2 + 2 >= positions.length) {
      continue;
    }
    const ax = positions[i0], ay = positions[i0 + 1], az = positions[i0 + 2];
    const bx = positions[i1], by = positions[i1 + 1], bz = positions[i1 + 2];
    const cx = positions[i2], cy = positions[i2 + 1], cz = positions[i2 + 2];
    // cross(b, c) then dot(a, cross) — the scalar triple product.
    vol6 += ax * (by * cz - bz * cy)
          + ay * (bz * cx - bx * cz)
          + az * (bx * cy - by * cx);
  }

  const cm3 = Math.abs(vol6) / 6 / 1000;
  return Number.isFinite(cm3) ? cm3 : 0;
}

export interface CostEstimate {
  /** Mold volume, cm³. */
  volumeCm3: number;
  /** Material weight, grams. */
  grams: number;
  /** Rough print time, hours. */
  hours: number;
  /** Material cost (no currency symbol — the user sets the price). */
  cost: number;
}

export function estimatePieceCost(
  volumeCm3: number,
  material: PrintMaterial,
  pricePerKg: number,
): CostEstimate {
  const spec = MATERIALS[material];
  const grams = volumeCm3 * spec.densityGPerCm3;
  // Floor at 15 min — even a trivial mold half has slicing/startup overhead.
  const hours = Math.max(0.25, volumeCm3 / spec.cm3PerHour);
  const safePrice = Number.isFinite(pricePerKg) && pricePerKg > 0 ? pricePerKg : 0;
  return {
    volumeCm3,
    grams,
    hours,
    cost: (grams / 1000) * safePrice,
  };
}

/** Silicone cost from the generator's own cm³ estimate. */
export function estimateSiliconeCost(
  siliconeVolumeCm3: number,
  pricePerLiter: number,
): CostEstimate {
  const spec = { densityGPerCm3: 1.1 };
  const grams = siliconeVolumeCm3 * spec.densityGPerCm3;
  const safePrice = Number.isFinite(pricePerLiter) && pricePerLiter > 0 ? pricePerLiter : 0;
  return {
    volumeCm3: siliconeVolumeCm3,
    grams,
    hours: 0, // curing time isn't machine time; not shown for silicone.
    cost: (siliconeVolumeCm3 / 1000) * safePrice,
  };
}
