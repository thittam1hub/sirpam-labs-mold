// Sirpam 3D Labs Mold — one-page printable workshop sheet: weights, mix ratio,
// pot life / demold adjusted for the workshop temperature, print settings and
// a pour checklist. All numbers are rules of thumb; the supplier's TDS wins.
import { useMemo, useState } from 'react';
import * as THREE from 'three';
import type { Axis, MoldMode } from '../types';
import { CASTING_MATERIALS, solidProps, type CastingMaterialId } from '../utils/tier2';
import { demoldRisk, airTrapPoints } from '../mold/castRisk';

interface Props {
  geometry: THREE.BufferGeometry; boundingBox: THREE.Box3 | null; axis: Axis; offset: number; cutAngle: number;
  moldMode: MoldMode; castingMaterial: CastingMaterialId; cavities: number; autoVents: boolean; scale: number;
  onClose: () => void;
}

/** Mix ratio by weight (A:B) typical for each casting material, null = single part. */
const MIX: Record<CastingMaterialId, [number, number] | null> = {
  pu_resin: [1, 1], epoxy: [2, 1], plaster: [100, 70], concrete: null, wax: null, soap: null, chocolate: null, silicone_cast: [1, 1],
};
const REACTIVE = new Set<CastingMaterialId>(['pu_resin', 'epoxy', 'silicone_cast']);
const SILICONE_DENSITY = 1.1; // g/cm³
const WALL_MM = 10;

/** Rule of thumb: cure speed roughly doubles every 10 °C above 25 °C. */
export function heatFactor(tempC: number) { return Math.pow(2, (tempC - 25) / 10); }

const fmtMin = (m: number) => (m >= 90 ? `${(m / 60).toFixed(1)} h` : `${Math.round(m)} min`);

