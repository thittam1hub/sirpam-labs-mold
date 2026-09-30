// Sirpam 3D Labs Mold — React hook that talks to the mold and STEP workers
// and handles downloads. Heavy geometry work never runs on the page thread.
import { useCallback, useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { MoldExtras } from '../mold/moldFeatures';
import type { Axis, MoldBoxShape } from '../types';
import { autoDetectPlane as autoDetectPlaneImpl } from '../mold/generateMold';
import type { SuggestResult } from '../mold/suggestParting';
import { exportSTL, exportOBJ, export3MF } from '../mold/exporters';
import { collectTransferables, deserializeGeometry, type WorkerRequest, type WorkerResponse } from '../mold/workerProtocol';
import type { MeshRepairLog } from '../mold/validateMesh';
import {
  collectRequestTransferables as stepTransferables,
  type StepExportRequest,
  type StepExportResponse,
} from '../mold/stepExportProtocol';

export { EXPLODE_OFFSET_RATIO } from '../mold/constants';

type CommonOptions = {
  wallThicknessRatio?: number | undefined;
  clearanceMm?: number | undefined;
  sprueDiameterMm?: number | undefined;
  moldBoxShape?: MoldBoxShape | undefined;
  cutAngle?: number | undefined;
  isHollow?: boolean | undefined;
  formFit?: boolean | undefined;
  extras?: MoldExtras | undefined;
};

/** Copy the model into fresh buffers (they are handed over to the worker). */
function meshPayload(geometry: THREE.BufferGeometry, box: THREE.Box3) {
  const pos = geometry.getAttribute('position');
  if (!pos) throw new Error('Geometry has no position attribute.');
  return {
    positions: new Float32Array(pos.array as ArrayLike<number>),
    index: geometry.index ? new Uint32Array(geometry.index.array as ArrayLike<number>) : undefined,
    bboxMin: [box.min.x, box.min.y, box.min.z] as [number, number, number],
    bboxMax: [box.max.x, box.max.y, box.max.z] as [number, number, number],
  };
}

/** Send one request and wait for the reply with the matching id. */
function ask<Res extends { id: number }>(worker: Worker, id: number, msg: unknown, transfer: Transferable[], crashText: string) {
  return new Promise<Res>((resolve, reject) => {
    const done = () => { worker.removeEventListener('message', onMsg); worker.removeEventListener('error', onErr); };
    const onMsg = (ev: MessageEvent<Res>) => { if (ev.data.id === id) { done(); resolve(ev.data); } };
    const onErr = (ev: ErrorEvent) => { done(); reject(new Error(ev.message || crashText)); };
    worker.addEventListener('message', onMsg);
    worker.addEventListener('error', onErr);
    worker.postMessage(msg, transfer);
  });
}

export function useMoldGenerator() {
  const moldWorker = useRef<Worker | null>(null);
  const stepWorker = useRef<Worker | null>(null);
  const nextId = useRef(0);
  const stepCancel = useRef<{ cancelled: boolean; reject: ((e: Error) => void) | null }>({ cancelled: false, reject: null });

  const getMoldWorker = useCallback(() => (moldWorker.current ??= new Worker(new URL('../mold/moldWorker.ts', import.meta.url), { type: 'module' })), []);
  const getStepWorker = useCallback(() => (stepWorker.current ??= new Worker(new URL('../mold/stepExportWorker.ts', import.meta.url), { type: 'module' })), []);

  useEffect(() => () => {
    moldWorker.current?.terminate(); moldWorker.current = null;
    stepWorker.current?.terminate(); stepWorker.current = null;
  }, []);

  const runMold = useCallback(async (req: WorkerRequest) => {
    const res = await ask<WorkerResponse>(getMoldWorker(), req.id, req, collectTransferables(req) as Transferable[], 'Mold worker crashed');
    if (res.type === 'error') throw new Error(res.message);
    return res;
  }, [getMoldWorker]);

  const generateMold = useCallback(async (
    geometry: THREE.BufferGeometry, boundingBox: THREE.Box3, axis: Axis, offset: number,
    options: CommonOptions & {
      sprueOverride?: { a: number; b: number } | undefined;
      additionalPlanes?: Array<{ axis: Axis; offset: number; cutAngle?: number | undefined }> | undefined;
    } = {},
  ): Promise<{ pieces: THREE.BufferGeometry[]; repairs: MeshRepairLog; notices?: string[] | undefined }> => {
    const req = { type: 'generate', id: ++nextId.current, payload: { ...meshPayload(geometry, boundingBox), axis, offset, ...options } } as WorkerRequest;
    const res = await runMold(req);
    if (res.type !== 'result') throw new Error('Unexpected reply from mold worker');
    return { pieces: res.payload.pieces.map(deserializeGeometry), repairs: res.payload.repairs, notices: res.payload.notices };
  }, [runMold]);

  const generateSilicone = useCallback(async (
    geometry: THREE.BufferGeometry, boundingBox: THREE.Box3, axis: Axis, offset: number,
    options: CommonOptions & {
      siliconeType: 'blockOneWay' | 'blockTwoPart' | 'skinCore';
      siliconeMarginMm?: number | undefined; skinThicknessMm?: number | undefined; includeCore?: boolean | undefined;
    },
  ): Promise<{ pieces: THREE.BufferGeometry[]; labels: string[]; repairs: MeshRepairLog; siliconeVolumeCm3: number }> => {
    const { siliconeType, siliconeMarginMm, skinThicknessMm, includeCore, ...common } = options;
    const req = {
      type: 'silicone', id: ++nextId.current,
      payload: { ...meshPayload(geometry, boundingBox), axis, offset, ...common, silicone: { type: siliconeType, siliconeMarginMm, skinThicknessMm, includeCore } },
    } as WorkerRequest;
    const res = await runMold(req);
    if (res.type !== 'result') throw new Error('Unexpected reply from mold worker');
    return {
      pieces: res.payload.pieces.map(deserializeGeometry),
      labels: res.payload.labels ?? [],
      repairs: res.payload.repairs,
      siliconeVolumeCm3: res.payload.siliconeVolumeCm3 ?? 0,
    };
  }, [runMold]);

  const autoDetectPlane = useCallback(autoDetectPlaneImpl, []);

  const suggestParting = useCallback(async (geometry: THREE.BufferGeometry, boundingBox: THREE.Box3): Promise<SuggestResult> => {
    const req = { type: 'suggest', id: ++nextId.current, payload: { ...meshPayload(geometry, boundingBox), axis: 'z', offset: 0.5 } } as WorkerRequest;
    const res = await runMold(req);
    if (res.type !== 'suggestResult') throw new Error('Unexpected reply from mold worker');
    const { axis, offset, cutAngle, undercut } = res.payload;
    return { axis, offset, cutAngle, undercut, evaluated: 45 };
  }, [runMold]);

  const exportStep = useCallback(async (geo: THREE.BufferGeometry): Promise<ArrayBuffer> => {
    const flat = geo.index ? geo.toNonIndexed() : geo;
    const positions = new Float32Array(flat.getAttribute('position').array as ArrayLike<number>);
    if (flat !== geo) flat.dispose();
    const req: StepExportRequest = { type: 'export', id: ++nextId.current, payload: { positions } };
    const res = await new Promise<StepExportResponse>((resolve, reject) => {
      stepCancel.current.reject = reject;
      ask<StepExportResponse>(getStepWorker(), req.id, req, stepTransferables(req) as Transferable[], 'STEP export worker crashed').then(resolve, reject);
    }).finally(() => { stepCancel.current.reject = null; });
    if (res.type === 'error') throw Object.assign(new Error(res.message), { code: res.code });
    return res.stepBuffer;
  }, [getStepWorker]);

  const cancelStepExport = useCallback(() => {
    stepCancel.current.cancelled = true;
    stepWorker.current?.terminate();
    stepWorker.current = null;
    stepCancel.current.reject?.(new Error('Export cancelled'));
    stepCancel.current.reject = null;
  }, []);

  const exportFiles = useCallback(async (
    pieces: THREE.BufferGeometry[], fileName: string, format: 'stl' | 'obj' | '3mf' | 'step', scale = 1, labels?: string[],
  ) => {
    const base = fileName.replace(/\.[^.]+$/, '') || 'mold';
    const nameFor = (i: number) => labels?.[i] || (pieces.length === 2 ? (i === 0 ? 'top' : 'bottom') : `part_${i + 1}`);
    if (format === 'step') stepCancel.current.cancelled = false;

    for (let i = 0; i < pieces.length; i++) {
      const src = pieces[i]!;
      const geo = scale === 1 ? src : src.clone().applyMatrix4(new THREE.Matrix4().makeScale(scale, scale, scale));
      try {
        const data =
          format === 'obj' ? exportOBJ(geo)
          : format === '3mf' ? await export3MF(geo)
          : format === 'step' ? await exportStep(geo)
          : exportSTL(geo);
        const url = URL.createObjectURL(new Blob([data], { type: 'application/octet-stream' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `${base}_${nameFor(i)}.${format}`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      } finally {
        if (geo !== src) geo.dispose();
      }
      if (format === 'step' && stepCancel.current.cancelled) throw new Error('Export cancelled');
      // Browsers block rapid multiple downloads; space them out.
      if (i < pieces.length - 1) await new Promise(r => setTimeout(r, 500));
    }
  }, [exportStep]);

  return { generateMold, generateSilicone, exportFiles, cancelStepExport, autoDetectPlane, suggestParting };
}

export type { Axis };
