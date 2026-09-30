// Sirpam 3D Labs Mold — Model step: load a file and check it against a
// printer's build volume before spending time on a split/mold setup.
import type { AppState } from '../../App';
import { PRINTER_PRESETS } from '../../utils/printerPresets';
import { formatFitStatus } from '../../utils/printerFit';
import { computePrinterFitInfo } from './geometry';
import { styles, colors, spacing, fontSizes } from './tokens';
import { CircleCheck, TriangleAlert } from 'lucide-react';

interface ModelStepProps {
  state: AppState;
  hasModel: boolean;
  onLoadFile: () => void;
  onPrinterChange: (printerId: string | null) => void;
  onScaleChange: (scale: number) => void;
  onResetScale: () => void;
  modelSlot?: React.ReactNode;
}

export function ModelStep({ state, hasModel, onLoadFile, onPrinterChange, onScaleChange, onResetScale, modelSlot }: ModelStepProps) {
  const { selectedPrinter, fit, suggestedScale, canApplySuggestion, scaleDiffersFromDefault } =
    computePrinterFitInfo(state.selectedPrinterId, state.boundingBox, state.wallThicknessRatio, state.scale);

  return (
    <>
      <div style={styles.section}>
        <h2 style={{ ...styles.sectionTitle, marginTop: 0 }}>Model</h2>
        {state.fileName && <div style={{ ...styles.fileInfo, marginBottom: spacing.sm + 2 }}>{state.fileName}</div>}
        <button type="button" style={{ ...styles.button, ...styles.secondaryBtn }} onClick={onLoadFile}>
          {hasModel ? 'Load Different Model' : 'Open STL / OBJ File'}
        </button>
      </div>

      {modelSlot}

      {hasModel && (
        <div style={styles.section}>
          <div style={styles.sectionHeaderRow}>
            <h2 style={{ ...styles.sectionTitle, marginTop: 0, marginBottom: 0 }}>Printer Fit</h2>
            {scaleDiffersFromDefault && (
              <button type="button" onClick={onResetScale} style={styles.resetLinkBtn} aria-label="Reset scale to 100%">
                Reset scale
              </button>
            )}
          </div>

          <label htmlFor="printer-preset" style={{ ...styles.label, marginBottom: spacing.xs, display: 'block' }}>Printer</label>
          <select
            id="printer-preset"
            value={state.selectedPrinterId ?? ''}
            onChange={e => onPrinterChange(e.target.value || null)}
            style={{ ...styles.select, marginBottom: spacing.md }}
            aria-label="Printer preset"
          >
            <option value="">None selected</option>
            <optgroup label="FDM / Filament">
              {PRINTER_PRESETS.filter(p => p.category === 'fdm').map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </optgroup>
            <optgroup label="Resin / MSLA">
              {PRINTER_PRESETS.filter(p => p.category === 'resin').map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </optgroup>
          </select>

          {selectedPrinter && fit && (
            <div
              role="status"
              aria-live="polite"
              style={{
                fontSize: fontSizes.sm,
                color: fit.fits ? '#4ade80' : '#facc15',
                padding: `${spacing.sm}px ${spacing.md}px`,
                background: colors.viewportBg,
                boxShadow: 'var(--neu-inset)',
                borderRadius: 4,
                border: `1px solid ${fit.fits ? '#4ade8044' : '#facc1544'}`,
                marginBottom: spacing.md,
                display: 'flex',
                alignItems: 'center',
                gap: spacing.sm,
              }}
            >
              {fit.fits ? <CircleCheck aria-hidden="true" size={18} /> : <TriangleAlert aria-hidden="true" size={18} />}
              <span>{formatFitStatus(fit)}</span>
            </div>
          )}

          {suggestedScale !== null && canApplySuggestion && (
            <button
              type="button"
              onClick={() => onScaleChange(suggestedScale)}
              style={{ ...styles.button, ...styles.secondaryBtn, marginBottom: spacing.sm }}
              aria-label={`Apply suggested scale of ${Math.round(suggestedScale * 100)} percent`}
            >
              Apply suggested scale: {Math.round(suggestedScale * 100)}%
            </button>
          )}

          {selectedPrinter && (
            <div>
              <label style={{ ...styles.label, marginBottom: spacing.xs, display: 'block' }}>
                Print Scale: {Math.round(state.scale * 100)}%
              </label>
              <input
                type="range" min={0.1} max={1.0} step={0.01} value={state.scale}
                onChange={e => onScaleChange(parseFloat(e.target.value))}
                style={styles.slider} aria-label="Print scale" aria-valuetext={`${Math.round(state.scale * 100)} percent`}
              />
            </div>
          )}

          {!selectedPrinter && (
            <div style={{ ...styles.hint, marginTop: spacing.xs }}>
              Pick a printer to check fit and see a scale suggestion. Scale is a preview — the exported STL matches what's shown here.
            </div>
          )}
        </div>
      )}
    </>
  );
}
