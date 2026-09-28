import { useMemo, useState } from 'react';
import * as THREE from 'three';
import type { Axis, MoldMode } from '../types';
import { colors, radii, spacing, fontSizes, shadows } from '../theme';
import { repairModel, reduceDetail, transformModel, describeRepair, type UpAxis } from '../mold/meshFix';
import { reserveFor } from '@/lib/credits';
import { CASTING_MATERIALS, solidProps, type CastingMaterialId } from '../utils/tier2';
import { leakGuide } from '../utils/shopAdvice';
import { MATERIALS } from '../utils/costEstimate';

const s = {
  section: { background: colors.sectionBg, borderRadius: radii.xl, padding: spacing.md + 4, boxShadow: shadows.raised },
  title: { fontSize: fontSizes.sm, fontWeight: 600, color: colors.textDim, marginBottom: spacing.sm + 2, textTransform: 'uppercase' as const, letterSpacing: 1.5 },
  sub: { fontSize: fontSizes.xs, fontWeight: 600, color: colors.textMuted, margin: `${spacing.md}px 0 ${spacing.xs}px`, textTransform: 'uppercase' as const, letterSpacing: 1 },
  hint: { fontSize: fontSizes.xs, color: colors.textDim, lineHeight: 1.4, marginTop: spacing.xs },
  row: { display: 'flex', gap: spacing.xs, flexWrap: 'wrap' as const, alignItems: 'center' },
  chip: (active: boolean) => ({
    flex: 1, minWidth: 44, padding: `${spacing.sm}px ${spacing.xs}px`, borderRadius: radii.md, border: 'none', fontFamily: 'inherit',
    background: colors.sectionBg, boxShadow: active ? shadows.inset : shadows.raisedSm,
    color: active ? colors.primary : colors.textMuted, cursor: 'pointer', fontWeight: 600, fontSize: fontSizes.xs,
  }),
  btn: {
    width: '100%', marginTop: spacing.sm, padding: `${spacing.sm}px ${spacing.md}px`, borderRadius: radii.pill, border: 'none', cursor: 'pointer',
    background: colors.sectionBg, color: colors.textBody, boxShadow: shadows.raisedSm, fontWeight: 600, fontSize: fontSizes.sm, fontFamily: 'inherit',
  },
  kv: { display: 'flex', justifyContent: 'space-between', fontSize: fontSizes.sm, color: colors.textBody, padding: '2px 0' },
  input: {
    width: '100%', padding: `${spacing.xs + 2}px ${spacing.sm}px`, borderRadius: radii.md, border: 'none', fontFamily: 'inherit',
    background: colors.sectionBg, boxShadow: shadows.inset, color: colors.textBody, fontSize: fontSizes.sm,
  },
};

const triCount = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.attributes['position']!.count) / 3;
const tick = () => new Promise(r => setTimeout(r, 30));

/* ───────────── Fix & fit (Model step) ───────────── */

