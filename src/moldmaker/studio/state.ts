// Sirpam 3D Labs Mold — shared app state shape and defaults for the Studio.
import * as THREE from 'three';
import type { Tier2Settings } from '../components/AdvancedMoldPanel';
import { DEFAULT_TIER2, tier2GeomKey } from '../components/AdvancedMoldPanel';
import type { Axis, MoldBoxShape, MoldMode, SiliconeMoldType } from '../types';
import { WALL_THICKNESS_RATIO, CLEARANCE_MM } from '../mold/constants';

/**
 * Snapshot of the parameters a given mold was generated with. When the
 * current parameters drift from this snapshot, the UI knows the mold is
 * stale and surfaces a "Regenerate Mold" CTA instead of silently discarding
 * the mold.
 */
export interface GeneratedParams {
  axis: Axis;
  offset: number;
  cutAngle: number;
  wallThicknessRatio: number;
  clearanceMm: number;
  sprueDiameterMm: number;
  moldBoxShape: MoldBoxShape;
  sprueOverride: { a: number; b: number } | null;
  additionalPlanes: Array<{ axis: Axis; offset: number; cutAngle: number }>;
  isHollow: boolean;
  moldMode: MoldMode;
  siliconeType: SiliconeMoldType;
  siliconeMarginMm: number;
  skinThicknessMm: number;
  includeCore: boolean;
  formFit: boolean;
  tier2: Tier2Settings;
}

export interface AppState {
  originalGeometry: THREE.BufferGeometry | null;
  fileName: string;
  axis: Axis;
  planeOffset: number;
  cutAngle: number;
  wallThicknessRatio: number;
  clearanceMm: number;
  sprueDiameterMm: number;
  moldBoxShape: MoldBoxShape;
  sprueOverride: { enabled: boolean; a: number; b: number };
  autoDetecting: boolean;
  moldGenerated: boolean;
  moldPieces: THREE.BufferGeometry[];
  additionalPlanes: Array<{ axis: Axis; offset: number; cutAngle: number }>;
  isHollow: boolean;
  moldMode: MoldMode;
  siliconeType: SiliconeMoldType;
  siliconeMarginMm: number;
  skinThicknessMm: number;
  includeCore: boolean;
  formFit: boolean;
  tier2: Tier2Settings;
  pieceLabels: string[];
  buildNotices: string[];
  siliconeVolumeCm3: number;
  generatedParams: GeneratedParams | null;
  explodedView: boolean;
  showOriginal: boolean;
  showHeatmap: boolean;
  showSplitLine: boolean;
  suggesting: boolean;
  estimator: {
    material: 'pla' | 'resin';
    pricePerKg: number;
    siliconePricePerLiter: number;
  };
  wireframe: boolean;
  generating: boolean;
  boundingBox: THREE.Box3 | null;
  errorMessage: string | null;
  infoMessage: string | null;
  scale: number;
  selectedPrinterId: string | null;
}

export const initialAppState: AppState = {
  originalGeometry: null,
  fileName: '',
  axis: 'z',
  planeOffset: 0.5,
  cutAngle: 0,
  wallThicknessRatio: WALL_THICKNESS_RATIO,
  clearanceMm: CLEARANCE_MM,
  sprueDiameterMm: 0, // 0 = auto: sized to the model at generation time
  moldBoxShape: 'rect',
  sprueOverride: { enabled: false, a: 0, b: 0 },
  autoDetecting: false,
  moldGenerated: false,
  moldPieces: [],
  additionalPlanes: [],
  isHollow: false,
  moldMode: 'rigid',
  siliconeType: 'blockTwoPart',
  siliconeMarginMm: 0,
  skinThicknessMm: 0,
  includeCore: true,
  formFit: false,
  buildNotices: [],
  tier2: DEFAULT_TIER2,
  pieceLabels: [],
  siliconeVolumeCm3: 0,
  generatedParams: null,
  explodedView: true,
  showOriginal: true,
  showHeatmap: false,
  showSplitLine: true,
  suggesting: false,
  estimator: { material: 'pla', pricePerKg: 20, siliconePricePerLiter: 30 },
  wireframe: false,
  generating: false,
  boundingBox: null,
  errorMessage: null,
  infoMessage: null,
  scale: 1.0,
  selectedPrinterId: null,
};

/**
 * True when the live editable params have drifted from the params the
 * current mold was generated with — the UI swaps "Up to date" for
 * "Regenerate" and keeps showing the parting-plane preview.
 */
export function moldIsStale(state: AppState): boolean {
  const gen = state.generatedParams;
  if (!gen) return false;
  const activeOverride = state.sprueOverride.enabled
    ? { a: state.sprueOverride.a, b: state.sprueOverride.b }
    : null;
  const sprueOverrideChanged = (() => {
    const g = gen.sprueOverride;
    if (g === null && activeOverride === null) return false;
    if (g === null || activeOverride === null) return true;
    return g.a !== activeOverride.a || g.b !== activeOverride.b;
  })();
  return (
    gen.axis !== state.axis ||
    gen.offset !== state.planeOffset ||
    gen.cutAngle !== state.cutAngle ||
    gen.wallThicknessRatio !== state.wallThicknessRatio ||
    gen.clearanceMm !== state.clearanceMm ||
    gen.sprueDiameterMm !== state.sprueDiameterMm ||
    gen.moldBoxShape !== state.moldBoxShape ||
    gen.formFit !== state.formFit ||
    tier2GeomKey(gen.tier2) !== tier2GeomKey(state.tier2) ||
    sprueOverrideChanged
  );
}
