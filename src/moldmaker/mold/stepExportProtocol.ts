// Sirpam 3D Labs Mold — messages for the STEP export worker.

export type StepExportRequest = {
  type: 'export';
  id: number;
  payload: { positions: Float32Array; tolerance?: number; maxTriangles?: number };
};

export type StepExportResponse =
  | { type: 'result'; id: number; stepBuffer: ArrayBuffer }
  | { type: 'error'; id: number; message: string; code?: string };

export const collectRequestTransferables = (req: StepExportRequest): ArrayBufferLike[] => [req.payload.positions.buffer];

export const collectResponseTransferables = (res: StepExportResponse): ArrayBufferLike[] =>
  res.type === 'result' ? [res.stepBuffer] : [];
