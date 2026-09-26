import * as THREE from 'three';
import type { Axis } from '../types';

/* ───────────────────────── Casting material presets ───────────────────────── */

export type CastingMaterialId =
  | 'pu_resin' | 'epoxy' | 'plaster' | 'concrete' | 'wax' | 'soap' | 'chocolate' | 'silicone_cast';

export interface CastingMaterial {
  id: CastingMaterialId;
  label: string;
  /** g/cm³ */
  density: number;
  /** Recommended silicone cure system for the mold. */
  silicone: string;
  /** Recommended Shore A hardness for the mold. */
  shore: string;
  release: string;
  demold: string;
  /** Max service temperature the mold must survive, °C. */
  pourTempC: number;
  notes: string;
}

/** Datasheet-typical values; always confirm with your supplier's TDS. */
export const CASTING_MATERIALS: CastingMaterial[] = [
  { id: 'pu_resin', label: 'Polyurethane resin', density: 1.1, silicone: 'Tin or platinum cure', shore: '20–30A', release: 'Silicone-safe mold release', demold: '10–60 min', pourTempC: 25, notes: 'Moisture sensitive — keep molds dry; vent high points.' },
  { id: 'epoxy', label: 'Epoxy resin', density: 1.15, silicone: 'Platinum cure (clear, low shrink)', shore: '15–25A', release: 'Usually none needed', demold: '24–72 h', pourTempC: 60, notes: 'Exothermic in thick pours — pour in layers under 2 cm.' },
  { id: 'plaster', label: 'Plaster / gypsum', density: 1.6, silicone: 'Tin cure', shore: '25–40A', release: 'Soap solution', demold: '30–60 min', pourTempC: 40, notes: 'Tap mold to release bubbles; let dry 24 h before sealing.' },
  { id: 'concrete', label: 'Concrete / cement', density: 2.3, silicone: 'Tin cure, high tear', shore: '40–60A', release: 'Form release oil', demold: '24–48 h', pourTempC: 30, notes: 'Needs a thick, rigid mold — use 15 mm+ silicone or a mother mold.' },
  { id: 'wax', label: 'Candle / casting wax', density: 0.9, silicone: 'Platinum or tin cure (heat resistant)', shore: '20–30A', release: 'None', demold: '1–4 h', pourTempC: 85, notes: 'Pour below 90 °C; top up the sprue as wax shrinks.' },
  { id: 'soap', label: 'Melt & pour soap', density: 1.05, silicone: 'Platinum or tin cure', shore: '20–30A', release: 'None', demold: '2–12 h', pourTempC: 65, notes: 'Spritz alcohol to pop surface bubbles.' },
  { id: 'chocolate', label: 'Chocolate / food', density: 1.3, silicone: 'Food-safe platinum cure only', shore: '15–25A', release: 'None', demold: '15–30 min (chilled)', pourTempC: 50, notes: 'Only food-grade silicone; never food-contact a printed mold directly.' },
  { id: 'silicone_cast', label: 'Silicone (into silicone)', density: 1.1, silicone: 'Any, with barrier', shore: '25–40A', release: 'Petroleum jelly / Ease Release 200', demold: '4–16 h', pourTempC: 25, notes: 'Silicone sticks to silicone — always apply a release barrier.' },
];

/* ───────────────────────────── Mesh helpers ───────────────────────────── */

function triIter(geo: THREE.BufferGeometry, cb: (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => void) {
  const pos = geo.attributes.position;
  const idx = geo.index;
  const n = idx ? idx.count : pos.count;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let t = 0; t + 2 < n; t += 3) {
    const i0 = idx ? idx.getX(t) : t, i1 = idx ? idx.getX(t + 1) : t + 1, i2 = idx ? idx.getX(t + 2) : t + 2;
    a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
    cb(a, b, c);
  }
}

