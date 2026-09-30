// Sirpam 3D Labs Mold — Split step: choose and preview the parting plane(s)
// that divide the model into printable mold halves.
import type { AppState } from '../../App';
import type { Axis } from '../../types';
import { ENABLE_OBLIQUE_PLANES } from '../../mold/constants';
import { MAX_CUT_ANGLE_DEGREES, hingeAxisFor } from '../../mold/planeGeometry';
import { ToggleSwitch } from './primitives';
import { styles, colors, radii, spacing, fontSizes, shadows } from './tokens';

interface SplitStepProps {
  state: AppState;
  hasModel: boolean;
  onAxisChange: (axis: Axis) => void;
  onOffsetChange: (offset: number) => void;
  onCutAngleChange: (cutAngle: number) => void;
  onAddAdditionalPlane: () => void;
  onRemoveAdditionalPlane: (index: number) => void;
  onAdditionalPlaneChange: (index: number, plane: { axis: Axis; offset: number; cutAngle: number }) => void;
  onToggleHollow: (isHollow: boolean) => void;
  onSprueOverrideToggle: (enabled: boolean) => void;
  onSprueOverrideAChange: (a: number) => void;
  onSprueOverrideBChange: (b: number) => void;
  onToggleHeatmap: () => void;
  onToggleSplitLine: () => void;
  onAutoDetect: () => void;
  onSuggestParting: () => void;
}

const LATERAL_LABELS: Record<Axis, [string, string]> = {
  z: ['X', 'Y'],
  y: ['Z', 'X'],
  x: ['Y', 'Z'],
};

