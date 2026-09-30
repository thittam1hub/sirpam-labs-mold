// Sirpam 3D Labs Mold — STEP (ISO 10303-21) export for CAD apps.
// Each triangle becomes a planar B-rep face; OpenCascade sews them into one
// shell and writes the STEP text. OpenCascade (LGPL-2.1) is a separate,
// lazily-downloaded module that only loads when someone asks for STEP.
/* eslint-disable @typescript-eslint/no-explicit-any -- OpenCascade has no typings here */
import * as THREE from 'three';

export interface ExportStepOptions {
  /** Sewing tolerance in model units. */
  tolerance?: number;
  /** Refuse meshes larger than this (B-rep per triangle is heavy). */
  maxTriangles?: number;
}

/** Error codes, translated for users in stepExportErrors.ts. */
export class StepExportError extends Error {
  constructor(public code: 'empty' | 'tooMany' | 'download' | 'badFace' | 'sewFailed', message: string) {
    super(message);
    this.name = 'StepExportError';
  }
}

let occ: Promise<any> | null = null;

export function getOCP(): Promise<any> {
  if (!occ) {
    occ = (async () => {
      const mod: any = await import('opencascade.js/dist/opencascade.wasm.js');
      const url = new URL('../../../node_modules/opencascade.js/dist/opencascade.wasm.wasm', import.meta.url);
      const res = await fetch(url.href);
      if (!res.ok) throw new StepExportError('download', `CAD engine download failed (${res.status} ${res.statusText})`);
      return mod.default({ wasmBinary: await res.arrayBuffer() });
    })();
    occ.catch(() => { occ = null; });
  }
  return occ;
}

export async function exportSTEP(geometry: THREE.BufferGeometry, options: ExportStepOptions = {}): Promise<ArrayBuffer> {
  const tol = options.tolerance ?? 1e-3;
  const limit = options.maxTriangles ?? 100_000;
  const src = geometry.index ? geometry.toNonIndexed() : geometry;
  const p = src.getAttribute('position').array as ArrayLike<number>;
  const tris = Math.floor(p.length / 9);
  if (tris === 0) throw new StepExportError('empty', 'Mesh has no triangles');
  if (tris > limit) throw new StepExportError('tooMany', `${tris} triangles (limit ${limit})`);

  const oc = await getOCP();
  // Sewing flags: stitch by parameters, split at T-junctions, merge equal points, manifold output.
  const sew = new oc.BRepBuilderAPI_Sewing(tol, true, true, true, false);
  const pt = (i: number) => new oc.gp_Pnt_3(p[i]!, p[i + 1]!, p[i + 2]!);
  for (let t = 0; t < tris; t++) {
    const a = pt(9 * t), b = pt(9 * t + 3), c = pt(9 * t + 6);
    const wire = new oc.BRepBuilderAPI_MakeWire_4(
      new oc.BRepBuilderAPI_MakeEdge_3(a, b).Edge(),
      new oc.BRepBuilderAPI_MakeEdge_3(b, c).Edge(),
      new oc.BRepBuilderAPI_MakeEdge_3(c, a).Edge(),
    ).Wire();
    const face = new oc.BRepBuilderAPI_MakeFace_15(wire, true).Face();
    if (face.IsNull()) throw new StepExportError('badFace', `Triangle ${t} could not be turned into a face`);
    sew.Add(face);
  }
  sew.Perform(new oc.Handle_Message_ProgressIndicator_1());
  const shape = sew.SewedShape();
  if (!shape || shape.IsNull()) throw new StepExportError('sewFailed', 'Faces could not be joined into a surface');

  const writer = new oc.STEPControl_Writer_1();
  writer.Transfer(shape, oc.STEPControl_StepModelType.STEPControl_AsIs, true);
  const file = '/mold.step';
  writer.Write(file);
  const bytes: Uint8Array = oc.FS.readFile(file);
  oc.FS.unlink(file);
  return bytes.slice().buffer;
}
