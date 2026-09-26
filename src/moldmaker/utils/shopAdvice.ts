import * as THREE from 'three';
import type { Axis, MoldMode } from '../types';
import type { CastingMaterialId } from './tier2';

/* ───────────── Shrink & fit compensation ─────────────
 * Typical linear shrink values (rules of thumb, not datasheet values).
 * Print shrink = how much the printed mold shrinks vs. CAD.
 * Cast shrink  = how much the cast part shrinks inside the mold.        */

export interface ShrinkOption { id: string; label: string; pct: number; clearanceMm: number }

export const PRINT_SHRINK: ShrinkOption[] = [
  { id: 'pla', label: 'FDM · PLA', pct: 0.3, clearanceMm: 0.2 },
  { id: 'petg', label: 'FDM · PETG', pct: 0.5, clearanceMm: 0.25 },
  { id: 'abs', label: 'FDM · ABS / ASA', pct: 0.8, clearanceMm: 0.3 },
  { id: 'resin', label: 'Resin (MSLA)', pct: 1.0, clearanceMm: 0.1 },
];

export const CAST_SHRINK: ShrinkOption[] = [
  { id: 'none', label: 'No compensation', pct: 0, clearanceMm: 0 },
  { id: 'pu', label: 'Polyurethane resin', pct: 0.3, clearanceMm: 0 },
  { id: 'epoxy', label: 'Epoxy resin', pct: 0.2, clearanceMm: 0 },
  { id: 'wax', label: 'Candle / casting wax', pct: 1.5, clearanceMm: 0 },
  { id: 'gold', label: 'Jewelry · gold (lost wax)', pct: 1.25, clearanceMm: 0 },
  { id: 'silver', label: 'Jewelry · sterling silver', pct: 1.5, clearanceMm: 0 },
  { id: 'bronze', label: 'Jewelry · bronze / brass', pct: 1.5, clearanceMm: 0 },
  { id: 'concrete', label: 'Concrete', pct: 0.05, clearanceMm: 0 },
];

/** Scale factor to apply to the master so the finished cast matches CAD. */
export function shrinkScale(printPct: number, castPct: number): number {
  return 1 / ((1 - printPct / 100) * (1 - castPct / 100));
}

export function scaledCopy(geo: THREE.BufferGeometry, f: number): THREE.BufferGeometry {
  const g = geo.clone();
  g.scale(f, f, f);
  g.computeBoundingBox();
  g.computeVertexNormals();
  return g;
}

/* ───────────── Pour presets (food / wax / soap / concrete) ───────────── */

export interface PourPreset {
  id: string; label: string; castingMaterial: CastingMaterialId; moldMode: MoldMode;
  siliconeMarginMm: number; sprueDiameterMm: number; notes: string;
}

export const POUR_PRESETS: PourPreset[] = [
  { id: 'chocolate', label: 'Chocolate', castingMaterial: 'chocolate', moldMode: 'silicone', siliconeMarginMm: 8, sprueDiameterMm: 10,
    notes: 'Use food-grade platinum silicone only. The printed parts are only the pour box — never let food touch the print.' },
  { id: 'candle', label: 'Candle wax', castingMaterial: 'wax', moldMode: 'silicone', siliconeMarginMm: 10, sprueDiameterMm: 12,
    notes: 'Wide pour hole so you can top up as wax shrinks. Leave a wick channel down the middle.' },
  { id: 'soap', label: 'Soap', castingMaterial: 'soap', moldMode: 'silicone', siliconeMarginMm: 8, sprueDiameterMm: 12,
    notes: 'Open pour works best. Spritz alcohol to pop bubbles.' },
  { id: 'concrete', label: 'Concrete', castingMaterial: 'concrete', moldMode: 'silicone', siliconeMarginMm: 15, sprueDiameterMm: 20,
    notes: 'Thick silicone and a rigid outer box. Vibrate the mold to push air out.' },
  { id: 'resin', label: 'Resin parts', castingMaterial: 'pu_resin', moldMode: 'rigid', siliconeMarginMm: 0, sprueDiameterMm: 8,
    notes: 'Printed rigid mold; seal the inside (see Finish step) and use mold release.' },
];

/* ───────────── Leak-proof print guide ───────────── */

export interface Advice { level: 'ok' | 'warn' | 'info'; text: string }

