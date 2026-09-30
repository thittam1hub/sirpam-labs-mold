import { useMemo, useState } from 'react';
import * as THREE from 'three';
import type { Axis, MoldMode } from '../types';
import { colors, radii, spacing, fontSizes, shadows } from '../theme';
import type { CastingMaterialId } from '../utils/tier2';
import {
  PRINT_SHRINK, CAST_SHRINK, POUR_PRESETS, shrinkScale, leakGuide, finishAdvisor, moldLife,
  type PourPreset, type Advice,
} from '../utils/shopAdvice';
import { embossModel, splitForBed, buildWaxTree, addModelBase, type Side } from '../mold/modelTools';
import { exportSTL } from '../mold/exporters';
import { addDraft } from '../mold/draftTool';
import { undercutFraction } from '../mold/draftAnalysis';
import { orientForPrint, solidProps } from '../utils/tier2';
import { packPlates } from '../utils/shopAdvice';
import { buildFromSpec } from '../mold/modelTools';
import { generateShape } from '@/lib/shapeAi.functions';
import { reserveFor, type Charge } from '@/lib/credits';
import { useServerFn } from '@tanstack/react-start';

const s = {
  section: { background: colors.sectionBg, borderRadius: radii.xl, padding: spacing.md + 4, boxShadow: shadows.raised },
  title: { fontSize: fontSizes.sm, fontWeight: 600, color: colors.textDim, marginBottom: spacing.sm + 2, textTransform: 'uppercase' as const, letterSpacing: 1.5 },
  sub: { fontSize: fontSizes.xs, fontWeight: 600, color: colors.textMuted, margin: `${spacing.md}px 0 ${spacing.xs}px`, textTransform: 'uppercase' as const, letterSpacing: 1 },
  hint: { fontSize: fontSizes.xs, color: colors.textDim, lineHeight: 1.4, marginTop: spacing.xs },
  row: { display: 'flex', gap: spacing.xs, flexWrap: 'wrap' as const },
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

function Slider({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginTop: spacing.xs }}>
      <div style={s.kv}><span>{label}</span><span>{value}{unit}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} style={{ width: '100%' }}
        aria-label={label} onChange={e => onChange(parseFloat(e.target.value))} />
    </div>
  );
}

function download(geo: THREE.BufferGeometry, name: string) {
  const blob = new Blob([exportSTL(geo)], { type: 'model/stl' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function AdviceList({ items }: { items: Advice[] }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 18 }}>
      {items.map((a, i) => (
        <li key={i} style={{ fontSize: fontSizes.xs, lineHeight: 1.45, marginTop: 4,
          color: a.level === 'warn' ? colors.primary : colors.textBody, fontWeight: a.level === 'warn' ? 600 : 400 }}>
          {a.level === 'warn' ? 'Warning: ' : a.level === 'ok' ? 'OK: ' : ''}{a.text}
        </li>
      ))}
    </ul>
  );
}

/* ═════════════ Step 2 (Mold): shrink/fit + pour presets ═════════════ */

/** Shrink % of each casting material (single source: tier2.castingMaterial). */
const CAST_TO_SHRINK: Partial<Record<CastingMaterialId, string>> = { pu_resin: 'pu', epoxy: 'epoxy', wax: 'wax', concrete: 'concrete' };
const METALS = CAST_SHRINK.filter(c => ['gold', 'silver', 'bronze'].includes(c.id));