/** Volume (mm³) and volume-weighted centroid of a closed mesh. */
export function solidProps(geo: THREE.BufferGeometry): { volume: number; centroid: THREE.Vector3 } {
  let v6 = 0;
  const c = new THREE.Vector3();
  triIter(geo, (a, b, d) => {
    const vol = a.dot(new THREE.Vector3().crossVectors(b, d));
    v6 += vol;
    c.x += vol * (a.x + b.x + d.x);
    c.y += vol * (a.y + b.y + d.y);
    c.z += vol * (a.z + b.z + d.z);
  });
  if (Math.abs(v6) < 1e-9) {
    geo.computeBoundingBox();
    return { volume: 0, centroid: geo.boundingBox!.getCenter(new THREE.Vector3()) };
  }
  c.divideScalar(4 * v6);
  return { volume: Math.abs(v6) / 6, centroid: c };
}

/* ───────────────────────────── Gate advisor ───────────────────────────── */

export interface GateAdvice {
  /** Lateral coords for the sprue (same frame as sprueOverride). */
  a: number;
  b: number;
  sprueDiameterMm: number;
  ventCount: number;
  partVolumeCm3: number;
  fillSeconds: number;
  tips: string[];
}

const LAT: Record<Axis, [number, number]> = { x: [1, 2], y: [2, 0], z: [0, 1] };
const PRI: Record<Axis, number> = { x: 0, y: 1, z: 2 };

/**
 * Gravity-casting gate advice. Gate goes over the thickest section
 * (approximated by the solid's centre of mass) so material flows thick → thin
 * and feeds shrinkage; sprue diameter scales with part volume so a pour
 * finishes inside a typical resin pot-life; vents go at every local high point.
 */
export function adviseGate(geo: THREE.BufferGeometry, axis: Axis): GateAdvice {
  const { volume, centroid } = solidProps(geo);
  const cm3 = volume / 1000;
  const [la, lb] = LAT[axis];
  const pi = PRI[axis];

  // Sprue: ~3 mm per cube-root cm³, clamped to practical 5–25 mm.
  const sprue = Math.round(Math.min(25, Math.max(5, 3 + 2.2 * Math.cbrt(Math.max(cm3, 0.1)))) * 2) / 2;
  // Gravity flow ≈ 1.5 cm³/s per cm² of gate area (conservative for 500–1500 cP resins).
  const area = Math.PI * (sprue / 20) ** 2;
  const fillSeconds = cm3 / Math.max(area * 1.5 * 10, 0.1);

  // Local high points: bin top-facing vertices on a coarse lateral grid.
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const top = bb.max.getComponent(pi), bot = bb.min.getComponent(pi);
  const band = top - (top - bot) * 0.25;
  const pos = geo.attributes.position;
  const G = 6;
  const grid = new Map<string, number>();
  const sa = bb.max.getComponent(la) - bb.min.getComponent(la) || 1;
  const sb = bb.max.getComponent(lb) - bb.min.getComponent(lb) || 1;
  for (let i = 0; i < pos.count; i++) {
    const h = pos.getComponent(i, pi);
    if (h < band) continue;
    const ga = Math.min(G - 1, Math.floor(((pos.getComponent(i, la) - bb.min.getComponent(la)) / sa) * G));
    const gb = Math.min(G - 1, Math.floor(((pos.getComponent(i, lb) - bb.min.getComponent(lb)) / sb) * G));
    const k = `${ga},${gb}`;
    grid.set(k, Math.max(grid.get(k) ?? -Infinity, h));
  }
  let peaks = 0;
  for (const [k, h] of grid) {
    const [ga, gb] = k.split(',').map(Number);
    let isPeak = true;
    for (let da = -1; da <= 1 && isPeak; da++) for (let db = -1; db <= 1; db++) {
      if (!da && !db) continue;
      const nh = grid.get(`${ga + da},${gb + db}`);
      if (nh !== undefined && nh > h) { isPeak = false; break; }
    }
    if (isPeak) peaks++;
  }
  const ventCount = Math.min(6, Math.max(2, peaks));

  const tips: string[] = [];
  if (fillSeconds > 90) tips.push('Long pour — consider a slower-curing resin or a second sprue.');
  if (peaks > 2) tips.push(`${peaks} separate high points found — make sure each has a vent.`);
  tips.push('Pour slowly down one side of the sprue to avoid trapping air.');
  tips.push('Sprue should be the last place to fill — overfill it slightly to feed shrinkage.');

  return {
    a: centroid.getComponent(la),
    b: centroid.getComponent(lb),
    sprueDiameterMm: sprue,
    ventCount,
    partVolumeCm3: cm3,
    fillSeconds,
    tips,
  };
}

