// Sirpam 3D Labs Mold — file writers for printing: binary STL, OBJ and 3MF.
// STEP (for CAD) lives in stepExporter.ts and runs in its own worker.
import * as THREE from 'three';

/** Triangle-soup positions (and normals, if present) for any geometry. */
function soup(g: THREE.BufferGeometry): { pos: ArrayLike<number>; nrm: ArrayLike<number> | undefined } {
  const s = g.index ? g.toNonIndexed() : g;
  return { pos: s.getAttribute('position').array as ArrayLike<number>, nrm: s.getAttribute('normal')?.array as ArrayLike<number> | undefined };
}

/**
 * Binary STL: 80-byte header, uint32 triangle count, then per triangle
 * 12 floats (normal + 3 corners) and a 2-byte attribute field.
 */
export function exportSTL(geometry: THREE.BufferGeometry): ArrayBuffer {
  const { pos, nrm } = soup(geometry);
  const tris = Math.floor(pos.length / 9);
  const buf = new ArrayBuffer(84 + tris * 50);
  const v = new DataView(buf);
  const header = new TextEncoder().encode('Sirpam 3D Labs Mold - binary STL');
  new Uint8Array(buf, 0, 80).set(header.subarray(0, 80));
  v.setUint32(80, tris, true);
  let o = 84;
  for (let t = 0; t < tris; t++) {
    const i = t * 9;
    const n = nrm ? [nrm[i]!, nrm[i + 1]!, nrm[i + 2]!] : [0, 0, 1];
    for (const c of n) { v.setFloat32(o, c, true); o += 4; }
    for (let k = 0; k < 9; k++) { v.setFloat32(o, pos[i + k]!, true); o += 4; }
    o += 2; // attribute byte count, left 0
  }
  return buf;
}

/** Wavefront OBJ with one vertex per triangle corner. */
export function exportOBJ(geometry: THREE.BufferGeometry): ArrayBuffer {
  const { pos } = soup(geometry);
  const n = Math.floor(pos.length / 3);
  const out: string[] = ['# Sirpam 3D Labs Mold'];
  for (let i = 0; i < n; i++) out.push(`v ${pos[3 * i]} ${pos[3 * i + 1]} ${pos[3 * i + 2]}`);
  for (let i = 1; i <= n; i += 3) out.push(`f ${i} ${i + 1} ${i + 2}`);
  return new TextEncoder().encode(out.join('\n') + '\n').buffer as ArrayBuffer;
}

/** Escape a string for use inside an XML attribute. */
export function xmlAttr(value: string): string {
  return value.replace(/[&"<>]/g, c => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' })[c]!);
}

/** 3MF package (ZIP) holding a single mesh object, units in millimetres. */
export async function export3MF(geometry: THREE.BufferGeometry): Promise<ArrayBuffer> {
  const { pos } = soup(geometry);
  const n = Math.floor(pos.length / 3);
  const verts: string[] = [];
  const tris: string[] = [];
  for (let i = 0; i < n; i++) verts.push(`<vertex x="${pos[3 * i]}" y="${pos[3 * i + 1]}" z="${pos[3 * i + 2]}"/>`);
  for (let i = 0; i < n; i += 3) tris.push(`<triangle v1="${i}" v2="${i + 1}" v3="${i + 2}"/>`);
  const model = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<model unit="${xmlAttr('millimeter')}" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">`,
    '<resources><object id="1" type="model"><mesh>',
    `<vertices>${verts.join('')}</vertices>`,
    `<triangles>${tris.join('')}</triangles>`,
    '</mesh></object></resources>',
    '<build><item objectid="1"/></build>',
    '</model>',
  ].join('\n');
  const types = '<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/></Types>';
  const rels = '<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>';
  const { createZip } = await import('../utils/minizip');
  return createZip({ '[Content_Types].xml': types, '_rels/.rels': rels, '3D/3dmodel.model': model });
}
