/// <reference lib="webworker" />
// Sirpam 3D Labs Mold — background thread for STEP export. Kept separate from
// the mold worker so the large CAD engine only loads when STEP is requested,
// and so a stuck export can be cancelled by terminating just this worker.
import * as THREE from 'three';
import { exportSTEP, StepExportError } from './stepExporter';
import { collectResponseTransferables, type StepExportRequest, type StepExportResponse } from './stepExportProtocol';

const scope = self as unknown as DedicatedWorkerGlobalScope;
let activeId = -1;

function fail(id: number, err: unknown) {
  const res: StepExportResponse = {
    type: 'error',
    id,
    message: err instanceof Error ? err.message : typeof err === 'string' ? err : 'CAD export engine crashed',
    ...(err instanceof StepExportError ? { code: err.code } : {}),
  };
  scope.postMessage(res);
}

scope.onmessage = async (ev: MessageEvent<StepExportRequest>) => {
  const req = ev.data;
  if (req.type !== 'export') {
    fail((req as { id?: number }).id ?? -1, `Unknown STEP worker message: ${String((req as { type: unknown }).type)}`);
    return;
  }
  activeId = req.id;
  try {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(req.payload.positions, 3));
    const opts: { tolerance?: number; maxTriangles?: number } = {};
    if (req.payload.tolerance !== undefined) opts.tolerance = req.payload.tolerance;
    if (req.payload.maxTriangles !== undefined) opts.maxTriangles = req.payload.maxTriangles;
    const stepBuffer = await exportSTEP(geo, opts);
    const res: StepExportResponse = { type: 'result', id: req.id, stepBuffer };
    scope.postMessage(res, collectResponseTransferables(res) as Transferable[]);
  } catch (err) {
    fail(req.id, err);
  } finally {
    activeId = -1;
  }
};

// Crashes inside the WASM engine surface as global errors — report them.
scope.addEventListener('error', ev => { ev.preventDefault(); fail(activeId, ev.message || 'CAD export engine crashed'); });
scope.addEventListener('unhandledrejection', ev => { ev.preventDefault(); fail(activeId, ev.reason); });

export {};
