// Sirpam 3D Labs Mold — saved projects. Stored in the browser (IndexedDB) and
// exportable as a single .sirpam.json file. Names/keys stay stable so
// projects people already saved keep loading.
import type { Tier2Settings } from '../components/AdvancedMoldPanel';

const DB = 'sirpam-mold-projects';
const STORE = 'projects';
const FILE_APP = 'sirpam-mold-project';
const FILE_VERSION = 1;

type Ax = 'x' | 'y' | 'z';

export interface ProjectParams {
  axis: Ax;
  planeOffset: number;
  cutAngle: number;
  wallThicknessRatio: number;
  clearanceMm: number;
  sprueDiameterMm: number;
  moldBoxShape: 'rect' | 'cylinder' | 'roundedRect';
  sprueOverride: { enabled: boolean; a: number; b: number };
  additionalPlanes: Array<{ axis: Ax; offset: number; cutAngle: number }>;
  isHollow: boolean;
  moldMode: 'rigid' | 'silicone';
  siliconeType: 'blockOneWay' | 'blockTwoPart' | 'skinCore';
  siliconeMarginMm: number;
  skinThicknessMm: number;
  includeCore: boolean;
  formFit: boolean;
  tier2?: Tier2Settings;
  scale: number;
  selectedPrinterId: string | null;
}

export interface StoredProject {
  id: string;
  name: string;
  savedAt: string;
  fileName: string;
  positions: Float32Array;
  index: Uint32Array | null;
  params: ProjectParams;
}

export type ProjectMeta = Pick<StoredProject, 'id' | 'name' | 'savedAt' | 'fileName'>;

const asPromise = <T>(req: IDBRequest<T>) =>
  new Promise<T>((ok, fail) => { req.onsuccess = () => ok(req.result); req.onerror = () => fail(req.error); });

/** Open the store, run one transaction, and always close the connection. */
async function withStore<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  if (typeof indexedDB === 'undefined') throw new Error('Browser storage is not available here.');
  const open = indexedDB.open(DB, 1);
  open.onupgradeneeded = () => {
    if (!open.result.objectStoreNames.contains(STORE)) open.result.createObjectStore(STORE, { keyPath: 'id' });
  };
  const db = await asPromise(open);
  try {
    const tx = db.transaction(STORE, mode);
    const finished = new Promise<void>((ok, fail) => {
      tx.oncomplete = () => ok();
      tx.onerror = tx.onabort = () => fail(tx.error ?? new Error('Saving projects failed.'));
    });
    const result = await asPromise(fn(tx.objectStore(STORE)));
    await finished;
    return result;
  } finally {
    db.close();
  }
}

export async function listProjects(): Promise<ProjectMeta[]> {
  try {
    const all = (await withStore('readonly', s => s.getAll())) as StoredProject[];
    return all
      .filter(p => p.id !== AUTOSAVE_ID)
      .map(({ id, name, savedAt, fileName }) => ({ id, name, savedAt, fileName }))
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  } catch {
    return [];
  }
}

export const saveProject = async (p: StoredProject) => { await withStore('readwrite', s => s.put(p)); };
export const getProject = async (id: string) => ((await withStore('readonly', s => s.get(id))) as StoredProject | undefined) ?? null;
export const deleteProject = async (id: string) => { await withStore('readwrite', s => s.delete(id)); };

// ---- file export / import ----

function toBase64(view: ArrayBufferView): string {
  const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += 0x8000) parts.push(String.fromCharCode(...bytes.subarray(i, i + 0x8000)));
  return btoa(parts.join(''));
}

function fromBase64(text: string): ArrayBuffer {
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

interface ProjectFile {
  app: string;
  version: number;
  name: string;
  savedAt: string;
  fileName: string;
  params: ProjectParams;
  geometry: { positions: string; index: string | null };
}

export function projectToJSON(p: StoredProject): string {
  const file: ProjectFile = {
    app: FILE_APP,
    version: FILE_VERSION,
    name: p.name,
    savedAt: p.savedAt,
    fileName: p.fileName,
    params: p.params,
    geometry: { positions: toBase64(p.positions), index: p.index ? toBase64(p.index) : null },
  };
  return JSON.stringify(file);
}

const str = (v: unknown, fallback: string) => (typeof v === 'string' ? v : fallback);

export function projectFromJSON(json: string): StoredProject {
  const f = JSON.parse(json) as Partial<ProjectFile>;
  if (f.app !== FILE_APP) throw new Error('Not a Sirpam Mold project file.');
  const positions = f.geometry?.positions ? new Float32Array(fromBase64(f.geometry.positions)) : new Float32Array();
  if (!f.params || positions.length === 0) throw new Error('Project file is missing the model or its settings.');
  return {
    id: `import-${newProjectId()}`,
    name: str(f.name, 'Imported project'),
    savedAt: str(f.savedAt, new Date().toISOString()),
    fileName: str(f.fileName, 'model'),
    positions,
    index: f.geometry?.index ? new Uint32Array(fromBase64(f.geometry.index)) : null,
    params: f.params,
  };
}

export function downloadProjectFile(p: StoredProject): void {
  const url = URL.createObjectURL(new Blob([projectToJSON(p)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${p.name.replace(/[^\w\- ]+/g, '').trim() || 'project'}.sirpam.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function pickProjectFile(): Promise<StoredProject | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.oncancel = () => resolve(null);
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try { resolve(projectFromJSON(await file.text())); }
      catch (e) { reject(e instanceof Error ? e : new Error('Could not read project file.')); }
    };
    input.click();
  });
}

/** Fixed slot for the automatic on-device backup of the current session. */
export const AUTOSAVE_ID = '__autosave__';

export const newProjectId = () => `p-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