export function WorkshopSheet(p: Props) {
  const [temp, setTemp] = useState(32);
  const mat = CASTING_MATERIALS.find(m => m.id === p.castingMaterial) ?? CASTING_MATERIALS[0]!;
  const data = useMemo(() => {
    const s3 = p.scale ** 3;
    const partCm3 = Math.abs(solidProps(p.geometry).volume) * s3 / 1000;
    const bb = p.boundingBox ?? new THREE.Box3().setFromBufferAttribute(p.geometry.getAttribute('position') as THREE.BufferAttribute);
    const sz = bb.getSize(new THREE.Vector3()).multiplyScalar(p.scale);
    const blockCm3 = ((sz.x + 2 * WALL_MM) * (sz.y + 2 * WALL_MM) * (sz.z + 2 * WALL_MM)) / 1000;
    const siliconeCm3 = Math.max(0, blockCm3 - partCm3) * p.cavities;
    const castG = partCm3 * mat.density * p.cavities * 1.1; // +10% for sprue and spill
    const risk = p.boundingBox ? demoldRisk(p.geometry, p.axis, p.offset, p.boundingBox, p.cutAngle) : null;
    const traps = p.boundingBox ? airTrapPoints(p.geometry, p.axis, p.boundingBox).length : 0;
    return { partCm3, siliconeG: siliconeCm3 * SILICONE_DENSITY * 1.1, castG, sz, risk, traps };
  }, [p.geometry, p.boundingBox, p.scale, p.cavities, p.axis, p.offset, p.cutAngle, mat.density]);

  const f = heatFactor(temp);
  const mix = MIX[p.castingMaterial];
  const split = (g: number) => (mix ? [g * mix[0] / (mix[0] + mix[1]), g * mix[1] / (mix[0] + mix[1])] : null);
  const castSplit = split(data.castG);
  const silSplit = p.moldMode === 'silicone' ? [data.siliconeG / 2, data.siliconeG / 2] : null;
  const potLife = REACTIVE.has(p.castingMaterial) ? (p.castingMaterial === 'epoxy' ? 40 : 10) / f : null;
  const siliconeWork = 40 / f, siliconeCure = 6 * 60 / f;
  const row = { display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #ddd' } as const;
  const h = { fontSize: 13, fontWeight: 700, margin: '14px 0 4px', textTransform: 'uppercase' as const, letterSpacing: 1 };

  return (
    <div role="dialog" aria-modal="true" aria-label="Workshop pour and print sheet" className="ws-overlay"
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.55)', overflow: 'auto', padding: 16 }}>
      <style>{`@media print { body * { visibility: hidden !important; } .ws-print, .ws-print * { visibility: visible !important; }
        .ws-overlay { position: absolute !important; background: none !important; padding: 0 !important; }
        .ws-print { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; margin: 0 !important; } .ws-noprint { display: none !important; }
        @page { size: A4; margin: 12mm; } }`}</style>
      <article className="ws-print" style={{ maxWidth: 720, margin: '0 auto', background: '#fff', color: '#111', borderRadius: 8, padding: 24, fontSize: 13, lineHeight: 1.45, fontFamily: 'inherit' }}>
        <div className="ws-noprint" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBottom: 8 }}>
          <label style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            Workshop temperature
            <input type="range" min={20} max={40} value={temp} onChange={e => setTemp(+e.target.value)} aria-label="Workshop temperature" />
            <strong>{temp} °C</strong>
          </label>
          <button type="button" onClick={() => window.print()} style={{ padding: '6px 14px', borderRadius: 999, border: 'none', background: '#e8632b', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Print</button>
          <button type="button" onClick={p.onClose} style={{ padding: '6px 14px', borderRadius: 999, border: '1px solid #999', background: '#fff', cursor: 'pointer' }}>Close</button>
        </div>
        <h2 style={{ margin: 0, fontSize: 20 }}>Workshop sheet — Sirpam 3D Labs Mold</h2>
        <div style={{ color: '#555' }}>{new Date().toLocaleDateString('en-IN')} · {p.moldMode === 'silicone' ? 'Silicone' : 'Rigid printed'} mold · split along {p.axis.toUpperCase()} · {p.cavities} cavit{p.cavities > 1 ? 'ies' : 'y'} · workshop {temp} °C</div>

        <div style={h}>Model</div>
        <div style={row}><span>Size (W × D × H)</span><span>{data.sz.x.toFixed(0)} × {data.sz.y.toFixed(0)} × {data.sz.z.toFixed(0)} mm</span></div>
        <div style={row}><span>Volume per piece</span><span>{data.partCm3.toFixed(1)} cm³</span></div>
        {data.risk && <div style={row}><span>Release risk</span><span>{data.risk.score}/100 ({data.risk.level})</span></div>}
        <div style={row}><span>Air pockets</span><span>{data.traps ? `${data.traps}${p.autoVents ? ' — vents added' : ' — add vents!'}` : 'none'}</span></div>

        <div style={h}>Casting: {mat.label}</div>
        <div style={row}><span>Total to mix (+10% spare)</span><strong>{data.castG.toFixed(0)} g</strong></div>
        {castSplit && mix && <div style={row}><span>Part A : Part B ({mix[0]}:{mix[1]} by weight)</span><strong>{castSplit[0]!.toFixed(0)} g + {castSplit[1]!.toFixed(0)} g</strong></div>}
        {potLife !== null && <div style={row}><span>Working time at {temp} °C</span><span>about {fmtMin(potLife)}</span></div>}
        <div style={row}><span>Demold (datasheet at 25 °C)</span><span>{mat.demold}{f > 1.2 ? ' — usually sooner in this heat' : ''}</span></div>
        <div style={row}><span>Release agent</span><span>{mat.release}</span></div>
        <div style={{ color: '#555', marginTop: 4 }}>{mat.notes}</div>

        {silSplit && <>
          <div style={h}>Mold silicone ({mat.shore}, {mat.silicone})</div>
          <div style={row}><span>Silicone needed (10 mm walls, +10%)</span><strong>{data.siliconeG.toFixed(0)} g</strong></div>
          <div style={row}><span>Part A + Part B (1:1, check your kit)</span><strong>{silSplit[0]!.toFixed(0)} g + {silSplit[1]!.toFixed(0)} g</strong></div>
          <div style={row}><span>Working time at {temp} °C</span><span>about {fmtMin(siliconeWork)}</span></div>
          <div style={row}><span>Cure before demold at {temp} °C</span><span>about {fmtMin(siliconeCure)}</span></div>
        </>}

        <div style={h}>Print the mold</div>
        <div style={row}><span>Layer height</span><span>0.12–0.16 mm (smoother cast surface)</span></div>
        <div style={row}><span>Walls / top-bottom</span><span>4 walls · 5 top/bottom layers (no leaks)</span></div>
        <div style={row}><span>Infill</span><span>20–30% gyroid</span></div>
        <div style={row}><span>Material</span><span>PLA or PETG; PETG for wax/soap above 60 °C</span></div>

        <div style={h}>Pour checklist</div>
        <ol style={{ margin: 0, paddingLeft: 20, listStyle: 'decimal' }}>
          {[
            'Clean the cavity and apply release; let it dry.',
            'Clamp the halves evenly; seal the seam with clay or tape.',
            temp >= 30 ? `It is ${temp} °C: mix small batches and pour quickly — it sets faster in heat.` : 'Weigh both parts on a scale, never by eye.',
            'Mix slowly for 2–3 minutes, scraping the sides and bottom.',
            'Pour in a thin stream from 30–50 cm into the lowest corner.',
            'Tap the mold or vibrate for 1 minute to lift bubbles.',
            'Top up the pour hole as it shrinks; demold only when fully hard.',
          ].map((t, i) => <li key={i}>{t}</li>)}
        </ol>
        <div style={{ marginTop: 12, fontSize: 11, color: '#666' }}>Estimates only — follow your material supplier's datasheet. Questions? WhatsApp Sirpam 3D Labs +91 97893 91798.</div>
      </article>
    </div>
  );
}
