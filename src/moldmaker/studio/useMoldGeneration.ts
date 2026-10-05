// Sirpam 3D Labs Mold — generate/auto-detect/suggest-parting workflow and mold staleness.
import { useCallback, useEffect, useRef, useState } from 'react';
import type * as THREE from 'three';
import type { AppState, GeneratedParams } from './state';
import { useMoldGenerator } from '../hooks/useMoldGenerator';
import { buildCavityTray, solidProps } from '../utils/tier2';
import type { MoldExtras } from '../mold/moldFeatures';
import { summarizeRepairs } from '../mold/validateMesh';
import { repairModel, describeRepair } from '../mold/meshFix';
import { trackEvent } from '@/components/Analytics';
import { supabase } from '@/integrations/supabase/client';
import { getCreditStatus } from '@/lib/credits';
import { reserveFor, type Charge } from '@/lib/credits';

export interface MoldGeneration {
  handleGenerate: () => Promise<void>;
  handleAutoDetect: () => Promise<void>;
  handleSuggestParting: () => Promise<void>;
  repairProgress: { pct: number; label: string } | null;
}

/**
 * Owns the Generate / Auto-detect / Suggest-parting button behaviour: builds
 * the (silicone or rigid) generator inputs from live state, snapshots the
 * params used so staleness can be detected later, auto-repairs and retries
 * once on non-manifold failures, and reports analytics + credit reservations.
 */
