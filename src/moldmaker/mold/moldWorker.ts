/// <reference lib="webworker" />
// Sirpam 3D Labs Mold — background thread for mold building.
// Solid-geometry work can take seconds; running it here keeps the 3D view
// responsive. The Manifold engine loads once and is reused for every job.
import * as THREE from 'three';
import { generateMold } from './generateMold';
import { generateSiliconeMold } from './siliconeMold';
import { suggestBestParting } from './suggestParting';
import type { MeshRepairLog } from './validateMesh';
import { serializeGeometry, collectResultTransferables, type WorkerRequest, type WorkerResponse, type MoldJob } from './workerProtocol';

const scope = self as unknown as DedicatedWorkerGlobalScope;
const reply = (res: WorkerResponse, transfer: Transferable[] = []) => scope.postMessage(res, transfer);

function rebuild(job: MoldJob): { geo: THREE.BufferGeometry; bbox: THREE.Box3 } {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(job.positions, 3));
  if (job.index) geo.setIndex(new THREE.BufferAttribute(job.index, 1));
  const bbox = new THREE.Box3(new THREE.Vector3(...job.bboxMin), new THREE.Vector3(...job.bboxMax));
  return { geo, bbox };
}

scope.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const req = ev.data;
  const id = (req as { id?: number }).id ?? -1;
  if (!['generate', 'silicone', 'suggest'].includes(req.type)) {
    reply({ type: 'error', id, message: `Unknown worker message type: ${String((req as { type: unknown }).type)}` });
    return;
  }
  try {
    const job = req.payload;
    const { geo, bbox } = rebuild(job);

    if (req.type === 'suggest') {
      const s = suggestBestParting(geo, bbox);
      reply({ type: 'suggestResult', id, payload: { axis: s.axis, offset: s.offset, cutAngle: s.cutAngle, undercut: s.undercut } });
      return;
    }

    const shared = {
      wallThicknessRatio: job.wallThicknessRatio,
      clearanceMm: job.clearanceMm,
      sprueDiameterMm: job.sprueDiameterMm,
      moldBoxShape: job.moldBoxShape,
      cutAngle: job.cutAngle,
      isHollow: job.isHollow,
      formFit: job.formFit,
      extras: job.extras,
    };
    const result: { pieces: THREE.BufferGeometry[]; repairs: MeshRepairLog; labels?: string[]; notices?: string[]; siliconeVolumeCm3?: number } =
      req.type === 'silicone'
        ? await generateSiliconeMold(geo, bbox, job.axis, job.offset, {
            ...shared,
            type: job.silicone?.type ?? 'blockTwoPart',
            siliconeMarginMm: job.silicone?.siliconeMarginMm,
            skinThicknessMm: job.silicone?.skinThicknessMm,
            includeCore: job.silicone?.includeCore,
          } as never)
        : await generateMold(geo, bbox, job.axis, job.offset, {
            ...shared,
            sprueOverride: job.sprueOverride,
            additionalPlanes: job.additionalPlanes,
          } as never);

    const res: WorkerResponse = {
      type: 'result',
      id,
      payload: {
        pieces: result.pieces.map(serializeGeometry),
        repairs: result.repairs,
        labels: result.labels,
        notices: result.notices,
        siliconeVolumeCm3: result.siliconeVolumeCm3,
      },
    };
    reply(res, collectResultTransferables(res) as Transferable[]);
  } catch (err) {
    reply({ type: 'error', id, message: err instanceof Error ? err.message : String(err) });
  }
};

export {};
