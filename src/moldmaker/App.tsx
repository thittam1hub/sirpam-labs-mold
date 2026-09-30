// Sirpam 3D Labs Mold — thin app composer: wires studio hooks, ControlPanel, and the 3D scene.
import { useTheme } from '@/components/ThemeToggle';
import { useCallback, useEffect, useState } from 'react';
import * as THREE from 'three';
import AdvancedMoldPanel, { MoldCoreSettings } from './components/AdvancedMoldPanel';
import OverhangPanel from './components/OverhangPanel';
import ControlPanel from './components/ControlPanel';
import { loadFile as _loadFile } from './utils/fileLoader';
import { trackEvent } from '@/components/Analytics';
import type { Axis, MoldBoxShape, MoldMode, SiliconeMoldType } from './types';
import { colors, radii, spacing, fontSizes, focusVisibleCss, shadows, fonts, sceneColors } from './theme';
import { WALL_THICKNESS_RATIO, CLEARANCE_MM, SPRUE_DIAMETER_MM } from './mold/constants';
import TopBar from './components/layout/TopBar';
import { MoldPrepPanel, ModelToolsPanel, FinishAdvisorPanel, PlatePackerPanel } from './components/ShopPanels';
import { PrintQueuePanel } from './components/PrintQueuePanel';
import WorkflowRail from './components/layout/WorkflowRail';
import StatusBar from './components/layout/StatusBar';
import { Link } from '@tanstack/react-router';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { ModelFixPanel, MoldReportPanel } from './components/ModelFixPanels';
import { getPresetById } from './utils/printerPresets';

import { initialAppState, tier2GeomKeyGuard, moldIsStale, type AppState } from './studio/state';
import { useStudioState } from './studio/useStudioState';
import { useModelIngestion } from './studio/useModelIngestion';
import { useMoldGeneration } from './studio/useMoldGeneration';
import { useExportActions } from './studio/useExportActions';
import { useProjectActions } from './studio/useProjectActions';
import { useShortcuts } from './studio/useShortcuts';
import StudioScene from './studio/Scene';
import DropZone from './studio/DropZone';
import ViewToolbar from './studio/ViewToolbar';
import ShortcutsSheet from './studio/ShortcutsSheet';
import { ErrorBanner, InfoBanner, RepairProgressBanner, HeatmapLegend, FillLegend, ThicknessLegend } from './studio/Banners';

export type { AppState };

type MoldMakerAppProps = { initialStep?: number; initialTool?: string };