export function SplitStep(props: SplitStepProps) {
  const { state, hasModel } = props;
  if (!hasModel) return null;
  const [labelA, labelB] = LATERAL_LABELS[state.axis];

  return (
    <div style={styles.section}>
      <h2 style={{ ...styles.sectionTitle, marginTop: 0 }}>Parting Plane</h2>

      <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.md }}>
        {(['x', 'y', 'z'] as Axis[]).map(a => (
          <button key={a} type="button" style={styles.axisBtn(state.axis === a)} onClick={() => props.onAxisChange(a)} aria-pressed={state.axis === a}>
            {a.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={{ marginBottom: spacing.md }}>
        <label style={{ ...styles.label, marginBottom: spacing.xs, display: 'block' }}>
          Plane Position: {Math.round(state.planeOffset * 100)}%
        </label>
        <input
          type="range" min={0.05} max={0.95} step={0.01} value={state.planeOffset}
          onChange={e => props.onOffsetChange(parseFloat(e.target.value))}
          style={styles.slider} aria-label="Plane position" aria-valuetext={`${Math.round(state.planeOffset * 100)} percent`}
        />
      </div>

      {ENABLE_OBLIQUE_PLANES && (
        <div style={{ marginBottom: spacing.md }}>
          <label style={{ ...styles.label, marginBottom: spacing.xs, display: 'block' }}>
            Cut Angle: {state.cutAngle.toFixed(0)}°
            <span style={{ color: colors.textDim, fontWeight: 400, marginLeft: spacing.xs }}>
              (tilts toward {hingeAxisFor(state.axis).toUpperCase()})
            </span>
          </label>
          <input
            type="range" min={0} max={MAX_CUT_ANGLE_DEGREES} step={1} value={state.cutAngle}
            onChange={e => props.onCutAngleChange(parseFloat(e.target.value))}
            style={styles.slider} aria-label="Cut angle in degrees" aria-valuetext={`${state.cutAngle.toFixed(0)} degrees`}
          />
        </div>
      )}

      <div style={{ marginBottom: spacing.md }}>
        <div style={{ ...styles.label, marginBottom: spacing.xs, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>
            Additional Cuts
            <span style={{ color: colors.textDim, fontWeight: 400, marginLeft: spacing.xs }}>
              ({state.additionalPlanes.length === 0 ? '2 pieces' : `${(state.additionalPlanes.length + 1) * 2} pieces max`})
            </span>
          </span>
          <button
            type="button" onClick={props.onAddAdditionalPlane}
            style={{ background: 'transparent', color: colors.primary, border: `1px solid ${colors.primary}`, borderRadius: radii.sm, padding: `${spacing.xs}px ${spacing.sm}px`, cursor: 'pointer', fontSize: fontSizes.xs }}
            aria-label="Add another parting cut"
          >
            + Add Cut
          </button>
        </div>

        {state.additionalPlanes.map((plane, i) => (
          <div key={i} style={{ marginTop: spacing.sm, padding: spacing.sm, background: colors.viewportBg, boxShadow: shadows.inset, borderRadius: radii.sm, border: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs }}>
              <span style={{ fontSize: fontSizes.xs, color: colors.textDim }}>Cut #{i + 2}</span>
              <button
                type="button" onClick={() => props.onRemoveAdditionalPlane(i)}
                style={{ background: 'transparent', color: colors.textDim, border: 'none', cursor: 'pointer', fontSize: fontSizes.xs, padding: `${spacing.xs}px ${spacing.sm}px` }}
                aria-label={`Remove cut ${i + 2}`}
              >
                Remove
              </button>
            </div>

            <div style={{ display: 'flex', gap: spacing.xs, marginBottom: spacing.xs }}>
              {(['x', 'y', 'z'] as Axis[]).map(a => (
                <button
                  key={a} type="button"
                  style={{ ...styles.axisBtn(plane.axis === a), flex: 1, fontSize: fontSizes.xs, padding: `${spacing.xs}px 0` }}
                  onClick={() => props.onAdditionalPlaneChange(i, { ...plane, axis: a })}
                  aria-pressed={plane.axis === a}
                >
                  {a.toUpperCase()}
                </button>
              ))}
            </div>

            <label style={{ display: 'block', fontSize: fontSizes.xs, color: colors.textDim, marginBottom: spacing.xs }}>
              Position: {Math.round(plane.offset * 100)}%
            </label>
            <input
              type="range" min={0.05} max={0.95} step={0.01} value={plane.offset}
              onChange={e => props.onAdditionalPlaneChange(i, { ...plane, offset: parseFloat(e.target.value) })}
              style={styles.slider} aria-label={`Cut ${i + 2} position`}
            />

            {ENABLE_OBLIQUE_PLANES && (
              <>
                <label style={{ display: 'block', fontSize: fontSizes.xs, color: colors.textDim, marginTop: spacing.xs, marginBottom: spacing.xs }}>
                  Tilt: {plane.cutAngle.toFixed(0)}°
                </label>
                <input
                  type="range" min={0} max={MAX_CUT_ANGLE_DEGREES} step={1} value={plane.cutAngle}
                  onChange={e => props.onAdditionalPlaneChange(i, { ...plane, cutAngle: parseFloat(e.target.value) })}
                  style={styles.slider} aria-label={`Cut ${i + 2} tilt angle`}
                />
              </>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginBottom: spacing.md }}>
        <div style={styles.toggleRow}>
          <span style={styles.label}>Hollow vessel (cap open holes)</span>
          <ToggleSwitch active={state.isHollow} onClick={() => props.onToggleHollow(!state.isHollow)} label="Hollow vessel mode" />
        </div>
        {state.isHollow && (
          <div style={{ marginTop: spacing.xs, fontSize: fontSizes.xs, color: colors.textDim, lineHeight: 1.4 }}>
            Closes open rims so pots/jars stop failing. Note: this phase casts a solid exterior — interior core generation is coming in a later update.
          </div>
        )}
      </div>

      <div style={{ marginBottom: spacing.md }}>
        <div style={styles.toggleRow}>
          <span style={styles.label}>Custom sprue position</span>
          <ToggleSwitch active={state.sprueOverride.enabled} onClick={() => props.onSprueOverrideToggle(!state.sprueOverride.enabled)} label="Override sprue placement" />
        </div>
        {state.sprueOverride.enabled && (
          <div style={{ marginTop: spacing.sm, display: 'flex', gap: spacing.sm }}>
            <label style={{ flex: 1, fontSize: fontSizes.xs, color: colors.textDim }}>
              {labelA} (mm)
              <input
                type="number" step={0.5} value={state.sprueOverride.a}
                onChange={e => props.onSprueOverrideAChange(parseFloat(e.target.value) || 0)}
                style={{ ...styles.input, marginTop: spacing.xs }}
                aria-label={`Sprue lateral ${labelA} coord in millimetres`}
              />
            </label>
            <label style={{ flex: 1, fontSize: fontSizes.xs, color: colors.textDim }}>
              {labelB} (mm)
              <input
                type="number" step={0.5} value={state.sprueOverride.b}
                onChange={e => props.onSprueOverrideBChange(parseFloat(e.target.value) || 0)}
                style={{ ...styles.input, marginTop: spacing.xs }}
                aria-label={`Sprue lateral ${labelB} coord in millimetres`}
              />
            </label>
          </div>
        )}
      </div>

      <div style={{ ...styles.toggleRow, marginBottom: spacing.md }}>
        <span style={styles.label}>Draft Analysis</span>
        <ToggleSwitch active={state.showHeatmap} onClick={props.onToggleHeatmap} label="Demoldability heatmap" />
      </div>

      <div style={{ ...styles.toggleRow, marginBottom: spacing.md }}>
        <span style={styles.label}>Split Line</span>
        <ToggleSwitch active={state.showSplitLine} onClick={props.onToggleSplitLine} label="Split-line preview" />
      </div>

      <button
        type="button"
        style={{ ...styles.button, ...styles.secondaryBtn, marginBottom: spacing.sm, ...(state.autoDetecting ? styles.disabledBtn : {}) }}
        onClick={props.onAutoDetect} disabled={state.autoDetecting} aria-live="polite"
      >
        {state.autoDetecting ? 'Analyzing planes...' : 'Auto-Detect Optimal Plane'}
      </button>

      <button
        type="button"
        style={{ ...styles.button, ...styles.secondaryBtn, marginBottom: spacing.sm, ...((state.suggesting || !hasModel) ? styles.disabledBtn : {}) }}
        onClick={props.onSuggestParting} disabled={state.suggesting || !hasModel} aria-live="polite"
      >
        {state.suggesting ? 'Sweeping parting setups...' : 'Suggest Best Split'}
      </button>
    </div>
  );
}
