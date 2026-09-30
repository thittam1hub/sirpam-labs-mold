// Sirpam 3D Labs Mold — Finish step: cost estimate, project save/load,
// mesh export (STL/OBJ/3MF/STEP) and Start Over.
import { useState } from 'react';
import type { AppState } from '../../App';
import type { ProjectMeta } from '../../services/projectStorage';
import { meshVolumeCm3, estimatePieceCost, estimateSiliconeCost } from '../../utils/costEstimate';
import { solidProps, CASTING_MATERIALS, type CastingMaterialId } from '../../utils/tier2';
import { styles, colors, spacing, fontSizes } from './tokens';

/** Typical Indian retail price ₹/kg per casting material — editable in the panel. */
const CAST_PRICE_DEFAULT_INR: Record<CastingMaterialId, number> = {
  pu_resin: 450, epoxy: 600, plaster: 40, concrete: 15, wax: 300,
  soap: 250, chocolate: 800, silicone_cast: 1200,
};

const inr = (v: number) => `₹${v.toLocaleString('en-IN', { maximumFractionDigits: v < 100 ? 2 : 0 })}`;

interface FinishStepProps {
  state: AppState;
  hasModel: boolean;
  hasMold: boolean;
  estimator: { material: 'pla' | 'resin'; pricePerKg: number; siliconePricePerLiter: number; castingPricePerKg: number };
  onEstimatorChange: (patch: { material?: 'pla' | 'resin'; pricePerKg?: number; siliconePricePerLiter?: number; castingPricePerKg?: number }) => void;
  projects: ProjectMeta[];
  projectBusy: boolean;
  onSaveProject: () => void;
  onOpenProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onExportProject: (id: string) => void;
  onImportProject: () => void;
  onExport: (format: 'stl' | 'obj' | '3mf' | 'step') => void;
  stepExporting: boolean;
  onCancelStepExport: () => void;
  onStartOver: () => void;
  finishSlot?: React.ReactNode;
  packSlot?: React.ReactNode;
  reportSlot?: React.ReactNode;
}

export function FinishStep(props: FinishStepProps) {
  const { state, hasModel, hasMold } = props;
  if (!hasModel) return null;

  return (
    <>
      {props.finishSlot}
      {hasMold && props.packSlot}
      {hasMold && props.reportSlot}

      <div style={styles.section}>
        <h2 style={{ ...styles.sectionTitle, marginTop: 0 }}>Material & Cost</h2>
        {!hasMold ? (
          <div style={styles.hint}>Generate a mold to see material and cost estimates.</div>
        ) : state.moldMode === 'silicone' ? (
          <SiliconeCostEstimate volumeCm3={state.siliconeVolumeCm3} estimator={props.estimator} onEstimatorChange={props.onEstimatorChange} />
        ) : (
          <RigidCostEstimate state={state} estimator={props.estimator} onEstimatorChange={props.onEstimatorChange} />
        )}
        <div style={{ ...styles.hint, marginTop: spacing.sm }}>
          Rough estimate from mesh volume — not a slicer. Print time varies with layer height, supports and infill.
        </div>
      </div>

      <div id="sirpam-projects" style={styles.section}>
        <h2 style={{ ...styles.sectionTitle, marginTop: 0 }}>Projects</h2>
        <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.md }}>
          <button
            type="button" style={{ ...styles.button, ...styles.secondaryBtn, flex: 1, ...((props.projectBusy || !hasModel) ? styles.disabledBtn : {}) }}
            onClick={props.onSaveProject} disabled={props.projectBusy || !hasModel}
          >
            Save Project
          </button>
          <button
            type="button" style={{ ...styles.button, ...styles.secondaryBtn, flex: 1, ...(props.projectBusy ? styles.disabledBtn : {}) }}
            onClick={props.onImportProject} disabled={props.projectBusy}
          >
            Import…
          </button>
        </div>

        {props.projects.length === 0 ? (
          <div style={styles.hint}>No saved projects yet. Saving keeps the model and every mold setting in this browser.</div>
        ) : (
          <div>
            {props.projects.map(p => (
              <div key={p.id} style={{ padding: `${spacing.sm}px ${spacing.md}px`, borderRadius: 4, background: colors.viewportBg, boxShadow: 'var(--neu-inset)', marginBottom: spacing.sm }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.sm }}>
                  <span style={{ color: colors.textPrimary, fontSize: fontSizes.sm, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.name}>
                    {p.name}
                  </span>
                  <span style={{ color: colors.textDim, fontSize: fontSizes.xs, flexShrink: 0 }}>
                    {new Date(p.savedAt).toLocaleDateString()}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: spacing.sm, marginTop: spacing.sm }}>
                  <button type="button" style={{ ...styles.button, ...styles.primaryBtn, flex: 1, padding: `${spacing.xs}px 0` }} onClick={() => props.onOpenProject(p.id)} disabled={props.projectBusy}>Open</button>
                  <button type="button" style={{ ...styles.button, ...styles.secondaryBtn, flex: 1, padding: `${spacing.xs}px 0` }} onClick={() => props.onExportProject(p.id)} disabled={props.projectBusy}>Export</button>
                  <button type="button" style={{ ...styles.button, ...styles.secondaryBtn, flex: 1, padding: `${spacing.xs}px 0` }} onClick={() => props.onDeleteProject(p.id)} disabled={props.projectBusy} aria-label={`Delete project ${p.name}`}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {hasMold && (
        <div style={styles.section}>
          <h2 style={{ ...styles.sectionTitle, marginTop: 0 }}>Export</h2>
          <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.sm }}>
            <button type="button" style={styles.exportBtn} onClick={() => props.onExport('stl')} disabled={props.stepExporting}>STL</button>
            <button type="button" style={styles.exportBtn} onClick={() => props.onExport('obj')} disabled={props.stepExporting}>OBJ</button>
            <button type="button" style={styles.exportBtn} onClick={() => props.onExport('3mf')} disabled={props.stepExporting}>3MF</button>
          </div>
          {props.stepExporting ? (
            <button type="button" style={{ ...styles.exportBtn, width: '100%' }} onClick={props.onCancelStepExport} title="Cancel STEP export">
              Exporting STEP… (cancel)
            </button>
          ) : (
            <button
              type="button" style={{ ...styles.exportBtn, width: '100%' }} onClick={() => props.onExport('step')}
              title="STEP / ISO 10303-21 — for CAD tools like Fusion, FreeCAD, Onshape"
            >
              STEP (CAD)
            </button>
          )}
        </div>
      )}

      <button type="button" style={{ ...styles.button, ...styles.secondaryBtn, marginTop: 'auto' }} onClick={props.onStartOver}>
        Start Over
      </button>
    </>
  );
}

