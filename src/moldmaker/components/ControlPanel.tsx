// @ts-nocheck — upstream mold-maker code; type-checked under its own repo tsconfig
import type { AppState } from '../App';
import type { Axis, MoldBoxShape, MoldMode, SiliconeMoldType } from '../types';
import { WALL_THICKNESS_RATIO, CLEARANCE_MM, SPRUE_DIAMETER_MM, ENABLE_OBLIQUE_PLANES } from '../mold/constants';
import { MAX_CUT_ANGLE_DEGREES, hingeAxisFor } from '../mold/planeGeometry';
import { colors, radii, spacing, fontSizes, shadows, fonts } from '../theme';
import { PRINTER_PRESETS, getPresetById } from '../utils/printerPresets';
import { computeFit, suggestScale, formatFitStatus } from '../utils/printerFit';

interface ControlPanelProps {
  state: AppState;
  onLoadFile: () => void;
  onAxisChange: (axis: Axis) => void;
  onOffsetChange: (offset: number) => void;
  /** Tilt the parting plane around its hinge axis. Degrees. Gated by ENABLE_OBLIQUE_PLANES. */
  onCutAngleChange: (cutAngle: number) => void;
  /** Append a new additional cut. Default values match the primary
   *  plane's defaults so the user immediately sees a reasonable preview. */
  onAddAdditionalPlane: () => void;
  /** Remove the additional cut at the given index. */
  onRemoveAdditionalPlane: (index: number) => void;
  /** Replace the additional cut at the given index with new values.
   *  Used by axis selector + offset slider + cutAngle slider for each
   *  cut row in the Additional Cuts section. */
  onAdditionalPlaneChange: (
    index: number,
    plane: { axis: Axis; offset: number; cutAngle: number },
  ) => void;
  /** Toggle hollow-vessel mode (caps open holes so open pots/jars don't
   *  hard-fail). Phase 1 — no core generation yet. */
  onToggleHollow: (isHollow: boolean) => void;
  /** Toggle custom (manual) sprue placement on/off. When off the engine
   *  falls back to auto-placement (area-weighted surface centroid). */
  onSprueOverrideToggle: (enabled: boolean) => void;
  /** Update the lateral A coord of the sprue override. Units = world mm. */
  onSprueOverrideAChange: (a: number) => void;
  /** Update the lateral B coord of the sprue override. Units = world mm. */
  onSprueOverrideBChange: (b: number) => void;
  onWallThicknessChange: (ratio: number) => void;
  /** Clearance between mating surfaces in absolute mm (roadmap #13). */
  onClearanceChange: (clearanceMm: number) => void;
  /** Sprue top-diameter in absolute mm (roadmap #13). */
  onSprueDiameterChange: (sprueDiameterMm: number) => void;
  onMoldBoxShapeChange: (shape: MoldBoxShape) => void;
  /** Switch between the rigid casting mold and the silicone tooling flows. */
  onMoldModeChange: (mode: MoldMode) => void;
  /** Pick the silicone workflow: pour box, two-part block, or skin + core. */
  onSiliconeTypeChange: (type: SiliconeMoldType) => void;
  /** Silicone thickness around the master, mm. 0 = auto from part size. */
  onSiliconeMarginChange: (mm: number) => void;
  /** Skin/glove mold wall thickness, mm. 0 = auto from part size. */
  onSkinThicknessChange: (mm: number) => void;
  /** Include the printable core with a skin mold. */
  onIncludeCoreChange: (include: boolean) => void;
  /** Toggle the form-fit shell (outer wall hugs the model, not a box). */
  onFormFitChange: (formFit: boolean) => void;
  onResetDimensions: () => void;
  onGenerate: () => void;
  onAutoDetect: () => void;
  onExport: (format: 'stl' | 'obj' | '3mf' | 'step') => void;
  /** True while a STEP export is mid-flight in the worker. STEP runs ~20-30s
   *  per half so it gets a visible busy state — the other formats finish in
   *  milliseconds and don't need one. */
  stepExporting: boolean;
  /** Cancel an in-flight STEP export (terminates the worker). No-op if no
   *  STEP export is running. */
  onCancelStepExport: () => void;
  onToggleExplode: () => void;
  onToggleOriginal: () => void;
  onToggleHeatmap: () => void;
  onToggleWireframe: () => void;
  onStartOver: () => void;
  /** Printer Fit section — pass null to clear selection. */
  onPrinterChange: (printerId: string | null) => void;
  /** Set the uniform display/export scale. 1.0 = no scaling. */
  onScaleChange: (scale: number) => void;
  /** Reset scale to 1.0. Used by the "Reset" affordance in Printer Fit. */
  onResetScale: () => void;
  /** Privacy section: only rendered when the build was compiled with a
   *  telemetry host (VITE_TELEMETRY_HOST). Forks without a host see nothing. */
  telemetryConfigured: boolean;
  /** Current opt-in state for the privacy-section toggle label. */
  telemetryEnabled: boolean;
  /** Called when the toggle switches on → grantConsent under the hood. */
  onTelemetryAllow: () => void;
  /** Called when the toggle switches off → declineConsent. */
  onTelemetryDecline: () => void;
}

// Slider bounds for the mold-dimension controls.
// - Wall thickness: still ratio-based (it's the scaffold for a dozen derived
//   values — see constants.ts). 3% floor / 20% ceiling as before.
// - Clearance: ABSOLUTE mm (roadmap #13). 0.05 mm floor (too tight to demold
//   below that), 1.0 mm ceiling (beyond that pins wobble). Step = 0.05 mm.
// - Sprue diameter: ABSOLUTE mm top-diameter (roadmap #13). 4 mm floor (below
//   that the pour is impractical for a hand-held bottle), 25 mm ceiling
//   (beyond that you're wasting material and the sprue dominates the mold).
// Wall-thickness bounds stay as RATIOS of the model's max extent (the
// internal source of truth). The slider PRESENTS these as mm by multiplying
// by the loaded model's extent — see wallMmMin/wallMmMax in the component.
const WALL_THICKNESS_MIN = 0.03;
const WALL_THICKNESS_MAX = 0.20;
const CLEARANCE_MIN_MM = 0.05;
const CLEARANCE_MAX_MM = 1.0;
const CLEARANCE_STEP_MM = 0.05;
const SPRUE_DIAMETER_MIN_MM = 4;
const SPRUE_DIAMETER_MAX_MM = 25;
const SPRUE_DIAMETER_STEP_MM = 0.5;

