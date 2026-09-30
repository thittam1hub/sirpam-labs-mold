// Sirpam 3D Labs Mold — printer-fit and wall-thickness derivations shared by
// the Model and Mold steps. Pure functions over AppState fields; kept out of
// the step components so both can read the same numbers without recomputing
// slightly different versions of them.
import { computeFit, suggestScale, type FitResult } from '../../utils/printerFit';
import { getPresetById, type PrinterPreset } from '../../utils/printerPresets';
import { WALL_THICKNESS_MIN, WALL_THICKNESS_MAX } from './constants';

export interface Bbox3 { x: number; y: number; z: number }

export function boundingBoxSize(boundingBox: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } } | null): Bbox3 | null {
  if (!boundingBox) return null;
  return {
    x: boundingBox.max.x - boundingBox.min.x,
    y: boundingBox.max.y - boundingBox.min.y,
    z: boundingBox.max.z - boundingBox.min.z,
  };
}

export interface PrinterFitInfo {
  selectedPrinter: PrinterPreset | undefined;
  partBbox: Bbox3 | null;
  fit: FitResult | null;
  suggestedScale: number | null;
  canApplySuggestion: boolean;
  scaleDiffersFromDefault: boolean;
}

export function computePrinterFitInfo(
  selectedPrinterId: string | null,
  boundingBox: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } } | null,
  wallThicknessRatio: number,
  scale: number,
): PrinterFitInfo {
  const selectedPrinter = getPresetById(selectedPrinterId);
  const partBbox = boundingBoxSize(boundingBox);
  const fit = (selectedPrinter && partBbox) ? computeFit(partBbox, wallThicknessRatio, scale, selectedPrinter) : null;
  const suggestedScale = (selectedPrinter && partBbox && fit && !fit.fits)
    ? suggestScale(partBbox, wallThicknessRatio, selectedPrinter)
    : null;
  const canApplySuggestion = suggestedScale !== null && Math.abs(scale - suggestedScale) > 0.001;
  const scaleDiffersFromDefault = Math.abs(scale - 1.0) > 0.001;
  return { selectedPrinter, partBbox, fit, suggestedScale, canApplySuggestion, scaleDiffersFromDefault };
}

export interface WallThicknessInfo {
  wallMaxExtent: number;
  wallThicknessMm: number;
  wallMmMin: number;
  wallMmMax: number;
}

/** Users think in mm; the ratio (source of truth for the CSG engine) is
 *  derived from the model's largest dimension. Guarded against a 0-extent
 *  (no model yet) so callers never divide by zero. */
export function computeWallThicknessInfo(partBbox: Bbox3 | null, wallThicknessRatio: number): WallThicknessInfo {
  const wallMaxExtent = partBbox ? Math.max(partBbox.x, partBbox.y, partBbox.z) : 0;
  return {
    wallMaxExtent,
    wallThicknessMm: wallThicknessRatio * wallMaxExtent,
    wallMmMin: WALL_THICKNESS_MIN * wallMaxExtent,
    wallMmMax: WALL_THICKNESS_MAX * wallMaxExtent,
  };
}
