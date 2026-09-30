// Sirpam 3D Labs Mold — Mold step: mold type, box shape and the dimension
// sliders (wall thickness, clearance, sprue diameter, vent size) that shape the cast.
import type { AppState } from '../../App';
import type { MoldBoxShape, MoldMode, SiliconeMoldType } from '../../types';
import { isDimensionsAtDefaults } from './staleness';
import { boundingBoxSize, computeWallThicknessInfo } from './geometry';
import { suggestedSprueDiameterMm, VENT_RADIUS_RATIO, SPRUE_TOP_MULTIPLIER } from '../../mold/constants';
import {
  CLEARANCE_MIN_MM, CLEARANCE_MAX_MM, CLEARANCE_STEP_MM,
  SPRUE_DIAMETER_MIN_MM, SPRUE_DIAMETER_MAX_MM, SPRUE_DIAMETER_STEP_MM,
} from './constants';
import { styles, colors, spacing } from './tokens';

interface MoldStepProps {
  state: AppState;
  hasModel: boolean;
  onMoldModeChange: (mode: MoldMode) => void;
  onSiliconeTypeChange: (type: SiliconeMoldType) => void;
  onSiliconeMarginChange: (mm: number) => void;
  onSkinThicknessChange: (mm: number) => void;
  onIncludeCoreChange: (include: boolean) => void;
  onFormFitChange: (formFit: boolean) => void;
  onMoldBoxShapeChange: (shape: MoldBoxShape) => void;
  onWallThicknessChange: (ratio: number) => void;
  onClearanceChange: (clearanceMm: number) => void;
  onSprueDiameterChange: (sprueDiameterMm: number) => void;
  onVentDiameterChange: (ventDiameterMm: number) => void;
  onResetDimensions: () => void;
  moldSlot?: React.ReactNode;
}

const MOLD_MODE_OPTIONS: { id: MoldMode; label: string; title: string }[] = [
  { id: 'rigid', label: 'Rigid', title: 'Two-part rigid mold printed directly (original flow)' },
  { id: 'silicone', label: 'Silicone', title: 'Printed tooling for pouring a silicone mold' },
];

const SILICONE_TYPE_OPTIONS: { id: SiliconeMoldType; label: string; title: string }[] = [
  { id: 'blockOneWay', label: 'Open Pour Box', title: 'Single open-top box: glue the master to the base, pour silicone, peel out. Simplest, one printed part.' },
  { id: 'blockTwoPart', label: 'Two-Part Block Mold', title: 'Split box with registration keys: pour each half in turn for a fully enclosed part.' },
  { id: 'skinCore', label: 'Skin Mold + Mother Mold', title: 'Thin silicone skin held by a rigid mother mold. Saves silicone on large parts.' },
];

const BOX_SHAPE_OPTIONS: { id: MoldBoxShape; label: string; title: string }[] = [
  { id: 'rect', label: 'Rect', title: 'Axis-aligned rectangular box (default)' },
  { id: 'cylinder', label: 'Cylinder', title: 'Circular cross-section — cleaner demold for round parts' },
  { id: 'roundedRect', label: 'Rounded', title: 'Rectangular with rounded vertical edges — more durable on FDM' },
];

/** Vent diameter the engine will use in Auto mode: 35% of the sprue gate radius, both ways. */
function autoVentMm(state: AppState): number {
  const maxExtent = state.boundingBox
    ? Math.max(
        state.boundingBox.max.x - state.boundingBox.min.x,
        state.boundingBox.max.y - state.boundingBox.min.y,
        state.boundingBox.max.z - state.boundingBox.min.z,
      )
    : 0;
  const sprue = state.sprueDiameterMm > 0 ? state.sprueDiameterMm : suggestedSprueDiameterMm(maxExtent);
  const gateR = Math.max(sprue / 2, 1) / SPRUE_TOP_MULTIPLIER;
  return gateR * VENT_RADIUS_RATIO * 2;
}

