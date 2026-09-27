// @ts-nocheck — upstream mold-maker code; type-checked under its own repo tsconfig
import { useState, useCallback, useEffect, useRef, Fragment } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei';
import * as THREE from 'three';
import AdvancedMoldPanel, { MoldCoreSettings, DEFAULT_TIER2, tier2GeomKey, type Tier2Settings } from './components/AdvancedMoldPanel';
import { buildCavityTray, orientForPrint, solidProps } from './utils/tier2';
import OverhangPanel from './components/OverhangPanel';
import type { MoldExtras } from './mold/moldFeatures';
import ModelViewer from './components/ModelViewer';
import ControlPanel from './components/ControlPanel';
import PartingPlane from './components/PartingPlane';
import HeatmapOverlay from './components/HeatmapOverlay';
import SplitLineOverlay from './components/SplitLineOverlay';
import { useMoldGenerator, EXPLODE_OFFSET_RATIO } from './hooks/useMoldGenerator';
import { loadFile, parseFile } from './utils/fileLoader';
import { createSampleModel } from './utils/sampleModel';
import type { Axis, MoldBoxShape, MoldMode, SiliconeMoldType } from './types';
import { colors, radii, spacing, fontSizes, focusVisibleCss, shadows, fonts } from './theme';
import { WALL_THICKNESS_RATIO, CLEARANCE_MM, SPRUE_DIAMETER_MM } from './mold/constants';
import { translateStepError } from './mold/stepExportErrors';
import { summarizeRepairs } from './mold/validateMesh';
import { repairModel, describeRepair } from './mold/meshFix';
import { useTelemetry } from './services/useTelemetry';
import { buildEvent } from './services/telemetryEvents';
import {
  listProjects, saveProject, getProject, deleteProject,
  downloadProjectFile, pickProjectFile, newProjectId,
  type ProjectMeta, type ProjectParams,
} from './services/projectStorage';
import FirstRunTelemetryModal from './components/FirstRunTelemetryModal';
import GuidedTour from './components/GuidedTour';
import TopBar from './components/layout/TopBar';
import { MoldPrepPanel, ModelToolsPanel, FinishAdvisorPanel, PlatePackerPanel, AiShapePanel } from './components/ShopPanels';
import FillOverlay from './components/FillOverlay';
import { ModelFixPanel, MoldReportPanel } from './components/ModelFixPanels';
import ThicknessOverlay from './components/ThicknessOverlay';
import { getPresetById } from './utils/printerPresets';
import { supabase } from '@/integrations/supabase/client';
import { spendCredits, getCreditStatus, describeCharge, chargeFor, type CreditAction } from '@/lib/credits';

export type { Axis } from './types';

type MoldMakerAppProps = { initialStep?: number; initialTool?: string };

/**
 * Re-aims the camera along the parting axis whenever it changes, so the
 * "top" face of the mold (where the sprue exits) always faces the viewer.
 * Previously the camera stayed pinned to a fixed isometric angle and the
 * pour hole silently drew itself onto the face pointing AWAY from the
 * camera — users reasonably concluded "there's no pour hole" or "it's
 * coming out through the side."
 *
 * Preserves the user's current zoom distance (length of camera.position)
 * so switching axis doesn't snap the view back to a default distance and
 * undo whatever they'd orbited into. Also re-targets OrbitControls at the
 * origin to keep pan state sane.
 */
function CameraRig({ axis }: { axis: Axis }) {
  const camera = useThree(s => s.camera);
  const controls = useThree(s => s.controls) as {
    target?: THREE.Vector3;
    update?: () => void;
  } | null;
  // Only reorient on axis change, not on every render. Otherwise any state
  // update would snap the camera back to its canonical angle.
  const prevAxis = useRef<Axis | null>(null);
  useEffect(() => {
    if (prevAxis.current === axis) return;
    prevAxis.current = axis;

    const dist = camera.position.length() || 120;
    // Bias along +axis so the sprue-exit face of the top half is visible;
    // smaller tilts on the two lateral axes keep depth cues intact so the
    // view doesn't collapse to an orthographic-looking silhouette.
    const pos: [number, number, number] = [0, 0, 0];
    const primary = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
    pos[primary] = dist * 0.78;
    pos[(primary + 1) % 3] = dist * 0.45;
    pos[(primary + 2) % 3] = dist * 0.45;
    camera.position.set(pos[0], pos[1], pos[2]);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();

    if (controls?.target && typeof controls.update === 'function') {
      controls.target.set(0, 0, 0);
      controls.update();
    }
  }, [axis, camera, controls]);
  return null;
}

/**
 * Snapshot of the parameters a given mold was generated with. When the current
 * parameters drift from this snapshot, the UI knows the mold is stale and
 * surfaces a "Regenerate Mold" CTA instead of silently discarding the mold.
 */
export interface GeneratedParams {
  axis: Axis;
  offset: number;
  /** Cut-plane tilt around hinge axis, degrees. 0 = axis-aligned. */
  cutAngle: number;
  wallThicknessRatio: number;
  /** Clearance in absolute mm (roadmap #13 — was clearanceRatio before). */
  clearanceMm: number;
  /** Sprue top-diameter in absolute mm (roadmap #13). Drives sprueTopRadius
   *  directly; gate radius is derived via SPRUE_TOP_MULTIPLIER (2:1 taper). */
  sprueDiameterMm: number;
  /** Outer shell shape. Included in the staleness check — changing it must
   *  re-generate the mold, since it changes the CSG output geometry. */
  moldBoxShape: MoldBoxShape;
  /**
   * User-specified sprue lateral coords that were in effect at generation
   * time, or null when auto-placement was used. Included in the staleness
   * check so toggling the override or changing its coords forces a
   * regenerate rather than silently leaving stale CSG on screen.
   */
  sprueOverride: { a: number; b: number } | null;
  /** Additional sequential parting planes used at generate time. Snapshotted
   *  in the result so the staleness check picks up adds, removes, or
   *  individual axis/offset/cutAngle changes — same lifecycle as `cutAngle`
   *  on the primary plane. Empty array for legacy 2-piece molds. */
  additionalPlanes: Array<{ axis: Axis; offset: number; cutAngle: number }>;
  /** Hollow-vessel mode in effect at generate time. Snapshotted for the
   *  staleness check — toggling it must invalidate the current mold. */
  isHollow: boolean;
  /** Rigid casting mold vs silicone tooling, at generate time. */
  moldMode: MoldMode;
  /** Which silicone workflow was generated (only meaningful for silicone). */
  siliconeType: SiliconeMoldType;
  /** Silicone thickness around the master for block molds, mm. */
  siliconeMarginMm: number;
  /** Skin thickness for skin/glove molds, mm. */
  skinThicknessMm: number;
  /** Whether the printable core was included with a skin mold. */
  includeCore: boolean;
  /** Form-fit shell in effect at generate time (outer wall hugs the model). */
  formFit: boolean;
  /** Tier-2 pro features in effect at generate time. */
  tier2: Tier2Settings;
}