export function MoldPrepPanel({ castingMaterial, scale, onScaleChange, onSetClearance, onApplyPreset }: {
  castingMaterial: CastingMaterialId;
  /** Shared print scale — the same value as Printer Fit. */
  scale: number;
  onScaleChange: (s: number) => void;
  onSetClearance: (mm: number) => void;
  onApplyPreset: (p: PourPreset) => void;
}) {
  const [printId, setPrintId] = useState('pla');
  const [metal, setMetal] = useState('');
  const [preset, setPreset] = useState<string | null>(null);
  const pr = PRINT_SHRINK.find(p => p.id === printId)!;
  const ca = CAST_SHRINK.find(c => c.id === (metal || CAST_TO_SHRINK[castingMaterial] || 'none'))!;
  const f = shrinkScale(pr.pct, ca.pct);
  const active = POUR_PRESETS.find(p => p.id === preset);

  return (
    <div style={s.section} id="sirpam-shop-prep">
      <div style={s.title}>What are you casting?</div>
      <div style={s.row}>
        {POUR_PRESETS.map(p => (
          <button key={p.id} type="button" style={s.chip(preset === p.id)} aria-pressed={preset === p.id}
            onClick={() => { setPreset(p.id); onApplyPreset(p); }}>{p.label}</button>
        ))}
      </div>
      <div style={s.hint}>{active ? active.notes : 'One click sets mold type, silicone thickness, pour hole size and casting material.'}</div>

      <div style={s.sub}>Shrink & fit compensation</div>
      <label style={s.hint}>Printer material
        <select style={s.input} value={printId} onChange={e => setPrintId(e.target.value)} aria-label="Print material">
          {PRINT_SHRINK.map(p => <option key={p.id} value={p.id}>{p.label} (~{p.pct}%)</option>)}
        </select>
      </label>
      <label style={s.hint}>Lost-wax metal (jewelry only)
        <select style={s.input} value={metal} onChange={e => setMetal(e.target.value)} aria-label="Lost-wax metal">
          <option value="">None — use casting material</option>
          {METALS.map(c => <option key={c.id} value={c.id}>{c.label} (~{c.pct}%)</option>)}
        </select>
      </label>
      <div style={{ ...s.kv, marginTop: spacing.sm }}><span>Cast shrink ({ca.label})</span><span>{ca.pct}%</span></div>
      <div style={s.kv}><span>Compensation</span><span>+{((f - 1) * 100).toFixed(2)}%</span></div>
      <div style={s.kv}><span>Print scale now</span><span>×{scale.toFixed(4)}</span></div>
      <div style={s.kv}><span>Suggested clearance</span><span>{pr.clearanceMm} mm</span></div>
      <button type="button" style={s.btn} onClick={() => onScaleChange(scale * f)}>
        Add shrink compensation to print scale
      </button>
      <button type="button" style={s.btn} onClick={() => onSetClearance(pr.clearanceMm)}>Use suggested clearance</button>
      <div style={s.hint}>Print scale is one setting shared with Printer Fit and Model, then Scale. Typical values — print a test piece to dial in your printer.</div>
    </div>
  );
}

/* ═════════════ Step 3 (Pro): model tools ═════════════ */

type Tool = 'emboss' | 'split' | 'tree' | 'base' | 'draft';

