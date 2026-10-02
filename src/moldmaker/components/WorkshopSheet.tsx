// Sirpam 3D Labs Mold — one-page printable workshop sheet: weights, mix ratio,
// pot life / demold adjusted for the workshop temperature, print settings and
// a pour checklist. All numbers are rules of thumb; the supplier's TDS wins.
import { useMemo, useState } from 'react';
import * as THREE from 'three';
import type { Axis, MoldMode } from '../types';
import { CASTING_MATERIALS, solidProps, type CastingMaterialId } from '../utils/tier2';
import { demoldRisk, airTrapPoints } from '../mold/castRisk';
import {
  HANDLING_ALLOWANCE,
  REFERENCE_TEMPERATURE_C,
  SILICONE_MOLD_CURE_HOURS_AT_25C,
  SILICONE_MOLD_DENSITY_G_CM3,
  SILICONE_MOLD_WALL_MM,
  SILICONE_MOLD_WORK_MINUTES_AT_25C,
  WORKSHOP_MATERIAL_PROFILES,
  splitByWeight,
  temperatureGuidance,
} from '../utils/workshopDefaults';

interface Props {
  geometry: THREE.BufferGeometry; boundingBox: THREE.Box3 | null; axis: Axis; offset: number; cutAngle: number;
  moldMode: MoldMode; castingMaterial: CastingMaterialId; cavities: number; autoVents: boolean; scale: number;
  onClose: () => void;
}

const fmtRange = (range: readonly [number, number], unit: string) => `${range[0]}–${range[1]} ${unit}`;

export function WorkshopSheet(p: Props) {
  const [temp, setTemp] = useState(REFERENCE_TEMPERATURE_C);
  const mat = CASTING_MATERIALS.find(m => m.id === p.castingMaterial) ?? CASTING_MATERIALS[0];
  if (!mat) return null;
  const profile = WORKSHOP_MATERIAL_PROFILES[p.castingMaterial];
  const data = useMemo(() => {
    const s3 = p.scale ** 3;
    const partCm3 = Math.abs(solidProps(p.geometry).volume) * s3 / 1000;
    const bb = p.boundingBox ?? new THREE.Box3().setFromBufferAttribute(p.geometry.getAttribute('position') as THREE.BufferAttribute);
    const sz = bb.getSize(new THREE.Vector3()).multiplyScalar(p.scale);
    const blockCm3 = ((sz.x + 2 * SILICONE_MOLD_WALL_MM) * (sz.y + 2 * SILICONE_MOLD_WALL_MM) * (sz.z + 2 * SILICONE_MOLD_WALL_MM)) / 1000;
    const siliconeCm3 = Math.max(0, blockCm3 - partCm3) * p.cavities;
    const castG = partCm3 * mat.density * p.cavities * (1 + HANDLING_ALLOWANCE);
    const risk = p.boundingBox ? demoldRisk(p.geometry, p.axis, p.offset, p.boundingBox, p.cutAngle) : null;
    const traps = p.boundingBox ? airTrapPoints(p.geometry, p.axis, p.boundingBox).length : 0;
    return { partCm3, siliconeG: siliconeCm3 * SILICONE_MOLD_DENSITY_G_CM3 * (1 + HANDLING_ALLOWANCE), castG, sz, risk, traps };
  }, [p.geometry, p.boundingBox, p.scale, p.cavities, p.axis, p.offset, p.cutAngle, mat.density]);

  const mix = profile.mixByWeight;
  const castSplit = splitByWeight(data.castG, mix);
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
        <div style={row}><span>Total to prepare (+10% handling allowance)</span><strong>{data.castG.toFixed(0)} g</strong></div>
        {castSplit && mix && <div style={row}><span>Plaster : water ({mix[0]}:{mix[1]} by weight)</span><strong>{castSplit[0].toFixed(0)} g + {castSplit[1].toFixed(0)} g</strong></div>}
        <div style={{ color: '#8a4b16', marginTop: 4 }}><strong>Before mixing:</strong> use the exact ratio printed in your product TDS. Resin and silicone ratios are product-specific.</div>
        {profile.workingMinutesAt25C && <div style={row}><span>Typical working-time range at 25 °C</span><span>{fmtRange(profile.workingMinutesAt25C, 'min')}</span></div>}
        <div style={row}><span>Typical demold range at 25 °C</span><span>{mat.demold}</span></div>
        <div style={{ color: '#555', marginTop: 4 }}>{temperatureGuidance(temp)}</div>
        <div style={row}><span>Release agent</span><span>{mat.release}</span></div>
        <div style={{ color: '#555', marginTop: 4 }}>{mat.notes}</div>

        {p.moldMode === 'silicone' && <>
          <div style={h}>Mold silicone ({mat.shore}, {mat.silicone})</div>
          <div style={row}><span>Silicone estimate ({SILICONE_MOLD_WALL_MM} mm walls, +10%)</span><strong>{data.siliconeG.toFixed(0)} g</strong></div>
          <div style={row}><span>Typical working-time range at 25 °C</span><span>{fmtRange(SILICONE_MOLD_WORK_MINUTES_AT_25C, 'min')}</span></div>
          <div style={row}><span>Typical cure range at 25 °C</span><span>{fmtRange(SILICONE_MOLD_CURE_HOURS_AT_25C, 'h')}</span></div>
          <div style={{ color: '#8a4b16', marginTop: 4 }}><strong>Before mixing:</strong> silicone may be 1:1, 100:10 or 100:5. Use your product's exact TDS ratio and minimum cure time.</div>
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
            temp >= 30 ? `It is ${temp} °C: working time may be shorter. Prepare a smaller batch and follow the TDS.` : 'Weigh both parts on a suitable scale, never by eye.',
            'Mix for the time stated in the TDS, scraping the sides and bottom without whipping in air.',
            'Pour a thin, steady stream into the lowest point and let the material rise through the cavity.',
            'Tap the mold or vibrate for 1 minute to lift bubbles.',
            'Top up the pour hole as it shrinks; demold only when fully hard.',
          ].map((t, i) => <li key={i}>{t}</li>)}
        </ol>
        <div style={{ marginTop: 12, fontSize: 11, color: '#666' }}>Planning estimates only — the product Technical Data Sheet (TDS) controls ratio, working time, cure, temperature, safety and release. Questions? WhatsApp Sirpam 3D Labs +91 97893 91798.</div>
      </article>
    </div>
  );
}