export function MoldStep(props: MoldStepProps) {
  const { state, hasModel } = props;
  if (!hasModel) return null;
  const partBbox = boundingBoxSize(state.boundingBox);
  const { wallMaxExtent, wallThicknessMm, wallMmMin, wallMmMax } = computeWallThicknessInfo(partBbox, state.wallThicknessRatio);
  const atDefaults = isDimensionsAtDefaults(state);

  return (
    <>
      <div style={styles.section}>
        <div style={styles.sectionHeaderRow}>
          <h2 style={{ ...styles.sectionTitle, marginTop: 0, marginBottom: 0 }}>Mold Box</h2>
          <button
            type="button" onClick={props.onResetDimensions} disabled={atDefaults} aria-disabled={atDefaults}
            style={{ ...styles.resetLinkBtn, ...(atDefaults ? styles.resetLinkBtnDisabled : {}) }}
          >
            Reset to defaults
          </button>
        </div>

        <div style={{ marginBottom: spacing.md }}>
          <label style={{ ...styles.label, marginBottom: spacing.xs, display: 'block' }}>Mold Type</label>
          <div style={{ display: 'flex', gap: spacing.xs }} role="radiogroup" aria-label="Mold type">
            {MOLD_MODE_OPTIONS.map(opt => (
              <button key={opt.id} type="button" role="radio" aria-checked={state.moldMode === opt.id} title={opt.title}
                onClick={() => props.onMoldModeChange(opt.id)} style={styles.axisBtn(state.moldMode === opt.id)}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {state.moldMode === 'silicone' && (
          <div style={{ marginBottom: spacing.md }}>
            <label style={{ ...styles.label, marginBottom: spacing.xs, display: 'block' }}>Silicone Workflow</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }} role="radiogroup" aria-label="Silicone workflow">
              {SILICONE_TYPE_OPTIONS.map(opt => (
                <button key={opt.id} type="button" role="radio" aria-checked={state.siliconeType === opt.id} title={opt.title}
                  onClick={() => props.onSiliconeTypeChange(opt.id)} style={styles.axisBtn(state.siliconeType === opt.id)}>
                  {opt.label}
                </button>
              ))}
            </div>

            <div style={{ marginTop: spacing.md }}>
              <label style={{ ...styles.label, marginBottom: spacing.xs, display: 'block' }}>
                Silicone Margin: {state.siliconeMarginMm === 0 ? 'Auto' : `${state.siliconeMarginMm.toFixed(1)} mm`}
              </label>
              <input type="range" min={0} max={40} step={0.5} value={state.siliconeMarginMm}
                onChange={e => props.onSiliconeMarginChange(parseFloat(e.target.value))}
                aria-label="Silicone margin in millimetres" style={{ width: '100%' }} />
            </div>

            {state.siliconeType === 'skinCore' && (
              <>
                <div style={{ marginTop: spacing.md }}>
                  <label style={{ ...styles.label, marginBottom: spacing.xs, display: 'block' }}>
                    Skin Thickness: {state.skinThicknessMm === 0 ? 'Auto' : `${state.skinThicknessMm.toFixed(1)} mm`}
                  </label>
                  <input type="range" min={0} max={15} step={0.5} value={state.skinThicknessMm}
                    onChange={e => props.onSkinThicknessChange(parseFloat(e.target.value))}
                    aria-label="Skin thickness in millimetres" style={{ width: '100%' }} />
                </div>
                <label style={{ ...styles.label, marginTop: spacing.sm, display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                  <input type="checkbox" checked={state.includeCore} onChange={e => props.onIncludeCoreChange(e.target.checked)} />
                  Include printable core
                </label>
              </>
            )}

            {state.siliconeVolumeCm3 > 0 && (
              <p style={{ ...styles.label, color: colors.textDim, marginTop: spacing.sm }}>
                Estimated silicone needed: {state.siliconeVolumeCm3.toFixed(0)} cm³
              </p>
            )}
          </div>
        )}

        <div style={{ marginBottom: spacing.md }}>
          <label style={{ ...styles.label, display: 'flex', alignItems: 'center', gap: spacing.xs }}>
            <input type="checkbox" checked={state.formFit} onChange={e => props.onFormFitChange(e.target.checked)} />
            {state.moldMode === 'silicone' && state.siliconeType === 'skinCore' ? 'Form fit mother mold (hugs the skin)' : 'Form fit shell (hugs the model)'}
          </label>
          {state.formFit && (
            <p style={{ ...styles.label, color: colors.textDim, marginTop: spacing.xs }}>
              Saves material on curvy models — generation takes longer.
            </p>
          )}
        </div>

        {!state.formFit && (
          <div style={{ marginBottom: spacing.md }}>
            <label style={{ ...styles.label, marginBottom: spacing.xs, display: 'block' }}>Box Shape</label>
            <div style={{ display: 'flex', gap: spacing.xs }} role="radiogroup" aria-label="Mold box shape">
              {BOX_SHAPE_OPTIONS.map(opt => (
                <button key={opt.id} type="button" role="radio" aria-checked={state.moldBoxShape === opt.id} title={opt.title}
                  onClick={() => props.onMoldBoxShapeChange(opt.id)} style={styles.axisBtn(state.moldBoxShape === opt.id)}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginBottom: spacing.md }}>
          <label style={{ ...styles.label, marginBottom: spacing.xs, display: 'block' }}>
            Wall Thickness: {wallThicknessMm.toFixed(1)} mm
            <span style={{ color: colors.textDim, fontWeight: 400, marginLeft: spacing.xs }}>
              ({Math.round(state.wallThicknessRatio * 1000) / 10}% of model extent)
            </span>
          </label>
          <input
            type="range" min={wallMmMin} max={wallMmMax} step={0.1} value={wallThicknessMm}
            onChange={e => {
              const mm = parseFloat(e.target.value);
              props.onWallThicknessChange(wallMaxExtent > 0 ? mm / wallMaxExtent : state.wallThicknessRatio);
            }}
            style={styles.slider} aria-label="Wall thickness in millimeters" aria-valuetext={`${wallThicknessMm.toFixed(1)} millimeters`}
          />
        </div>

        <div style={{ marginBottom: spacing.md }}>
          <label style={{ ...styles.label, marginBottom: spacing.xs, display: 'block' }}>
            Clearance: {state.clearanceMm.toFixed(2)} mm
          </label>
          <input
            type="range" min={CLEARANCE_MIN_MM} max={CLEARANCE_MAX_MM} step={CLEARANCE_STEP_MM} value={state.clearanceMm}
            onChange={e => props.onClearanceChange(parseFloat(e.target.value))}
            style={styles.slider} aria-label="Clearance between mold halves in millimetres" aria-valuetext={`${state.clearanceMm.toFixed(2)} millimetres`}
          />
          <div style={{ display: 'flex', gap: spacing.xs, marginTop: spacing.xs, flexWrap: 'wrap' }}>
            {([['Filament printer', 0.2], ['Resin printer', 0.1]] as const).map(([name, mm]) => (
              <button
                key={name} type="button" onClick={() => props.onClearanceChange(mm)}
                aria-pressed={Math.abs(state.clearanceMm - mm) < 0.001}
                style={{
                  ...styles.label, cursor: 'pointer', padding: '4px 10px', borderRadius: 999,
                  border: `1px solid ${Math.abs(state.clearanceMm - mm) < 0.001 ? colors.primary : colors.borderSubtle}`,
                  background: 'transparent', color: colors.textBody,
                }}
              >
                {name} ({mm} mm)
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: spacing.md }}>
          <label style={{ ...styles.label, marginBottom: spacing.xs, display: 'block' }}>
            Sprue diameter: {state.sprueDiameterMm === 0
              ? `Auto (${suggestedSprueDiameterMm(partBbox ? Math.max(partBbox.x, partBbox.y, partBbox.z) : 0).toFixed(1)} mm)`
              : `${state.sprueDiameterMm.toFixed(1)} mm`}
          </label>
          <input
            type="range" min={0} max={SPRUE_DIAMETER_MAX_MM} step={SPRUE_DIAMETER_STEP_MM} value={state.sprueDiameterMm}
            onChange={e => {
              const v = parseFloat(e.target.value);
              // Below the manual minimum, snap back to Auto.
              props.onSprueDiameterChange(v < SPRUE_DIAMETER_MIN_MM ? 0 : v);
            }}
            style={styles.slider} aria-label="Sprue pour-opening diameter in millimetres, zero for automatic"
            aria-valuetext={state.sprueDiameterMm === 0 ? 'Automatic, sized to the model' : `${state.sprueDiameterMm.toFixed(1)} millimetres`}
          />
          <p style={{ ...styles.label, color: colors.textDim, marginTop: spacing.xs }}>
            Auto sizes the pour hole to the model (about 15% of its largest side, 4–12 mm).
          </p>
        </div>

        <div>
          <label style={{ ...styles.label, marginBottom: spacing.xs, display: 'block' }}>
            Air vent size: {(state.tier2.ventDiameterMm ?? 0) === 0
              ? `Auto (${autoVentMm(state).toFixed(1)} mm)`
              : `${(state.tier2.ventDiameterMm ?? 0).toFixed(1)} mm`}
          </label>
          <input
            type="range" min={0} max={8} step={0.5} value={state.tier2.ventDiameterMm ?? 0}
            onChange={e => props.onVentDiameterChange(parseFloat(e.target.value))}
            style={styles.slider} aria-label="Air vent diameter in millimetres, zero for automatic"
            aria-valuetext={(state.tier2.ventDiameterMm ?? 0) === 0 ? 'Automatic, follows the sprue size' : `${(state.tier2.ventDiameterMm ?? 0).toFixed(1)} millimetres`}
          />
          <p style={{ ...styles.label, color: colors.textDim, marginTop: spacing.xs }}>
            Auto keeps vents proportional to the pour hole so air escapes as fast as the mold fills.
          </p>
        </div>
      </div>

      {props.moldSlot}
    </>
  );
}
