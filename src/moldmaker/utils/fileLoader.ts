// Sirpam 3D Labs Mold — open STL / OBJ files from the user's device.
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const MAX_FILE_MB = 200;
export const MAX_TRIANGLES = 2_000_000;

export interface LoadedModel {
  geometry: THREE.BufferGeometry;
  fileName: string;
}

/** Flatten every mesh in an OBJ scene into one position-only geometry. */
function objToGeometry(root: THREE.Group): THREE.BufferGeometry {
  root.updateMatrixWorld(true);
  const parts: THREE.BufferGeometry[] = [];
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh) || !node.geometry?.getAttribute('position')) return;
    const g = new THREE.BufferGeometry();
    const src = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry;
    g.setAttribute('position', src.getAttribute('position').clone());
    g.applyMatrix4(node.matrixWorld);
    parts.push(g);
  });
  if (parts.length === 0) return new THREE.BufferGeometry();
  if (parts.length === 1) return parts[0]!;
  return mergeGeometries(parts, false) ?? parts[0]!;
}

/** Parse raw file bytes by extension. */
export function parseModel(data: ArrayBuffer, fileName: string): LoadedModel {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (ext !== 'stl' && ext !== 'obj') {
    throw new Error(`Unsupported file type: .${ext || '(none)'} — please use an .stl or .obj file.`);
  }
  try {
    const geometry = ext === 'stl'
      ? new STLLoader().parse(data)
      : objToGeometry(new OBJLoader().parse(new TextDecoder().decode(data)));
    return { geometry, fileName };
  } catch (e) {
    throw new Error(`We couldn't read ${fileName}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** Read a dropped/picked File with size and triangle limits. */
export async function parseFile(file: File): Promise<LoadedModel> {
  if (file.size === 0) throw new Error(`${file.name} is empty — check the file was exported fully.`);
  const mb = file.size / 1048576;
  if (mb > MAX_FILE_MB) {
    throw new Error(`${file.name} is ${mb.toFixed(0)} MB — the limit is ${MAX_FILE_MB} MB. Export with less detail (binary STL is about 5× smaller) and try again.`);
  }
  const out = parseModel(await file.arrayBuffer(), file.name);
  const pos = out.geometry.getAttribute('position');
  if (!pos || pos.count < 3) throw new Error(`${file.name} has no 3D shape in it — check you exported the model, not an empty scene.`);
  const tris = (out.geometry.index?.count ?? pos.count) / 3;
  if (tris > MAX_TRIANGLES) {
    throw new Error(`${file.name} has ${(tris / 1e6).toFixed(1)} million triangles — the limit is ${MAX_TRIANGLES / 1e6} million. Reduce the detail first; molds rarely need more than 500,000.`);
  }
  return out;
}

/** Show the browser's file picker. Resolves null if the user cancels. */
export function loadFile(): Promise<LoadedModel | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.stl,.obj';
    input.addEventListener('change', () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      parseFile(f).then(resolve, reject);
    });
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}