export function ModelToolsPanel({ geometry, fileName, bed, canUndo, onUndo, onReplaceModel, split }: {
  geometry: THREE.BufferGeometry | null; fileName: string | null;
  split?: { axis: Axis; offset: number; box: THREE.Box3 | null } | undefined;
  bed: { x: number; y: number; z: number } | null;
  canUndo: boolean; onUndo: () => void;
  onReplaceModel: (g: THREE.BufferGeometry, note: string) => void;
}) {
  const [tool, setTool] = useState<Tool>('emboss');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Emboss
  const [text, setText] = useState('SIRPAM');
  const [svg, setSvg] = useState<string | null>(null);
  const [side, setSide] = useState<Side>('+z');
  const [height, setHeight] = useState(8);
  const [depth, setDepth] = useState(1.2);
  const [mode, setMode] = useState<'raise' | 'engrave'>('raise');
  // Split
  const b = bed ?? { x: 220, y: 220, z: 250 };
  const [dowel, setDowel] = useState(1.75);
  const [pieces, setPieces] = useState<THREE.BufferGeometry[]>([]);
  // Tree
  const [count, setCount] = useState(8);
  const [tree, setTree] = useState<THREE.BufferGeometry | null>(null);
  // Base
  const [trim, setTrim] = useState(0);
  const [baseMm, setBaseMm] = useState(5);
  const [style, setStyle] = useState<'solid' | 'ring'>('solid');
  // Draft
  const [draftDeg, setDraftDeg] = useState(2);

  const baseName = (fileName ?? 'model').replace(/\.[^.]+$/, '');
  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setErr(null);
    try { await fn(); } catch (e) { setErr(e instanceof Error ? e.message : 'That did not work on this model.'); }
    finally { setBusy(false); }
  };
  if (!geometry) return null;

  return (
    <div style={s.section} id="sirpam-model-tools">
      <div style={s.title}>Model Tools</div>
      <div style={s.row}>
        {([['emboss', 'Logo / text'], ['split', 'Big-prop split'], ['tree', 'Wax tree'], ['base', 'Model base'], ['draft', 'Add draft']] as const).map(([k, l]) => (
          <button key={k} type="button" style={s.chip(tool === k)} aria-pressed={tool === k} onClick={() => setTool(k)}>{l}</button>
        ))}
      </div>

      {tool === 'emboss' && (<>
        <div style={s.hint}>Raise or engrave a name or logo onto the model — great for chocolate, soap and candle molds. Use Pro, then cavity count to repeat it across a tray.</div>
        <input style={{ ...s.input, marginTop: spacing.sm }} value={text} onChange={e => { setText(e.target.value); setSvg(null); }} aria-label="Emboss text" placeholder="Text" />
        <label style={{ ...s.hint, display: 'block' }}>…or an SVG logo:
          <input type="file" accept=".svg,image/svg+xml" aria-label="SVG logo" onChange={async e => {
            const f = e.target.files?.[0]; if (f) setSvg(await f.text());
          }} />
        </label>
        {svg && <div style={s.hint}>SVG loaded — text is ignored. <button type="button" style={{ ...s.chip(false), flex: 'none' }} onClick={() => setSvg(null)}>Clear</button></div>}
        <div style={{ ...s.row, marginTop: spacing.sm }}>
          {(['+z', '-z', '+x', '-x', '+y', '-y'] as Side[]).map(v => (
            <button key={v} type="button" style={s.chip(side === v)} onClick={() => setSide(v)} aria-label={`Side ${v}`}>{v.toUpperCase()}</button>
          ))}
        </div>
        <div style={{ ...s.row, marginTop: spacing.xs }}>
          <button type="button" style={s.chip(mode === 'raise')} onClick={() => setMode('raise')}>Raised</button>
          <button type="button" style={s.chip(mode === 'engrave')} onClick={() => setMode('engrave')}>Engraved</button>
        </div>
        <Slider label="Letter height" value={height} min={2} max={60} step={1} unit=" mm" onChange={setHeight} />
        <Slider label="Depth" value={depth} min={0.4} max={5} step={0.2} unit=" mm" onChange={setDepth} />
        <button type="button" style={s.btn} disabled={busy} onClick={() => run(async () => {
          const g = await embossModel(geometry, { text, svg: svg ?? undefined, side, heightMm: height, depthMm: depth, mode });
          onReplaceModel(g, `${mode === 'raise' ? 'Raised' : 'Engraved'} ${svg ? 'logo' : `"${text}"`}`);
        })}>{busy ? 'Working…' : 'Apply to model'}</button>
      </>)}

      {tool === 'split' && (<>
        <div style={s.hint}>Cuts an oversized prop into pieces that fit your printer bed, with matching dowel holes (use filament or dowel pins) so they line up.</div>
        <div style={s.kv}><span>Printer bed</span><span>{b.x}×{b.y}×{b.z} mm</span></div>
        <div style={s.hint}>{bed ? 'From the printer picked in Printer Fit.' : 'Default size — pick your printer in Printer Fit to use its bed.'}</div>
        <div style={s.row}>
          {[1.75, 3, 6].map(d => <button key={d} type="button" style={s.chip(dowel === d)} onClick={() => setDowel(d)}>{d} mm pin</button>)}
        </div>
        <button type="button" style={s.btn} disabled={busy} onClick={() => run(async () => {
          const r = await splitForBed(geometry, { bed: b, dowelDiameterMm: dowel, dowelDepthMm: 8 });
          setPieces(r.pieces);
          if (r.pieces.length <= 1) setErr('The model already fits this bed — no split needed.');
        })}>{busy ? 'Cutting…' : 'Split model'}</button>
        {pieces.length > 1 && (<div style={{ marginTop: spacing.sm }}>
          <div style={s.hint}>{pieces.length} pieces. Download each, or load one as the model to make a mold of it.</div>
          {pieces.map((p, i) => (
            <div key={i} style={{ ...s.row, marginTop: 4 }}>
              <button type="button" style={s.chip(false)} onClick={() => download(p, `${baseName}_piece${i + 1}.stl`)}>Piece {i + 1} STL</button>
              <button type="button" style={s.chip(false)} onClick={() => onReplaceModel(p, `Using piece ${i + 1}`)}>Use as model</button>
            </div>
          ))}
        </div>)}
      </>)}

      {tool === 'tree' && (<>
        <div style={s.hint}>For jewelry lost-wax casting: arranges copies of the model around a central sprue with gates and a base button, ready to print in castable resin.</div>
        <Slider label="Number of parts" value={count} min={2} max={24} step={1} unit="" onChange={setCount} />
        <button type="button" style={s.btn} disabled={busy} onClick={() => run(async () => {
          setTree(await buildWaxTree(geometry, { count, sprueDiameterMm: 6, gateDiameterMm: 2.5, gapMm: 6 }));
        })}>{busy ? 'Building…' : 'Build tree'}</button>
        {tree && (<div style={s.row}>
          <button type="button" style={s.chip(false)} onClick={() => download(tree, `${baseName}_wax_tree.stl`)}>Download tree STL</button>
          <button type="button" style={s.chip(false)} onClick={() => onReplaceModel(tree, 'Wax tree')}>Show in viewer</button>
        </div>)}
        <div style={s.hint}>Check your flask size. Gates attach at each part's centre — move them to a hidden spot in your modeling tool if needed.</div>
      </>)}

      {tool === 'base' && (<>
        <div style={s.hint}>For dental and medical scans: trims the ragged bottom edge and adds a flat base (Z is treated as up).</div>
        <Slider label="Trim bottom" value={trim} min={0} max={50} step={1} unit="%" onChange={setTrim} />
        <Slider label="Base height" value={baseMm} min={2} max={20} step={1} unit=" mm" onChange={setBaseMm} />
        <div style={s.row}>
          <button type="button" style={s.chip(style === 'solid')} onClick={() => setStyle('solid')}>Solid base</button>
          <button type="button" style={s.chip(style === 'ring')} onClick={() => setStyle('ring')}>Hollow (saves resin)</button>
        </div>
        <button type="button" style={s.btn} disabled={busy} onClick={() => run(async () => {
          onReplaceModel(await addModelBase(geometry, { trimPct: trim, baseMm, marginMm: 2, style, wallMm: 2.5 }), 'Added model base');
        })}>{busy ? 'Working…' : 'Add base'}</button>
      </>)}

      {tool === 'draft' && (<>
        <div style={s.hint}>Tapers the model slightly away from the split line so casts slide out without tearing. 1–3° is typical; the model narrows by about 0.5 mm per 15 mm of height at 2°.</div>
        <Slider label="Draft angle" value={draftDeg} min={0.5} max={3} step={0.5} unit="°" onChange={setDraftDeg} />
        <button type="button" style={s.btn} disabled={busy || !split?.box} onClick={() => run(async () => {
          if (!split?.box) throw new Error('Load a model first.');
          onReplaceModel(addDraft(geometry, split.box, split.axis, split.offset, draftDeg), `Added ${draftDeg}° draft`);
        })}>{busy ? 'Working…' : 'Add draft'}</button>
        <div style={s.hint}>Best for simple shapes (cups, soaps, candles, plaques). Fine surface detail changes size slightly, so check the model after. Undo is below.</div>
      </>)}

      {err && <div role="alert" style={{ ...s.hint, color: colors.primary, fontWeight: 600 }}>{err}</div>}
      {canUndo && <button type="button" style={s.btn} onClick={onUndo}>Undo last model change</button>}
    </div>
  );
}