export interface AppState {
  originalGeometry: THREE.BufferGeometry | null;
  fileName: string;
  axis: Axis;
  planeOffset: number;
  /**
   * Parting-plane tilt around the hinge axis, in degrees. 0 = axis-aligned.
   * Range [-30, 30]. Only actually honoured when ENABLE_OBLIQUE_PLANES is
   * true; otherwise it's threaded through state for forward compat but the
   * generator treats it as 0.
   */
  cutAngle: number;
  /** Wall thickness as a fraction of max bbox extent. User-tunable; defaults to constants. */
  wallThicknessRatio: number;
  /** Clearance between mating surfaces in absolute mm (roadmap #13). User-tunable. */
  clearanceMm: number;
  /** Sprue top-diameter in absolute mm (roadmap #13). User-tunable. */
  sprueDiameterMm: number;
  /** Outer shell shape. Defaults to 'rect'. */
  moldBoxShape: MoldBoxShape;
  /**
   * Sprue placement override. When `enabled` is true, `a` and `b` are used
   * verbatim as the lateral sprue coords in the current axis's frame (see
   * ComputeChannelOpts). When false or when the user hasn't opted in, the
   * auto-placement centroid path runs unchanged.
   *
   * Why an `enabled` flag rather than just `null` → we want to retain the
   * user's last-entered coords when they toggle auto/manual back and forth,
   * so they don't lose the position they dialled in.
   */
  sprueOverride: { enabled: boolean; a: number; b: number };
  autoDetecting: boolean;
  moldGenerated: boolean;
  /**
   * Mold pieces in stable order:
   *   [0] = top half of the primary parting plane (carries sprue/vents)
   *   [1] = bottom half of the primary plane (carries pin sockets)
   *   [2..] = subdivisions from `additionalPlanes`, in apply order.
   * Empty array when no mold has been generated yet. Always >= 2 after
   * a successful generate.
   */
  moldPieces: THREE.BufferGeometry[];
  /**
   * Sequential cuts beyond the primary parting plane. Each entry adds
   * one more split to every existing piece. Default empty = legacy
   * 2-piece behavior. Editing this list does NOT regenerate the mold —
   * the user must click Generate again, same as for any other plane param.
   */
  additionalPlanes: Array<{ axis: Axis; offset: number; cutAngle: number }>;
  /** Hollow-vessel mode (Phase 1): caps open holes so open pots/jars stop
   *  hard-failing. Does not yet generate a core — see generateMold.isHollow. */
  isHollow: boolean;
  /**
   * Which workflow the Generate button runs:
   *   'rigid'    — the original two-part rigid casting mold.
   *   'silicone' — printable silicone tooling (see siliconeType).
   */
  moldMode: MoldMode;
  /** Silicone workflow: open-pour box, two-part block mold, or skin mold. */
  siliconeType: SiliconeMoldType;
  /** Silicone thickness around the master for block molds, mm. 0 = auto. */
  siliconeMarginMm: number;
  /** Skin thickness for skin/glove molds, mm. 0 = auto. */
  skinThicknessMm: number;
  /** Emit the printable core alongside the mother-mold halves. */
  includeCore: boolean;
  /** Form-fit shell: outer wall hugs the model instead of a box. Applies to
   *  the rigid mold and the silicone block workflows (not skinCore). */
  formFit: boolean;
  /** Tier-2 pro mold features (seal, pry slots, radial, tray, orient, material). */
  tier2: Tier2Settings;
  /** Export filename suffixes for the current pieces (silicone workflows). */
  pieceLabels: string[];
  /** Estimated silicone consumption of the current mold, cm³. 0 = unknown. */
  siliconeVolumeCm3: number;
  /** Params used to generate the current mold — null when no mold exists. */
  generatedParams: GeneratedParams | null;
  explodedView: boolean;
  showOriginal: boolean;
  /** Demoldability heatmap overlay — off by default (diagnostic view). */
  showHeatmap: boolean;
  /**
   * Split-line preview — draws the seam where the parting plane crosses the
   * model surface. On by default; hidden while the heatmap is on (its colors
   * would bury the line) and while generated pieces are shown instead of the
   * original model.
   */
  showSplitLine: boolean;
  /** Split advisor sweep in flight (worker-side, ~45 scoring passes). */
  suggesting: boolean;
  /** Cost-estimator inputs. Prices are in the user's own currency unit. */
  estimator: {
    material: 'pla' | 'resin';
    pricePerKg: number;
    siliconePricePerLiter: number;
  };
  /** Render loaded model + mold halves as wireframe — off by default. Useful for
   *  inspecting mesh topology when CSG fails or diagnosing boolean artifacts. */
  wireframe: boolean;
  generating: boolean;
  boundingBox: THREE.Box3 | null;
  /** User-facing error message for load / generate / auto-detect failures. */
  errorMessage: string | null;
  /** Non-error informational notice — e.g. "we auto-repaired N triangles in
   *  your mesh." Visually distinct from errorMessage (amber, not red) and
   *  dismissible. Cleared on next generate. */
  infoMessage: string | null;
  /**
   * Uniform display/export scale applied to the part + generated mold. 1.0 = no
   * scaling (default). Applied non-destructively: the generated mold geometry
   * is always produced at 1:1, then a Three `<group scale>` wraps the viewport
   * and a Matrix4 scale is baked into the export. Means the user can try
   * different scales without re-running CSG (which takes seconds).
   *
   * Kept OUT of GeneratedParams deliberately — changing scale does NOT stale
   * the mold. The mold topology is the same, just visually/exported at a
   * different size.
   */
  scale: number;
  /**
   * Currently selected printer preset id, or null if no printer is picked
   * (default). `null` hides the fit readout entirely — unknown printer means
   * we can't say anything true about fit.
   */
  selectedPrinterId: string | null;
}

