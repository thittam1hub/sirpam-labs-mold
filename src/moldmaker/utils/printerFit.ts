// Sirpam 3D Labs Mold — will the mold fit on the chosen printer, and if not,
// what scale would make it fit?
import type { PrinterPreset } from './printerPresets';

export interface Mm3 { x: number; y: number; z: number }
export type PartBbox = Mm3;
type Ax = 'x' | 'y' | 'z';
const AXES: Ax[] = ['x', 'y', 'z'];

/** Mold block size: the scaled part plus a wall (a ratio of its longest side) on every face. */
export function predictMoldFootprint(part: PartBbox, wallRatio: number, scale: number): Mm3 {
  const wall = Math.max(part.x, part.y, part.z) * wallRatio * scale;
  return { x: part.x * scale + 2 * wall, y: part.y * scale + 2 * wall, z: part.z * scale + 2 * wall };
}

export interface FitResult { fits: boolean; moldSize: Mm3; overflow: Mm3; worstAxis: Ax | null }

export function computeFit(part: PartBbox, wallRatio: number, scale: number, printer: PrinterPreset): FitResult {
  const moldSize = predictMoldFootprint(part, wallRatio, scale);
  const overflow = {} as Mm3;
  for (const a of AXES) overflow[a] = Math.max(0, moldSize[a] - printer.volumeMm[a]);
  const worst = AXES.reduce((w, a) => (overflow[a] > overflow[w] ? a : w), 'x' as Ax);
  const fits = overflow[worst] === 0;
  return { fits, moldSize, overflow, worstAxis: fits ? null : worst };
}

/** Largest scale (≤ 1, rounded down to 0.01) that keeps the mold inside the printer with a safety margin. */
export function suggestScale(part: PartBbox, wallRatio: number, printer: PrinterPreset, safetyMargin = 0.95): number {
  if (AXES.some(a => part[a] <= 0)) return 1;
  const wall2 = 2 * wallRatio * Math.max(part.x, part.y, part.z);
  const s = Math.min(...AXES.map(a => (printer.volumeMm[a] * safetyMargin) / (part[a] + wall2)));
  return s >= 1 ? 1 : Math.floor(s * 100) / 100;
}

export function formatFitStatus(fit: FitResult): string {
  if (fit.fits) {
    const { x, y, z } = fit.moldSize;
    return `Fits (${Math.round(x)} × ${Math.round(y)} × ${Math.round(z)} mm)`;
  }
  const over = AXES.filter(a => fit.overflow[a] > 0).map(a => `${Math.ceil(fit.overflow[a])}mm on ${a.toUpperCase()}`);
  return `Doesn't fit — ${over.join(', ')}`;
}
