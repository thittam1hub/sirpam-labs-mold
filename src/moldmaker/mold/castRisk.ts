// Sirpam 3D Labs Mold — pre-pour risk checks shown before generating.
// 1. Demolding risk score (0–100): combines true undercuts and near-vertical
//    drag faces for the chosen split, and suggests a better split axis.
// 2. Air traps: local high points (reuses the auto-vent finder) the pour
//    cannot reach, with a one-click "turn on auto vents" fix in the UI.
import * as THREE from 'three';
import type { Axis } from '../types';
import { summarizeClassification, undercutFraction } from './draftAnalysis';
import { trappedAirPoints } from './proFeatures';

export type RiskLevel = 'low' | 'medium' | 'high';

export interface DemoldRisk {
  score: number;
  level: RiskLevel;
  undercutPct: number;
  dragPct: number;
  /** Better axis (mid split) when it scores at least 15 points lower. */
  betterAxis: Axis | null;
  betterScore: number | null;
}

/** 0 = pops right out, 100 = locked in. Undercuts weigh 4× drag faces. */
export function riskScore(undercutPct: number, dragPct: number): number {
  return Math.round(Math.min(100, undercutPct * 400 + dragPct * 60));
}

export function riskLevel(score: number): RiskLevel {
  return score < 25 ? 'low' : score < 55 ? 'medium' : 'high';
}

function scoreFor(g: THREE.BufferGeometry, axis: Axis, offset: number, bbox: THREE.Box3, cutAngle: number) {
  const u = undercutFraction(g, axis, offset, bbox, cutAngle);
  const s = summarizeClassification(g, axis, offset, bbox, cutAngle);
  const d = s.total ? s.yellow / s.total : 0;
  return { u, d, score: riskScore(u, d) };
}

export function demoldRisk(g: THREE.BufferGeometry, axis: Axis, offset: number, bbox: THREE.Box3, cutAngle = 0): DemoldRisk {
  const cur = scoreFor(g, axis, offset, bbox, cutAngle);
  let betterAxis: Axis | null = null, betterScore: number | null = null;
  for (const a of ['x', 'y', 'z'] as Axis[]) {
    if (a === axis) continue;
    const s = scoreFor(g, a, 0.5, bbox, 0).score;
    if (s <= cur.score - 15 && (betterScore === null || s < betterScore)) { betterAxis = a; betterScore = s; }
  }
  return { score: cur.score, level: riskLevel(cur.score), undercutPct: cur.u, dragPct: cur.d, betterAxis, betterScore };
}

/** Likely air pockets for pouring along +axis from the model's centre. */
export function airTrapPoints(g: THREE.BufferGeometry, axis: Axis, bbox: THREE.Box3) {
  const c = bbox.getCenter(new THREE.Vector3());
  const idx = { x: 0, y: 1, z: 2 }[axis];
  const lat = [0, 1, 2].filter(i => i !== idx) as [number, number];
  const size = bbox.getSize(new THREE.Vector3());
  const avoidR = Math.max(size.getComponent(lat[0]), size.getComponent(lat[1])) * 0.08;
  return trappedAirPoints(g, axis, bbox, [[c.getComponent(lat[0]), c.getComponent(lat[1])]], avoidR);
}