const initialState: AppState = {
  originalGeometry: null,
  fileName: '',
  axis: 'z',
  planeOffset: 0.5,
  cutAngle: 0,
  wallThicknessRatio: WALL_THICKNESS_RATIO,
  clearanceMm: CLEARANCE_MM,
  sprueDiameterMm: SPRUE_DIAMETER_MM,
  moldBoxShape: 'rect',
  sprueOverride: { enabled: false, a: 0, b: 0 },
  autoDetecting: false,
  moldGenerated: false,
  moldPieces: [],
  additionalPlanes: [],
  isHollow: false,
  moldMode: 'rigid',
  siliconeType: 'blockTwoPart',
  // 0 = "let the generator pick from the part size" (10 mm shop minimum,
  // scaled up for large parts). Users override with the sliders.
  siliconeMarginMm: 0,
  skinThicknessMm: 0,
  includeCore: true,
  formFit: false,
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

export default function App({ initialStep, initialTool }: MoldMakerAppProps) {
  const [state, setState] = useState<AppState>(initialState);
  /**
   * Cheat-sheet overlay visibility. Pure UI ephemeral state — doesn't need
   * to survive anything, doesn't need to flow through ControlPanel, so it
   * lives outside AppState.
   */
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const [step, setStepRaw] = useState(() => initialStep ? initialStep - 1 : 0);
  useEffect(() => {
    if (initialStep) return;
    try { const v = Number(localStorage.getItem('sirpam.step')); if (v >= 0 && v <= 4) setStepRaw(v); } catch { /* ignore */ }
  }, [initialStep]);
  useEffect(() => {
    if (!initialTool) return;
    window.requestAnimationFrame(() => document.getElementById(initialTool)?.scrollIntoView({ block: 'start' }));
  }, [initialTool]);
  const setStep = useCallback((n: number) => {
    setStepRaw(n);
    try { localStorage.setItem('sirpam.step', String(n)); } catch { /* ignore */ }
  }, []);
  /**
   * First-run telemetry consent modal visibility. Set to true in the
   * mold_generated success branch IFF telemetry is configured and we haven't
   * asked the user yet. Deliberately NOT stored in AppState — it's a
   * one-shot modal driven by a settings value that already persists.
   */
  const [telemetryModalOpen, setTelemetryModalOpen] = useState(false);
  /**
   * Busy indicator for STEP export specifically. Other formats finish in
   * milliseconds so they don't need a visible state. STEP can run for ~60s
   * total (both halves) in a worker, so the UI disables other export buttons
   * and swaps the STEP button for a Cancel button while it's in flight.
   */
  const [stepExporting, setStepExporting] = useState(false);
  const { generateMold, generateSilicone, exportFiles, cancelStepExport, autoDetectPlane, suggestParting } =
    useMoldGenerator();
  const telemetry = useTelemetry();

  // ── Saved projects (browser-only, IndexedDB) ──
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [projectBusy, setProjectBusy] = useState(false);
  const refreshProjects = useCallback(() => {
    listProjects().then(setProjects);
  }, []);
  useEffect(() => { refreshProjects(); }, [refreshProjects]);

  // ── Telemetry: session_started ──
  // Fires once per mount. Empty dep array is intentional — React 18's
  // strict-mode double-invoke in dev will double-fire; production builds
  // won't. The send call itself is safely no-op when disabled/unconfigured,
  // so double-fire in dev is a cosmetic dashboard issue, not a correctness one.
  useEffect(() => {
    telemetry.send(buildEvent('session_started', {}));
    // telemetry.send is a stable useCallback — but listing it would tangle
    // the lint dep array with first-render semantics. Disable is localized.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Geometry disposal effects ──
  // Three.js BufferGeometry holds GPU-side vertex buffers that are NOT reclaimed
  // by the JS garbage collector. Each effect captures the current geometry and
  // disposes it when the dependency changes (React runs cleanup-of-previous
  // before running the new effect, so the outgoing geometry is released before
  // the incoming one renders).
  useEffect(() => {
    const g = state.originalGeometry;
    return () => { g?.dispose(); };
  }, [state.originalGeometry]);

  // Dispose every mold piece's GPU buffers when the array reference changes
  // (i.e. on a fresh Generate, or when the user clears the model). Capturing
  // the array at effect-time means the cleanup disposes the OLD pieces, not
  // the new ones — same pattern as the topMold/bottomMold effects this
  // replaced, just generalized to N pieces.
  useEffect(() => {
    const pieces = state.moldPieces;
    return () => { pieces.forEach(p => p.dispose()); };
  }, [state.moldPieces]);

  /**
   * Commit a freshly-parsed geometry to app state. Shared between the
   * file-picker, drag-drop, and sample-model entry points so all three
   * go through identical normalization (center, bbox, vertex normals)
   * and identical state-reset semantics. Wrapping this once avoids the
   * three-way drift that would otherwise appear the first time someone
   * "fixes" a bug in just one code path.
   */
  const commitGeometry = useCallback((
    geometry: THREE.BufferGeometry,
    fileName: string,
  ) => {
    geometry.computeBoundingBox();
    geometry.center();
    geometry.computeVertexNormals();
    const bbox = geometry.boundingBox!.clone();
    setState({
      ...initialState,
      originalGeometry: geometry,
      fileName,
      boundingBox: bbox,
      showOriginal: true,
    });
    // Telemetry: model_loaded (success). No properties from the file — not
    // size, not triangle count, not filename. "Did a load succeed" is the
    // entire question this event answers.
    telemetry.send(buildEvent('model_loaded', { success: true }));
  }, [telemetry]);

  // Model-prep tools (shrink, emboss, base, split…) replace the master but keep
  // every setting. One level of undo.
  const undoGeo = useRef<THREE.BufferGeometry | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [showThickness, setShowThickness] = useState(false);
  const [showFill, setShowFill] = useState(false);
  const [trapCount, setTrapCount] = useState<number | null>(null);
  const [thicknessMin, setThicknessMin] = useState<number | null>(null);
  const replaceModel = useCallback((geometry: THREE.BufferGeometry, note: string) => {
    setState(prev => {
      undoGeo.current = prev.originalGeometry;
      geometry.computeBoundingBox();
      geometry.computeVertexNormals();
      return {
        ...prev, originalGeometry: geometry, boundingBox: geometry.boundingBox!.clone(),
        moldGenerated: false, moldPieces: [], generatedParams: null, showOriginal: true,
        infoMessage: `${note}. Generate the mold again to use it.`,
      };
    });
    setCanUndo(true);
  }, []);
  const undoModel = useCallback(() => {
    const g = undoGeo.current;
    if (!g) return;
    undoGeo.current = null;
    setCanUndo(false);
    setState(prev => ({ ...prev, originalGeometry: g, boundingBox: g.boundingBox!.clone(),
      moldGenerated: false, moldPieces: [], generatedParams: null, showOriginal: true, infoMessage: 'Model change undone.' }));
  }, []);

  const handleFileLoad = useCallback(async () => {
    try {
      const result = await loadFile();
      if (!result) return; // user canceled — not an error, not a telemetry event
      commitGeometry(result.geometry, result.fileName);
    } catch (err) {
      console.error('File load failed:', err);
      telemetry.send(buildEvent('model_loaded', { success: false, failureReason: 'parse_error' }));
      setState(prev => ({
        ...prev,
        errorMessage: err instanceof Error ? err.message : 'Failed to load file.',
      }));
    }
  }, [commitGeometry, telemetry]);

  const handleLoadSample = useCallback(() => {
    try {
      const { geometry, fileName } = createSampleModel();
      commitGeometry(geometry, fileName);
    } catch (err) {
      console.error('Sample load failed:', err);
      telemetry.send(buildEvent('model_loaded', { success: false, failureReason: 'unknown' }));
      setState(prev => ({
        ...prev,
        errorMessage: err instanceof Error ? err.message : 'Failed to load sample.',
      }));
    }
  }, [commitGeometry, telemetry]);

  /**
   * Drag-and-drop handler. We only accept a single file — dropping a
   * folder or multiple files takes the first file and surfaces an error
   * if the extension doesn't match. The browser's drag-drop File object
   * is identical to the one from <input type=file>, so we reuse parseFile.
   */
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    try {
      const result = await parseFile(file);
      commitGeometry(result.geometry, result.fileName);
    } catch (err) {
      console.error('Drop-load failed:', err);
      telemetry.send(buildEvent('model_loaded', { success: false, failureReason: 'parse_error' }));
      setState(prev => ({
        ...prev,
        errorMessage: err instanceof Error ? err.message : 'Failed to load dropped file.',
      }));
    }
  }, [commitGeometry, telemetry]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    // Must preventDefault on *both* dragover and drop to opt out of the
    // browser default (navigate to the file). Missing dragover silently
    // makes drop a no-op and is a classic drag-drop gotcha.
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const autoRepairTried = useRef(false);
  const retryAfterRepair = useRef(false);
  const [repairProgress, setRepairProgress] = useState<{ pct: number; label: string } | null>(null);
  const pendingAutoRepairNote = useRef<string | null>(null);
  const handleGenerate = useCallback(async () => {
    if (!state.originalGeometry || !state.boundingBox) return;
    // Concurrent-click guard: even though the button is disabled, an Enter-key
    // repeat or a synthetic click can re-enter before React rerenders. Manifold
    // WASM is a singleton — running two CSG graphs in parallel can corrupt it.
    if (state.generating) return;

    setState(prev => ({ ...prev, generating: true, errorMessage: null, infoMessage: null }));

    // Free-tier watermark: signed-in users with no paid credits get "Sirpam"
    // engraved under the bottom half (box molds only — round7 skips it for
    // form-fit shells and relief/press/slip-cast styles). Never blocks
    // generation if the credit check fails.
    let freeWatermark: string | undefined;
    try {
      const { data: s } = await supabase.auth.getSession();
      if (s.session) {
        const cs = await getCreditStatus();
        if (cs && cs.balance === 0) freeWatermark = 'Sirpam';
      }
    } catch { /* credit check is best-effort */ }

    // Snapshot params at call time so the result we later commit is tagged
    // with the params actually used, even if the user changes them mid-flight.
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
      // Snapshot the current additional planes — same staleness contract as
      // every other field. We deep-clone the entries so mutating the live
      // state.additionalPlanes can't retroactively change generatedParams.
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

    // Tier-2: build extras + (optionally) a multi-cavity tray geometry.
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
        autoVents: t2.autoVents || undefined,
        standFins: t2.standFins || undefined,
        volumeLabel: t2.volumeLabel && castMl ? `${castMl} ML` : undefined,
        watermark: t2.watermark?.trim() || freeWatermark || undefined,
        moldFeet: t2.moldFeet || undefined,
        gapFiller: t2.gapFiller || undefined,
        pieceCount: t2.pieceCount && t2.pieceCount > 2 ? t2.pieceCount : undefined,
        wallMm: undefined, // single source: Mold step wall slider (wallThicknessRatio)
        ventDiameterMm: t2.ventDiameterMm && t2.ventDiameterMm > 0 ? t2.ventDiameterMm : undefined,
        ventCount: t2.ventCount !== undefined && t2.ventCount >= 0 ? t2.ventCount : undefined,
        lockStyle: t2.lockStyle && t2.lockStyle !== 'round' ? t2.lockStyle : undefined,
        lockDiameterMm: t2.lockDiameterMm && t2.lockDiameterMm > 0 ? t2.lockDiameterMm : undefined,
        lockCount: t2.lockCount === 2 ? 2 : undefined,
      } : {}),
    };

    try {
      // Two distinct pipelines behind one button. Silicone tooling produces
      // named pieces (pour box / mother halves / core) and a material
      // estimate; the rigid path keeps its historical shape exactly.
      const result = params.moldMode === 'silicone'
        ? await generateSilicone(
            genGeometry,
            genBox,
            params.axis,
            params.offset,
            {
              siliconeType: params.siliconeType,
              siliconeMarginMm: params.siliconeMarginMm || undefined,
              skinThicknessMm: params.skinThicknessMm || undefined,
              includeCore: params.includeCore,
              wallThicknessRatio: params.wallThicknessRatio,
              clearanceMm: params.clearanceMm,
              sprueDiameterMm: params.sprueDiameterMm,
              moldBoxShape: params.moldBoxShape,
              cutAngle: params.cutAngle,
              isHollow: params.isHollow,
              formFit: params.formFit,
              extras,
            },
          )
        : await generateMold(
            genGeometry,
            genBox,
            params.axis,
            params.offset,
            {
              wallThicknessRatio: params.wallThicknessRatio,
              clearanceMm: params.clearanceMm,
              sprueDiameterMm: params.sprueDiameterMm,
              moldBoxShape: params.moldBoxShape,
              cutAngle: params.cutAngle,
              sprueOverride: params.sprueOverride ?? undefined,
              additionalPlanes: params.additionalPlanes.length > 0
                ? params.additionalPlanes
                : undefined,
              isHollow: params.isHollow,
              formFit: params.formFit,
              extras,
            },
          );

      // Surface a non-blocking info banner if the pre-flight mesh validator
      // had to drop bad triangles. summarizeRepairs returns null when nothing
      // was repaired, so clean meshes don't trigger the banner. Helps users
      // learn what's wrong with their source files without blocking the
      // generation they just succeeded at.
      const repairNote = summarizeRepairs(result.repairs);

      setState(prev => ({
        ...prev,
        moldPieces: result.pieces,
        moldGenerated: true,
        pieceLabels: (result as { labels?: string[] }).labels ?? [],
        siliconeVolumeCm3: (result as { siliconeVolumeCm3?: number }).siliconeVolumeCm3 ?? 0,
        generatedParams: params,
        generating: false,
        showOriginal: false,
        infoMessage: pendingAutoRepairNote.current ?? repairNote,
      }));
      pendingAutoRepairNote.current = null;
      autoRepairTried.current = false;
      // Telemetry: mold_generated (success). `axisUsed` lets us spot whether
      // Z dominates (it will) or any axis is unexpectedly common — a signal
      // about auto-detect quality and the default axis choice.
      telemetry.send(buildEvent('mold_generated', { success: true, axisUsed: params.axis }));
      // Consent moment: AFTER the user has just seen the product deliver
      // value, not before. Gated on `configured` so open-source forks without
      // a telemetry host never see this modal, and on `needsConsent` so we
      // don't re-ask users who've already made a decision.
      if (telemetry.configured && telemetry.needsConsent) {
        setTelemetryModalOpen(true);
      }
    } catch (err) {
      console.error('Mold generation failed:', err);
      // Coarse failure tagging only — the exception message may contain
      // details we don't want to exfiltrate. 'csg_failed' covers the vast
      // majority of cases (boolean op threw, result was empty). If we later
      // want to distinguish non_manifold, add a typed check in the mold code
      // and surface a distinct error class, not a message string.
      telemetry.send(
        buildEvent('mold_generated', {
          success: false,
          axisUsed: params.axis,
          failureReason: 'csg_failed',
        }),
      );
      const msg = err instanceof Error ? err.message : '';
      // Auto-repair: broken-surface failures are fixed and retried once
      // automatically instead of only being flagged.
      if (!autoRepairTried.current && /non-manifold|not manifold|watertight/i.test(msg) && !tray) {
        autoRepairTried.current = true;
        setState(prev => ({ ...prev, infoMessage: 'Broken spots found — repairing the model automatically…' }));
        try {
          // Auto-repair is a paid action (2 credits, monthly free credits
          // first). If the user declines or can't pay, fall through to the
          // normal error message.
          const paid = await chargeFor('auto_repair', m => setState(prev => ({ ...prev, infoMessage: m })));
          if (!paid) throw new Error('repair_declined');
          setRepairProgress({ pct: 0, label: 'Starting repair' });
          const { geometry: fixed, report } = await repairModel(state.originalGeometry, (pct, label) => setRepairProgress({ pct, label }))
            .finally(() => setRepairProgress(null));
          if (report.solidOk) {
            fixed.computeBoundingBox();
            undoGeo.current = state.originalGeometry;
            setCanUndo(true);
            pendingAutoRepairNote.current = `Auto-repaired before making the mold: ${describeRepair(report)}.`;
            setState(prev => ({ ...prev, generating: false, originalGeometry: fixed, boundingBox: fixed.boundingBox!.clone(), errorMessage: null }));
            retryAfterRepair.current = true;
            return;
          }
        } catch (e) { console.error('Auto-repair failed:', e); }
      }
      autoRepairTried.current = false;
      setState(prev => ({
        ...prev,
        generating: false,
        errorMessage: msg || 'Mold generation failed. The model may not be watertight.',
      }));
    }
  }, [
    state.originalGeometry, state.boundingBox,
    state.axis, state.planeOffset, state.cutAngle,
    state.wallThicknessRatio, state.clearanceMm, state.sprueDiameterMm,
    state.moldBoxShape, state.sprueOverride,
    state.additionalPlanes, state.isHollow,
    state.moldMode, state.siliconeType, state.siliconeMarginMm,
    state.skinThicknessMm, state.includeCore, state.formFit, state.tier2,
    state.generating, generateMold, generateSilicone, telemetry,
  ]);

  // Retry the mold once the auto-repaired model is in state.
  useEffect(() => {
    if (retryAfterRepair.current && state.originalGeometry && !state.generating) {
      retryAfterRepair.current = false;
      void handleGenerate();
    }
  }, [state.originalGeometry, state.generating, handleGenerate]);

  const handleAutoDetect = useCallback(async () => {
    if (!state.originalGeometry) return;
    if (state.autoDetecting) return;
    setState(prev => ({ ...prev, autoDetecting: true, errorMessage: null }));

    try {
      const result = await autoDetectPlane(state.originalGeometry);
      setState(prev => ({
        ...prev,
        axis: result.axis,
        planeOffset: result.offset,
        autoDetecting: false,
      }));
      // Telemetry: plane_auto_detected (success). Compare `axisDetected`
      // against the later `mold_generated.axisUsed` in the dashboard to
      // estimate how often users accept vs override auto-detect.
      telemetry.send(
        buildEvent('plane_auto_detected', { success: true, axisDetected: result.axis }),
      );
    } catch (err) {
      console.error('Auto-detect failed:', err);
      telemetry.send(buildEvent('plane_auto_detected', { success: false }));
      setState(prev => ({
        ...prev,
        autoDetecting: false,
        errorMessage: err instanceof Error ? err.message : 'Auto-detect failed.',
      }));
    }
  }, [state.originalGeometry, state.autoDetecting, autoDetectPlane, telemetry]);

  // ── Split advisor (worker-side parting-setup sweep) ──
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
          `Best split found: ${result.axis.toUpperCase()} axis, ` +
          `${Math.round(result.offset * 100)}% up` +
          (result.cutAngle !== 0 ? `, ${result.cutAngle}° tilt` : '') +
          ` — ${result.undercut < 0.005 ? 'no' : (result.undercut * 100).toFixed(1) + '%'} undercut faces. ` +
          'Adjust if you like, then Generate.',
      }));
    } catch (err) {
      console.error('Split advisor failed:', err);
      setState(prev => ({
        ...prev,
        suggesting: false,
        errorMessage: err instanceof Error ? err.message : 'Split advisor failed.',
      }));
    }
  }, [state.originalGeometry, state.boundingBox, state.suggesting, suggestParting]);

  // ── Saved-project handlers (IndexedDB, browser-only) ──
  const handleSaveProject = useCallback(async () => {
    const geo = state.originalGeometry;
    if (!geo || projectBusy) return;
    const defaultName = state.fileName.replace(/\.[^.]+$/, '') || 'Untitled project';
    const name = window.prompt('Project name', defaultName)?.trim();
    if (!name) return; // cancelled or empty name
    setProjectBusy(true);
    try {
      // Overwrite an existing project of the same name instead of piling up
      // duplicates — the library stays one-row-per-project.
      const existing = projects.find(p => p.name === name);
      const positionAttr = geo.attributes.position;
      if (!positionAttr) throw new Error('Model has no geometry to save.');
      const positions = new Float32Array(positionAttr.array as Float32Array);
      const index = geo.index
        ? new Uint32Array(geo.index.array as Uint16Array | Uint32Array)
        : null;
      const params: ProjectParams = {
        axis: state.axis,
        planeOffset: state.planeOffset,
        cutAngle: state.cutAngle,
        wallThicknessRatio: state.wallThicknessRatio,
        clearanceMm: state.clearanceMm,
        sprueDiameterMm: state.sprueDiameterMm,
        moldBoxShape: state.moldBoxShape,
        sprueOverride: { ...state.sprueOverride },
        additionalPlanes: state.additionalPlanes.map(p => ({ ...p })),
        isHollow: state.isHollow,
        moldMode: state.moldMode,
        siliconeType: state.siliconeType,
        siliconeMarginMm: state.siliconeMarginMm,
        skinThicknessMm: state.skinThicknessMm,
        includeCore: state.includeCore,
        formFit: state.formFit,
        tier2: state.tier2,
        scale: state.scale,
        selectedPrinterId: state.selectedPrinterId,
      };
      await saveProject({
        id: existing?.id ?? newProjectId(),
        name,
        savedAt: new Date().toISOString(),
        fileName: state.fileName || 'model.stl',
        positions,
        index,
        params,
      });
      refreshProjects();
      setState(prev => ({ ...prev, infoMessage: `Project "${name}" saved.` }));
    } catch (err) {
      console.error('Save project failed:', err);
      setState(prev => ({
        ...prev,
        errorMessage: err instanceof Error ? err.message : 'Could not save project.',
      }));
    } finally {
      setProjectBusy(false);
    }
  }, [state, projects, projectBusy, refreshProjects]);

  /** Rebuild a BufferGeometry from stored typed arrays (save/load/import). */
  const geometryFromProject = useCallback(
    (positions: Float32Array, index: Uint32Array | null) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      if (index) geo.setIndex(new THREE.BufferAttribute(index, 1));
      return geo;
    },
    [],
  );

  const handleOpenProject = useCallback(async (id: string) => {
    if (projectBusy) return;
    setProjectBusy(true);
    try {
      const project = await getProject(id);
      if (!project) throw new Error('Project not found.');
      // Re-run the shared ingest path (center, bbox, normals), then layer the
      // saved parameters on top of the fresh state.
      commitGeometry(geometryFromProject(project.positions, project.index), project.fileName);
      setState(prev => ({
        ...prev,
        ...project.params,
        tier2: { ...DEFAULT_TIER2, ...(project.params.tier2 ?? {}) },
        infoMessage: `Project "${project.name}" opened.`,
      }));
    } catch (err) {
      console.error('Open project failed:', err);
      setState(prev => ({
        ...prev,
        errorMessage: err instanceof Error ? err.message : 'Could not open project.',
      }));
    } finally {
      setProjectBusy(false);
    }
  }, [projectBusy, commitGeometry, geometryFromProject]);

  const handleDeleteProject = useCallback(async (id: string) => {
    try {
      await deleteProject(id);
      refreshProjects();
} catch (err) {
      console.error('Delete project failed:', err);
      setState(prev => ({
        ...prev,
        errorMessage: err instanceof Error ? err.message : 'Could not delete project.',
      }));
    }
  }, [refreshProjects]);

  const handleExportProject = useCallback(async (id: string) => {
    try {
      const project = await getProject(id);
      if (!project) throw new Error('Project not found.');
      downloadProjectFile(project);
    } catch (err) {
      console.error('Export project failed:', err);
      setState(prev => ({
        ...prev,
        errorMessage: err instanceof Error ? err.message : 'Could not export project.',
      }));
    }
  }, []);

  const handleImportProject = useCallback(async () => {
    if (projectBusy) return;
    try {
      const imported = await pickProjectFile();
      if (!imported) return; // picker cancelled
      commitGeometry(
        geometryFromProject(imported.positions, imported.index),
        imported.fileName,
      );
      setState(prev => ({
        ...prev,
        ...imported.params,
        infoMessage: `Project "${imported.name}" imported.`,
      }));
    } catch (err) {
      console.error('Import project failed:', err);
      setState(prev => ({
        ...prev,
        errorMessage: err instanceof Error ? err.message : 'Could not import project file.',
      }));
    }
  }, [projectBusy, commitGeometry, geometryFromProject]);

  const handleExport = useCallback(async (format: 'stl' | 'obj' | '3mf' | 'step') => {
    if (state.moldPieces.length === 0) return;
    // Credits: designing is free; exporting needs sign-in and is charged.
    try {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) {
        setState(prev => ({ ...prev, errorMessage: 'Please sign in to export your mold — you get 10 welcome credits plus 3 free credits every month.' }));
        window.setTimeout(() => window.location.assign('/auth'), 1800);
        return;
      }
      const action = `export_${format}` as CreditAction;
      const status = await getCreditStatus();
      if (status) {
        const c = describeCharge(action, status);
        if (!c.affordable) {
          if (window.confirm(`${c.text.split('.')[0]}. You don't have enough credits. Open the Pricing page to buy more?`)) window.location.assign('/pricing');
          return;
        }
        if (!window.confirm(`${c.text}\n\nContinue?`)) return;
      }
      const r = await spendCredits(action);
      if (!r.ok) {
        setState(prev => ({ ...prev, errorMessage: `This export needs ${r.needed} credit(s) and you have ${r.balance}. Get more on the Pricing page (/pricing).` }));
        return;
      }
    } catch (e) {
      console.error('Credit check failed:', e);
      setState(prev => ({ ...prev, errorMessage: 'Could not check your credits. Please try again.' }));
      return;
    }
    // STEP runs for ~60s in a worker — flip the busy flag so the panel can
    // disable the other formats and swap the STEP button for a Cancel button.
    // Other formats finish in <100ms; not worth a re-render storm for them.
    if (format === 'step') setStepExporting(true);
    try {
      // Pass the current scale. Export bakes it into the geometry so the STL
      // matches what the user sees in the viewport (where the scale is
      // applied via a <group scale> wrapper). Scale 1.0 is the no-op path.
      const piecesOut = state.tier2.orientForPrint
        ? state.moldPieces.map(g => orientForPrint(g))
        : state.moldPieces;
      await exportFiles(
        piecesOut,
        state.generatedParams?.tier2?.volumeLabel && state.originalGeometry
          ? state.fileName.replace(/(\.[^.]+)?$/, `_${Math.max(1, Math.round((solidProps(state.originalGeometry).volume / 1000) * 1.05)) * Math.max(1, state.generatedParams.tier2.cavityCount || 1)}ml$1`)
          : state.fileName,
        format, state.scale,
        // Silicone runs name their pieces (pour_box, mother_top, core…);
        // rigid runs pass an empty list and keep top/bottom naming.
        state.pieceLabels.length > 0 ? state.pieceLabels : undefined,
      );
      // Telemetry: file_exported (success only — we don't event failures here
      // because export failures are extremely rare and the signal we actually
      // want is "which format matters", which is the success count per format).
      // STEP success-count specifically answers task #27: "is the 66 MB OCP
      // bundle pulling its weight, or should we lazy-load / split it?"
      telemetry.send(buildEvent('file_exported', { format }));
    } catch (err) {
      // 'Export cancelled' is the user's choice, not a failure — surface a
      // gentler note (and skip the console.error noise) so it doesn't look
      // like the app broke.
      const isCancel = err instanceof Error && err.message === 'Export cancelled';
      if (!isCancel) {
        // Keep the raw error in the console for bug reports — translateStepError
        // only shapes what the USER sees. A technical message still needs to be
        // grep-able from a support thread.
        console.error('Export failed:', err);
      }
      const raw = err instanceof Error ? err.message : 'Export failed.';
      // Only STEP has a translation table — other exporters are fast, local,
      // and their errors are already user-friendly ("File write failed" etc.).
      const userFacing = format === 'step' ? translateStepError(raw) : raw;
      setState(prev => ({
        ...prev,
        errorMessage: isCancel ? null : userFacing,
      }));
    } finally {
      if (format === 'step') setStepExporting(false);
    }
  }, [state.moldPieces, state.fileName, state.scale, state.pieceLabels, state.tier2.orientForPrint, exportFiles, telemetry]);

  const handleCancelStepExport = useCallback(() => {
    cancelStepExport();
    // Hide the busy state immediately — the awaiter in handleExport will
    // also flip it via finally, but the user just clicked Cancel and a
    // 100ms gap before the button stops saying "Exporting…" looks broken.
    setStepExporting(false);
  }, [cancelStepExport]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, errorMessage: null }));
  }, []);

  const clearInfo = useCallback(() => {
    setState(prev => ({ ...prev, infoMessage: null }));
  }, []);

  // ── Global keyboard shortcuts ──
  // Installed once per relevant-state change. The skip-if-in-input check is
  // critical: without it, hitting "X" while focused on the plane-position
  // slider would try to jump to X-axis *and* nudge the slider. Range inputs
  // in particular use arrow keys, so we want zero interception while one is
  // focused.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Don't steal keystrokes from focused form controls.
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          target.isContentEditable
        ) return;
      }
      // Don't interfere with browser/OS chords — Cmd-R reload, Ctrl-F find, etc.
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // ? (or Shift+/) toggles the cheat sheet. Escape always closes it.
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        setShortcutHelpOpen(v => !v);
        return;
      }
      if (e.key === 'Escape' && shortcutHelpOpen) {
        e.preventDefault();
        setShortcutHelpOpen(false);
        return;
      }
      // Suppress other shortcuts while the overlay is open — the overlay
      // reads like a dialog and shouldn't be acting on background shortcuts.
      if (shortcutHelpOpen) return;

      switch (e.key.toLowerCase()) {
        case 'o':
          e.preventDefault();
          handleFileLoad();
          break;
        case 'g':
          if (state.originalGeometry && !state.generating) {
            e.preventDefault();
            handleGenerate();
          }
          break;
        case 'a':
          if (state.originalGeometry && !state.autoDetecting) {
            e.preventDefault();
            handleAutoDetect();
          }
          break;
        case 'h':
          if (state.originalGeometry) {
            e.preventDefault();
            setState(prev => ({ ...prev, showHeatmap: !prev.showHeatmap }));
          }
          break;
        case 'w':
          if (state.originalGeometry) {
            e.preventDefault();
            setState(prev => ({ ...prev, wireframe: !prev.wireframe }));
          }
          break;
        case 'e':
          if (state.moldGenerated) {
            e.preventDefault();
            setState(prev => ({ ...prev, explodedView: !prev.explodedView }));
          }
          break;
        case 'x':
        case 'y':
        case 'z':
          if (state.originalGeometry) {
            e.preventDefault();
            setState(prev => ({ ...prev, axis: e.key.toLowerCase() as Axis }));
          }
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    shortcutHelpOpen,
    state.originalGeometry, state.generating, state.autoDetecting, state.moldGenerated,
    handleFileLoad, handleGenerate, handleAutoDetect,
  ]);

  // Visual indicator of the current parting plane. Shown before first generation
  // OR after, when the user has moved the slider/axis away from the params the
  // current mold was generated with (so the indicator marks where the *next*
  // cut will happen, not the old one).
  // Sprue-override staleness: the stored value in generatedParams is either
  // null (auto mode used) or {a,b}. Compare against the currently active
  // override (null when toggle is off) — any mismatch = stale mold.
  const currentActiveOverride = state.sprueOverride.enabled
    ? { a: state.sprueOverride.a, b: state.sprueOverride.b }
    : null;
  const sprueOverrideChanged = state.generatedParams !== null && (() => {
    const gen = state.generatedParams.sprueOverride;
    if (gen === null && currentActiveOverride === null) return false;
    if (gen === null || currentActiveOverride === null) return true;
    return gen.a !== currentActiveOverride.a || gen.b !== currentActiveOverride.b;
  })();

  const paramsChanged = state.generatedParams !== null && (
    state.generatedParams.axis !== state.axis ||
    state.generatedParams.offset !== state.planeOffset ||
    state.generatedParams.cutAngle !== state.cutAngle ||
    state.generatedParams.wallThicknessRatio !== state.wallThicknessRatio ||
    state.generatedParams.clearanceMm !== state.clearanceMm ||
    state.generatedParams.sprueDiameterMm !== state.sprueDiameterMm ||
    state.generatedParams.moldBoxShape !== state.moldBoxShape ||
    state.generatedParams.formFit !== state.formFit ||
    tier2GeomKey(state.generatedParams.tier2) !== tier2GeomKey(state.tier2) ||
    sprueOverrideChanged
  );
  const genLabel = state.generating ? 'Generating…'
    : state.moldGenerated ? (paramsChanged ? 'Regenerate' : 'Up to date') : 'Generate Mold';
  const genDisabled = state.generating || (state.moldGenerated && !paramsChanged);
  const showPartingPlaneIndicator =
    !!state.originalGeometry && !!state.boundingBox && (!state.moldGenerated || paramsChanged);

  return (
    <>
      {/* One-time <style> injection for focus-visible rings. Inline styles
          can't express pseudo-classes, so any focusable element (button,
          input, etc.) gets a brand-colored ring via this rule. */}
      <style>{focusVisibleCss}</style>
      <style>{`
        .sirpam-show-sm{display:none}
        @media (max-width: 900px){
          .sirpam-hide-sm{display:none !important}
          .sirpam-show-sm{display:block}
          .sirpam-body{flex-direction:column}
          .sirpam-body > main{min-height:45vh}
          .sirpam-panel{width:100% !important;max-height:55vh;border-radius:20px 20px 0 0}
        }
      `}</style>

      <div data-sirpam style={{
        display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh',
        background: colors.appBg, fontFamily: fonts.body, color: colors.textBody,
      }}>
      <TopBar
        fileName={state.fileName}
        hasModel={!!state.originalGeometry}
        hasMold={state.moldGenerated}
        generateLabel={genLabel}
        generateDisabled={genDisabled}
        stepExporting={stepExporting}
        onOpen={handleFileLoad}
        onSample={handleLoadSample}
        onProjects={() => { setStep(4); setTimeout(() => document.getElementById('sirpam-projects')?.scrollIntoView({ behavior: 'smooth' }), 50); }}
        onHelp={() => setShortcutHelpOpen(true)}
        onGenerate={handleGenerate}
        onExport={handleExport}
      />
      <div className="sirpam-body" style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* 3D Viewport */}
        <main
          style={{ flex: 1, position: 'relative' }}
          aria-label="3D viewport"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <Canvas
            camera={{ position: [80, 60, 80], fov: 50, near: 0.1, far: 10000 }}
            gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
          >
            <color attach="background" args={[colors.sceneBg]} />
            <CameraRig axis={state.axis} />
            <ambientLight intensity={0.4} />
            <directionalLight position={[10, 10, 5]} intensity={1} />
            <directionalLight position={[-5, -5, -5]} intensity={0.3} />

            {/* Print-scale wrapper: everything inside scales together so the
                viewport visually matches the exported STL size. The grid and
                gizmo stay OUTSIDE this group on purpose — they're world-space
                reference (grid squares are "true mm", gizmo is orientation,
                scaling them would defeat their job). The explode offset is
                computed from the 1:1 bbox, so it ends up scaled here — which
                is what we want (exploded halves move apart proportionally). */}
            <group scale={[state.scale, state.scale, state.scale]}>
              {/* Heatmap takes precedence over the normal original mesh — both
                  at the same coordinates would Z-fight and the flat unlit
                  heatmap colors would fight the lit physical material. */}
              {state.originalGeometry && showFill && !showThickness && (
                <FillOverlay geometry={state.originalGeometry} axis={state.axis} onTraps={setTrapCount} />
              )}
              {state.originalGeometry && showThickness && (
                <ThicknessOverlay geometry={state.originalGeometry} onMin={setThicknessMin} />
              )}
              {state.originalGeometry && state.boundingBox && state.showHeatmap && !showThickness && !showFill && (
                <HeatmapOverlay
                  geometry={state.originalGeometry}
                  axis={state.axis}
                  offset={state.planeOffset}
                  boundingBox={state.boundingBox}
                  cutAngle={state.cutAngle}
                  onOffsetChange={(offset: number) => setState(prev => ({ ...prev, planeOffset: offset }))}
                />
              )}

              {/* Split-line preview: the seam where the parting plane meets
                  the model surface. Hidden while the heatmap paints the same
                  surface, and only while the original model is visible. */}
              {state.originalGeometry && state.boundingBox &&
               state.showSplitLine && !state.showHeatmap && state.showOriginal && (
                <SplitLineOverlay
                  geometry={state.originalGeometry}
                  axis={state.axis}
                  offset={state.planeOffset}
                  boundingBox={state.boundingBox}
                  cutAngle={state.cutAngle}
                />
              )}

              {state.originalGeometry && !state.showHeatmap && !showThickness && !showFill && state.showOriginal && (
                <ModelViewer
                  geometry={state.originalGeometry}
                  color="#6c9bcf"
                  opacity={state.moldGenerated ? 0.3 : 0.9}
                  wireframe={state.wireframe}
                />
              )}

              {state.moldGenerated && state.moldPieces.map((piece, i) => (
                <ModelViewer
                  key={i}
                  geometry={piece}
                  color={getPieceColor(i)}
                  opacity={0.85}
                  position={
                    state.explodedView
                      ? getExplodeOffsetForPiece(state.axis, i, state.boundingBox!)
                      : [0, 0, 0]
                  }
                  wireframe={state.wireframe}
                />
              ))}

              {showPartingPlaneIndicator && (
                <PartingPlane
                  axis={state.axis}
                  offset={state.planeOffset}
                  boundingBox={state.boundingBox!}
                  cutAngle={state.cutAngle}
                />
              )}

              {/* Preview quads for the additional sequential cuts. Same
                  visibility gate as the primary plane (only shown before
                  generation, or while editing). Lets the user SEE where
                  every additional cut will land before clicking Generate
                  — otherwise editing additional planes feels like flying
                  blind. */}
              {showPartingPlaneIndicator && state.additionalPlanes.map((plane, i) => (
                <PartingPlane
                  key={`extra-${i}`}
                  axis={plane.axis}
                  offset={plane.offset}
                  boundingBox={state.boundingBox!}
                  cutAngle={plane.cutAngle}
                />
              ))}
            </group>

            <OrbitControls makeDefault />
            <gridHelper args={[200, 20, colors.gridMajor, colors.gridMinor]} />

            <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
              <GizmoViewport />
            </GizmoHelper>
          </Canvas>

          {/* Error banner: surface failures that previously only went to console */}
          {state.errorMessage && (
            <div
              role="alert"
              style={{
                position: 'absolute', top: spacing.lg, left: spacing.lg, right: spacing.lg,
                background: colors.errorBg, color: '#fff',
                padding: `${spacing.md}px ${spacing.lg}px`,
                borderRadius: radii.lg,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                boxShadow: shadows.raised,
                fontSize: fontSizes.md,
                zIndex: 10,
              }}
            >
              <span>{state.errorMessage}</span>
              <button
                type="button"
                onClick={clearError}
                style={{
                  background: 'transparent', color: '#fff',
                  border: '1px solid rgba(255,255,255,0.7)',
                  borderRadius: radii.sm,
                  padding: `${spacing.xs}px ${spacing.sm + 2}px`,
                  cursor: 'pointer', fontSize: fontSizes.xs,
                  marginLeft: spacing.lg,
                }}
                aria-label="Dismiss error"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Info banner: non-blocking notice from the pre-flight mesh
              validator — surfaces "we auto-repaired N triangles" so users
              know to clean their source files. Stacks BELOW the error
              banner if both happen to be visible (errors take precedence
              on read order). Amber, not red, so users can tell at a
              glance this was successful work, not a failure. */}
          {repairProgress && (
            <div
              role="progressbar"
              aria-label="Repairing model"
              aria-valuenow={repairProgress.pct}
              aria-valuemin={0}
              aria-valuemax={100}
              style={{
                position: 'absolute', left: '50%', bottom: 72, transform: 'translateX(-50%)', zIndex: 30,
                width: 'min(420px, 90%)', background: colors.panelBg, borderRadius: radii.xl,
                boxShadow: shadows.raised, padding: '12px 16px', fontSize: fontSizes.sm, color: colors.textPrimary,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <b>Repairing broken spots…</b><span>{Math.round(repairProgress.pct)}%</span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: colors.sceneBg, overflow: 'hidden' }}>
                <div style={{ width: `${repairProgress.pct}%`, height: '100%', background: colors.primary, transition: 'width .3s' }} />
              </div>
              <div style={{ marginTop: 6, color: colors.textMuted }}>{repairProgress.label}</div>
            </div>
          )}
          {state.infoMessage && (
            <div
              role="status"
              style={{
                position: 'absolute',
                top: state.errorMessage ? spacing.lg + 56 : spacing.lg,
                left: spacing.lg, right: spacing.lg,
                background: colors.infoBg, color: '#fff',
                padding: `${spacing.md}px ${spacing.lg}px`,
                borderRadius: radii.lg,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                boxShadow: shadows.raised,
                fontSize: fontSizes.md,
                zIndex: 10,
              }}
            >
              <span>{state.infoMessage}</span>
              <button
                type="button"
                onClick={clearInfo}
                style={{
                  background: 'transparent', color: '#fff',
                  border: '1px solid rgba(255,255,255,0.7)',
                  borderRadius: radii.sm,
                  padding: `${spacing.xs}px ${spacing.sm + 2}px`,
                  cursor: 'pointer', fontSize: fontSizes.xs,
                  marginLeft: spacing.lg,
                }}
                aria-label="Dismiss notice"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Heatmap legend — only visible when the heatmap is on. Positioned
              bottom-right to stay clear of the axis gizmo (bottom-left) and
              the error banner (top). Small, unobtrusive, explains what the
              colors mean so users don't have to guess. */}
          {state.showHeatmap && state.originalGeometry && (
            <div
              role="region"
              aria-label="Heatmap legend"
              style={{
                position: 'absolute',
                bottom: spacing.lg,
                right: spacing.lg,
                background: 'rgba(224, 229, 236, 0.92)',
                border: 'none',
                boxShadow: shadows.raisedSm,
                borderRadius: radii.md,
                padding: `${spacing.sm}px ${spacing.md}px`,
                color: colors.textBody,
                fontSize: fontSizes.xs,
                display: 'flex',
                flexDirection: 'column',
                gap: spacing.xs,
                zIndex: 5,
                pointerEvents: 'none',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: spacing.xs }}>Demoldability</div>
              <LegendRow color="#4ade80" label="Draftable" />
              <LegendRow color="#facc15" label="Marginal" />
              <LegendRow color="#ef4444" label="Undercut" />
            </div>
          )}

          {/* Drop zone — previously a single full-viewport button, now a
              two-action region (load file vs. try sample) so first-time
              users aren't stuck if they don't have an STL handy. The outer
              div handles drag-over styling; the primary affordance is
              still a real <button> for keyboard + screen-reader access. */}
          {!state.originalGeometry && (
            <div
              style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                background: 'rgba(224, 229, 236, 0.88)',
                color: colors.textPrimary,
                fontFamily: fonts.body,
                // Let mouse drags fall through to the 3D canvas so the empty
                // scene is still orbit-able; only the buttons re-enable
                // pointer events for themselves.
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              {/* Inline SVG instead of a platform-dependent emoji — renders
                  identically across macOS / Windows / Linux. */}
              <svg
                aria-hidden="true"
                width="64" height="64" viewBox="0 0 24 24"
                fill="none" stroke={colors.primary}
                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ marginBottom: spacing.lg }}
              >
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
              <div style={{ fontSize: fontSizes.lg, fontWeight: 600, marginBottom: spacing.sm }}>
                Drop a 3D model here
              </div>
              <div style={{ fontSize: fontSizes.md, color: colors.textFaint, marginBottom: spacing.lg }}>
                Supports STL and OBJ files
              </div>
              <div style={{ display: 'flex', gap: spacing.md, pointerEvents: 'auto' }}>
                <button
                  type="button"
                  onClick={handleFileLoad}
                  style={{
                    background: colors.primary,
                    color: '#fff',
                    border: 'none',
                    borderRadius: radii.pill,
                    padding: `${spacing.md}px ${spacing.xl}px`,
                    fontSize: fontSizes.md,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    boxShadow: shadows.primary,
                  }}
                  aria-label="Load a 3D model file"
                >
                  Browse Files
                </button>
                <button
                  type="button"
                  onClick={handleLoadSample}
                  style={{
                    background: colors.sectionBg,
                    color: colors.textBody,
                    border: 'none',
                    borderRadius: radii.pill,
                    padding: `${spacing.md}px ${spacing.xl}px`,
                    fontSize: fontSizes.md,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    boxShadow: shadows.raisedSm,
                  }}
                  aria-label="Load the built-in sample model"
                >
                  Try Sample
                </button>
              </div>
            </div>
          )}

          {state.originalGeometry && (
            <div role="toolbar" aria-label="View options" style={{
              position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: spacing.lg, display: 'flex', gap: 4, padding: 4,
              background: colors.sectionBg, borderRadius: radii.pill, boxShadow: shadows.raisedSm, zIndex: 6, flexWrap: 'wrap',
            }}>
              {([
                ['Wireframe', state.wireframe, () => setState(p => ({ ...p, wireframe: !p.wireframe })), true],
                ['Heatmap', state.showHeatmap, () => setState(p => ({ ...p, showHeatmap: !p.showHeatmap })), true],
                ['Thickness', showThickness, () => { setShowThickness(v => !v); setShowFill(false); }, true],
                ['Fill preview', showFill, () => { setShowFill(v => !v); setShowThickness(false); }, true],
                ['Exploded', state.explodedView, () => setState(p => ({ ...p, explodedView: !p.explodedView })), state.moldGenerated],
                ['Original', state.showOriginal, () => setState(p => ({ ...p, showOriginal: !p.showOriginal })), state.moldGenerated],
              ] as const).filter(c => c[3]).map(([label, on, fn]) => (
                <button key={label} type="button" aria-pressed={on} onClick={fn} style={{
                  border: 'none', borderRadius: radii.pill, padding: `6px ${spacing.md}px`, cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: fontSizes.xs, fontWeight: 600, background: colors.sectionBg,
                  color: on ? colors.primary : colors.textMuted, boxShadow: on ? shadows.inset : 'none',
                }}>{label}</button>
              ))}
            </div>
          )}
          {showFill && state.originalGeometry && (
            <div aria-label="Fill preview legend" style={{
              position: 'absolute', top: spacing.lg, right: spacing.lg, zIndex: 6, padding: `${spacing.sm}px ${spacing.md}px`, maxWidth: 280,
              background: colors.sectionBg, borderRadius: radii.lg, boxShadow: shadows.raisedSm, fontSize: fontSizes.xs, color: colors.textBody,
            }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Fill preview (pour from +{state.axis.toUpperCase()})</div>
              <div>Orange rises as material fills from the bottom. Red dots = likely air traps{trapCount !== null ? ` (${trapCount})` : ''} — add a vent there.</div>
              <div style={{ opacity: 0.7, marginTop: 4 }}>Estimate only, not a flow simulation.</div>
            </div>
          )}
          {showThickness && state.originalGeometry && (
            <div aria-label="Thickness legend" style={{
              position: 'absolute', top: spacing.lg, right: spacing.lg, zIndex: 6, padding: `${spacing.sm}px ${spacing.md}px`,
              background: colors.sectionBg, borderRadius: radii.lg, boxShadow: shadows.raisedSm, fontSize: fontSizes.xs, color: colors.textBody,
            }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Wall thickness</div>
              <div>Red: under 1.5 mm · Yellow: 1.5–3 mm · Green: 3 mm+</div>
              {thicknessMin !== null && <div>Thinnest spot: {thicknessMin.toFixed(1)} mm</div>}
            </div>
          )}
        </main>

        {/* Control Panel — axis/offset changes no longer wipe the mold; the
            Generate button relabels to "Regenerate Mold" when params drift. */}
        <ControlPanel
          state={state}
          step={step}
          onStepChange={setStep}
          onLoadFile={handleFileLoad}
          onAxisChange={(axis: Axis) => setState(prev => ({ ...prev, axis }))}
          onOffsetChange={(offset: number) => setState(prev => ({ ...prev, planeOffset: offset }))}
          onCutAngleChange={(cutAngle: number) => setState(prev => ({ ...prev, cutAngle }))}
          onAddAdditionalPlane={() => setState(prev => ({
            ...prev,
            // New cut defaults to the same axis as the primary plane at
            // 50% offset, no tilt — a sensible "you can see it immediately"
            // starting point. The user nudges from there.
            additionalPlanes: [
              ...prev.additionalPlanes,
              { axis: prev.axis, offset: 0.5, cutAngle: 0 },
            ],
          }))}
          onRemoveAdditionalPlane={(index: number) => setState(prev => ({
            ...prev,
            additionalPlanes: prev.additionalPlanes.filter((_, i) => i !== index),
          }))}
          onAdditionalPlaneChange={(index, plane) => setState(prev => ({
            ...prev,
            additionalPlanes: prev.additionalPlanes.map((p, i) => i === index ? plane : p),
          }))}
          onToggleHollow={(isHollow: boolean) => setState(prev => ({ ...prev, isHollow }))}
          onSprueOverrideToggle={(enabled: boolean) => setState(prev => ({
            ...prev,
            sprueOverride: { ...prev.sprueOverride, enabled },
          }))}
          onSprueOverrideAChange={(a: number) => setState(prev => ({
            ...prev,
            sprueOverride: { ...prev.sprueOverride, a },
          }))}
          onSprueOverrideBChange={(b: number) => setState(prev => ({
            ...prev,
            sprueOverride: { ...prev.sprueOverride, b },
          }))}
          onWallThicknessChange={(wallThicknessRatio: number) =>
            setState(prev => ({ ...prev, wallThicknessRatio }))}
          onClearanceChange={(clearanceMm: number) =>
            setState(prev => ({ ...prev, clearanceMm }))}
          onSprueDiameterChange={(sprueDiameterMm: number) =>
            setState(prev => ({ ...prev, sprueDiameterMm }))}
          onMoldBoxShapeChange={(moldBoxShape: MoldBoxShape) =>
            setState(prev => ({ ...prev, moldBoxShape }))}
          onMoldModeChange={(moldMode: MoldMode) =>
            setState(prev => ({ ...prev, moldMode }))}
          onSiliconeTypeChange={(siliconeType: SiliconeMoldType) =>
            setState(prev => ({ ...prev, siliconeType }))}
          onSiliconeMarginChange={(siliconeMarginMm: number) =>
            setState(prev => ({ ...prev, siliconeMarginMm }))}
          onSkinThicknessChange={(skinThicknessMm: number) =>
            setState(prev => ({ ...prev, skinThicknessMm }))}
          onIncludeCoreChange={(includeCore: boolean) =>
            setState(prev => ({ ...prev, includeCore }))}
          onFormFitChange={(formFit: boolean) =>
            setState(prev => ({ ...prev, formFit }))}
          onResetDimensions={() => setState(prev => ({
            ...prev,
            wallThicknessRatio: WALL_THICKNESS_RATIO,
            clearanceMm: CLEARANCE_MM,
            sprueDiameterMm: SPRUE_DIAMETER_MM,
            moldBoxShape: 'rect',
            formFit: false,
          }))}
          onGenerate={handleGenerate}
          onAutoDetect={handleAutoDetect}
          onExport={handleExport}
          onToggleExplode={() => setState(prev => ({ ...prev, explodedView: !prev.explodedView }))}
          onToggleOriginal={() => setState(prev => ({ ...prev, showOriginal: !prev.showOriginal }))}
          onToggleHeatmap={() => setState(prev => ({ ...prev, showHeatmap: !prev.showHeatmap }))}
          onToggleSplitLine={() => setState(prev => ({ ...prev, showSplitLine: !prev.showSplitLine }))}
          onSuggestParting={handleSuggestParting}
          estimator={state.estimator}
          onEstimatorChange={(patch: { material?: 'pla' | 'resin'; pricePerKg?: number; siliconePricePerLiter?: number }) =>
            setState(prev => ({ ...prev, estimator: { ...prev.estimator, ...patch } }))}
          projects={projects}
          projectBusy={projectBusy}
          onSaveProject={handleSaveProject}
          onOpenProject={handleOpenProject}
          onDeleteProject={handleDeleteProject}
          onExportProject={handleExportProject}
          onImportProject={handleImportProject}
          onToggleWireframe={() => setState(prev => ({ ...prev, wireframe: !prev.wireframe }))}
          onStartOver={() => setState(initialState)}
          onPrinterChange={(selectedPrinterId: string | null) =>
            setState(prev => ({ ...prev, selectedPrinterId }))}
          onScaleChange={(scale: number) =>
            setState(prev => ({ ...prev, scale }))}
          onResetScale={() =>
            setState(prev => ({ ...prev, scale: 1.0 }))}
          telemetryConfigured={telemetry.configured}
          telemetryEnabled={telemetry.settings.telemetryEnabled}
          onTelemetryAllow={telemetry.grant}
          onTelemetryDecline={telemetry.decline}
          stepExporting={stepExporting}
          onCancelStepExport={handleCancelStepExport}
          moldSlot={
            <>
            <MoldCoreSettings
              settings={state.tier2}
              onChange={patch => setState(prev => ({ ...prev, tier2: { ...prev.tier2, ...patch } }))}
              moldMode={state.moldMode}
              siliconeType={state.siliconeType}
              formFit={state.formFit}
            />
            <MoldPrepPanel
              castingMaterial={state.tier2.castingMaterial}
              scale={state.scale}
              onScaleChange={sc => setState(prev => ({ ...prev, scale: sc }))}
              onSetClearance={mm => setState(prev => ({ ...prev, clearanceMm: mm }))}
              onApplyPreset={p => setState(prev => ({
                ...prev, moldMode: p.moldMode, sprueDiameterMm: p.sprueDiameterMm,
                siliconeMarginMm: p.moldMode === 'silicone' ? p.siliconeMarginMm : prev.siliconeMarginMm,
                tier2: { ...prev.tier2, castingMaterial: p.castingMaterial },
              }))}
            />
            </>
          }
          finishSlot={
            <FinishAdvisorPanel
              geometry={state.originalGeometry}
              boundingBox={state.boundingBox}
              axis={state.axis}
              offset={state.planeOffset}
              cutAngle={state.cutAngle}
              moldMode={state.moldMode}
              wallMm={state.moldMode === 'silicone'
                ? (state.siliconeMarginMm || 10)
                : (state.boundingBox ? state.boundingBox.getSize(new THREE.Vector3()).length() * state.wallThicknessRatio : 5)}
              castingMaterial={state.tier2.castingMaterial}
              printer={getPresetById(state.selectedPrinterId)?.category ?? (state.estimator.material === 'resin' ? 'resin' : 'fdm')}
            />
          }
          modelSlot={<>
            <ModelFixPanel geometry={state.originalGeometry} onReplaceModel={replaceModel} scale={state.scale} onSetScale={sc => setState(prev => ({ ...prev, scale: sc }))} />
            <AiShapePanel onCommit={commitGeometry} />
          </>}
          reportSlot={<>
            <MoldReportPanel
              geometry={state.originalGeometry}
              pieces={state.moldPieces}
              labels={state.pieceLabels}
              fileName={state.fileName}
              moldMode={state.moldMode}
              axis={state.axis}
              castingMaterial={state.tier2.castingMaterial}
              siliconeVolumeCm3={state.siliconeVolumeCm3}
              printMaterial={state.estimator.material}
              pricePerKg={state.estimator.pricePerKg}
              siliconePricePerLiter={state.estimator.siliconePricePerLiter}
              wallMm={state.moldMode === 'silicone' ? (state.siliconeMarginMm || 10) : 5}
              printer={getPresetById(state.selectedPrinterId)?.category ?? (state.estimator.material === 'resin' ? 'resin' : 'fdm')}
            />
            <OverhangPanel pieces={state.moldPieces} labels={state.pieceLabels} />
          </>
          }
          packSlot={
            <PlatePackerPanel
              pieces={state.moldPieces}
              bed={getPresetById(state.selectedPrinterId)?.volumeMm ?? null}
              material={state.estimator.material}
              pricePerKg={state.estimator.pricePerKg}
            />
          }
          toolsSlot={
            <ModelToolsPanel
              geometry={state.originalGeometry}
              fileName={state.fileName}
              bed={getPresetById(state.selectedPrinterId)?.volumeMm ?? null}
              canUndo={canUndo}
              onUndo={undoModel}
              onReplaceModel={replaceModel}
            />
          }
          tier2Slot={
            <AdvancedMoldPanel
              settings={state.tier2}
              onChange={patch => setState(prev => ({ ...prev, tier2: { ...prev.tier2, ...patch } }))}
              geometry={state.originalGeometry}
              axis={state.axis}
              moldMode={state.moldMode}
              siliconeType={state.siliconeType}
              cutAngle={state.cutAngle}
              formFit={state.formFit}
              siliconeVolumeCm3={state.siliconeVolumeCm3}
              onApplyGate={g => setState(prev => ({
                ...prev,
                sprueDiameterMm: g.sprueDiameterMm,
                sprueOverride: { enabled: true, a: g.a, b: g.b },
                infoMessage: `Gate advisor applied: ${g.sprueDiameterMm} mm sprue over the thickest section. Generate to see it.`,
              }))}
            />
          }
        />
      </div>
      </div>


      {shortcutHelpOpen && (
        <ShortcutCheatSheet onClose={() => setShortcutHelpOpen(false)} />
      )}

      {/* First-run consent modal. Only ever visible if the build was
          configured with a telemetry host AND the user hasn't yet been
          asked. Rendered outside the main layout flow so it can overlay
          everything including the control panel. */}
      <GuidedTour />

      {telemetryModalOpen && (
        <FirstRunTelemetryModal
          onAllow={() => {
            telemetry.grant();
            setTelemetryModalOpen(false);
          }}
          onDecline={() => {
            telemetry.decline();
            setTelemetryModalOpen(false);
          }}
          onDismiss={() => {
            // Escape / backdrop — close without recording a decision. The
            // modal will reappear on the next successful mold generation.
            // See component docblock for why we don't treat this as decline.
            setTelemetryModalOpen(false);
          }}
        />
      )}
    </>
  );
}

/**
 * Keyboard-shortcut cheat-sheet overlay. Triggered by `?`, dismissed by
 * Escape or clicking the backdrop. Uses role="dialog" + aria-modal so
 * screen readers announce it as a modal and focus is trapped by the
 * platform. Deliberately NOT a form — no submit button, no focusable
 * fields — so the native focus-trap behavior is sufficient.
 */
function ShortcutCheatSheet({ onClose }: { onClose: () => void }) {
  const rows: Array<[string, string]> = [
    ['?', 'Toggle this cheat sheet'],
    ['O', 'Open a file (browse)'],
    ['G', 'Generate mold'],
    ['A', 'Auto-detect parting plane'],
    ['H', 'Toggle demoldability heatmap'],
    ['W', 'Toggle wireframe'],
    ['E', 'Toggle exploded view'],
    ['X / Y / Z', 'Set parting axis'],
    ['Esc', 'Close this overlay'],
  ];
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(30,41,59,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: colors.panelBg,
          border: `1px solid ${colors.borderPanel}`,
          borderRadius: radii.lg,
          padding: `${spacing.xl}px ${spacing.xl + spacing.sm}px`,
          color: colors.textPrimary,
          minWidth: 360,
          maxWidth: 480,
          boxShadow: shadows.raised,
          border: 'none',
        }}
      >
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: spacing.lg,
        }}>
          <div style={{ fontSize: fontSizes.lg, fontWeight: 600 }}>
            Keyboard Shortcuts
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close shortcuts"
            style={{
              background: 'transparent',
              color: colors.textMuted,
              border: 'none',
              fontSize: fontSizes.lg,
              cursor: 'pointer',
              padding: spacing.xs,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: spacing.lg, rowGap: spacing.sm }}>
          {rows.map(([key, label]) => (
            <Fragment key={key}>
              <kbd style={{
                background: colors.sectionBg,
                border: `1px solid ${colors.borderSection}`,
                borderRadius: radii.sm,
                padding: `${spacing.xs}px ${spacing.sm}px`,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: fontSizes.sm,
                color: colors.textPrimary,
                whiteSpace: 'nowrap',
                textAlign: 'center',
              }}>
                {key}
              </kbd>
              <span style={{ fontSize: fontSizes.sm, color: colors.textBody, alignSelf: 'center' }}>
                {label}
              </span>
            </Fragment>
          ))}
        </div>
        <div style={{
          marginTop: spacing.lg,
          fontSize: fontSizes.xs,
          color: colors.textDim,
          textAlign: 'center',
        }}>
          Press <kbd style={{
            background: colors.sectionBg,
            border: `1px solid ${colors.borderSection}`,
            borderRadius: radii.sm,
            padding: `0 ${spacing.xs}px`,
            fontFamily: 'ui-monospace, monospace',
            fontSize: fontSizes.xs,
          }}>?</kbd> anytime to reopen
        </div>
      </div>
    </div>
  );
}

