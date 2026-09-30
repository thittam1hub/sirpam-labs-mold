// Sirpam 3D Labs Mold — file export (STL/OBJ/3MF/STEP) with credits and STEP cancel/busy state.
import { useCallback, useState } from 'react';
import type { AppState } from './state';
import { useMoldGenerator } from '../hooks/useMoldGenerator';
import { orientForPrint, solidProps } from '../utils/tier2';
import { translateStepError } from '../mold/stepExportErrors';
import { trackEvent } from '@/components/Analytics';
import { reserveFor, type CreditAction } from '@/lib/credits';

export interface ExportActions {
  handleExport: (format: 'stl' | 'obj' | '3mf' | 'step') => Promise<void>;
  handleCancelStepExport: () => void;
  /** True while a STEP export is mid-flight (worker-side, ~60s total). */
  stepExporting: boolean;
}

/**
 * Owns the export button: reserves credits before writing a file (STEP is
 * charged for like every other format, but runs long enough to need its own
 * busy/cancel state), bakes the viewport's display scale and print-orientation
 * into the geometry, and translates worker-side STEP failures into copy a
 * user can act on.
 */
export function useExportActions(
  state: AppState,
  setState: React.Dispatch<React.SetStateAction<AppState>>,
): ExportActions {
  const { exportFiles, cancelStepExport } = useMoldGenerator();
  const [stepExporting, setStepExporting] = useState(false);

  const handleExport = useCallback(async (format: 'stl' | 'obj' | '3mf' | 'step') => {
    if (state.moldPieces.length === 0) return;
    const charge = await reserveFor(`export_${format}` as CreditAction, m => setState(prev => ({ ...prev, errorMessage: m })));
    if (!charge) return;
    if (format === 'step') setStepExporting(true);
    try {
      const piecesOut = state.tier2.orientForPrint
        ? state.moldPieces.map(g => orientForPrint(g))
        : state.moldPieces;
      const cavityCount = Math.max(1, state.generatedParams?.tier2.cavityCount || 1);
      const fileName = state.generatedParams?.tier2?.volumeLabel && state.originalGeometry
        ? state.fileName.replace(
            /(\.[^.]+)?$/,
            `_${Math.max(1, Math.round((solidProps(state.originalGeometry).volume / 1000) * 1.05)) * cavityCount}ml$1`,
          )
        : state.fileName;
      await exportFiles(
        piecesOut,
        fileName,
        format,
        state.scale,
        state.pieceLabels.length > 0 ? state.pieceLabels : undefined,
      );
      await charge.succeed();
      trackEvent('file_exported', { format });
    } catch (err) {
      await charge.fail();
      const isCancel = err instanceof Error && err.message === 'Export cancelled';
      if (!isCancel) console.error('Export failed:', err);
      const raw = err instanceof Error ? err.message : 'Export failed.';
      const code = err && typeof err === 'object' && 'code' in err ? String((err as { code?: unknown }).code) : undefined;
      const userFacing = format === 'step' ? translateStepError(raw, code) : raw;
      setState(prev => ({ ...prev, errorMessage: isCancel ? null : userFacing }));
    } finally {
      if (format === 'step') setStepExporting(false);
    }
  }, [state.moldPieces, state.fileName, state.scale, state.pieceLabels, state.tier2.orientForPrint,
      state.generatedParams, state.originalGeometry, exportFiles, setState]);

  const handleCancelStepExport = useCallback(() => {
    cancelStepExport();
    setStepExporting(false);
  }, [cancelStepExport]);

  return { handleExport, handleCancelStepExport, stepExporting };
}
