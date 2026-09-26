// @ts-nocheck — upstream mold-maker code; type-checked under its own repo tsconfig
/// <reference lib="webworker" />
import * as THREE from 'three';
import { generateMold } from './generateMold';
import { generateSiliconeMold } from './siliconeMold';
import { suggestBestParting } from './suggestParting';
import {
  deserializeGeometry,
  serializeGeometry,
  collectResultTransferables,
  type WorkerRequest,
  type WorkerResponse,
} from './workerProtocol';

/**
 * Dedicated worker that runs Manifold CSG off the UI thread.
 *
 * Why: generateMold can hang for several seconds on complex models —
 * enough to trigger "page unresponsive" dialogs in Chromium. Moving it
 * here keeps the React render loop smooth and lets the three.js preview
 * (orbit, camera drag) stay responsive during generation.
 *
 * Lifetime: one worker instance per useMoldGenerator hook. The Manifold
 * WASM module loads lazily on the first `generate` message and persists
 * for subsequent generations — we pay the WASM init cost once.
 */

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const req = ev.data;
  if (req.type !== 'generate' && req.type !== 'silicone' && req.type !== 'suggest') {
    // Unknown message — reply with a structured error so the main thread
    // doesn't silently stall waiting on a response.
    const res: WorkerResponse = {
      type: 'error',
      id: (req as { id?: number }).id ?? -1,
      message: `Unknown worker message type: ${(req as { type: string }).type}`,
    };
    ctx.postMessage(res);
    return;
  }

  try {
    // Rehydrate the BufferGeometry from flat typed arrays.
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.BufferAttribute(req.payload.positions, 3),
    );
    if (req.payload.index) {
      geo.setIndex(new THREE.BufferAttribute(req.payload.index, 1));
    }

    const bbox = new THREE.Box3(
      new THREE.Vector3(...req.payload.bboxMin),
      new THREE.Vector3(...req.payload.bboxMax),
    );

    // Three pipelines share this worker: rigid two-part casting molds, the
    // silicone tooling workflows, and the split advisor. All are Manifold
    // WASM / draft-math over the same singletons, so keeping them in one
    // worker means one init and no risk of concurrent CSG graphs.
    if (req.type === 'suggest') {
      // Advisor sweep: pure draft-math over the mesh — no CSG, no WASM.
      const suggestion = suggestBestParting(geo, bbox);
      const res: WorkerResponse = {
        type: 'suggestResult',
        id: req.id,
        payload: {
          axis: suggestion.axis,
          offset: suggestion.offset,
          cutAngle: suggestion.cutAngle,
          undercut: suggestion.undercut,
        },
      };
      ctx.postMessage(res);
      return;
    }

    const result = req.type === 'silicone'
      ? await generateSiliconeMold(
          geo,
          bbox,
          req.payload.axis,
          req.payload.offset,
          {
            type: req.payload.silicone?.type ?? 'blockTwoPart',
            siliconeMarginMm: req.payload.silicone?.siliconeMarginMm,
            skinThicknessMm: req.payload.silicone?.skinThicknessMm,
            includeCore: req.payload.silicone?.includeCore,
            wallThicknessRatio: req.payload.wallThicknessRatio,
            clearanceMm: req.payload.clearanceMm,
            sprueDiameterMm: req.payload.sprueDiameterMm,
            moldBoxShape: req.payload.moldBoxShape,
            cutAngle: req.payload.cutAngle,
            isHollow: req.payload.isHollow,
            formFit: req.payload.formFit,
            extras: req.payload.extras,
          },
        )
      : await generateMold(
          geo,
          bbox,
          req.payload.axis,
          req.payload.offset,
          {
            wallThicknessRatio: req.payload.wallThicknessRatio,
            clearanceMm: req.payload.clearanceMm,
            sprueDiameterMm: req.payload.sprueDiameterMm,
            moldBoxShape: req.payload.moldBoxShape,
            cutAngle: req.payload.cutAngle,
            sprueOverride: req.payload.sprueOverride,
            additionalPlanes: req.payload.additionalPlanes,
            isHollow: req.payload.isHollow,
            formFit: req.payload.formFit,
            extras: req.payload.extras,
          },
        );

    const res: WorkerResponse = {
      type: 'result',
      id: req.id,
      payload: {
        pieces: result.pieces.map(serializeGeometry),
        repairs: result.repairs,
        labels: (result as { labels?: string[] }).labels,
        siliconeVolumeCm3: (result as { siliconeVolumeCm3?: number }).siliconeVolumeCm3,
      },
    };

    ctx.postMessage(res, collectResultTransferables(res));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const res: WorkerResponse = {
      type: 'error',
      id: req.id,
      message,
    };
    ctx.postMessage(res);
  }
};

export {};