export function ModelFixPanel({ geometry, onReplaceModel, scale, onSetScale }: {
  geometry: THREE.BufferGeometry | null;
  onReplaceModel: (g: THREE.BufferGeometry, note: string) => void;
  /** Single source of truth for print scale (same value as Printer Fit). */
  scale: number;
  onSetScale: (s: number) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [target, setTarget] = useState(200_000);
  const [axis, setAxis] = useState<UpAxis>('z');
  const [size, setSize] = useState('');
  const [rot, setRot] = useState({ rx: 0, ry: 0, rz: 0 });

  const info = useMemo(() => {
    if (!geometry) return null;
    geometry.computeBoundingBox();
    return { tris: triCount(geometry), size: geometry.boundingBox!.getSize(new THREE.Vector3()) };
  }, [geometry]);

  if (!geometry || !info) return null;

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label); setMsg(null);
    await tick();
    try { await fn(); } catch (e) { setMsg(e instanceof Error ? e.message : 'Something went wrong.'); }
    finally { setBusy(null); }
  };

  const doRepair = () => run('Repairing…', async () => {
    const charge = await reserveFor('auto_repair', setMsg);
    if (!charge) return;
    let res;
    try { res = await repairModel(geometry); } catch (e) { await charge.fail(); throw e; }
    const { geometry: g, report } = res;
    if (report.solidOk) await charge.succeed(); else await charge.fail();
    const txt = `Repaired: ${describeRepair(report)}.`;
    onReplaceModel(g, txt);
    setMsg(!report.solidOk ? `${txt} Some damage is too deep to fix automatically.` : report.rebuilt ? `${txt} The file was badly damaged, so the surface was rebuilt — fine details may be softer. A cleaner source file gives a sharper mold.` : `${txt} Full detail kept — the model is now a clean solid.`);
  });
  const doReduce = () => run('Reducing…', async () => {
    const { geometry: g, report } = await reduceDetail(geometry, target);
    onReplaceModel(g, `Detail reduced from ${report.inputTris.toLocaleString()} to ${report.outputTris.toLocaleString()} triangles`);
    setMsg(`Now ${report.outputTris.toLocaleString()} triangles${report.solidOk ? ', clean solid' : ''}.${report.rebuilt ? ' The file was badly damaged, so the surface was rebuilt — fine details may be softer.' : ' Fine details kept.'}`);
  });
  const doFit = () => run('Applying…', async () => {
    const mm = parseFloat(size);
    const rotated = rot.rx || rot.ry || rot.rz;
    const g = rotated ? transformModel(geometry, { ...rot, axis }) : geometry!;
    if (!g.boundingBox) g.computeBoundingBox();
    const b = g.boundingBox!.getSize(new THREE.Vector3());
    if (rotated) onReplaceModel(g, `Model turned — now ${b.x.toFixed(1)} × ${b.y.toFixed(1)} × ${b.z.toFixed(1)} mm`);
    if (Number.isFinite(mm) && mm > 0 && b[axis] > 0) {
      const sc = mm / b[axis];
      onSetScale(sc);
      setMsg(`Print scale set to ×${sc.toFixed(3)} (same setting as Printer Fit).`);
    }
    setRot({ rx: 0, ry: 0, rz: 0 });
  });

  const big = info.tris > 300_000;
  return (
    <div style={s.section} data-testid="model-fix-panel">
      <div style={s.title}>Fix & fit model</div>
      <div style={s.kv}><span>Size</span><span>{info.size.x.toFixed(1)} × {info.size.y.toFixed(1)} × {info.size.z.toFixed(1)} mm</span></div>
      <div style={s.kv}><span>Detail</span><span>{info.tris.toLocaleString()} triangles</span></div>

      <div style={s.sub}>Auto-repair</div>
      <button style={s.btn} disabled={!!busy} onClick={doRepair}>Repair broken model</button>
      <div style={s.hint}>Joins loose edges, removes broken and overlapping faces, turns inside-out faces and closes holes.</div>

      <div style={s.sub}>Reduce detail {big && <span style={{ color: colors.primary }}>· recommended</span>}</div>
      <div style={s.row}>
        {[50_000, 100_000, 200_000, 400_000].map(t => (
          <button key={t} style={s.chip(target === t)} onClick={() => setTarget(t)}>{t / 1000}k</button>
        ))}
      </div>
      <button style={s.btn} disabled={!!busy || info.tris <= target} onClick={doReduce}>Reduce to ~{(target / 1000).toFixed(0)}k triangles</button>
      <div style={s.hint}>Makes big files much faster and also repairs them. 200k keeps fine detail for most prints; lower is faster.</div>

      <div style={s.sub}>Scale & rotate</div>
      <div style={s.row}>
        <input style={{ ...s.input, flex: 2 }} type="number" min={0} placeholder="Target size (mm)" value={size} onChange={e => setSize(e.target.value)} aria-label="Target size in mm" />
        {(['x', 'y', 'z'] as UpAxis[]).map(a => (
          <button key={a} style={s.chip(axis === a)} onClick={() => setAxis(a)}>{a === 'z' ? 'Height' : a === 'x' ? 'Width' : 'Depth'}</button>
        ))}
      </div>
      <div style={{ ...s.row, marginTop: spacing.xs }}>
        {(['rx', 'ry', 'rz'] as const).map(k => (
          <button key={k} style={s.chip(rot[k] !== 0)} onClick={() => setRot(r => ({ ...r, [k]: (r[k] + 90) % 360 }))}>
            Turn {k[1]!.toUpperCase()} {rot[k]}°
          </button>
        ))}
      </div>
      <button style={s.btn} disabled={!!busy || (!size && !rot.rx && !rot.ry && !rot.rz)} onClick={doFit}>Apply size & rotation</button>
      <div style={s.hint}>Example: type 60 with Height selected for a 60 mm tall figure. Size sets the one print scale shared with Printer Fit (now ×{scale.toFixed(3)}). Each Turn click adds 90°.</div>

      {busy && <div style={{ ...s.hint, color: colors.primary }}>{busy} large files can take up to a minute.</div>}
      {msg && <div style={{ ...s.hint, color: colors.textBody }}>{msg}</div>}
    </div>
  );
}