/* ─────────────────────────── Multi-cavity tray ─────────────────────────── */

/**
 * Duplicate a part N times on a grid perpendicular to the parting axis.
 * Returns the merged (non-indexed) geometry, its bbox and each cavity's
 * lateral centre so the generator can drill one sprue per cavity.
 */
export function buildCavityTray(
  geo: THREE.BufferGeometry, axis: Axis, count: number, spacingMm: number,
): { geometry: THREE.BufferGeometry; bbox: THREE.Box3; centers: Array<{ a: number; b: number }> } {
  const src = geo.index ? geo.toNonIndexed() : geo;
  src.computeBoundingBox();
  const bb = src.boundingBox!;
  const size = bb.getSize(new THREE.Vector3());
  const [la, lb] = LAT[axis];
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const stepA = size.getComponent(la) + spacingMm;
  const stepB = size.getComponent(lb) + spacingMm;
  const center = bb.getCenter(new THREE.Vector3());
  const srcPos = src.attributes.position.array as Float32Array;
  const out = new Float32Array(srcPos.length * count);
  const centers: Array<{ a: number; b: number }> = [];
  for (let k = 0; k < count; k++) {
    const r = Math.floor(k / cols), c = k % cols;
    const off: [number, number, number] = [0, 0, 0];
    off[la] = (c - (cols - 1) / 2) * stepA;
    off[lb] = (r - (rows - 1) / 2) * stepB;
    const base = k * srcPos.length;
    for (let i = 0; i < srcPos.length; i += 3) {
      out[base + i] = srcPos[i] + off[0];
      out[base + i + 1] = srcPos[i + 1] + off[1];
      out[base + i + 2] = srcPos[i + 2] + off[2];
    }
    centers.push({ a: center.getComponent(la) + off[la], b: center.getComponent(lb) + off[lb] });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(out, 3));
  g.computeVertexNormals();
  g.computeBoundingBox();
  return { geometry: g, bbox: g.boundingBox!.clone(), centers };
}

/* ─────────────────────────── Auto-orient for print ─────────────────────────── */

/**
 * Choose, for one piece, the rotation (of 6 axis-aligned "down" directions)
 * that minimises support-needing overhang area (faces steeper than 45° facing
 * down, excluding those resting on the bed) and prefers a large flat base.
 * Returns a new geometry rotated and dropped onto Z = 0, centred on X/Y.
 */
export function orientForPrint(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const downs = [
    new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(-1, 0, 0), new THREE.Vector3(1, 0, 0),
  ];
  const cos45 = Math.cos(Math.PI / 4);
  const n = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  let best = downs[0]!;
  let bestScore = Infinity;
  for (const d of downs) {
    let minH = Infinity;
    triIter(geo, (a, b, c) => { minH = Math.min(minH, a.dot(d) * -1, b.dot(d) * -1, c.dot(d) * -1); });
    let overhang = 0, base = 0;
    triIter(geo, (a, b, c) => {
      e1.subVectors(b, a); e2.subVectors(c, a); n.crossVectors(e1, e2);
      const area = n.length() / 2;
      if (area === 0) return;
      n.normalize();
      const facing = n.dot(d); // 1 = pointing straight down
      const h = Math.min(-a.dot(d), -b.dot(d), -c.dot(d)) - minH;
      if (facing > 0.999 && h < 0.2) base += area;
      else if (facing > cos45) overhang += area;
    });
    const score = overhang - base * 0.5;
    if (score < bestScore) { bestScore = score; best = d; }
  }
  const q = new THREE.Quaternion().setFromUnitVectors(best, new THREE.Vector3(0, 0, -1));
  const out = geo.clone();
  out.applyQuaternion(q);
  out.computeBoundingBox();
  const bb = out.boundingBox!;
  const c = bb.getCenter(new THREE.Vector3());
  out.translate(-c.x, -c.y, -bb.min.z);
  out.computeVertexNormals();
  return out;
}