export function leakGuide(o: { moldMode: MoldMode; wallMm: number; castingMaterial: CastingMaterialId; printer: 'fdm' | 'resin' }): Advice[] {
  const out: Advice[] = [];
  if (o.moldMode === 'silicone') {
    out.push({ level: 'info', text: 'Silicone seals the cavity, so the printed box only needs to hold liquid silicone. Seal box seams with hot glue or clay.' });
    return out;
  }
  if (o.printer === 'fdm') {
    out.push({ level: 'info', text: 'Print with 4+ walls (perimeters) and 5+ top/bottom layers so the cavity face is solid.' });
    out.push({ level: 'info', text: 'Use 100% infill near the cavity, or at least 40% gyroid. Slightly higher temperature (+5 °C) fuses layers better.' });
    out.push({ level: 'info', text: 'Seal the cavity: 2 thin coats of brush-on epoxy (e.g. XTC-3D) or spray lacquer, then mold release.' });
    const minWall = 4 * 0.45;
    out.push(o.wallMm < minWall * 2
      ? { level: 'warn', text: `Mold wall is about ${o.wallMm.toFixed(1)} mm — too thin to seal reliably. Raise wall thickness to at least ${(minWall * 2).toFixed(1)} mm.` }
      : { level: 'ok', text: `Mold wall about ${o.wallMm.toFixed(1)} mm — thick enough to seal.` });
  } else {
    out.push({ level: 'ok', text: 'Resin prints are nearly watertight. Wash, fully cure, then apply mold release.' });
    if (o.wallMm < 2) out.push({ level: 'warn', text: 'Walls under 2 mm can crack when clamped. Raise wall thickness.' });
  }
  if (o.castingMaterial === 'chocolate') out.push({ level: 'warn', text: 'Printed plastic is not food safe. For food, make a silicone mold from the print instead.' });
  if (o.castingMaterial === 'wax' || o.castingMaterial === 'epoxy') out.push({ level: 'warn', text: 'Hot or exothermic pours can soften PLA. Use PETG/ASA or resin, or pour in thin layers.' });
  return out;
}

/* ───────────── Surface finish (layer line) advisor ───────────── */

const DIRS: Array<{ label: string; v: THREE.Vector3 }> = [
  { label: '+Z up', v: new THREE.Vector3(0, 0, 1) }, { label: '-Z up', v: new THREE.Vector3(0, 0, -1) },
  { label: '+Y up', v: new THREE.Vector3(0, 1, 0) }, { label: '-Y up', v: new THREE.Vector3(0, -1, 0) },
  { label: '+X up', v: new THREE.Vector3(1, 0, 0) }, { label: '-X up', v: new THREE.Vector3(-1, 0, 0) },
];

/** Share of surface area that is gently sloped (5°–30° from flat) — where
 *  stair-stepping layer lines are most visible — for a given build direction. */
function stairShare(geo: THREE.BufferGeometry, up: THREE.Vector3): number {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const idx = geo.index;
  const n = idx ? idx.count : pos.count;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), nrm = new THREE.Vector3();
  let total = 0, bad = 0;
  const lo = Math.cos(THREE.MathUtils.degToRad(30)), hi = Math.cos(THREE.MathUtils.degToRad(5));
  for (let i = 0; i + 2 < n; i += 3) {
    const ia = idx ? idx.getX(i) : i, ib = idx ? idx.getX(i + 1) : i + 1, ic = idx ? idx.getX(i + 2) : i + 2;
    a.fromBufferAttribute(pos, ia); b.fromBufferAttribute(pos, ib); c.fromBufferAttribute(pos, ic);
    nrm.subVectors(b, a).cross(c.clone().sub(a));
    const area = nrm.length() / 2;
    if (area === 0) continue;
    nrm.normalize();
    const d = Math.abs(nrm.dot(up));
    total += area;
    if (d > lo && d < hi) bad += area;
  }
  return total > 0 ? bad / total : 0;
}

export interface FinishReport { currentLabel: string; currentPct: number; bestLabel: string; bestPct: number; tips: string[] }