/* ───────────── Mold report (Finish step) ───────────── */

function renderPreview(pieces: THREE.BufferGeometry[], model: THREE.BufferGeometry | null): string {
  try {
    const W = 900, H = 560;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(W, H);
    renderer.setClearColor(0xf5efe6, 1);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x887766, 1.6));
    const dl = new THREE.DirectionalLight(0xffffff, 1.8); dl.position.set(1, -1.5, 2); scene.add(dl);
    const palette = [0xe8632b, 0x8a8278, 0xc9a27a, 0x5c6b73];
    const group = new THREE.Group();
    // Explode pieces away from the common centre so every half is visible.
    const all = new THREE.Box3();
    pieces.forEach(p => { p.computeBoundingBox(); all.union(p.boundingBox!); });
    const c = all.getCenter(new THREE.Vector3());
    const span = all.getSize(new THREE.Vector3()).length();
    pieces.forEach((p, i) => {
      const m = new THREE.Mesh(p, new THREE.MeshStandardMaterial({ color: palette[i % palette.length]!, roughness: 0.6 }));
      const pc = p.boundingBox!.getCenter(new THREE.Vector3()).sub(c);
      if (pc.lengthSq() > 1e-9) m.position.copy(pc.normalize().multiplyScalar(span * 0.25));
      group.add(m);
    });
    if (model) group.add(new THREE.Mesh(model, new THREE.MeshStandardMaterial({ color: 0x1c1a17, roughness: 0.5 })));
    scene.add(group);
    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    const r = box.getSize(new THREE.Vector3()).length() / 2;
    const cam = new THREE.PerspectiveCamera(35, W / H, r / 100, r * 20);
    cam.up.set(0, 0, 1);
    cam.position.copy(center).add(new THREE.Vector3(1.2, -1.6, 1.0).normalize().multiplyScalar(r * 3));
    cam.lookAt(center);
    renderer.render(scene, cam);
    const url = renderer.domElement.toDataURL('image/png');
    renderer.dispose();
    return url;
  } catch { return ''; }
}

const esc = (t: string) => t.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!));

