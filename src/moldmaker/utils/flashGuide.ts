// Sirpam 3D Labs Mold — "where to expect flash" guide for the mold report.
// Estimates the split-line perimeter (where the two halves meet and material
// can squeeze out as flash) and reuses the draft analysis to flag zones that
// need extra trimming or a different split.
import * as THREE from 'three';
import type { Axis } from '../types';
import { planeFromBox } from '../mold/planeGeometry';
import { getNonIndexedPositions, undercutFraction, summarizeClassification } from '../mold/draftAnalysis';
import type { CastingMaterialId } from './tier2';

export interface FlashGuide {
  /** Total length of the split line on the model, mm — the flash line. */
  seamMm: number;
  /** Share of faces that are undercuts (0..1). */
  undercutPct: number;
  /** Share of near-vertical faces that may drag (0..1). */
  dragPct: number;
  /** Plain-language trimming advice rows for the report. */
  tips: string[];
}

/** Length of the intersection polyline of a triangle with the plane, or 0. */
function triPlaneSegment(p: Float32Array, o: number, nx: number, ny: number, nz: number, d: number): number {
  const dist = [0, 1, 2].map(k => p[o + k * 3]! * nx + p[o + k * 3 + 1]! * ny + p[o + k * 3 + 2]! * nz - d);
  const pts: number[][] = [];
  for (let k = 0; k < 3; k++) {
    const a = dist[k]!, b = dist[(k + 1) % 3]!;
    if (a === 0) pts.push([p[o + k * 3]!, p[o + k * 3 + 1]!, p[o + k * 3 + 2]!]);
    if (a * b < 0) {
      const t = a / (a - b);
      pts.push([
        p[o + k * 3]! + t * (p[o + ((k + 1) % 3) * 3]! - p[o + k * 3]!),
        p[o + k * 3 + 1]! + t * (p[o + ((k + 1) % 3) * 3 + 1]! - p[o + k * 3 + 1]!),
        p[o + k * 3 + 2]! + t * (p[o + ((k + 1) % 3) * 3 + 2]! - p[o + k * 3 + 2]!),
      ]);
    }
  }
  if (pts.length < 2) return 0;
  return Math.hypot(pts[1]![0]! - pts[0]![0]!, pts[1]![1]! - pts[0]![1]!, pts[1]![2]! - pts[0]![2]!);
}

/** Total split-line length (mm) where the mold halves meet the model. */
export function splitLineLengthMm(source: THREE.BufferGeometry, axis: Axis, offset: number, bbox: THREE.Box3, cutAngle = 0): number {
  const plane = planeFromBox(bbox, axis, offset, cutAngle);
  const [nx, ny, nz] = plane.normal;
  const p = getNonIndexedPositions(source);
  let len = 0;
  for (let o = 0; o + 8 < p.length; o += 9) len += triPlaneSegment(p, o, nx, ny, nz, plane.originOffset);
  return len;
}

const TRIM_ADVICE: Record<CastingMaterialId, string> = {
  pu_resin: 'PU resin flash is soft — trim with a sharp craft knife within an hour of demolding, before it fully hardens.',
  epoxy: 'Epoxy flash hardens like glass — peel it while still rubbery (check at the earliest demold time) or sand it later.',
  plaster: 'Plaster flash snaps off by hand; scrape the seam with a spatula while damp for a clean edge.',
  concrete: 'Concrete flash is abrasive — rub the seam with a rubbing stone or wet sandpaper after demolding.',
  wax: 'Wax flash melts away — run a warm spatula or your thumb along the seam, no knife needed.',
  soap: 'Soap flash planes off with a vegetable peeler or beveller while the bar is still fresh.',
  chocolate: 'Chocolate flash: scrape with a bench scraper once set, or warm the seam slightly and press smooth.',
  silicone_cast: 'Silicone flash tears off by hand; cut thick seams with scissors flush to the part.',
};

export function buildFlashGuide(
  source: THREE.BufferGeometry, axis: Axis, offset: number, bbox: THREE.Box3, cutAngle: number,
  castingMaterial: CastingMaterialId, moldMode: 'rigid' | 'silicone',
): FlashGuide {
  const seamMm = splitLineLengthMm(source, axis, offset, bbox, cutAngle);
  const undercutPct = undercutFraction(source, axis, offset, bbox, cutAngle) * 100;
  const sum = summarizeClassification(source, axis, offset, bbox, cutAngle);
  const dragPct = sum.total ? (sum.yellow / sum.total) * 100 : 0;

  const tips: string[] = [
    `The seam where the halves meet runs about ${seamMm.toFixed(0)} mm around your model — that is the line you will trim.`,
    TRIM_ADVICE[castingMaterial],
  ];
  if (moldMode === 'silicone') {
    tips.push('A silicone mold with a tight seam leaves only a hair-line of flash. Press the halves together firmly or strap them with rubber bands before pouring.');
  } else {
    tips.push('Bolt or clamp the printed halves together — even a 0.2 mm gap at the seam becomes a visible flash line.');
  }
  if (undercutPct > 2) {
    tips.push(`${undercutPct.toFixed(0)}% of the surface is an undercut for this split — expect the cast to grip the mold there. Consider rotating the split axis or tilting the split line.`);
  }
  if (dragPct > 25) {
    tips.push(`${dragPct.toFixed(0)}% of the surface is near-vertical to the pull direction — these walls can drag and scuff. A little extra release agent on the walls helps.`);
  }
  return { seamMm, undercutPct, dragPct, tips };
}
