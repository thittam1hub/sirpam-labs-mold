// Sirpam 3D Labs Mold — Phase 3: leak check and cure/pour planner.
// Leak check: how wide is the flat seal land between the cavity edge and the
// mold's outer wall on the parting plane? Narrow lands leak under pour pressure.
import type * as THREE from 'three';
import type { Axis } from '../types';
import { planeFromBox } from './planeGeometry';
import { getNonIndexedPositions } from './draftAnalysis';
import { CASTING_MATERIALS, type CastingMaterialId } from '../utils/tier2';

export const SEAL_LAND_OK_MM = 6;
export const SEAL_LAND_MIN_MM = 3;

export interface LeakCheck {
  /** Narrowest seal land, mm (Infinity when the plane misses the model). */
  landMm: number;
  level: 'ok' | 'caution' | 'leak';
  advice: string;
}

/** Narrowest distance from the model's section on the plane to the box edge. */
export function sealLandMm(g: THREE.BufferGeometry, axis: Axis, offset: number, bbox: THREE.Box3, wallMm: number, cutAngle = 0): number {
  const plane = planeFromBox(bbox, axis, offset, cutAngle);
  const [nx, ny, nz] = plane.normal;
  const pi = { x: 0, y: 1, z: 2 }[axis];
  const lat = [0, 1, 2].filter(i => i !== pi);
  const lo = [bbox.min.x, bbox.min.y, bbox.min.z], hi = [bbox.max.x, bbox.max.y, bbox.max.z];
  const p = getNonIndexedPositions(g);
  let best = Infinity;
  for (let o = 0; o + 8 < p.length; o += 9) {
    for (let k = 0; k < 3; k++) {
      const a = o + k * 3, b = o + ((k + 1) % 3) * 3;
      const da = p[a]! * nx + p[a + 1]! * ny + p[a + 2]! * nz - plane.originOffset;
      const db = p[b]! * nx + p[b + 1]! * ny + p[b + 2]! * nz - plane.originOffset;
      if (da * db > 0 || da === db) continue;
      const t = da / (da - db);
      for (const i of lat) {
        const v = p[a + i]! + t * (p[b + i]! - p[a + i]!);
        best = Math.min(best, v - (lo[i]! - wallMm), hi[i]! + wallMm - v);
      }
    }
  }
  return best;
}

export function leakCheck(g: THREE.BufferGeometry, axis: Axis, offset: number, bbox: THREE.Box3, wallMm: number, cutAngle = 0): LeakCheck {
  const landMm = sealLandMm(g, axis, offset, bbox, wallMm, cutAngle);
  if (landMm >= SEAL_LAND_OK_MM) return { landMm, level: 'ok', advice: 'Seal land is wide enough — clamp evenly and it should not leak.' };
  if (landMm >= SEAL_LAND_MIN_MM) return { landMm, level: 'caution', advice: `Seal land is only ${landMm.toFixed(1)} mm. Add a bead of hot glue or clay around the seam, or raise the wall thickness.` };
  return { landMm, level: 'leak', advice: `Seal land is ${landMm.toFixed(1)} mm — the halves barely touch. Increase the wall/margin to at least ${SEAL_LAND_OK_MM} mm before printing.` };
}

// ─── Cure & pour planner ───

const POT_LIFE: Record<CastingMaterialId, string> = {
  pu_resin: '3–5 min', epoxy: '20–40 min', plaster: '8–12 min', concrete: '30–60 min',
  wax: 'until it skins (~2 min)', soap: 'until it skins (~3 min)', chocolate: 'while tempered (~5 min)', silicone_cast: '20–40 min',
};

export interface PourStep { label: string; detail: string }

export function pourPlan(material: CastingMaterialId, castGrams?: number): PourStep[] {
  const m = CASTING_MATERIALS.find(c => c.id === material)!;
  const mix = castGrams ? `Mix about ${Math.ceil(castGrams * 1.15)} g (cast + 15% for the sprue and cup).` : 'Mix enough for the cast plus 15% for the sprue and cup.';
  return [
    { label: 'Prepare', detail: `Clamp the halves, apply release (${m.release}), bring material to ~${m.pourTempC} °C.` },
    { label: 'Mix', detail: mix },
    { label: 'Pour', detail: `Working time: ${POT_LIFE[material]}. Pour slowly into the sprue in a thin stream; stop when material shows in every vent.` },
    { label: 'Wait', detail: `Demold after ${m.demold}. ${m.notes}` },
    { label: 'Finish', detail: 'Open the mold from the pry pockets, trim the sprue and flash, and clean the mold before the next pour.' },
  ];
}