export function useMoldGeneration(
  state: AppState,
  setState: React.Dispatch<React.SetStateAction<AppState>>,
  undoGeoRef: React.MutableRefObject<THREE.BufferGeometry | null>,
  setCanUndo: (v: boolean) => void,
): MoldGeneration {
  const { generateMold, generateSilicone, autoDetectPlane, suggestParting } = useMoldGenerator();

  const autoRepairTried = useRef(false);
  const retryAfterRepair = useRef(false);
  const pendingAutoRepairNote = useRef<string | null>(null);
  const [repairProgress, setRepairProgress] = useState<{ pct: number; label: string } | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!state.originalGeometry || !state.boundingBox) return;
    if (state.generating) return; // concurrent-click guard — Manifold WASM is a singleton

    setState(prev => ({ ...prev, generating: true, errorMessage: null, infoMessage: null }));

    // Free-tier watermark: signed-in users with zero paid credits get
    // "Sirpam" engraved on the bottom half (box molds only). Never blocks
    // generation if the credit check itself fails.
    let freeWatermark: string | undefined;
    try {
      const { data: s } = await supabase.auth.getSession();
      if (s.session) {
        const cs = await getCreditStatus();
        if (cs && cs.balance === 0) freeWatermark = 'Sirpam';
      }
    } catch { /* credit check is best-effort */ }

    const activeSprueOverride = state.sprueOverride.enabled
      ? { a: state.sprueOverride.a, b: state.sprueOverride.b }
      : null;

    const params: GeneratedParams = {
      axis: state.axis,
      offset: state.planeOffset,
      cutAngle: state.cutAngle,
      wallThicknessRatio: state.wallThicknessRatio,
      clearanceMm: state.clearanceMm,
      sprueDiameterMm: state.sprueDiameterMm,
      moldBoxShape: state.moldBoxShape,
      sprueOverride: activeSprueOverride,
      additionalPlanes: state.additionalPlanes.map(p => ({ ...p })),
      isHollow: state.isHollow,
      moldMode: state.moldMode,
      siliconeType: state.siliconeType,
      siliconeMarginMm: state.siliconeMarginMm,
      skinThicknessMm: state.skinThicknessMm,
      includeCore: state.includeCore,
      formFit: state.formFit,
      tier2: { ...state.tier2, siliconeSides: { ...state.tier2.siliconeSides } },
    };

    const t2 = params.tier2;
    const useTray = t2.cavityCount > 1 &&
      !(params.moldMode === 'silicone' && params.siliconeType === 'skinCore');
    const tray = useTray
      ? buildCavityTray(state.originalGeometry, params.axis, t2.cavityCount, t2.cavitySpacingMm)
      : null;
    const genGeometry = tray ? tray.geometry : state.originalGeometry;
    const genBox = tray ? tray.bbox : state.boundingBox;
    const castMl = t2.volumeLabel
      ? Math.max(1, Math.round((solidProps(genGeometry).volume / 1000) * 1.05))
      : 0;
    const extras: MoldExtras = {
      seal: t2.seal,
      pryPockets: t2.pryPockets,
      shopKit: true,
      radialSegments: t2.radialSegments,
      siliconeMargins: t2.siliconeSides.enabled
        ? { top: t2.siliconeSides.top, bottom: t2.siliconeSides.bottom, sides: t2.siliconeSides.sides }
        : undefined,
      cavityCenters: tray ? tray.centers : undefined,
      hollowCore: params.moldMode !== 'silicone' && t2.hollowCore?.enabled
        ? { wallMm: t2.hollowCore.wallMm, opening: t2.hollowCore.opening }
        : undefined,
      runner: tray && params.moldMode !== 'silicone' ? !!t2.runner : undefined,
      ...(params.moldMode !== 'silicone' ? {
        style: t2.moldStyle && t2.moldStyle !== 'standard' ? t2.moldStyle : undefined,
        curvedSplit: t2.curvedSplit || undefined,
        clampBoltMm: t2.clampBoltMm || undefined,
        clampLands: (t2.clampBoltMm && t2.clampLands) || undefined,
        corePinMm: t2.corePinMm || undefined,
        pourFunnel: t2.pourFunnel || undefined,
        clampJig: t2.clampJig || undefined,
        autoVents: t2.autoVents || undefined,
        standFins: t2.standFins || undefined,
        volumeLabel: t2.volumeLabel && castMl ? `${castMl} ML` : undefined,
        watermark: t2.watermark?.trim() || freeWatermark || undefined,
        moldFeet: t2.moldFeet || undefined,
        gapFiller: t2.gapFiller || undefined,
        pieceCount: t2.pieceCount && t2.pieceCount > 2 ? t2.pieceCount : undefined,
        wallMm: undefined,
        ventDiameterMm: t2.ventDiameterMm && t2.ventDiameterMm > 0 ? t2.ventDiameterMm : undefined,
        ventCount: t2.ventCount !== undefined && t2.ventCount >= 0 ? t2.ventCount : undefined,
        lockStyle: t2.lockStyle && t2.lockStyle !== 'round' ? t2.lockStyle : undefined,
        lockDiameterMm: t2.lockDiameterMm && t2.lockDiameterMm > 0 ? t2.lockDiameterMm : undefined,
        lockCount: t2.lockCount === 2 ? 2 : undefined,
      } : {}),
      flangeMm: params.formFit && t2.flangeMm && t2.flangeMm > 0 ? t2.flangeMm : undefined,
      flangeBoltMm: params.formFit && t2.flangeMm && t2.flangeBoltMm && t2.flangeBoltMm > 0 ? t2.flangeBoltMm : undefined,
      partingBoard: params.moldMode === 'silicone' && t2.partingBoard ? true : undefined,
      wallRibs: params.moldMode === 'silicone' && !params.formFit && t2.wallRibs ? true : undefined,
    };

    try {
      const result = params.moldMode === 'silicone'
        ? await generateSilicone(
            genGeometry, genBox, params.axis, params.offset,
            {
              siliconeType: params.siliconeType,
              siliconeMarginMm: params.siliconeMarginMm || undefined,
              skinThicknessMm: params.skinThicknessMm || undefined,
              includeCore: params.includeCore,
              wallThicknessRatio: params.wallThicknessRatio,
              clearanceMm: params.clearanceMm,
              sprueDiameterMm: params.sprueDiameterMm > 0 ? params.sprueDiameterMm : undefined,
              moldBoxShape: params.moldBoxShape,
              cutAngle: params.cutAngle,
              isHollow: params.isHollow,
              formFit: params.formFit,
              extras,
            },
          )
        : await generateMold(
            genGeometry, genBox, params.axis, params.offset,
            {
              wallThicknessRatio: params.wallThicknessRatio,
              clearanceMm: params.clearanceMm,
              sprueDiameterMm: params.sprueDiameterMm > 0 ? params.sprueDiameterMm : undefined,
              moldBoxShape: params.moldBoxShape,
              cutAngle: params.cutAngle,
              sprueOverride: params.sprueOverride ?? undefined,
              additionalPlanes: params.additionalPlanes.length > 0 ? params.additionalPlanes : undefined,
              isHollow: params.isHollow,
              formFit: params.formFit,
              extras,
            },
          );

      const repairNote = summarizeRepairs(result.repairs);

      setState(prev => ({
        ...prev,
        moldPieces: result.pieces,
        moldGenerated: true,
        pieceLabels: (result as { labels?: string[] }).labels ?? [],
        buildNotices: (result as { notices?: string[] }).notices ?? [],
        siliconeVolumeCm3: (result as { siliconeVolumeCm3?: number }).siliconeVolumeCm3 ?? 0,
        generatedParams: params,
        generating: false,
        showOriginal: false,
        infoMessage: [pendingAutoRepairNote.current ?? repairNote, ...((result as { notices?: string[] }).notices ?? [])]
          .filter(Boolean).join(' ') || null,
      }));
      pendingAutoRepairNote.current = null;
      autoRepairTried.current = false;
      trackEvent('mold_generated', { axis: params.axis });
    } catch (err) {
      console.error('Mold generation failed:', err);
      const msg = err instanceof Error ? err.message : '';
      // Auto-repair: broken-surface failures are fixed and retried once automatically.
      if (!autoRepairTried.current && /non-manifold|not manifold|watertight/i.test(msg) && !tray) {
        autoRepairTried.current = true;
        setState(prev => ({ ...prev, infoMessage: 'Broken spots found — repairing the model automatically…' }));
        let charge: Charge | null = null;
        try {
          charge = await reserveFor('auto_repair', m => setState(prev => ({ ...prev, infoMessage: m })));
          if (!charge) throw new Error('repair_declined');
          setRepairProgress({ pct: 0, label: 'Starting repair' });
          const { geometry: fixed, report } = await repairModel(state.originalGeometry, (pct, label) => setRepairProgress({ pct, label }))
            .finally(() => setRepairProgress(null));
          if (report.solidOk) {
            await charge.succeed();
            fixed.computeBoundingBox();
            undoGeoRef.current = state.originalGeometry;
            setCanUndo(true);
            pendingAutoRepairNote.current = `Auto-repaired before making the mold: ${describeRepair(report)}.`;
            setState(prev => ({ ...prev, generating: false, originalGeometry: fixed, boundingBox: fixed.boundingBox!.clone(), errorMessage: null }));
            retryAfterRepair.current = true;
            return;
          }
          await charge.fail();
          autoRepairTried.current = false;
          setState(prev => ({
            ...prev,
            generating: false,
            errorMessage: `This model can't be made into a mold yet. We tried to fix it (${describeRepair(report)}), but it still isn't one closed solid. No credits were used. Try "Repair model" or "Reduce detail" in the Model step, or export a cleaner file from your 3D program.`,
          }));
          return;
        } catch (e) { await charge?.fail(); console.error('Auto-repair failed:', e); }
      }
      autoRepairTried.current = false;
      setState(prev => ({
        ...prev,
        generating: false,
        errorMessage: msg || 'Mold generation failed. The model may not be watertight.',
      }));
    }
  }, [
    state.originalGeometry, state.boundingBox, state.axis, state.planeOffset, state.cutAngle,
    state.wallThicknessRatio, state.clearanceMm, state.sprueDiameterMm, state.moldBoxShape,
    state.sprueOverride, state.additionalPlanes, state.isHollow, state.moldMode, state.siliconeType,
    state.siliconeMarginMm, state.skinThicknessMm, state.includeCore, state.formFit, state.tier2,
    state.generating, generateMold, generateSilicone, setState, undoGeoRef, setCanUndo,
  ]);

  const handleAutoDetect = useCallback(async () => {
    if (!state.originalGeometry) return;
    if (state.autoDetecting) return;
    setState(prev => ({ ...prev, autoDetecting: true, errorMessage: null }));
    try {
      const result = await autoDetectPlane(state.originalGeometry);
      setState(prev => ({ ...prev, axis: result.axis, planeOffset: result.offset, autoDetecting: false }));
    } catch (err) {
      console.error('Auto-detect failed:', err);
      setState(prev => ({ ...prev, autoDetecting: false, errorMessage: err instanceof Error ? err.message : 'Auto-detect failed.' }));
    }
  }, [state.originalGeometry, state.autoDetecting, autoDetectPlane, setState]);

  const handleSuggestParting = useCallback(async () => {
    if (!state.originalGeometry || !state.boundingBox || state.suggesting) return;
    setState(prev => ({ ...prev, suggesting: true, errorMessage: null }));
    try {
      const result = await suggestParting(state.originalGeometry, state.boundingBox);
      setState(prev => ({
        ...prev,
        axis: result.axis,
        planeOffset: result.offset,
        cutAngle: result.cutAngle,
        suggesting: false,
        infoMessage:
          `Best split found: ${result.axis.toUpperCase()} axis, ${Math.round(result.offset * 100)}% up` +
          (result.cutAngle !== 0 ? `, ${result.cutAngle}° tilt` : '') +
          ` — ${result.undercut < 0.005 ? 'no' : (result.undercut * 100).toFixed(1) + '%'} undercut faces. ` +
          'Adjust if you like, then Generate.',
      }));
    } catch (err) {
      console.error('Split advisor failed:', err);
      setState(prev => ({ ...prev, suggesting: false, errorMessage: err instanceof Error ? err.message : 'Split advisor failed.' }));
    }
  }, [state.originalGeometry, state.boundingBox, state.suggesting, suggestParting, setState]);

  // Retry the mold once the auto-repair replaced state.originalGeometry —
  // handleGenerate sets retryAfterRepair.current before returning early.
  useEffect(() => {
    if (retryAfterRepair.current && state.originalGeometry && !state.generating) {
      retryAfterRepair.current = false;
      void handleGenerate();
    }
  }, [state.originalGeometry, state.generating, handleGenerate]);

  return { handleGenerate, handleAutoDetect, handleSuggestParting, repairProgress };
}
