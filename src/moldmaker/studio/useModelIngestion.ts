// Sirpam 3D Labs Mold — file picker, drag-drop, sample templates, and AI handoff ingest.
import { useCallback, useEffect } from 'react';
import type * as THREE from 'three';
import type { AppState } from './state';
import { loadFile, parseFile } from '../utils/fileLoader';
import { buildSampleTemplate, SAMPLE_TEMPLATES, type SampleTemplateId } from '../utils/sampleTemplates';
import { buildFromSpec } from '../mold/modelTools';
import { takeAiHandoff } from '@/lib/aiHandoff';

export { SAMPLE_TEMPLATES };
export type { SampleTemplateId };

export interface ModelIngestion {
  handleFileLoad: () => Promise<void>;
  loadTemplate: (id: SampleTemplateId) => void;
  handleLoadSample: () => void;
  handleDrop: (e: React.DragEvent) => Promise<void>;
  handleDragOver: (e: React.DragEvent) => void;
}

/**
 * All the ways a model gets into the Studio: the native file picker,
 * drag-and-drop onto the viewport, the built-in sample templates, and a
 * one-shot handoff from the AI Model Maker page. Every path funnels through
 * `commitGeometry` so normalization (center, bbox, vertex normals) and
 * state-reset semantics never drift between entry points.
 */
export function useModelIngestion(
  commitGeometry: (geometry: THREE.BufferGeometry, fileName: string) => void,
  setState: React.Dispatch<React.SetStateAction<AppState>>,
): ModelIngestion {
  const handleFileLoad = useCallback(async () => {
    try {
      const result = await loadFile();
      if (!result) return; // user canceled — not an error, not a telemetry event
      commitGeometry(result.geometry, result.fileName);
    } catch (err) {
      console.error('File load failed:', err);
      setState(prev => ({ ...prev, errorMessage: err instanceof Error ? err.message : 'Failed to load file.' }));
    }
  }, [commitGeometry, setState]);

  const loadTemplate = useCallback((id: SampleTemplateId) => {
    try {
      const { geometry, fileName } = buildSampleTemplate(id);
      commitGeometry(geometry, fileName);
      if (id === 'candle') setState(prev => ({ ...prev, tier2: { ...prev.tier2, castingMaterial: 'wax', corePinMm: 3 } }));
      if (id === 'soap') setState(prev => ({ ...prev, tier2: { ...prev.tier2, castingMaterial: 'soap' } }));
    } catch (err) {
      console.error('Sample load failed:', err);
      setState(prev => ({ ...prev, errorMessage: err instanceof Error ? err.message : 'Failed to load sample.' }));
    }
  }, [commitGeometry, setState]);

  const handleLoadSample = useCallback(() => loadTemplate('mushroom'), [loadTemplate]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    try {
      const result = await parseFile(file);
      commitGeometry(result.geometry, result.fileName);
    } catch (err) {
      console.error('Drop-load failed:', err);
      setState(prev => ({ ...prev, errorMessage: err instanceof Error ? err.message : 'Failed to load dropped file.' }));
    }
  }, [commitGeometry, setState]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  // Model handed over from the AI Model Maker page — consumed once on mount.
  useEffect(() => {
    const h = takeAiHandoff();
    if (!h) return;
    buildFromSpec(h.spec).then(g => commitGeometry(g, h.name)).catch(() => { /* ignore */ });
  }, [commitGeometry]);

  return { handleFileLoad, loadTemplate, handleLoadSample, handleDrop, handleDragOver };
}
