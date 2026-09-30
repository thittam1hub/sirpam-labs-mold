// Sirpam 3D Labs Mold — decides whether the current mold matches the current
// parameters, so the primary CTA can say "Generate", "Regenerate" or "Mold Up
// to Date" instead of always saying "Generate" and doing redundant CSG work.
import type { AppState } from '../../App';
import { tier2GeomKey } from '../AdvancedMoldPanel';
import { WALL_THICKNESS_RATIO, CLEARANCE_MM, SPRUE_DIAMETER_MM } from '../../mold/constants';

/** Structural (not reference) equality on the additional-planes list — every
 *  UI edit creates fresh objects, so `===` would always say "changed". */
function additionalPlanesChanged(state: AppState): boolean {
  if (state.generatedParams === null) return false;
  const generated = state.generatedParams.additionalPlanes;
  if (generated.length !== state.additionalPlanes.length) return true;
  return generated.some((p, i) => {
    const cur = state.additionalPlanes[i];
    return !cur || p.axis !== cur.axis || p.offset !== cur.offset || p.cutAngle !== cur.cutAngle;
  });
}

export function isMoldStale(state: AppState): boolean {
  if (state.generatedParams === null) return false;
  const g = state.generatedParams;
  return (
    g.axis !== state.axis ||
    g.offset !== state.planeOffset ||
    g.cutAngle !== state.cutAngle ||
    g.wallThicknessRatio !== state.wallThicknessRatio ||
    g.clearanceMm !== state.clearanceMm ||
    g.sprueDiameterMm !== state.sprueDiameterMm ||
    g.moldBoxShape !== state.moldBoxShape ||
    g.formFit !== state.formFit ||
    tier2GeomKey(g.tier2) !== tier2GeomKey(state.tier2) ||
    g.isHollow !== state.isHollow ||
    g.moldMode !== state.moldMode ||
    (state.moldMode === 'silicone' && (
      g.siliconeType !== state.siliconeType ||
      g.siliconeMarginMm !== state.siliconeMarginMm ||
      g.skinThicknessMm !== state.skinThicknessMm ||
      g.includeCore !== state.includeCore
    )) ||
    additionalPlanesChanged(state)
  );
}

export function isDimensionsAtDefaults(state: AppState): boolean {
  return (
    state.wallThicknessRatio === WALL_THICKNESS_RATIO &&
    state.clearanceMm === CLEARANCE_MM &&
    state.sprueDiameterMm === 0 && // 0 = auto (sized to the model)
    state.moldBoxShape === 'rect' &&
    state.formFit === false
  );
}

export function primaryCtaLabel(state: AppState, hasMold: boolean): string {
  if (state.generating) return 'Generating Mold...';
  if (!hasMold) return 'Generate Mold';
  return isMoldStale(state) ? 'Regenerate Mold' : 'Mold Up to Date';
}

export function primaryCtaDisabled(state: AppState, hasMold: boolean): boolean {
  return state.generating || (hasMold && !isMoldStale(state));
}
