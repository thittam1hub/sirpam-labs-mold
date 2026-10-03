// Sirpam 3D Labs Mold — thin composer that assembles the five panel steps.
import type { AppState } from '../App';
import type { Axis, MoldBoxShape, MoldMode, SiliconeMoldType } from '../types';
import type { ProjectMeta } from '../services/projectStorage';
import { styles } from './panel/tokens';
import { StepFooter, STEP_NAMES } from './panel/NavFooter';
import { ModelStep } from './panel/ModelStep';
import { SplitStep } from './panel/SplitStep';
import { MoldStep } from './panel/MoldStep';
import { ProStep } from './panel/ProStep';
import { FinishStep } from './panel/FinishStep';
import { primaryCtaLabel, primaryCtaDisabled } from './panel/staleness';

export { STEP_NAMES };

interface ControlPanelProps {
  state: AppState;
  tier2Slot?: React.ReactNode;
  moldSlot?: React.ReactNode;
  toolsSlot?: React.ReactNode;
  finishSlot?: React.ReactNode;
  modelSlot?: React.ReactNode;
  packSlot?: React.ReactNode;
  reportSlot?: React.ReactNode;
  step: number;
  onStepChange: (n: number) => void;
  onLoadFile: () => void;
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
  onWallThicknessChange: (ratio: number) => void;
  onClearanceChange: (clearanceMm: number) => void;
  onSprueDiameterChange: (sprueDiameterMm: number) => void;
  onVentDiameterChange: (ventDiameterMm: number) => void;
  onMoldBoxShapeChange: (shape: MoldBoxShape) => void;
  onMoldModeChange: (mode: MoldMode) => void;
  onSiliconeTypeChange: (type: SiliconeMoldType) => void;
  onSiliconeMarginChange: (mm: number) => void;
  onSkinThicknessChange: (mm: number) => void;
  onIncludeCoreChange: (include: boolean) => void;
  onFormFitChange: (formFit: boolean) => void;
  onResetDimensions: () => void;
  onGenerate: () => void;
  onAutoDetect: () => void;
  onExport: (format: 'stl' | 'obj' | '3mf' | 'step') => void;
  stepExporting: boolean;
  onCancelStepExport: () => void;
  onToggleExplode: () => void;
  onToggleOriginal: () => void;
  onToggleHeatmap: () => void;
  onToggleSplitLine: () => void;
  onSuggestParting: () => void;
  estimator: { material: 'pla' | 'resin'; pricePerKg: number; siliconePricePerLiter: number; castingPricePerKg: number };
  onEstimatorChange: (patch: { material?: 'pla' | 'resin'; pricePerKg?: number; siliconePricePerLiter?: number }) => void;
  projects: ProjectMeta[];
  projectBusy: boolean;
  onSaveProject: () => void;
  onOpenProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onExportProject: (id: string) => void;
  onImportProject: () => void;
  onToggleWireframe: () => void;
  onStartOver: () => void;
  onPrinterChange: (printerId: string | null) => void;
  onScaleChange: (scale: number) => void;
  onResetScale: () => void;
  headerSlot?: React.ReactNode;
}

export default function ControlPanel(props: ControlPanelProps) {
  const { state, step, onStepChange } = props;
  const hasModel = !!state.originalGeometry;
  const hasMold = state.moldGenerated;

  return (
    <aside className="sirpam-panel" style={styles.panel} aria-label="Controls">
      {props.headerSlot}


      <div style={styles.scrollArea}>
        {!hasModel && (
          <div style={styles.hint}>
            Load a model to begin — use Open model or Try sample in the top bar, or drop a file on the viewer.
          </div>
        )}

        {step === 0 && (
          <ModelStep
            state={state}
            hasModel={hasModel}
            onLoadFile={props.onLoadFile}
            onPrinterChange={props.onPrinterChange}
            onScaleChange={props.onScaleChange}
            onResetScale={props.onResetScale}
            modelSlot={props.modelSlot}
          />
        )}

        {step === 1 && (
          <SplitStep
            state={state}
            hasModel={hasModel}
            onAxisChange={props.onAxisChange}
            onOffsetChange={props.onOffsetChange}
            onCutAngleChange={props.onCutAngleChange}
            onAddAdditionalPlane={props.onAddAdditionalPlane}
            onRemoveAdditionalPlane={props.onRemoveAdditionalPlane}
            onAdditionalPlaneChange={props.onAdditionalPlaneChange}
            onToggleHollow={props.onToggleHollow}
            onSprueOverrideToggle={props.onSprueOverrideToggle}
            onSprueOverrideAChange={props.onSprueOverrideAChange}
            onSprueOverrideBChange={props.onSprueOverrideBChange}
            onToggleHeatmap={props.onToggleHeatmap}
            onToggleSplitLine={props.onToggleSplitLine}
            onAutoDetect={props.onAutoDetect}
            onSuggestParting={props.onSuggestParting}
          />
        )}

        {step === 2 && (
          <MoldStep
            state={state}
            hasModel={hasModel}
            onMoldModeChange={props.onMoldModeChange}
            onSiliconeTypeChange={props.onSiliconeTypeChange}
            onSiliconeMarginChange={props.onSiliconeMarginChange}
            onSkinThicknessChange={props.onSkinThicknessChange}
            onIncludeCoreChange={props.onIncludeCoreChange}
            onFormFitChange={props.onFormFitChange}
            onMoldBoxShapeChange={props.onMoldBoxShapeChange}
            onWallThicknessChange={props.onWallThicknessChange}
            onClearanceChange={props.onClearanceChange}
            onSprueDiameterChange={props.onSprueDiameterChange}
            onVentDiameterChange={props.onVentDiameterChange}
            onResetDimensions={props.onResetDimensions}
            moldSlot={props.moldSlot}
          />
        )}

        {step === 3 && (
          <ProStep hasModel={hasModel} tier2Slot={props.tier2Slot} toolsSlot={props.toolsSlot} />
        )}

        {step === 4 && (
          <FinishStep
            state={state}
            hasModel={hasModel}
            hasMold={hasMold}
            estimator={props.estimator}
            onEstimatorChange={props.onEstimatorChange}
            projects={props.projects}
            projectBusy={props.projectBusy}
            onSaveProject={props.onSaveProject}
            onOpenProject={props.onOpenProject}
            onDeleteProject={props.onDeleteProject}
            onExportProject={props.onExportProject}
            onImportProject={props.onImportProject}
            onExport={props.onExport}
            stepExporting={props.stepExporting}
            onCancelStepExport={props.onCancelStepExport}
            onStartOver={props.onStartOver}
            finishSlot={props.finishSlot}
            packSlot={props.packSlot}
            reportSlot={props.reportSlot}
          />
        )}
      </div>

      <StepFooter
        step={step}
        onStepChange={onStepChange}
        hasModel={hasModel}
        primaryLabel={primaryCtaLabel(state, hasMold)}
        primaryDisabled={primaryCtaDisabled(state, hasMold)}
        onGenerate={props.onGenerate}
      />
    </aside>
  );
}