function SiliconeCostEstimate({ volumeCm3, estimator, onEstimatorChange }: {
  volumeCm3: number;
  estimator: FinishStepProps['estimator'];
  onEstimatorChange: FinishStepProps['onEstimatorChange'];
}) {
  const est = estimateSiliconeCost(volumeCm3, estimator.siliconePricePerLiter);
  return (
    <>
      <label style={{ ...styles.label, marginBottom: spacing.xs, display: 'block' }}>Silicone price per litre</label>
      <input
        type="number" min={0} step={1} value={estimator.siliconePricePerLiter}
        onChange={e => onEstimatorChange({ siliconePricePerLiter: parseFloat(e.target.value) || 0 })}
        style={{ ...styles.input, marginBottom: spacing.md }}
        aria-label="Silicone price per litre"
      />
      <div style={styles.statRow}><span>Silicone volume</span><span>{volumeCm3.toFixed(0)} cm³</span></div>
      <div style={styles.statRow}><span>Weight</span><span>{est.grams.toFixed(0)} g</span></div>
      <div style={{ ...styles.statRow, color: colors.textPrimary }}><span>Est. material cost</span><span>{est.cost.toFixed(2)}</span></div>
    </>
  );
}

function RigidCostEstimate({ state, estimator, onEstimatorChange }: {
  state: AppState;
  estimator: FinishStepProps['estimator'];
  onEstimatorChange: FinishStepProps['onEstimatorChange'];
}) {
  const vols = state.moldPieces.map(p => meshVolumeCm3(
    p.getAttribute("position").array as Float32Array,
    p.index ? (p.index.array as ArrayLike<number>) : null,
  ));
  const ests = vols.map(v => estimatePieceCost(v, estimator.material, estimator.pricePerKg));
  const grams = ests.reduce((a, e) => a + e.grams, 0);
  const hours = ests.reduce((a, e) => a + e.hours, 0);
  const cost = ests.reduce((a, e) => a + e.cost, 0);
  const cm3 = vols.reduce((a, v) => a + v, 0);

  return (
    <>
      <label style={{ ...styles.label, marginBottom: spacing.xs, display: 'block' }}>Material</label>
      <select
        value={estimator.material}
        onChange={e => onEstimatorChange({ material: e.target.value as 'pla' | 'resin' })}
        style={{ ...styles.select, marginBottom: spacing.sm }}
        aria-label="Print material"
      >
        <option value="pla">PLA (filament)</option>
        <option value="resin">Resin (MSLA)</option>
      </select>

      <label style={{ ...styles.label, marginBottom: spacing.xs, display: 'block' }}>Price per kg</label>
      <input
        type="number" min={0} step={1} value={estimator.pricePerKg}
        onChange={e => onEstimatorChange({ pricePerKg: parseFloat(e.target.value) || 0 })}
        style={{ ...styles.input, marginBottom: spacing.md }}
        aria-label="Price per kilogram"
      />

      <div style={styles.statRow}><span>Mold volume</span><span>{cm3.toFixed(0)} cm³</span></div>
      <div style={styles.statRow}><span>Material weight</span><span>{grams.toFixed(0)} g</span></div>
      <div style={styles.statRow}><span>Est. print time</span><span>{hours >= 1 ? `${hours.toFixed(1)} h` : `${Math.round(hours * 60)} min`}</span></div>
      <div style={{ ...styles.statRow, color: colors.textPrimary }}><span>Est. material cost</span><span>{cost.toFixed(2)}</span></div>
    </>
  );
}
