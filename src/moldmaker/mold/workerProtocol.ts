// @ts-nocheck — upstream mold-maker code; type-checked under its own repo tsconfig
import * as THREE from 'three';
import type { MoldBoxShape, SiliconeMoldType } from '../types';
import type { MeshRepairLog } from './validateMesh';

/**
 * Message protocol between the main thread and the mold-generation worker.
 *
 * BufferGeometry can't cross the postMessage boundary intact — its prototype
 * chain, internal Three.js state, and per-attribute class identity are all
 * lost. So we serialize to flat typed arrays (whose underlying ArrayBuffers
 * are transferable — zero-copy transfer), then reconstruct on the other side.
 */

export type WorkerRequest = {
  /** 'generate' = rigid two-part casting mold, 'silicone' = silicone tooling. */
  type: 'generate' | 'silicone';
  /** Client-supplied correlation id, echoed back on the response. */
  id: number;
  payload: {
    /** Flat [x,y,z, x,y,z, ...] position buffer. */
    positions: Float32Array;
    /** Optional face indices; if absent, geometry is treated as non-indexed. */
    index?: Uint32Array;
    /** Bounding box min (x,y,z). */
    bboxMin: [number, number, number];
    /** Bounding box max (x,y,z). */
    bboxMax: [number, number, number];
    /** Split axis. */
    axis: 'x' | 'y' | 'z';
    /** Normalized split offset along that axis, 0..1. */
    offset: number;
    /**
     * Tilt of the parting plane around its hinge axis, in degrees.
     * 0 = axis-aligned (the only value produced before oblique-planes shipped).
     * Range: [-30, 30]. Clamped inside generateMold.
     * Omitted → 0 (legacy behaviour).
     */
    cutAngle?: number;
    /**
     * Optional tunable overrides. Omitted fields fall back to the
     * defaults in `../mold/constants`. Kept optional so older callers
     * (and the test suite) don't break when the protocol gains fields.
     */
    wallThicknessRatio?: number;
    /**
     * Clearance between mating surfaces in absolute mm. Replaced the prior
     * `clearanceRatio` (percent-of-wall-thickness) in roadmap #13 — see
     * CLEARANCE_MM in constants.ts for the rationale.
     */
    clearanceMm?: number;
    /**
     * Sprue top-diameter in absolute mm. Drives `sprueTopRadius` directly;
     * the gate radius is derived by dividing by SPRUE_TOP_MULTIPLIER (2:1
     * taper). Omitted → SPRUE_DIAMETER_MM default.
     */
    sprueDiameterMm?: number;
    /** Outer shell shape. Omitted → 'rect' (legacy behaviour). */
    moldBoxShape?: MoldBoxShape;
    /**
     * User-specified lateral sprue position in the part's coordinate system.
     * `a` and `b` are lateral coords in the axis frame: for axis='z',
     * (a, b) = (x, y); for axis='y', (a, b) = (z, x); for axis='x',
     * (a, b) = (y, z). Omitted → automatic placement via surface centroid.
     *
     * When present, cavity verification is bypassed — the mold generator
     * respects the user's choice even if it falls in empty space. The UI
     * is responsible for warning the user in that case.
     */
    sprueOverride?: { a: number; b: number };
    /**
     * Additional parting planes applied AFTER the primary plane (axis/
     * offset/cutAngle above). Each one cuts every existing piece into two,
     * so the output `pieces` array can grow up to 2^(N+1) elements for N
     * additional planes. Omitted or empty → legacy 2-piece behavior.
     *
     * Sprue, vents, and registration pins attach ONLY to the primary
     * plane's halves — additional planes are pure topological cuts.
     */
    additionalPlanes?: Array<{
      axis: 'x' | 'y' | 'z';
      offset: number;
      cutAngle?: number;
    }>;
    /**
     * Hollow-vessel mode. When true the worker caps open boundary loops in
     * the mesh before CSG so open pots/jars don't hard-fail. Omitted → false
     * (legacy solid-part behavior). See GenerateMoldOptions.isHollow.
     */
    isHollow?: boolean;
    /**
     * Silicone-workflow parameters. Present only for `type: 'silicone'`
     * requests; ignored by the rigid path.
     */
    silicone?: {
      type: SiliconeMoldType;
      /** Silicone thickness around the master for block molds, mm. */
      siliconeMarginMm?: number;
      /** Skin thickness for skin/glove molds, mm. */
      skinThicknessMm?: number;
      /** Emit the printable core alongside the mother-mold halves. */
      includeCore?: boolean;
    };
  };
};

