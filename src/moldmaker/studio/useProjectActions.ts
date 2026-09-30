// Sirpam 3D Labs Mold — saved-project handlers: save/open/delete/export/import.
import { useCallback, useEffect, useState } from 'react';
import * as THREE from 'three';
import type { AppState } from './state';
import { DEFAULT_TIER2 } from '../components/AdvancedMoldPanel';
import {
  listProjects, saveProject, getProject, deleteProject,
  downloadProjectFile, pickProjectFile, newProjectId,
  type ProjectMeta, type ProjectParams,
} from '../services/projectStorage';

export interface ProjectActions {
  projects: ProjectMeta[];
  projectBusy: boolean;
  handleSaveProject: () => Promise<void>;
  handleOpenProject: (id: string) => Promise<void>;
  handleDeleteProject: (id: string) => Promise<void>;
  handleExportProject: (id: string) => Promise<void>;
  handleImportProject: () => Promise<void>;
}

/** Rebuild a BufferGeometry from stored typed arrays (save/load/import). */
function geometryFromProject(positions: Float32Array, index: Uint32Array | null): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  if (index) geo.setIndex(new THREE.BufferAttribute(index, 1));
  return geo;
}

/**
 * Browser-only (IndexedDB) project library: save/open/delete plus a
 * portable-file export/import pair. Every ingest path (open, import) funnels
 * back through `commitGeometry` so normalization stays identical to file
 * load and sample templates, then layers the saved params on top.
 */
export function useProjectActions(
  state: AppState,
  setState: React.Dispatch<React.SetStateAction<AppState>>,
  commitGeometry: (geometry: THREE.BufferGeometry, fileName: string) => void,
): ProjectActions {
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [projectBusy, setProjectBusy] = useState(false);

  const refreshProjects = useCallback(() => {
    listProjects().then(setProjects);
  }, []);

  useEffect(() => { refreshProjects(); }, [refreshProjects]);

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
      setState(prev => ({ ...prev, errorMessage: err instanceof Error ? err.message : 'Could not save project.' }));
    } finally {
      setProjectBusy(false);
    }
  }, [state, projects, projectBusy, refreshProjects, setState]);

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
      setState(prev => ({ ...prev, errorMessage: err instanceof Error ? err.message : 'Could not open project.' }));
    } finally {
      setProjectBusy(false);
    }
  }, [projectBusy, commitGeometry, setState]);

  const handleDeleteProject = useCallback(async (id: string) => {
    try {
      await deleteProject(id);
      refreshProjects();
    } catch (err) {
      console.error('Delete project failed:', err);
      setState(prev => ({ ...prev, errorMessage: err instanceof Error ? err.message : 'Could not delete project.' }));
    }
  }, [refreshProjects, setState]);

  const handleExportProject = useCallback(async (id: string) => {
    try {
      const project = await getProject(id);
      if (!project) throw new Error('Project not found.');
      downloadProjectFile(project);
    } catch (err) {
      console.error('Export project failed:', err);
      setState(prev => ({ ...prev, errorMessage: err instanceof Error ? err.message : 'Could not export project.' }));
    }
  }, [setState]);

  const handleImportProject = useCallback(async () => {
    if (projectBusy) return;
    try {
      const imported = await pickProjectFile();
      if (!imported) return; // picker cancelled
      commitGeometry(geometryFromProject(imported.positions, imported.index), imported.fileName);
      setState(prev => ({ ...prev, ...imported.params, infoMessage: `Project "${imported.name}" imported.` }));
    } catch (err) {
      console.error('Import project failed:', err);
      setState(prev => ({ ...prev, errorMessage: err instanceof Error ? err.message : 'Could not import project file.' }));
    }
  }, [projectBusy, commitGeometry, setState]);

  return { projects, projectBusy, handleSaveProject, handleOpenProject, handleDeleteProject, handleImportProject, handleExportProject };
}
