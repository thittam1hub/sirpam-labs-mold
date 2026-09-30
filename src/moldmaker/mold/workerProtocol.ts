// Sirpam 3D Labs Mold — messages between the Studio and the mold worker.
// Meshes travel as flat typed arrays whose buffers are transferred (moved,
// not copied) across the thread boundary.
import * as THREE from 'three';
import type { Axis, MoldBoxShape, SiliconeMoldType } from '../types';
import type { MeshRepairLog } from './validateMesh';
import type { MoldExtras } from './moldFeatures';

type V3 = [number, number, number];

export interface MoldJob {
  positions: Float32Array;
  index?: Uint32Array;
  bboxMin: V3;
  bboxMax: V3;
  axis: Axis;
  offset: number;
  cutAngle?: number;
  wallThicknessRatio?: number;
  clearanceMm?: number;
  sprueDiameterMm?: number;
  moldBoxShape?: MoldBoxShape;
  sprueOverride?: { a: number; b: number };
  additionalPlanes?: Array<{ axis: Axis; offset: number; cutAngle?: number }>;
  isHollow?: boolean;
  formFit?: boolean;
  extras?: MoldExtras;
  silicone?: {
    type: SiliconeMoldType;
    siliconeMarginMm?: number;
    skinThicknessMm?: number;
    includeCore?: boolean;
  };
}

export type WorkerRequest = {
  /** generate = rigid mold, silicone = silicone tooling, suggest = split advisor. */
  type: 'generate' | 'silicone' | 'suggest';
  id: number;
  payload: MoldJob;
};

export interface SerializedGeometry {
  positions: Float32Array;
  normals?: Float32Array;
  index?: Uint32Array;
}

export type WorkerResponse =
  | {
      type: 'result';
      id: number;
      payload: {
        pieces: SerializedGeometry[];
        labels?: string[] | undefined;
        notices?: string[] | undefined;
        siliconeVolumeCm3?: number | undefined;
        repairs: MeshRepairLog;
      };
    }
  | { type: 'suggestResult'; id: number; payload: { axis: Axis; offset: number; cutAngle: number; undercut: number } }
  | { type: 'error'; id: number; message: string };

export function collectTransferables(req: WorkerRequest): ArrayBufferLike[] {
  return [req.payload.positions.buffer, ...(req.payload.index ? [req.payload.index.buffer] : [])];
}

export function collectResultTransferables(res: WorkerResponse): ArrayBufferLike[] {
  if (res.type !== 'result') return [];
  return res.payload.pieces.flatMap(p => [p.positions, p.normals, p.index].filter(Boolean).map(a => a!.buffer));
}

/** Copy a geometry's arrays into standalone typed arrays safe to transfer. */
export function serializeGeometry(g: THREE.BufferGeometry): SerializedGeometry {
  const pos = g.getAttribute('position');
  if (!pos) throw new Error('This piece has no shape data.');
  const out: SerializedGeometry = { positions: Float32Array.from(pos.array as ArrayLike<number>) };
  const nrm = g.getAttribute('normal');
  if (nrm) out.normals = Float32Array.from(nrm.array as ArrayLike<number>);
  if (g.index) out.index = Uint32Array.from(g.index.array as ArrayLike<number>);
  return out;
}

export function deserializeGeometry(s: SerializedGeometry): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(s.positions, 3));
  if (s.normals) g.setAttribute('normal', new THREE.BufferAttribute(s.normals, 3));
  if (s.index) g.setIndex(new THREE.BufferAttribute(s.index, 1));
  return g;
}