export default function App({ initialStep, initialTool }: MoldMakerAppProps) {
  const themeMode = useTheme();
  const sceneCols = sceneColors[themeMode];

  const { state, setState, modelFitSize, commitGeometry, replaceModel, undoModel, canUndo, undoGeoRef, setCanUndo } = useStudioState();

  const [noWebgl, setNoWebgl] = useState(false);
  useEffect(() => {
    try {
      const c = document.createElement('canvas');
      if (!(c.getContext('webgl2') || c.getContext('webgl'))) setNoWebgl(true);
    } catch { setNoWebgl(true); }
  }, []);

  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  useEffect(() => { try { if (localStorage.getItem('sirpam.panel') === '0') setPanelOpen(false); } catch { /* ignore */ } }, []);

  const [step, setStepRaw] = useState(() => initialStep ? initialStep - 1 : 0);
  useEffect(() => {
    if (initialStep) return;
    try { const v = Number(localStorage.getItem('sirpam.step')); if (v >= 0 && v <= 4) setStepRaw(v); } catch { /* ignore */ }
  }, [initialStep]);
  useEffect(() => {
    if (!initialTool) return;
    let attempts = 0;
    const reveal = () => {
      const panel = document.getElementById(initialTool);
      if (panel) { panel.scrollIntoView({ block: 'start' }); return; }
      attempts += 1;
      if (attempts < 20) window.setTimeout(reveal, 100);
    };
    window.requestAnimationFrame(reveal);
  }, [initialTool]);
  const setStep = useCallback((n: number) => {
    setStepRaw(n);
    try { localStorage.setItem('sirpam.step', String(n)); } catch { /* ignore */ }
  }, []);

  const [showThickness, setShowThickness] = useState(false);
  const [showFill, setShowFill] = useState(false);
  const [trapCount, setTrapCount] = useState<number | null>(null);
  const [thicknessMin, setThicknessMin] = useState<number | null>(null);

  const { handleFileLoad, loadTemplate, handleLoadSample, handleDrop, handleDragOver } =
    useModelIngestion(commitGeometry, setState);

  const { handleGenerate, handleAutoDetect, handleSuggestParting, repairProgress } =
    useMoldGeneration(state, setState, undoGeoRef, setCanUndo);

  const { handleExport, handleCancelStepExport, stepExporting } = useExportActions(state, setState);

  const { projects, projectBusy, handleSaveProject, handleOpenProject, handleDeleteProject, handleExportProject, handleImportProject } =
    useProjectActions(state, setState, commitGeometry);

  useShortcuts({
    state, setState, step, setStep, shortcutHelpOpen, setShortcutHelpOpen,
    onLoadFile: handleFileLoad, onGenerate: handleGenerate, onAutoDetect: handleAutoDetect,
  });

  const clearError = useCallback(() => setState(prev => ({ ...prev, errorMessage: null })), [setState]);
  const clearInfo = useCallback(() => setState(prev => ({ ...prev, infoMessage: null })), [setState]);

  const paramsChanged = moldIsStale(state);
  const genLabel = state.generating ? 'Generating…'
    : state.moldGenerated ? (paramsChanged ? 'Regenerate' : 'Up to date') : 'Generate Mold';
  const genDisabled = state.generating || (state.moldGenerated && !paramsChanged);
  const showPartingPlaneIndicator = !!state.originalGeometry && !!state.boundingBox && (!state.moldGenerated || paramsChanged);

  return (
    <>
      <style>{focusVisibleCss}</style>
      <style>{`
        .sirpam-show-sm{display:none}
        @media (max-width: 900px){
          .sirpam-hide-sm{display:none !important}
          .sirpam-show-sm{display:block}
          .sirpam-body{flex-direction:column}
          .sirpam-rail{order:3;width:100% !important;flex-direction:row !important;justify-content:space-around;padding:4px !important}
          .sirpam-rail-sep{display:none}
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
          <WorkflowRail step={step} onStep={setStep} hasModel={!!state.originalGeometry} hasMold={state.moldGenerated} />
          <main style={{ flex: 1, position: 'relative' }} aria-label="3D viewport" onDrop={handleDrop} onDragOver={handleDragOver}>
            <button type="button" className="sirpam-hide-sm"
              onClick={() => setPanelOpen(o => { try { localStorage.setItem('sirpam.panel', o ? '0' : '1'); } catch { /* ignore */ } return !o; })}
              aria-label={panelOpen ? 'Hide settings panel' : 'Show settings panel'}
              title={panelOpen ? 'Hide settings' : 'Show settings'} aria-expanded={panelOpen}
              style={{ position: 'absolute', bottom: spacing.lg, right: spacing.lg, zIndex: 7, border: 'none', borderRadius: radii.md, padding: 8, cursor: 'pointer', background: colors.sectionBg, color: colors.textBody, boxShadow: shadows.raisedSm, display: 'flex' }}>
              {panelOpen ? <PanelRightClose size={18} aria-hidden="true" /> : <PanelRightOpen size={18} aria-hidden="true" />}
            </button>
            {noWebgl && (
              <div role="alert" style={{ position: 'absolute', inset: 0, zIndex: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: spacing.lg, pointerEvents: 'none' }}>
                <div style={{ maxWidth: 420, background: colors.sectionBg, borderRadius: radii.lg, boxShadow: shadows.raised, padding: spacing.lg, color: colors.textBody, fontSize: fontSizes.sm, lineHeight: 1.5 }}>
                  <strong>3D view unavailable in this browser.</strong> Your browser has 3D graphics (WebGL) turned off or unsupported. You can still set up and export molds, but you won't see them. Try the latest Chrome, Edge, Safari or Firefox with hardware acceleration switched on.
                </div>
              </div>
            )}
            <StudioScene
              state={state}
              setState={setState}
              themeMode={themeMode}
              sceneCols={sceneCols}
              modelFitSize={modelFitSize}
              showThickness={showThickness}
              showFill={showFill}
              onTrapCount={setTrapCount}
              onThicknessMin={setThicknessMin}
              onCreated={() => setNoWebgl(false)}
              showPartingPlaneIndicator={showPartingPlaneIndicator}
            />

            {state.errorMessage && <ErrorBanner message={state.errorMessage} onDismiss={clearError} />}
            {repairProgress && <RepairProgressBanner pct={repairProgress.pct} label={repairProgress.label} sceneBg={sceneCols.sceneBg} />}
            {state.infoMessage && <InfoBanner message={state.infoMessage} onDismiss={clearInfo} pushDown={!!state.errorMessage} />}
            {state.showHeatmap && state.originalGeometry && <HeatmapLegend />}

            {!state.originalGeometry && <DropZone onLoadFile={handleFileLoad} onLoadTemplate={loadTemplate} />}

            {state.originalGeometry && (
              <ViewToolbar
                wireframe={state.wireframe} onToggleWireframe={() => setState(p => ({ ...p, wireframe: !p.wireframe }))}
                showHeatmap={state.showHeatmap} onToggleHeatmap={() => setState(p => ({ ...p, showHeatmap: !p.showHeatmap }))}
                showThickness={showThickness} onToggleThickness={() => { setShowThickness(v => !v); setShowFill(false); }}
                showFill={showFill} onToggleFill={() => { setShowFill(v => !v); setShowThickness(false); }}
                explodedView={state.explodedView} onToggleExplode={() => setState(p => ({ ...p, explodedView: !p.explodedView }))}
                showOriginal={state.showOriginal} onToggleOriginal={() => setState(p => ({ ...p, showOriginal: !p.showOriginal }))}
                moldGenerated={state.moldGenerated}
              />
            )}
            {showFill && state.originalGeometry && <FillLegend axis={state.axis} trapCount={trapCount} />}
            {showThickness && state.originalGeometry && <ThicknessLegend min={thicknessMin} />}
          </main>

          <div style={{ display: panelOpen ? 'contents' : 'none' }}>
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
                additionalPlanes: [...prev.additionalPlanes, { axis: prev.axis, offset: 0.5, cutAngle: 0 }],
              }))}
              onRemoveAdditionalPlane={(index: number) => setState(prev => ({
                ...prev, additionalPlanes: prev.additionalPlanes.filter((_, i) => i !== index),
              }))}
              onAdditionalPlaneChange={(index, plane) => setState(prev => ({
                ...prev, additionalPlanes: prev.additionalPlanes.map((p, i) => i === index ? plane : p),
              }))}
              onToggleHollow={(isHollow: boolean) => setState(prev => ({ ...prev, isHollow }))}
              onSprueOverrideToggle={(enabled: boolean) => setState(prev => ({ ...prev, sprueOverride: { ...prev.sprueOverride, enabled } }))}
              onSprueOverrideAChange={(a: number) => setState(prev => ({ ...prev, sprueOverride: { ...prev.sprueOverride, a } }))}
              onSprueOverrideBChange={(b: number) => setState(prev => ({ ...prev, sprueOverride: { ...prev.sprueOverride, b } }))}
              onWallThicknessChange={(wallThicknessRatio: number) => setState(prev => ({ ...prev, wallThicknessRatio }))}
              onClearanceChange={(clearanceMm: number) => setState(prev => ({ ...prev, clearanceMm }))}
              onSprueDiameterChange={(sprueDiameterMm: number) => setState(prev => ({ ...prev, sprueDiameterMm }))}
              onMoldBoxShapeChange={(moldBoxShape: MoldBoxShape) => setState(prev => ({ ...prev, moldBoxShape }))}
              onMoldModeChange={(moldMode: MoldMode) => setState(prev => ({ ...prev, moldMode }))}
              onSiliconeTypeChange={(siliconeType: SiliconeMoldType) => setState(prev => ({ ...prev, siliconeType }))}
              onSiliconeMarginChange={(siliconeMarginMm: number) => setState(prev => ({ ...prev, siliconeMarginMm }))}
              onSkinThicknessChange={(skinThicknessMm: number) => setState(prev => ({ ...prev, skinThicknessMm }))}
              onIncludeCoreChange={(includeCore: boolean) => setState(prev => ({ ...prev, includeCore }))}
              onFormFitChange={(formFit: boolean) => setState(prev => ({ ...prev, formFit }))}
              onResetDimensions={() => setState(prev => ({
                ...prev, wallThicknessRatio: WALL_THICKNESS_RATIO, clearanceMm: CLEARANCE_MM,
                sprueDiameterMm: SPRUE_DIAMETER_MM, moldBoxShape: 'rect', formFit: false,
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
              onStartOver={() => setState(initialAppState)}
              onPrinterChange={(selectedPrinterId: string | null) => setState(prev => ({ ...prev, selectedPrinterId }))}
              onScaleChange={(scale: number) => setState(prev => ({ ...prev, scale }))}
              onResetScale={() => setState(prev => ({ ...prev, scale: 1.0 }))}
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
                <Link to="/studio/ai" style={{ display: 'block', textDecoration: 'none', padding: spacing.lg, borderRadius: radii.lg, background: colors.sectionBg, boxShadow: shadows.raisedSm, color: colors.textBody }}>
                  <div style={{ fontWeight: 700, color: colors.primary, marginBottom: 4 }}>No model? Create one with AI</div>
                  <div style={{ fontSize: fontSizes.xs, color: colors.textMuted, lineHeight: 1.5 }}>Open the AI Model Maker, describe an object, preview and refine it, then send it straight back here.</div>
                </Link>
              </>}
              reportSlot={<>
                <MoldReportPanel
                  geometry={state.originalGeometry}
                  pieces={state.moldPieces}
                  labels={state.pieceLabels}
                  notices={state.buildNotices}
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
              </>}
              packSlot={<>
                <PlatePackerPanel
                  pieces={state.moldPieces}
                  bed={getPresetById(state.selectedPrinterId)?.volumeMm ?? null}
                  material={state.estimator.material}
                  pricePerKg={state.estimator.pricePerKg}
                />
                <PrintQueuePanel
                  pieces={state.moldPieces}
                  fileName={state.fileName}
                  moldMode={state.moldMode}
                  material={state.estimator.material}
                  pricePerKg={state.estimator.pricePerKg}
                  siliconeVolumeCm3={state.siliconeVolumeCm3}
                />
              </>}
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
                    ...prev, sprueDiameterMm: g.sprueDiameterMm, sprueOverride: { enabled: true, a: g.a, b: g.b },
                    infoMessage: `Gate advisor applied: ${g.sprueDiameterMm} mm sprue over the thickest section. Generate to see it.`,
                  }))}
                />
              }
            />
          </div>
        </div>
        <StatusBar
          size={state.boundingBox ? (() => { const v = state.boundingBox!.getSize(new THREE.Vector3()); return { x: v.x, y: v.y, z: v.z }; })() : null}
          triangles={state.originalGeometry ? Math.round((state.originalGeometry.index ? state.originalGeometry.index.count : state.originalGeometry.attributes.position.count) / 3) : 0}
          scale={state.scale}
          hasMold={state.moldGenerated}
          notes={state.moldGenerated ? state.buildNotices : []}
          busy={state.generating ? 'Building mold…' : state.autoDetecting ? 'Finding best split…' : stepExporting ? 'Exporting STEP…' : null}
        />
      </div>

      {shortcutHelpOpen && <ShortcutsSheet onClose={() => setShortcutHelpOpen(false)} />}
    </>
  );
}