/* ═════════════ Step 4 (Finish): leak, finish, life ═════════════ */

export function FinishAdvisorPanel({ geometry, boundingBox, axis, offset, cutAngle, moldMode, wallMm, castingMaterial, printer }: {
  geometry: THREE.BufferGeometry | null; boundingBox: THREE.Box3 | null; axis: Axis; offset: number; cutAngle: number;
  moldMode: MoldMode; wallMm: number; castingMaterial: CastingMaterialId; printer: 'fdm' | 'resin';
}) {
  const leak = leakGuide({ moldMode, wallMm, castingMaterial, printer });
  const finish = useMemo(() => (geometry ? finishAdvisor(geometry, printer) : null), [geometry, printer]);
  const undercutPct = useMemo(
    () => (geometry && boundingBox ? undercutFraction(geometry, axis, offset, boundingBox, cutAngle) * 100 : 0),
    [geometry, boundingBox, axis, offset, cutAngle],
  );
  const life = moldLife({ moldMode, castingMaterial, wallMm, undercutPct, printer });
  if (!geometry) return null;
  return (
    <div style={s.section} id="sirpam-finish-advisor">
      <div style={s.title}>Print & Cast Advisor</div>
      <div style={s.sub}>Leak-proof printing</div>
      <AdviceList items={leak} />
      {finish && (<>
        <div style={s.sub}>Surface finish</div>
        <div style={s.kv}><span>Layer-line risk ({finish.currentLabel})</span><span>{finish.currentPct.toFixed(0)}% of surface</span></div>
        {finish.bestPct < finish.currentPct - 3 && (
          <div style={s.hint}>Printing the master with {finish.bestLabel} drops that to {finish.bestPct.toFixed(0)}%.</div>
        )}
        <AdviceList items={finish.tips.map(t => ({ level: 'info' as const, text: t }))} />
      </>)}
      <div style={s.sub}>Mold life</div>
      <div style={s.kv}><span>Expected casts</span><span>about {life.low}–{life.high}</span></div>
      <div style={s.hint}>{life.note} Undercuts: {undercutPct.toFixed(1)}% of surface. Rough estimate only.</div>
    </div>
  );
}