/** Single color-swatch + label row inside the heatmap legend. */
function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
      <span
        aria-hidden="true"
        style={{
          width: 12, height: 12, borderRadius: 2, background: color,
          border: '1px solid rgba(255,255,255,0.2)', flexShrink: 0,
        }}
      />
      <span>{label}</span>
    </div>
  );
}

/**
 * Exploded-view offset for piece N in an N-piece mold.
 *
 * For 2-piece molds (the legacy case) this reduces to:
 *   piece 0 → +1 along primary axis
 *   piece 1 → -1 along primary axis
 * — identical to the old getExplodeOffset(axis, ±1) calls it replaced.
 *
 * For N>2: alternates ±along the primary axis with growing magnitude, so
 * additional pieces fan out as a "comb" past the primary halves rather
 * than colliding with them. We don't try to honour the actual
 * additional-plane normals here — that would need per-piece-of-origin
 * tracking through the CSG path. The fan view is good enough as a
 * "see all the pieces" gesture; users do per-piece inspection by
 * exporting to STL anyway.
 *
 *   index 0 → primary direction +1, magnitude 1
 *   index 1 → primary direction -1, magnitude 1
 *   index 2 → primary direction +1, magnitude 2
 *   index 3 → primary direction -1, magnitude 2
 *   ...
 */
