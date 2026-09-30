// Sirpam 3D Labs Mold — core geometry lifecycle: state, commit/replace/undo, disposal.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { initialAppState, type AppState } from './state';

export interface StudioState {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  /** Largest bbox side at print scale; a change re-frames the 3D camera. */
  modelFitSize: number | undefined;
  /** Normalize + commit a freshly loaded/parsed geometry, resetting all other state. */
  commitGeometry: (geometry: THREE.BufferGeometry, fileName: string) => void;
  /** Swap the master geometry in place (model-prep tools) while keeping settings. */
  replaceModel: (geometry: THREE.BufferGeometry, note: string) => void;
  /** Undo the last replaceModel call, if any. */
  undoModel: () => void;
  canUndo: boolean;
}

/**
 * Owns AppState plus the geometry ingest/replace/undo lifecycle shared by
 * the file picker, drag-drop, sample templates, saved projects, and the
 * model-prep tools. Also disposes GPU-side buffers (BufferGeometry isn't
 * garbage collected) whenever the geometry or mold-pieces references change.
 */
export function useStudioState(): StudioState {
  const [state, setState] = useState<AppState>(initialAppState);

  useEffect(() => {
    const g = state.originalGeometry;
    return () => { g?.dispose(); };
  }, [state.originalGeometry]);

  useEffect(() => {
    const pieces = state.moldPieces;
    return () => { pieces.forEach(p => p.dispose()); };
  }, [state.moldPieces]);

  const modelFitSize = useMemo(() => {
    if (!state.boundingBox) return undefined;
    const v = state.boundingBox.getSize(new THREE.Vector3());
    return Math.max(v.x, v.y, v.z) * state.scale;
  }, [state.boundingBox, state.scale]);

  const commitGeometry = useCallback((geometry: THREE.BufferGeometry, fileName: string) => {
    geometry.computeBoundingBox();
    geometry.center();
    geometry.computeVertexNormals();
    const bbox = geometry.boundingBox!.clone();
    setState({
      ...initialAppState,
      originalGeometry: geometry,
      fileName,
      boundingBox: bbox,
      showOriginal: true,
    });
  }, []);

  const undoGeo = useRef<THREE.BufferGeometry | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  const replaceModel = useCallback((geometry: THREE.BufferGeometry, note: string) => {
    setState(prev => {
      undoGeo.current = prev.originalGeometry;
      geometry.computeBoundingBox();
      geometry.computeVertexNormals();
      return {
        ...prev,
        originalGeometry: geometry,
        boundingBox: geometry.boundingBox!.clone(),
        moldGenerated: false,
        moldPieces: [],
        generatedParams: null,
        showOriginal: true,
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
    setState(prev => ({
      ...prev,
      originalGeometry: g,
      boundingBox: g.boundingBox!.clone(),
      moldGenerated: false,
      moldPieces: [],
      generatedParams: null,
      showOriginal: true,
      infoMessage: 'Model change undone.',
    }));
  }, []);

  return { state, setState, modelFitSize, commitGeometry, replaceModel, undoModel, canUndo };
}
