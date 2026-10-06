// @ts-nocheck — upstream mold-maker code; type-checked under its own repo tsconfig
/**
 * Mold project storage — browser-only persistence for save/load projects.
 *
 * IndexedDB, not localStorage: a saved project embeds the model geometry
 * (a Float32Array position buffer plus optional index), which is routinely
 * 1-10 MB — far past the ~5 MB localStorage quota. Structured clone stores
 * typed arrays natively, so geometry round-trips without base64 inside the
 * DB. The shareable `.sirpam.json` export DOES base64-encode, because JSON
 * has no binary type.
 *
 * Failure philosophy copied from telemetrySettings.ts: storage being
 * unavailable (private mode, quota, SSR) must never break the app — every
 * entry point resolves to empty/no-op or throws a plain Error that the
 * caller surfaces as a banner message.
 */

const DB_NAME = 'sirpam-mold-projects';
const DB_VERSION = 1;
const STORE = 'projects';

/** The mold settings a saved project restores. Mirrors the generate-relevant
 *  slice of AppState — deliberately NOT a reference to AppState so the
 *  storage shape stays decoupled from UI state evolution. */
export interface ProjectParams {
  axis: 'x' | 'y' | 'z';
  planeOffset: number;
  cutAngle: number;
  wallThicknessRatio: number;
  clearanceMm: number;
  sprueDiameterMm: number;
  moldBoxShape: 'rect' | 'cylinder' | 'roundedRect';
  sprueOverride: { enabled: boolean; a: number; b: number };
  additionalPlanes: Array<{ axis: 'x' | 'y' | 'z'; offset: number; cutAngle: number }>;
  isHollow: boolean;
  moldMode: 'rigid' | 'silicone';
  siliconeType: 'blockOneWay' | 'blockTwoPart' | 'skinCore';
  siliconeMarginMm: number;
  skinThicknessMm: number;
  includeCore: boolean;
  formFit: boolean;
  /** Tier-2 pro features (optional — absent in older saves). */
  tier2?: import('../components/AdvancedMoldPanel').Tier2Settings;
  scale: number;
  selectedPrinterId: string | null;
}

export interface StoredProject {
  id: string;
  name: string;
  savedAt: string; // ISO timestamp
  fileName: string;
  /** Centered, normalized model positions (one xyz triple per vertex). */
  positions: Float32Array;
  /** Optional triangle index; absent = non-indexed geometry. */
  index: Uint32Array | null;
  params: ProjectParams;
}

/** Lightweight list row — same shape minus the heavy geometry fields. */
export type ProjectMeta = Pick<StoredProject, 'id' | 'name' | 'savedAt' | 'fileName'>;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Browser storage is not available in this context.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Could not open project storage.'));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Project storage transaction failed.'));
    tx.onabort = () => reject(tx.error ?? new Error('Project storage transaction aborted.'));
  });
}

export async function listProjects(): Promise<ProjectMeta[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    const all: StoredProject[] = await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result as StoredProject[]);
      req.onerror = () => reject(req.error);
    });
    await txDone(tx);
    db.close();
    return all
      .map(({ id, name, savedAt, fileName }) => ({ id, name, savedAt, fileName }))
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  } catch {
    // Storage unavailable → behave like "no saved projects yet".
    return [];
  }
}

export async function saveProject(project: StoredProject): Promise<void> {
  const db = await openDB();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(project);
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function getProject(id: string): Promise<StoredProject | null> {
  const db = await openDB();
  try {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    const result = await new Promise<StoredProject | undefined>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    await txDone(tx);
    return result ?? null;
  } finally {
    db.close();
  }
}

export async function deleteProject(id: string): Promise<void> {
  const db = await openDB();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    await txDone(tx);
  } finally {
    db.close();
  }
}

// ── .sirpam.json shareable export/import ─────────────────────────────────

const FILE_MAGIC = 'sirpam-mold-project';
const FILE_VERSION = 1;

function bufToBase64(u8: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < u8.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, u8.subarray(i, i + CHUNK) as unknown as number[]);
  }
  return btoa(bin);
}

function base64ToBuf(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

interface ProjectFileJSON {
  app: string;
  version: number;
  name: string;
  savedAt: string;
  fileName: string;
  params: ProjectParams;
  geometry: { positions: string; index: string | null };
}

export function projectToJSON(p: StoredProject): string {
  const file: ProjectFileJSON = {
    app: FILE_MAGIC,
    version: FILE_VERSION,
    name: p.name,
    savedAt: p.savedAt,
    fileName: p.fileName,
    params: p.params,
    geometry: {
      positions: bufToBase64(new Uint8Array(p.positions.buffer, p.positions.byteOffset, p.positions.byteLength)),
      index: p.index
        ? bufToBase64(new Uint8Array(p.index.buffer, p.index.byteOffset, p.index.byteLength))
        : null,
    },
  };
  return JSON.stringify(file);
}

export function projectFromJSON(json: string): StoredProject {
  const file = JSON.parse(json) as ProjectFileJSON;
  if (file.app !== FILE_MAGIC) {
    throw new Error('Not a Sirpam Mold project file.');
  }
  const positions = new Float32Array(base64ToBuf(file.geometry.positions).buffer);
  const index = file.geometry.index
    ? new Uint32Array(base64ToBuf(file.geometry.index).buffer)
    : null;
  if (!file.params || !positions.length) {
    throw new Error('Project file is missing the model or its settings.');
  }
  return {
    id: `import-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    name: typeof file.name === 'string' ? file.name : 'Imported project',
    savedAt: typeof file.savedAt === 'string' ? file.savedAt : new Date().toISOString(),
    fileName: typeof file.fileName === 'string' ? file.fileName : 'model',
    positions,
    index,
    params: file.params,
  };
}

export function downloadProjectFile(p: StoredProject): void {
  const blob = new Blob([projectToJSON(p)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${p.name.replace(/[^\w\- ]+/g, '').trim() || 'project'}.sirpam.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Open a native file picker and parse the chosen .sirpam.json. */
export function pickProjectFile(): Promise<StoredProject | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      try {
        resolve(projectFromJSON(await file.text()));
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Could not read project file.'));
      }
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export function newProjectId(): string {
  return `p-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}