export function MoldReportPanel(p: {
  geometry: THREE.BufferGeometry | null;
  pieces: THREE.BufferGeometry[];
  labels: string[];
  fileName: string;
  moldMode: MoldMode;
  axis: Axis;
  castingMaterial: CastingMaterialId;
  siliconeVolumeCm3: number;
  printMaterial: 'pla' | 'resin';
  pricePerKg: number;
  siliconePricePerLiter: number;
  wallMm: number;
  printer: 'fdm' | 'resin';
}) {
  const [err, setErr] = useState<string | null>(null);
  if (!p.geometry || p.pieces.length === 0) return null;

  const open = async () => {
    setErr(null);
    const charge = await reserveFor('mold_report', setErr);
    if (!charge) return;
    const win = window.open('', '_blank');
    if (!win) { await charge.fail(); setErr('Your browser blocked the new tab. Allow pop-ups for this site and try again.'); return; }
    const model = p.geometry!;
    model.computeBoundingBox();
    const ms = model.boundingBox!.getSize(new THREE.Vector3());
    const cast = CASTING_MATERIALS.find(c => c.id === p.castingMaterial) ?? CASTING_MATERIALS[0]!;
    const modelVol = solidProps(model).volume / 1000;
    const mat = MATERIALS[p.printMaterial];
    let totalCm3 = 0;
    const rows = p.pieces.map((g, i) => {
      g.computeBoundingBox();
      const sz = g.boundingBox!.getSize(new THREE.Vector3());
      const v = Math.abs(solidProps(g).volume) / 1000;
      totalCm3 += v;
      const grams = v * mat.densityGPerCm3;
      return `<tr><td>${esc(p.labels[i] ?? `Piece ${i + 1}`)}</td><td>${sz.x.toFixed(1)} × ${sz.y.toFixed(1)} × ${sz.z.toFixed(1)} mm</td><td>${v.toFixed(1)} cm³</td><td>${grams.toFixed(0)} g</td><td>${(grams / 1000 * p.pricePerKg).toFixed(2)}</td><td>${(v / mat.cm3PerHour).toFixed(1)} h</td></tr>`;
    }).join('');
    const printCost = totalCm3 * mat.densityGPerCm3 / 1000 * p.pricePerKg;
    const silCost = p.moldMode === 'silicone' ? p.siliconeVolumeCm3 / 1000 * p.siliconePricePerLiter : 0;
    const tips = leakGuide({ moldMode: p.moldMode, wallMm: p.wallMm, castingMaterial: p.castingMaterial, printer: p.printer });
    const img = renderPreview(p.pieces, null);
    const imgModel = renderPreview([], model);
    const date = new Date().toLocaleDateString();
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Mold report — ${esc(p.fileName || 'model')}</title>
<style>
body{font-family:'DM Sans',system-ui,sans-serif;color:#1C1A17;background:#fff;max-width:900px;margin:24px auto;padding:0 24px;line-height:1.45}
h1,h2{font-family:'Space Grotesk',system-ui,sans-serif;margin:0 0 6px}h1{font-size:26px}h2{font-size:17px;margin-top:22px;border-bottom:2px solid #E8632B;padding-bottom:4px}
.muted{color:#6b6359;font-size:13px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.grid img{width:100%;border-radius:10px;border:1px solid #e6ddd0}
table{width:100%;border-collapse:collapse;font-size:13px}td,th{text-align:left;padding:6px 8px;border-bottom:1px solid #eee}th{background:#F5EFE6}
.kv td:first-child{color:#6b6359;width:40%}li{margin:4px 0;font-size:13px}.warn{color:#b3471a}
.bar{display:flex;justify-content:space-between;align-items:center}button{background:#E8632B;color:#fff;border:0;border-radius:999px;padding:8px 18px;font-weight:600;cursor:pointer}
@media print{button{display:none}body{margin:0}}
</style></head><body>
<div class="bar"><div><h1>Sirpam 3D Labs · Mold report</h1><div class="muted">${esc(p.fileName || 'Untitled model')} · ${date}</div></div><button onclick="print()">Save as PDF</button></div>
<h2>Before / after</h2><div class="grid"><div>${imgModel ? `<img src="${imgModel}" alt="Original model">` : ''}<div class="muted">Before: your model</div></div><div>${img ? `<img src="${img}" alt="Mold pieces">` : ''}<div class="muted">After: mold pieces (pulled apart)</div></div></div>
<h2>Model</h2><table class="kv">
<tr><td>Size</td><td>${ms.x.toFixed(1)} × ${ms.y.toFixed(1)} × ${ms.z.toFixed(1)} mm</td></tr>
<tr><td>Volume (casting material needed)</td><td>${modelVol.toFixed(1)} cm³ · about ${(modelVol * cast.density).toFixed(0)} g of ${esc(cast.label)} (add 10–15% for the pour hole)</td></tr>
<tr><td>Mold type</td><td>${p.moldMode === 'silicone' ? 'Silicone mold with printed box' : 'Printed rigid mold'} · split across ${p.axis.toUpperCase()}</td></tr>
</table>
<h2>Pieces to print</h2><table><tr><th>Piece</th><th>Size</th><th>Volume</th><th>Weight</th><th>Cost</th><th>Print time</th></tr>${rows}</table>
<p class="muted">${esc(mat.label)} at ${p.pricePerKg}/kg. Total print ≈ ${printCost.toFixed(2)}${silCost ? ` + silicone ${(p.siliconeVolumeCm3 / 1000).toFixed(2)} L ≈ ${silCost.toFixed(2)}` : ''}. Estimates only.</p>
<h2>Casting</h2><table class="kv">
<tr><td>Material</td><td>${esc(cast.label)}</td></tr><tr><td>Silicone</td><td>${esc(cast.silicone)} · Shore ${esc(cast.shore)}</td></tr>
<tr><td>Release agent</td><td>${esc(cast.release)}</td></tr><tr><td>Pour temperature</td><td>about ${cast.pourTempC} °C</td></tr>
<tr><td>Demold after</td><td>${esc(cast.demold)}</td></tr><tr><td>Note</td><td>${esc(cast.notes)}</td></tr></table>
<h2>Pour tips</h2><ul>${tips.map(t => `<li class="${t.level === 'warn' ? 'warn' : ''}">${esc(t.text)}</li>`).join('')}</ul>
<p class="muted">Made with Sirpam 3D Labs Mold.</p></body></html>`;
    win.document.open(); win.document.write(html); win.document.close();
    await charge.succeed();
  };

  return (
    <div style={s.section} data-testid="mold-report-panel">
      <div style={s.title}>Mold report</div>
      <div style={s.hint}>A one-page summary with before/after pictures, sizes, material, cost and pour tips. Opens in a new tab — press "Save as PDF" to keep or print it.</div>
      <button style={s.btn} onClick={open}>Open mold report</button>
      {err && <div style={{ ...s.hint, color: colors.primary }}>{err}</div>}
    </div>
  );
}