const styles = {
  panel: {
    width: 340,
    background: colors.panelBg,
    borderLeft: 'none',
    padding: spacing.xl,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: spacing.lg,
    overflowY: 'auto' as const,
    fontFamily: fonts.body,
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  logoMark: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    background: colors.sectionBg,
    boxShadow: shadows.raisedSm,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: fonts.display,
    fontWeight: 700,
    fontSize: fontSizes.sm,
    color: colors.textPrimary,
    flexShrink: 0,
  },
  title: {
    fontSize: fontSizes.lg,
    fontWeight: 700,
    fontFamily: fonts.display,
    color: colors.textPrimary,
    letterSpacing: -0.3,
    lineHeight: 1.15,
  },
  titleAccent: {
    color: colors.primary,
  },
  subtitle: {
    fontSize: fontSizes.xs,
    color: colors.textDim,
    marginTop: spacing.xs,
    lineHeight: 1.4,
  },
  section: {
    background: colors.sectionBg,
    borderRadius: radii.xl,
    padding: spacing.md + 4, // 16
    border: 'none',
    boxShadow: shadows.raised,
  },
  sectionTitle: {
    fontSize: fontSizes.sm,
    fontWeight: 600,
    color: colors.textDim,
    marginBottom: spacing.sm + 2, // 10
    textTransform: 'uppercase' as const,
    letterSpacing: 1.5,
  },
  button: {
    width: '100%',
    padding: `${spacing.sm + 2}px ${spacing.lg}px`, // 10px 16px
    borderRadius: radii.md,
    border: 'none',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: fontSizes.md,
    transition: 'all 0.15s',
  },
  primaryBtn: {
    background: colors.primary,
    color: '#fff',
    boxShadow: shadows.primary,
    borderRadius: radii.pill,
  },
  secondaryBtn: {
    background: colors.sectionBg,
    color: colors.textBody,
    boxShadow: shadows.raisedSm,
    borderRadius: radii.pill,
  },
  disabledBtn: {
    opacity: 0.5,
    cursor: 'not-allowed' as const,
  },
  axisBtn: (active: boolean) => ({
    flex: 1,
    padding: `${spacing.sm}px ${spacing.md}px`, // 8px 12px
    borderRadius: radii.md,
    border: 'none',
    background: colors.sectionBg,
    boxShadow: active ? shadows.inset : shadows.raisedSm,
    color: active ? colors.primary : colors.textMuted,
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: fontSizes.md,
  }),
  slider: {
    width: '100%',
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${spacing.xs + 2}px 0`, // 6px 0
  },
  label: {
    fontSize: fontSizes.sm,
    color: colors.textBody,
  },
  fileInfo: {
    fontSize: fontSizes.sm,
    color: colors.fileInfo,
    wordBreak: 'break-all' as const,
  },
  exportBtn: {
    flex: 1,
    padding: `${spacing.sm}px ${spacing.md}px`,
    borderRadius: radii.md,
    border: 'none',
    background: colors.sectionBg,
    boxShadow: shadows.raisedSm,
    color: colors.textBody,
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: fontSizes.sm,
  },
  sectionHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm + 2, // match sectionTitle marginBottom
  },
  resetLinkBtn: {
    background: 'transparent',
    border: 'none',
    color: colors.textDim,
    fontSize: fontSizes.xs,
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline',
    fontFamily: 'inherit',
  },
  resetLinkBtnDisabled: {
    opacity: 0.4,
    cursor: 'default' as const,
    textDecoration: 'none' as const,
  },
};

export default function ControlPanel({
  state, onLoadFile, onAxisChange, onOffsetChange, onCutAngleChange,
  onAddAdditionalPlane, onRemoveAdditionalPlane, onAdditionalPlaneChange,
  onToggleHollow,
  onSprueOverrideToggle, onSprueOverrideAChange, onSprueOverrideBChange,
  onWallThicknessChange, onClearanceChange, onSprueDiameterChange, onMoldBoxShapeChange, onResetDimensions,
  onMoldModeChange, onSiliconeTypeChange, onSiliconeMarginChange, onSkinThicknessChange, onIncludeCoreChange,
  onFormFitChange,
  onGenerate, onAutoDetect, onExport,
  onToggleExplode, onToggleOriginal, onToggleHeatmap, onToggleWireframe, onStartOver,
  onPrinterChange, onScaleChange, onResetScale,
  telemetryConfigured, telemetryEnabled, onTelemetryAllow, onTelemetryDecline,
  stepExporting, onCancelStepExport,
}: ControlPanelProps) {
  const hasModel = !!state.originalGeometry;
  const hasMold = state.moldGenerated;

  // ── Printer Fit derivations ─────────────────────────────────────────
  // Compute once per render. All pure-fn, cheap — no need to memoize.
  // We read bbox size from Box3.min/max directly instead of calling
  // getSize(new Vector3()) because that would require a THREE import here
  // and this file is otherwise THREE-free (all geometry stuff lives in
  // App.tsx and hooks).
  const selectedPrinter = getPresetById(state.selectedPrinterId);
  const partBbox = state.boundingBox
    ? {
        x: state.boundingBox.max.x - state.boundingBox.min.x,
        y: state.boundingBox.max.y - state.boundingBox.min.y,
        z: state.boundingBox.max.z - state.boundingBox.min.z,
      }
    : null;
  const fit = (selectedPrinter && partBbox)
    ? computeFit(partBbox, state.wallThicknessRatio, state.scale, selectedPrinter)
    : null;
  const suggestedScale = (selectedPrinter && partBbox && fit && !fit.fits)
    ? suggestScale(partBbox, state.wallThicknessRatio, selectedPrinter)
    : null;
  // "Apply" is only meaningful if (a) a printer is picked, (b) the current
  // scale differs from the suggestion. Same scale → button is a no-op.
  const canApplySuggestion =
    suggestedScale !== null && Math.abs(state.scale - suggestedScale) > 0.001;
  const scaleDiffersFromDefault = Math.abs(state.scale - 1.0) > 0.001;

  // ── Wall thickness: mm display, ratio under the hood ────────────────
  // Users think in absolute mm — "a 3mm wall" is concrete; "8% of model
  // extent" is not. So the slider presents and accepts mm, derived from the
  // loaded model's largest dimension, and converts back to a ratio on change.
  // The ratio stays the source of truth (generateMold, printerFit, and the
  // worker protocol all consume the ratio unchanged), which has the happy
  // side effect that the wall still scales sensibly when you load a model of
  // a different size. wallMaxExtent is 0 before a model loads; the Dimensions
  // section is model-gated so the slider never renders in that state, but we
  // guard the division anyway.
  const wallMaxExtent = partBbox
    ? Math.max(partBbox.x, partBbox.y, partBbox.z)
    : 0;
  const wallThicknessMm = state.wallThicknessRatio * wallMaxExtent;
  const wallMmMin = WALL_THICKNESS_MIN * wallMaxExtent;
  const wallMmMax = WALL_THICKNESS_MAX * wallMaxExtent;

  // The reset link is only meaningful when something has actually been changed.
  // Hiding it when already-at-defaults avoids the dead-button confusion where
  // clicking it does nothing.
  const dimensionsAtDefaults =
    state.wallThicknessRatio === WALL_THICKNESS_RATIO &&
    state.clearanceMm === CLEARANCE_MM &&
    state.sprueDiameterMm === SPRUE_DIAMETER_MM &&
    state.moldBoxShape === 'rect' &&
    state.formFit === false;

  // Compare current params against the params used for the last successful
  // mold generation. When different, the existing mold is stale and the primary
  // CTA should invite regeneration. When identical, there's nothing to do —
  // disable the button rather than let the user kick off redundant CSG work
  // that takes several seconds.
  // Deep equality on the additional-planes list. We can't use === because
  // any UI edit (add, delete, axis change, slider drag) creates fresh
  // objects; we want a "structurally equivalent" check so the button only
  // says "Regenerate" when the actual values differ. Length-then-fields
  // ordering short-circuits in the common "same length, same values" case.
  const additionalPlanesChanged =
    state.generatedParams !== null && (
      state.generatedParams.additionalPlanes.length !== state.additionalPlanes.length ||
      state.generatedParams.additionalPlanes.some((p, i) => {
        const cur = state.additionalPlanes[i];
        return p.axis !== cur.axis || p.offset !== cur.offset || p.cutAngle !== cur.cutAngle;
      })
    );

  const paramsChanged = state.generatedParams !== null && (
    state.generatedParams.axis !== state.axis ||
    state.generatedParams.offset !== state.planeOffset ||
    state.generatedParams.cutAngle !== state.cutAngle ||
    state.generatedParams.wallThicknessRatio !== state.wallThicknessRatio ||
    state.generatedParams.clearanceMm !== state.clearanceMm ||
    state.generatedParams.sprueDiameterMm !== state.sprueDiameterMm ||
    state.generatedParams.moldBoxShape !== state.moldBoxShape ||
    state.generatedParams.formFit !== state.formFit ||
    state.generatedParams.isHollow !== state.isHollow ||
    // Silicone params only make the mold stale while silicone mode is on;
    // switching modes is itself a change either way.
    state.generatedParams.moldMode !== state.moldMode ||
    (state.moldMode === 'silicone' && (
      state.generatedParams.siliconeType !== state.siliconeType ||
      state.generatedParams.siliconeMarginMm !== state.siliconeMarginMm ||
      state.generatedParams.skinThicknessMm !== state.skinThicknessMm ||
      state.generatedParams.includeCore !== state.includeCore
    )) ||
    additionalPlanesChanged
  );

  const primaryLabel = state.generating
    ? 'Generating Mold...'
    : hasMold
      ? (paramsChanged ? 'Regenerate Mold' : 'Mold Up to Date')
      : 'Generate Mold';

  const primaryDisabled = state.generating || (hasMold && !paramsChanged);

  return (
    <aside style={styles.panel} aria-label="Controls">
      <div>
        <div style={styles.titleRow}>
          <div style={styles.logoMark} aria-hidden="true">
            <span style={{ color: colors.primary, fontSize: fontSizes.lg }}>●</span>
          </div>
          <div style={styles.title}>
            Sirpam <span style={styles.titleAccent}>3D Labs</span> Mold
          </div>
        </div>
        <div style={styles.subtitle}>Two-part &amp; silicone mold generator for 3D printing</div>
      </div>

      {/* File Section */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Model</div>
        {state.fileName && (
          <div style={{ ...styles.fileInfo, marginBottom: spacing.sm + 2 }}>
            {state.fileName}
          </div>
        )}
        <button
          type="button"
          style={{ ...styles.button, ...styles.secondaryBtn }}
          onClick={onLoadFile}
        >
          {hasModel ? 'Load Different Model' : 'Open STL / OBJ File'}
        </button>
      </div>

      {/* Parting Plane Section — remains visible after generation so the user
          can tweak axis/offset and regenerate without the old flow silently
          discarding the mold. */}
      {hasModel && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Parting Plane</div>

          <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.md }}>
            {(['x', 'y', 'z'] as Axis[]).map(a => (
              <button
                key={a}
                type="button"
                style={styles.axisBtn(state.axis === a)}
                onClick={() => onAxisChange(a)}
                aria-pressed={state.axis === a}
              >
                {a.toUpperCase()}
              </button>
            ))}
          </div>

          <div style={{ marginBottom: spacing.md }}>
            <label style={{ ...styles.label, marginBottom: spacing.xs, display: 'block' }}>
              Plane Position: {Math.round(state.planeOffset * 100)}%
            </label>
            <input
              type="range"
              min={0.05}
              max={0.95}
              step={0.01}
              value={state.planeOffset}
              onChange={e => onOffsetChange(parseFloat(e.target.value))}
              style={styles.slider}
              aria-label="Plane position"
              aria-valuetext={`${Math.round(state.planeOffset * 100)} percent`}
            />
          </div>

          {/* Cut Angle — tilts the parting plane around its hinge axis. Lets
              users handle parts that don't split cleanly along X/Y/Z. Hidden
              entirely when ENABLE_OBLIQUE_PLANES is false so the feature gate
              is visible at UI level too, not just at the CSG layer. */}
          {ENABLE_OBLIQUE_PLANES && (
            <div style={{ marginBottom: spacing.md }}>
              <label style={{ ...styles.label, marginBottom: spacing.xs, display: 'block' }}>
                Cut Angle: {state.cutAngle.toFixed(0)}°
                <span style={{ color: colors.textDim, fontWeight: 400, marginLeft: spacing.xs }}>
                  (tilts toward {hingeAxisFor(state.axis).toUpperCase()})
                </span>
              </label>
              <input
                type="range"
                min={0}
                max={MAX_CUT_ANGLE_DEGREES}
                step={1}
                value={state.cutAngle}
                onChange={e => onCutAngleChange(parseFloat(e.target.value))}
                style={styles.slider}
                aria-label="Cut angle in degrees"
                aria-valuetext={`${state.cutAngle.toFixed(0)} degrees`}
              />
            </div>
          )}

          {/* Additional Cuts — sequential cuts beyond the primary parting
              plane. Each entry adds one more split that subdivides every
              existing piece. The primary plane carries the sprue and pins;
              additional planes are pure topological cuts. Empty list (the
              default) preserves the legacy 2-piece behavior exactly. */}
          <div style={{ marginBottom: spacing.md }}>
            <div style={{
              ...styles.label,
              marginBottom: spacing.xs,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span>
                Additional Cuts
                <span style={{ color: colors.textDim, fontWeight: 400, marginLeft: spacing.xs }}>
                  ({state.additionalPlanes.length === 0
                    ? '2 pieces'
                    : `${(state.additionalPlanes.length + 1) * 2} pieces max`})
                </span>
              </span>
              <button
                type="button"
                onClick={onAddAdditionalPlane}
                style={{
                  background: 'transparent',
                  color: colors.primary,
                  border: `1px solid ${colors.primary}`,
                  borderRadius: radii.sm,
                  padding: `${spacing.xs}px ${spacing.sm}px`,
                  cursor: 'pointer',
                  fontSize: fontSizes.xs,
                }}
                aria-label="Add another parting cut"
              >
                + Add Cut
              </button>
            </div>

            {state.additionalPlanes.map((plane, i) => (
              <div
                key={i}
                style={{
                  marginTop: spacing.sm,
                  padding: spacing.sm,
                  background: colors.viewportBg,
                          boxShadow: shadows.inset,
                  borderRadius: radii.sm,
                  border: 'none',
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: spacing.xs,
                }}>
                  <span style={{ fontSize: fontSizes.xs, color: colors.textDim }}>
                    Cut #{i + 2}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveAdditionalPlane(i)}
                    style={{
                      background: 'transparent',
                      color: colors.textDim,
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: fontSizes.xs,
                      padding: `${spacing.xs}px ${spacing.sm}px`,
                    }}
                    aria-label={`Remove cut ${i + 2}`}
                  >
                    Remove
                  </button>
                </div>

                <div style={{ display: 'flex', gap: spacing.xs, marginBottom: spacing.xs }}>
                  {(['x', 'y', 'z'] as Axis[]).map(a => (
                    <button
                      key={a}
                      type="button"
                      style={{
                        ...styles.axisBtn(plane.axis === a),
                        flex: 1,
                        fontSize: fontSizes.xs,
                        padding: `${spacing.xs}px 0`,
                      }}
                      onClick={() => onAdditionalPlaneChange(i, { ...plane, axis: a })}
                      aria-pressed={plane.axis === a}
                    >
                      {a.toUpperCase()}
                    </button>
                  ))}
                </div>

                <label style={{
                  display: 'block',
                  fontSize: fontSizes.xs,
                  color: colors.textDim,
                  marginBottom: spacing.xs,
                }}>
                  Position: {Math.round(plane.offset * 100)}%
                </label>
                <input
                  type="range"
                  min={0.05}
                  max={0.95}
                  step={0.01}
                  value={plane.offset}
                  onChange={e => onAdditionalPlaneChange(i, {
                    ...plane,
                    offset: parseFloat(e.target.value),
                  })}
                  style={styles.slider}
                  aria-label={`Cut ${i + 2} position`}
                />

                {ENABLE_OBLIQUE_PLANES && (
                  <>
                    <label style={{
                      display: 'block',
                      fontSize: fontSizes.xs,
                      color: colors.textDim,
                      marginTop: spacing.xs,
                      marginBottom: spacing.xs,
                    }}>
                      Tilt: {plane.cutAngle.toFixed(0)}°
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={MAX_CUT_ANGLE_DEGREES}
                      step={1}
                      value={plane.cutAngle}
                      onChange={e => onAdditionalPlaneChange(i, {
                        ...plane,
                        cutAngle: parseFloat(e.target.value),
                      })}
                      style={styles.slider}
                      aria-label={`Cut ${i + 2} tilt angle`}
                    />
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Hollow vessel mode — caps open boundary loops (the rim of an
              open pot/jar) so the mesh becomes watertight and doesn't
              hard-fail the CSG. Phase 1: capping only — no interior core
              yet, so the cast is a SOLID version of the exterior. The helper
              note sets that expectation honestly. */}
          <div style={{ marginBottom: spacing.md }}>
            <div style={styles.toggleRow}>
              <span style={styles.label}>Hollow vessel (cap open holes)</span>
              <ToggleSwitch
                active={state.isHollow}
                onClick={() => onToggleHollow(!state.isHollow)}
                label="Hollow vessel mode"
              />
            </div>
            {state.isHollow && (
              <div style={{
                marginTop: spacing.xs,
                fontSize: fontSizes.xs,
                color: colors.textDim,
                lineHeight: 1.4,
              }}>
                Closes open rims so pots/jars stop failing. Note: this phase
                casts a solid exterior — interior core generation is coming
                in a later update.
              </div>
            )}
          </div>

          {/* Sprue placement override — lets the user pin the sprue at a
              specific lateral (a, b) point in the current axis's frame. Auto
              placement (area-weighted surface centroid + cavity-snap) stays
              the default; opting in bypasses BOTH centroid and cavity check.
              The engine-side `opts.sprueOverride` path respects the values
              verbatim, so this UI owes the user visible labels for what
              "A" and "B" mean in the current axis. */}
          {(() => {
            // Axis-relative lateral labels — (a, b) maps to different world
            // axes depending on the parting axis. Keeping this derived in UI
            // rather than trusting the user to know the mapping.
            const latLabels: Record<Axis, [string, string]> = {
              z: ['X', 'Y'],
              y: ['Z', 'X'],
              x: ['Y', 'Z'],
            };
            const [labelA, labelB] = latLabels[state.axis];
            return (
              <div style={{ marginBottom: spacing.md }}>
                <div style={styles.toggleRow}>
                  <span style={styles.label}>Custom sprue position</span>
                  <ToggleSwitch
                    active={state.sprueOverride.enabled}
                    onClick={() => onSprueOverrideToggle(!state.sprueOverride.enabled)}
                    label="Override sprue placement"
                  />
                </div>
                {state.sprueOverride.enabled && (
                  <div style={{ marginTop: spacing.sm, display: 'flex', gap: spacing.sm }}>
                    <label style={{ flex: 1, fontSize: fontSizes.xs, color: colors.textDim }}>
                      {labelA} (mm)
                      <input
                        type="number"
                        step={0.5}
                        value={state.sprueOverride.a}
                        onChange={e => onSprueOverrideAChange(parseFloat(e.target.value) || 0)}
                        style={{
                          width: '100%',
                          marginTop: spacing.xs,
                          padding: `${spacing.xs + 2}px ${spacing.sm}px`,
                          borderRadius: radii.sm,
                          border: 'none',
                          background: colors.viewportBg,
                          boxShadow: shadows.inset,
                          color: colors.textPrimary,
                          fontSize: fontSizes.sm,
                          fontFamily: 'inherit',
                        }}
                        aria-label={`Sprue lateral ${labelA} coord in millimetres`}
                      />
                    </label>
                    <label style={{ flex: 1, fontSize: fontSizes.xs, color: colors.textDim }}>
                      {labelB} (mm)
                      <input
                        type="number"
                        step={0.5}
                        value={state.sprueOverride.b}
                        onChange={e => onSprueOverrideBChange(parseFloat(e.target.value) || 0)}
                        style={{
                          width: '100%',
                          marginTop: spacing.xs,
                          padding: `${spacing.xs + 2}px ${spacing.sm}px`,
                          borderRadius: radii.sm,
                          border: 'none',
                          background: colors.viewportBg,
                          boxShadow: shadows.inset,
                          color: colors.textPrimary,
                          fontSize: fontSizes.sm,
                          fontFamily: 'inherit',
                        }}
                        aria-label={`Sprue lateral ${labelB} coord in millimetres`}
                      />
                    </label>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Draft analysis toggle — surfaces the demoldability heatmap so the
              user can SEE which faces won't release before running the CSG.
              Lives in this section on purpose: it answers the "is this axis
              the right one?" question that axis buttons + slider are posing. */}
          <div style={{ ...styles.toggleRow, marginBottom: spacing.md }}>
            <span style={styles.label}>Draft Analysis</span>
            <ToggleSwitch
              active={state.showHeatmap}
              onClick={onToggleHeatmap}
              label="Demoldability heatmap"
            />
          </div>

          <button
            type="button"
            style={{
              ...styles.button, ...styles.secondaryBtn,
              marginBottom: spacing.sm,
              ...(state.autoDetecting ? styles.disabledBtn : {}),
            }}
            onClick={onAutoDetect}
            disabled={state.autoDetecting}
            aria-live="polite"
          >
            {state.autoDetecting ? 'Analyzing planes...' : 'Auto-Detect Optimal Plane'}
          </button>

          <button
            type="button"
            style={{
              ...styles.button, ...styles.primaryBtn,
              ...(primaryDisabled ? styles.disabledBtn : {}),
            }}
            onClick={onGenerate}
            disabled={primaryDisabled}
            aria-live="polite"
          >
            {primaryLabel}
          </button>
        </div>
      )}

      {/* Mold Dimensions — wall thickness and clearance ratios were previously
          compile-time constants. Exposing them here lets the user dial in fit
          for tight tolerances (small parts) or strong shells (brittle casts).
          Changing either invalidates the current mold, same as axis/offset. */}
      {hasModel && (
        <div style={styles.section}>
          <div style={styles.sectionHeaderRow}>
            <div style={{ ...styles.sectionTitle, marginBottom: 0 }}>Mold Box</div>
            <button
              type="button"
              onClick={onResetDimensions}
              disabled={dimensionsAtDefaults}
              aria-disabled={dimensionsAtDefaults}
              style={{
                ...styles.resetLinkBtn,
                ...(dimensionsAtDefaults ? styles.resetLinkBtnDisabled : {}),
              }}
            >
              Reset to defaults
            </button>
          </div>

          {/* Mold mode — rigid casting mold (the original flow) vs silicone
              tooling. Silicone reveals its own workflow picker and the two
              thickness sliders the trade actually specifies parts by. */}
          <div style={{ marginBottom: spacing.md }}>
            <label style={{ ...styles.label, marginBottom: spacing.xs, display: 'block' }}>
              Mold Type
            </label>
            <div style={{ display: 'flex', gap: spacing.xs }} role="radiogroup" aria-label="Mold type">
              {([
                { id: 'rigid', label: 'Rigid', title: 'Two-part rigid mold printed directly (original flow)' },
                { id: 'silicone', label: 'Silicone', title: 'Printed tooling for pouring a silicone mold' },
              ] as { id: MoldMode; label: string; title: string }[]).map(opt => {
                const active = state.moldMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    title={opt.title}
                    onClick={() => onMoldModeChange(opt.id)}
                    style={styles.axisBtn(active)}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {state.moldMode === 'silicone' && (
            <div style={{ marginBottom: spacing.md }}>
              <label style={{ ...styles.label, marginBottom: spacing.xs, display: 'block' }}>
                Silicone Workflow
              </label>
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}
                role="radiogroup"
                aria-label="Silicone workflow"
              >
                {([
                  {
                    id: 'blockOneWay',
                    label: 'Open Pour Box',
                    title: 'Single open-top box: glue the master to the base, pour silicone, peel out. Simplest, one printed part.',
                  },
                  {
                    id: 'blockTwoPart',
                    label: 'Two-Part Block Mold',
                    title: 'Split box with registration keys: pour each half in turn for a fully enclosed part.',
                  },
                  {
                    id: 'skinCore',
                    label: 'Skin Mold + Mother Mold',
                    title: 'Thin silicone skin held by a rigid mother mold. Saves silicone on large parts.',
                  },
                ] as { id: SiliconeMoldType; label: string; title: string }[]).map(opt => {
                  const active = state.siliconeType === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      title={opt.title}
                      onClick={() => onSiliconeTypeChange(opt.id)}
                      style={styles.axisBtn(active)}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {/* 0 means "auto" — the generator derives it from the part size
                  (industry rule of thumb: ~10 mm of silicone around a small
                  master). The sliders let the caster override per job. */}
              <div style={{ marginTop: spacing.md }}>
                <label style={{ ...styles.label, marginBottom: spacing.xs, display: 'block' }}>
                  Silicone Margin: {state.siliconeMarginMm === 0
                    ? 'Auto'
                    : `${state.siliconeMarginMm.toFixed(1)} mm`}
                </label>
                <input
                  type="range"
                  min={0}
                  max={40}
                  step={0.5}
                  value={state.siliconeMarginMm}
                  onChange={e => onSiliconeMarginChange(parseFloat(e.target.value))}
                  aria-label="Silicone margin in millimetres"
                  style={{ width: '100%' }}
                />
              </div>

              {state.siliconeType === 'skinCore' && (
                <>
                  <div style={{ marginTop: spacing.md }}>
                    <label style={{ ...styles.label, marginBottom: spacing.xs, display: 'block' }}>
                      Skin Thickness: {state.skinThicknessMm === 0
                        ? 'Auto'
                        : `${state.skinThicknessMm.toFixed(1)} mm`}
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={15}
                      step={0.5}
                      value={state.skinThicknessMm}
                      onChange={e => onSkinThicknessChange(parseFloat(e.target.value))}
                      aria-label="Skin thickness in millimetres"
                      style={{ width: '100%' }}
                    />
                  </div>
                  <label
                    style={{
                      ...styles.label,
                      marginTop: spacing.sm,
                      display: 'flex',
                      alignItems: 'center',
                      gap: spacing.xs,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={state.includeCore}
                      onChange={e => onIncludeCoreChange(e.target.checked)}
                    />
                    Include printable core
                  </label>
                </>
              )}

              {/* Material estimate — the number that decides whether a job is
                  worth running, so it sits next to the settings that change it. */}
              {state.siliconeVolumeCm3 > 0 && (
                <p style={{ ...styles.label, color: colors.textDim, marginTop: spacing.sm }}>
                  Estimated silicone needed: {state.siliconeVolumeCm3.toFixed(0)} cm³
                </p>
              )}
            </div>
          )}

          {/* Form-fit shell — the outer wall hugs the model (outward offset)
              instead of an analytic box. Hidden for skin molds: the mother
              mold there already hugs the inflated model, so the toggle would
              be a no-op. */}
          {!(state.moldMode === 'silicone' && state.siliconeType === 'skinCore') && (
            <div style={{ marginBottom: spacing.md }}>
              <label
                style={{
                  ...styles.label,
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing.xs,
                }}
              >
                <input
                  type="checkbox"
                  checked={state.formFit}
                  onChange={e => onFormFitChange(e.target.checked)}
                />
                Form fit shell (hugs the model)
              </label>
              {state.formFit && (
                <p style={{ ...styles.label, color: colors.textDim, marginTop: spacing.xs }}>
                  Saves material on curvy models — generation takes longer.
                </p>
              )}
            </div>
          )}

          {/* Mold box shape — rect is default, cylinder wins for round parts
              (bottles, dials), roundedRect is a small FDM-durability upgrade
              over rect. Rendered as a segmented 3-way control to match the
              axis picker aesthetic below. Hidden while form fit is on — the
              shell silhouette comes from the model, not this picker. */}
          {!state.formFit && (
          <div style={{ marginBottom: spacing.md }}>
            <label style={{ ...styles.label, marginBottom: spacing.xs, display: 'block' }}>
              Box Shape
            </label>
            <div style={{ display: 'flex', gap: spacing.xs }} role="radiogroup" aria-label="Mold box shape">
              {([
                { id: 'rect', label: 'Rect', title: 'Axis-aligned rectangular box (default)' },
                { id: 'cylinder', label: 'Cylinder', title: 'Circular cross-section — cleaner demold for round parts' },
                { id: 'roundedRect', label: 'Rounded', title: 'Rectangular with rounded vertical edges — more durable on FDM' },
              ] as { id: MoldBoxShape; label: string; title: string }[]).map(opt => {
                const active = state.moldBoxShape === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    title={opt.title}
                    onClick={() => onMoldBoxShapeChange(opt.id)}
                    style={styles.axisBtn(active)}
                  >
                    {opt.label}
                  </button>
                );
              })}
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
              type="range"
              min={wallMmMin}
              max={wallMmMax}
              // 0.1mm steps — the granularity casters actually care about. The
              // ratio the slider maps to is continuous; we convert on change.
              step={0.1}
              value={wallThicknessMm}
              onChange={e => {
                const mm = parseFloat(e.target.value);
                // Convert mm back to the internal ratio. Guard the divide for
                // the (UI-gated, shouldn't-happen) no-model case.
                onWallThicknessChange(
                  wallMaxExtent > 0 ? mm / wallMaxExtent : state.wallThicknessRatio,
                );
              }}
              style={styles.slider}
              aria-label="Wall thickness in millimeters"
              aria-valuetext={`${wallThicknessMm.toFixed(1)} millimeters`}
            />
          </div>

          <div>
            <label style={{ ...styles.label, marginBottom: spacing.xs, display: 'block' }}>
              Clearance: {state.clearanceMm.toFixed(2)} mm
            </label>
            <input
              type="range"
              min={CLEARANCE_MIN_MM}
              max={CLEARANCE_MAX_MM}
              step={CLEARANCE_STEP_MM}
              value={state.clearanceMm}
              onChange={e => onClearanceChange(parseFloat(e.target.value))}
              style={styles.slider}
              aria-label="Clearance between mold halves in millimetres"
              aria-valuetext={`${state.clearanceMm.toFixed(2)} millimetres`}
            />
          </div>

          <div>
            <label style={{ ...styles.label, marginBottom: spacing.xs, display: 'block' }}>
              Sprue diameter: {state.sprueDiameterMm.toFixed(1)} mm
            </label>
            <input
              type="range"
              min={SPRUE_DIAMETER_MIN_MM}
              max={SPRUE_DIAMETER_MAX_MM}
              step={SPRUE_DIAMETER_STEP_MM}
              value={state.sprueDiameterMm}
              onChange={e => onSprueDiameterChange(parseFloat(e.target.value))}
              style={styles.slider}
              aria-label="Sprue pour-opening diameter in millimetres"
              aria-valuetext={`${state.sprueDiameterMm.toFixed(1)} millimetres`}
            />
          </div>
        </div>
      )}

      {/* Printer Fit — "will the generated mold fit my printer?". Distinct
          from the competitor pattern that silently rescales your model at
          export time. We show the fit, show what scale would make it fit,
          and let the user decide. No stealth rescaling. */}
      {hasModel && (
        <div style={styles.section}>
          <div style={styles.sectionHeaderRow}>
            <div style={{ ...styles.sectionTitle, marginBottom: 0 }}>Printer Fit</div>
            {scaleDiffersFromDefault && (
              <button
                type="button"
                onClick={onResetScale}
                style={styles.resetLinkBtn}
                aria-label="Reset scale to 100%"
              >
                Reset scale
              </button>
            )}
          </div>

          <label
            htmlFor="printer-preset"
            style={{ ...styles.label, marginBottom: spacing.xs, display: 'block' }}
          >
            Printer
          </label>
          <select
            id="printer-preset"
            value={state.selectedPrinterId ?? ''}
            onChange={e => onPrinterChange(e.target.value || null)}
            style={{
              width: '100%',
              padding: `${spacing.sm}px ${spacing.md}px`,
              borderRadius: radii.sm,
              border: 'none',
              background: colors.viewportBg,
                          boxShadow: shadows.inset,
              color: colors.textPrimary,
              fontSize: fontSizes.sm,
              fontFamily: 'inherit',
              marginBottom: spacing.md,
            }}
            aria-label="Printer preset"
          >
            <option value="">None selected</option>
            <optgroup label="FDM / Filament">
              {PRINTER_PRESETS.filter(p => p.category === 'fdm').map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </optgroup>
            <optgroup label="Resin / MSLA">
              {PRINTER_PRESETS.filter(p => p.category === 'resin').map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </optgroup>
          </select>

          {/* Status row — only when a printer is picked. Color-codes fit
              vs overflow so the user can glance at the row and know. */}
          {selectedPrinter && fit && (
            <div
              role="status"
              aria-live="polite"
              style={{
                fontSize: fontSizes.sm,
                color: fit.fits ? '#4ade80' : '#facc15',
                padding: `${spacing.sm}px ${spacing.md}px`,
                background: colors.viewportBg,
                          boxShadow: shadows.inset,
                borderRadius: radii.sm,
                border: `1px solid ${fit.fits ? '#4ade8044' : '#facc1544'}`,
                marginBottom: spacing.md,
                display: 'flex',
                alignItems: 'center',
                gap: spacing.sm,
              }}
            >
              <span aria-hidden="true" style={{ fontSize: fontSizes.md }}>
                {fit.fits ? '✓' : '⚠'}
              </span>
              <span>{formatFitStatus(fit)}</span>
            </div>
          )}

          {/* Suggestion row — only when there's something to suggest.
              Polite affordance: the button applies the scale, doesn't
              auto-apply. User stays in control. */}
          {suggestedScale !== null && canApplySuggestion && (
            <button
              type="button"
              onClick={() => onScaleChange(suggestedScale)}
              style={{
                ...styles.button,
                ...styles.secondaryBtn,
                marginBottom: spacing.sm,
              }}
              aria-label={`Apply suggested scale of ${Math.round(suggestedScale * 100)} percent`}
            >
              Apply suggested scale: {Math.round(suggestedScale * 100)}%
            </button>
          )}

          {/* Manual scale slider — always visible when a printer is picked,
              so users can experiment. 10-100% because upscaling past 100%
              would frequently overflow the printer, and going below 10%
              produces comically tiny prints. */}
          {selectedPrinter && (
            <div>
              <label style={{ ...styles.label, marginBottom: spacing.xs, display: 'block' }}>
                Print Scale: {Math.round(state.scale * 100)}%
              </label>
              <input
                type="range"
                min={0.1}
                max={1.0}
                step={0.01}
                value={state.scale}
                onChange={e => onScaleChange(parseFloat(e.target.value))}
                style={styles.slider}
                aria-label="Print scale"
                aria-valuetext={`${Math.round(state.scale * 100)} percent`}
              />
            </div>
          )}

          {/* Help text — tiny, dim. Explains the difference between this
              feature and the silent-rescale pattern users may have seen
              elsewhere, so they trust it. */}
          {!selectedPrinter && (
            <div style={{
              fontSize: fontSizes.xs,
              color: colors.textDim,
              lineHeight: 1.4,
              marginTop: spacing.xs,
            }}>
              Pick a printer to check fit and see a scale suggestion.
              Scale is a preview — the exported STL matches what's shown here.
            </div>
          )}
        </div>
      )}

      {/* View Options — promoted from hasMold-only to hasModel-and-up because
          Wireframe is useful on the *loaded* model too (CSG debugging, topology
          inspection). Exploded/Show Original still require a mold to be
          meaningful, so they stay nested behind hasMold. */}
      {hasModel && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>View</div>
          <div style={styles.toggleRow}>
            <span style={styles.label}>Wireframe</span>
            <ToggleSwitch active={state.wireframe} onClick={onToggleWireframe} label="Wireframe view" />
          </div>
          {hasMold && (
            <>
              <div style={styles.toggleRow}>
                <span style={styles.label}>Exploded View</span>
                <ToggleSwitch active={state.explodedView} onClick={onToggleExplode} label="Exploded view" />
              </div>
              <div style={styles.toggleRow}>
                <span style={styles.label}>Show Original</span>
                <ToggleSwitch active={state.showOriginal} onClick={onToggleOriginal} label="Show original model" />
              </div>
            </>
          )}
        </div>
      )}

      {/* Export Section */}
      {hasMold && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Export</div>
          <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.sm }}>
            <button
              type="button"
              style={styles.exportBtn}
              onClick={() => onExport('stl')}
              disabled={stepExporting}
            >STL</button>
            <button
              type="button"
              style={styles.exportBtn}
              onClick={() => onExport('obj')}
              disabled={stepExporting}
            >OBJ</button>
            <button
              type="button"
              style={styles.exportBtn}
              onClick={() => onExport('3mf')}
              disabled={stepExporting}
            >3MF</button>
          </div>
          {/* STEP is a full-width row on its own. It's the only exporter that
              can take 30-60s (per-half BRep build in OCP WASM), so it owns the
              visible busy + cancel state. Other formats are millisecond-scale
              and just get disabled while a STEP export is running (so the user
              can't accidentally fire a second long-running job). */}
          {stepExporting ? (
            <button
              type="button"
              style={{ ...styles.exportBtn, width: '100%' }}
              onClick={onCancelStepExport}
              title="Cancel STEP export"
            >
              Exporting STEP… (cancel)
            </button>
          ) : (
            <button
              type="button"
              style={{ ...styles.exportBtn, width: '100%' }}
              onClick={() => onExport('step')}
              title="STEP / ISO 10303-21 — for CAD tools like Fusion, FreeCAD, Onshape"
            >
              STEP (CAD)
            </button>
          )}
        </div>
      )}

      {/* Privacy section — only visible if the build was compiled with a
          telemetry host. Forks without VITE_TELEMETRY_HOST get a completely
          invisible privacy section, so the UI doesn't advertise a feature
          that can't work. The toggle wraps grant/decline so a user who turns
          it off actually records a decline (= we don't re-prompt). */}
      {telemetryConfigured && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Privacy</div>
          <div style={styles.toggleRow}>
            <span style={styles.label}>Anonymous usage data</span>
            <ToggleSwitch
              active={telemetryEnabled}
              onClick={telemetryEnabled ? onTelemetryDecline : onTelemetryAllow}
              label="Send anonymous usage data"
            />
          </div>
          <div style={{
            fontSize: fontSizes.xs,
            color: colors.textDim,
            marginTop: spacing.sm,
            lineHeight: 1.4,
          }}>
            Five coarse events. No file contents, no mesh data, no paths.
            See PRIVACY.md for the full list.
          </div>
        </div>
      )}

      {/* Start Over */}
      {hasModel && (
        <button
          type="button"
          style={{ ...styles.button, ...styles.secondaryBtn, marginTop: 'auto' }}
          onClick={onStartOver}
        >
          Start Over
        </button>
      )}
    </aside>
  );
}

/**
 * Accessible toggle switch. Rendered as a real <button> with role="switch" and
 * aria-checked so screen readers announce the state transition, and so it
 * responds to Space/Enter like any other button. Previously this was a <div>
 * with onClick, which meant keyboard users couldn't focus or activate it.
 */
function ToggleSwitch({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={label}
      onClick={onClick}
      style={{
        width: 44, height: 24, borderRadius: 12,
        background: active ? colors.primary : colors.sectionBg,
        boxShadow: active ? 'none' : shadows.inset,
        cursor: 'pointer', position: 'relative',
        transition: 'background 0.2s',
        border: 'none', padding: 0,
        flexShrink: 0,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'block',
          width: 18, height: 18, borderRadius: 9,
          background: '#fff', position: 'absolute',
          top: 3, left: active ? 23 : 3,
          transition: 'left 0.2s',
          boxShadow: '1px 1px 3px rgba(0,0,0,0.25)',
        }}
      />
    </button>
  );
}