/* ═════════════ Finish: print-farm plate packer ═════════════ */

export function PlatePackerPanel({ pieces, bed, material, pricePerKg }: {
  pieces: THREE.BufferGeometry[]; bed: { x: number; y: number; z: number } | null;
  material: 'pla' | 'resin'; pricePerKg: number;
}) {
  const [copies, setCopies] = useState(4);
  const b = bed ?? { x: 220, y: 220, z: 250 };
  const info = useMemo(() => pieces.map(g => {
    const o = orientForPrint(g);
    const sz = o.boundingBox!.getSize(new THREE.Vector3());
    const vol = solidProps(o).volume / 1000;
    o.dispose();
    return { w: sz.x, d: sz.y, h: sz.z, vol };
  }), [pieces]);
  const items = useMemo(() => Array.from({ length: copies }, () => info).flat(), [info, copies]);
  const pack = useMemo(() => packPlates(items, b), [items, b.x, b.y, b.z]);
  if (!pieces.length) return null;
  const density = material === 'resin' ? 1.1 : 1.24;
  const perCopy = info.reduce((s2, i) => s2 + i.vol, 0) * density * pricePerKg / 1000;
  const first = pack.layout.filter(l => l.plate === 0);
  const sc = 180 / Math.max(b.x, b.y);
  return (
    <div style={s.section} id="sirpam-plate-packer">
      <div style={s.title}>Print Farm Planner</div>
      <Slider label="Molds to make" value={copies} min={1} max={40} step={1} unit="" onChange={setCopies} />
      <div style={s.kv}><span>Bed</span><span>{b.x}×{b.y}×{b.z} mm{bed ? '' : ' (pick a printer for yours)'}</span></div>
      <div style={s.kv}><span>Plates needed</span><span>{pack.plates}</span></div>
      <div style={s.kv}><span>Pieces per plate</span><span>about {pack.perPlate}</span></div>
      <div style={s.kv}><span>Material per mold</span><span>{perCopy.toFixed(2)}</span></div>
      <div style={s.kv}><span>Material total</span><span>{(perCopy * copies).toFixed(2)}</span></div>
      {pack.tooTall && <div style={{ ...s.hint, color: colors.primary }}>Some pieces are taller than the bed.</div>}
      {pack.tooWide && <div style={{ ...s.hint, color: colors.primary }}>Some pieces don't fit the bed at all — try Big-prop split.</div>}
      <svg width={b.x * sc} height={b.y * sc} style={{ marginTop: spacing.sm, background: colors.viewportBg, borderRadius: radii.md }} aria-label="Plate 1 layout">
        {first.map((l, i) => <rect key={i} x={l.x * sc} y={l.y * sc} width={l.w * sc} height={l.d * sc} fill={colors.primary} opacity={0.7} rx={2} />)}
      </svg>
      <div style={s.hint}>Plate 1 layout, pieces laid flat with 5 mm gaps. Cost uses your price per kg from Material & Cost. Rough plan — your slicer has the final say.</div>
    </div>
  );
}

/* ═════════════ Model step: AI shape from text / photo ═════════════ */

async function shrinkImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, 1024 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85);
  } finally { URL.revokeObjectURL(url); }
}