function getExplodeOffsetForPiece(
  axis: Axis,
  index: number,
  bbox: THREE.Box3,
): [number, number, number] {
  const direction = index % 2 === 0 ? 1 : -1;
  // Magnitude grows every PAIR of pieces — pieces 0 & 1 at 1×, pieces 2 & 3
  // at 2×, etc. Math.floor(index / 2) + 1 gives that "ring" distance.
  const ring = Math.floor(index / 2) + 1;
  const size = new THREE.Vector3();
  bbox.getSize(size);
  const dist = Math.max(size.x, size.y, size.z) * EXPLODE_OFFSET_RATIO * ring;
  switch (axis) {
    case 'x': return [direction * dist, 0, 0];
    case 'y': return [0, direction * dist, 0];
    case 'z': return [0, 0, direction * dist];
  }
}

/**
 * Cycle through a small palette so each piece gets a distinct colour. The
 * first two entries are the legacy top/bottom colours so 2-piece molds
 * look exactly like they used to. Beyond two pieces we use distinguishable
 * hues that don't collide with the model's blue (#6c9bcf).
 */
const PIECE_COLORS = [
  '#5b9bd5', // top — legacy blue
  '#e07070', // bottom — legacy red
  '#7bc77b', // green
  '#d9a14e', // orange
  '#a980d6', // purple
  '#54bcb8', // teal
] as const;

function getPieceColor(index: number): string {
  return PIECE_COLORS[index % PIECE_COLORS.length];
}