export function finishAdvisor(geo: THREE.BufferGeometry, printer: 'fdm' | 'resin'): FinishReport {
  const scores = DIRS.map(d => ({ label: d.label, pct: stairShare(geo, d.v) * 100 }));
  const current = scores[0]!;
  const best = scores.reduce((m, s) => (s.pct < m.pct ? s : m), current);
  const tips = printer === 'fdm'
    ? ['Use 0.12 mm layers (or variable layer height) on the cavity side.', 'Sand the master 220 → 400 → 800 grit, then a filler primer coat.', 'Silicone copies every line — smooth the master before pouring.']
    : ['Use 0.03–0.05 mm layers.', 'Angle flat areas 30–45° to the build plate to hide steps.', 'Light 800-grit wet sand after curing.'];
  return { currentLabel: current.label, currentPct: current.pct, bestLabel: best.label, bestPct: best.pct, tips };
}

/* ───────────── Mold life estimate ───────────── */

export function moldLife(o: { moldMode: MoldMode; castingMaterial: CastingMaterialId; wallMm: number; undercutPct: number; printer: 'fdm' | 'resin' }): { low: number; high: number; note: string } {
  let low: number, high: number;
  if (o.moldMode === 'silicone') { low = 25; high = 50; } else if (o.printer === 'resin') { low = 10; high = 30; } else { low = 5; high = 20; }
  const matMult: Record<CastingMaterialId, number> = {
    pu_resin: 1, epoxy: 0.8, plaster: 1.5, concrete: 0.6, wax: 2, soap: 2.5, chocolate: 3, silicone_cast: 0.7,
  };
  let m = matMult[o.castingMaterial];
  if (o.undercutPct > 5) m *= 0.6; else if (o.undercutPct > 1) m *= 0.8;
  if (o.moldMode === 'silicone' && o.wallMm < 6) m *= 0.7;
  low = Math.max(1, Math.round(low * m)); high = Math.max(low + 1, Math.round(high * m));
  const note = o.moldMode === 'silicone'
    ? 'Tin-cure silicone wears faster; platinum lasts longer. Resins slowly dry out silicone — use release every few pulls.'
    : 'Printed molds wear at the seal and fine details. Re-seal the cavity when casts start sticking.';
  return { low, high, note };
}

/* ───────────── Wall thickness (per vertex) ───────────── */

/**
 * Local material thickness at each vertex: cast a ray inward (against the
 * vertex normal) and measure the distance to the opposite surface.
 * Brute-force with a triangle cap so the UI stays responsive; vertices past
 * the sample budget reuse their nearest sampled neighbour's value.
 */
export function computeThickness(source: THREE.BufferGeometry, maxSamples = 2500): { geometry: THREE.BufferGeometry; values: Float32Array; min: number } {
  const geo = source.index ? source.toNonIndexed() : source.clone();
  geo.computeVertexNormals();
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const nor = geo.getAttribute('normal') as THREE.BufferAttribute;
  const vCount = pos.count;
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const ray = new THREE.Raycaster();
  const values = new Float32Array(vCount).fill(Infinity);
  const stride = Math.max(1, Math.ceil(vCount / maxSamples));
  const p = new THREE.Vector3(), d = new THREE.Vector3();
  let min = Infinity;
  for (let i = 0; i < vCount; i += stride) {
    p.fromBufferAttribute(pos, i); d.fromBufferAttribute(nor, i).negate().normalize();
    ray.set(p.clone().addScaledVector(d, 1e-3), d);
    const hits = ray.intersectObject(mesh, false);
    const t = hits.length ? hits[0]!.distance : Infinity;
    values[i] = t;
    if (t < min) min = t;
  }
  for (let i = 0; i < vCount; i++) if (i % stride !== 0) values[i] = values[i - (i % stride)]!;
  // Colour: red < 1.5 mm, yellow < 3 mm, green otherwise.
  const col = new Float32Array(vCount * 3);
  for (let i = 0; i < vCount; i++) {
    const t = values[i]!;
    const [r, g, b] = t < 1.5 ? [0.9, 0.2, 0.15] : t < 3 ? [0.95, 0.75, 0.2] : [0.3, 0.7, 0.35];
    col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  (mesh.material as THREE.Material).dispose();
  return { geometry: geo, values, min: Number.isFinite(min) ? min : 0 };
}

export function axisVec(axis: Axis): THREE.Vector3 {
  return axis === 'x' ? new THREE.Vector3(1, 0, 0) : axis === 'y' ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
}