export function AiShapePanel({ onCommit }: { onCommit: (g: THREE.BufferGeometry, name: string) => void }) {
  const gen = useServerFn(generateShape);
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const go = async () => {
    setBusy(true); setErr(null);
    let charge: Charge | null = null;
    try {
      charge = await reserveFor('ai_shape', setErr);
      if (!charge) return;
      const r = await gen({ data: { prompt, image: image ?? undefined, holdId: charge.holdId } });
      if (!r.ok) { await charge.fail(); setErr(`${r.error} Your credits were returned.`); return; }
      const g = await buildFromSpec(r.spec);
      await charge.succeed();
      onCommit(g, `${r.spec.name.replace(/[^\w-]+/g, '_').slice(0, 40) || 'ai_shape'}.stl`);
    } catch (e) {
      await charge?.fail();
      setErr(e instanceof Error ? e.message : 'Could not make that shape.');
    } finally { setBusy(false); }
  };
  return (
    <div style={s.section} id="sirpam-ai-shape">
      <div style={s.title}>Make a model with AI</div>
      <div style={s.hint}>Describe a simple object, or add a photo to trace its outline. Works best for round things (vases, candles), flat shapes (chocolates, pendants) and simple toys.</div>
      <textarea style={{ ...s.input, minHeight: 64, marginTop: spacing.sm, resize: 'vertical' }} value={prompt} maxLength={1000}
        onChange={e => setPrompt(e.target.value)} aria-label="Describe the object" placeholder="e.g. a 90 mm tall candle shaped like a twisted cone" />
      <div style={{ ...s.row, marginTop: spacing.xs }}>
        {['Heart-shaped chocolate, 40 mm', 'Tall vase with a wide belly', 'Chess pawn, 50 mm'].map(ex => (
          <button key={ex} type="button" style={s.chip(false)} onClick={() => setPrompt(ex)}>{ex}</button>
        ))}
      </div>
      <label style={{ ...s.btn, display: 'block', textAlign: 'center', cursor: 'pointer' }}>
        {image ? 'Change photo' : 'Add a photo (optional)'}
        <input type="file" accept="image/*" aria-label="Photo to trace" style={{ display: 'none' }} onChange={async e => {
          const f = e.target.files?.[0]; setImage(f ? await shrinkImage(f) : null);
        }} />
      </label>
      {image && <img src={image} alt="Photo to trace" style={{ maxWidth: '100%', maxHeight: 120, borderRadius: radii.md, marginTop: spacing.xs }} />}
      <button type="button" style={s.btn} disabled={busy || (!prompt.trim() && !image)} onClick={go}>
        {busy ? 'Designing… (up to a minute)' : 'Generate model'}
      </button>
      {err && <div role="alert" style={{ ...s.hint, color: colors.primary, fontWeight: 600 }}>{err}</div>}
      <div style={s.hint}>AI-powered. Uses AI credits for each model. Check sizes before printing.</div>
    </div>
  );
}