export type WorkerResponse =
  | {
      type: 'result';
      id: number;
      payload: {
        /**
         * Mold pieces in stable order:
         *   [0] = top half of the primary parting plane (carries sprue/vents)
         *   [1] = bottom half of the primary plane (carries pin sockets)
         *   [2..] = subdivisions from any additionalPlanes, in apply order
         *
         * Single-plane requests (no additionalPlanes) always produce a
         * 2-element array so legacy callers can destructure as
         * `const [top, bottom] = pieces`.
         */
        pieces: SerializedGeometry[];
        /** Export filename suffixes, parallel to `pieces`. Silicone path
         *  only — the rigid path leaves this undefined and callers fall
         *  back to the historical top/bottom/part_N naming. */
        labels?: string[];
        /** Estimated silicone consumption in cm³ (silicone path only). */
        siliconeVolumeCm3?: number;
        /** Mesh validation log from the pre-flight repair pass. Always
         *  present (even if no repairs were needed) so the main thread
         *  can decide whether to surface a toast. */
        repairs: MeshRepairLog;
      };
    }
  | {
      type: 'error';
      id: number;
      /** User-surfaceable error message. */
      message: string;
    };

export interface SerializedGeometry {
  positions: Float32Array;
  normals?: Float32Array;
  index?: Uint32Array;
}

/**
 * Extract the transferable ArrayBuffers out of a WorkerRequest so the
 * caller can pass them as the `transfer` arg to postMessage.
 *
 * Return type is `ArrayBufferLike[]` (= `ArrayBuffer | SharedArrayBuffer`)
 * because TypedArray.buffer resolves to that union in TS 5+. Both sides
 * of the union satisfy the Transferable protocol, so postMessage accepts
 * the array directly.
 *
 * After transfer the buffer on the sending side is detached — do not
 * touch it again.
 */
export function collectTransferables(req: WorkerRequest): ArrayBufferLike[] {
  const transfers: ArrayBufferLike[] = [req.payload.positions.buffer];
  if (req.payload.index) transfers.push(req.payload.index.buffer);
  return transfers;
}

export function collectResultTransferables(res: WorkerResponse): ArrayBufferLike[] {
  if (res.type !== 'result') return [];
  // Walk every piece — N-piece molds can carry 2..2^(planes+1) pieces.
  // Each one's positions/normals/index buffers (if present) need to be
  // listed as transferable so postMessage zero-copies them across the
  // worker boundary instead of structured-cloning megabytes of vertex data.
  const transfers: ArrayBufferLike[] = [];
  for (const piece of res.payload.pieces) {
    transfers.push(piece.positions.buffer);
    if (piece.normals) transfers.push(piece.normals.buffer);
    if (piece.index) transfers.push(piece.index.buffer);
  }
  return transfers;
}

/**
 * Serialize a BufferGeometry to plain typed arrays. We intentionally do not
 * preserve uv/color attributes — the mold halves don't need them and the
 * smaller payload keeps transfers fast.
 */
export function serializeGeometry(geo: THREE.BufferGeometry): SerializedGeometry {
  const positionAttr = geo.attributes.position;
  if (!positionAttr) {
    throw new Error('Geometry has no position attribute — cannot serialize.');
  }

  // Clone into a fresh Float32Array so we own the buffer and can transfer it.
  const positions = new Float32Array(positionAttr.array as Float32Array);

  const out: SerializedGeometry = { positions };

  const normalAttr = geo.attributes.normal;
  if (normalAttr) {
    out.normals = new Float32Array(normalAttr.array as Float32Array);
  }

  if (geo.index) {
    // Normalize index to Uint32Array so the receiver doesn't need to
    // branch on Uint16 vs Uint32.
    out.index = new Uint32Array(geo.index.array as Uint16Array | Uint32Array);
  }

  return out;
}

/**
 * Reconstruct a BufferGeometry from a serialized payload. The typed arrays
 * passed in are assumed to be owned by the caller after transfer.
 */
export function deserializeGeometry(s: SerializedGeometry): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(s.positions, 3));
  if (s.normals) {
    geo.setAttribute('normal', new THREE.BufferAttribute(s.normals, 3));
  }
  if (s.index) {
    geo.setIndex(new THREE.BufferAttribute(s.index, 1));
  }
  return geo;
}
