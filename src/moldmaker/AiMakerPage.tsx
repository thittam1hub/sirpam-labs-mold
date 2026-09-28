import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Bounds } from '@react-three/drei';
import { Link, useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { ArrowLeft, Sparkles, Download, Send, ImagePlus, RotateCcw, Trash2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { generateShape, type ShapeSpec } from '@/lib/shapeAi.functions';
import { reserveFor, ACTION_COST, type Charge } from '@/lib/credits';
import { setAiHandoff } from '@/lib/aiHandoff';
import { useAppSession } from '@/components/AppSession';
import { buildFromSpec } from './mold/modelTools';
import { exportSTL } from './mold/exporters';
import { colors, radii, spacing, fontSizes, shadows, fonts } from './theme';

type Result = { id: number; prompt: string; spec: ShapeSpec; geometry: THREE.BufferGeometry; name: string };

const STYLES = ['Vase', 'Candle', 'Chocolate', 'Pendant', 'Coaster', 'Chess piece', 'Soap bar', 'Figurine base'];
const EXAMPLES = ['Heart-shaped chocolate, 40 mm wide', 'Tall vase with a wide belly, 120 mm', 'Twisted cone candle, 90 mm tall', 'Chess pawn, 50 mm tall'];
const REFINES = ['Make it taller', 'Make it wider', 'Add a rim on top', 'Smoother edges', 'Flat base'];

async function shrinkImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, 768 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85);
  } finally { URL.revokeObjectURL(url); }
}

function sizeOf(g: THREE.BufferGeometry) {
  g.computeBoundingBox();
  const v = g.boundingBox!.getSize(new THREE.Vector3());
  return `${v.x.toFixed(0)} x ${v.y.toFixed(0)} x ${v.z.toFixed(0)} mm`;
}

export default function AiMakerPage({ initialPrompt }: { initialPrompt?: string }) {
  const gen = useServerFn(generateShape);
  const navigate = useNavigate();
  const { session } = useAppSession(); const user = session?.user ?? null;
  const [prompt, setPrompt] = useState(initialPrompt ?? '');
  const [style, setStyle] = useState<string | null>(null);
  const [heightMm, setHeightMm] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const active = results.find(r => r.id === activeId) ?? null;
  const cost = ACTION_COST.ai_shape;

  const run = async (text: string) => {
    setBusy(true); setErr(null);
    let charge: Charge | null = null;
    try {
      charge = await reserveFor('ai_shape', setErr);
      if (!charge) return;
      const r = await gen({ data: { prompt: text, image: image ?? undefined, holdId: charge.holdId } });
      if (!r.ok) { await charge.fail(); setErr(`${r.error} Your credits were returned.`); return; }
      const g = await buildFromSpec(r.spec);
      g.computeVertexNormals();
      await charge.succeed();
      const name = `${r.spec.name.replace(/[^\w-]+/g, '_').slice(0, 40) || 'ai_shape'}.stl`;
      const id = Date.now();
      setResults(prev => [{ id, prompt: text, spec: r.spec, geometry: g, name }, ...prev].slice(0, 12));
      setActiveId(id);
    } catch (e) {
      await charge?.fail();
      setErr(e instanceof Error ? e.message : 'Could not make that shape.');
    } finally { setBusy(false); }
  };

  const fullPrompt = () => [style ? `A ${style.toLowerCase()}.` : '', prompt.trim(), heightMm ? `Overall height about ${heightMm} mm.` : ''].filter(Boolean).join(' ');
  const canGenerate = !busy && !!user && (!!prompt.trim() || !!image || !!style);

  const download = (r: Result) => {
    const blob = new Blob([exportSTL(r.geometry)], { type: 'model/stl' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = r.name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const useInStudio = (r: Result) => { setAiHandoff(r.spec, r.name); navigate({ to: '/studio', search: { step: 1 } }); };

  const card: React.CSSProperties = { background: colors.sectionBg, borderRadius: radii.lg, boxShadow: shadows.raisedSm, padding: spacing.lg };
  const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: 'none', borderRadius: radii.md, padding: spacing.md, background: colors.viewportBg, boxShadow: shadows.inset, color: colors.textPrimary, fontFamily: fonts.body, fontSize: fontSizes.sm };
  const chip = (on: boolean): React.CSSProperties => ({ border: 'none', borderRadius: 999, padding: '5px 11px', fontSize: fontSizes.xs, fontWeight: 600, fontFamily: fonts.body, cursor: 'pointer', background: on ? colors.primary : colors.sectionBg, color: on ? '#fff' : colors.textBody, boxShadow: on ? shadows.primary : shadows.raisedSm });
  const btn = (primary: boolean, disabled = false): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: 'none', borderRadius: radii.md, padding: '10px 14px', fontWeight: 700, fontSize: fontSizes.sm, fontFamily: fonts.body, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, background: primary ? colors.primary : colors.sectionBg, color: primary ? '#fff' : colors.textPrimary, boxShadow: primary ? shadows.primary : shadows.raisedSm, textDecoration: 'none' });
  const label: React.CSSProperties = { fontSize: fontSizes.xs, fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'block' };

  useEffect(() => () => results.forEach(r => r.geometry.dispose()), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div data-sirpam style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: colors.appBg, color: colors.textBody, fontFamily: fonts.body }}>
      <style>{`@media (max-width: 900px){.ai-grid{grid-template-columns:1fr !important}.ai-view{min-height:340px !important}}`}</style>
      <header style={{ display: 'flex', alignItems: 'center', gap: spacing.md, padding: `${spacing.md}px ${spacing.xl}px`, background: colors.panelBg, boxShadow: shadows.raisedSm, position: 'sticky', top: 0, zIndex: 5 }}>
        <Link to="/studio" style={btn(false)}><ArrowLeft size={16} aria-hidden="true" /> Studio</Link>
        <h1 style={{ margin: 0, fontFamily: fonts.display, fontSize: fontSizes.lg, color: colors.textPrimary, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={20} color={colors.primary} aria-hidden="true" /> AI Model Maker
        </h1>
        <span style={{ flex: 1 }} />
        <ThemeToggle />
      </header>

      <div className="ai-grid" style={{ flex: 1, display: 'grid', gridTemplateColumns: '380px 1fr 240px', gap: spacing.lg, padding: spacing.xl, minHeight: 0 }}>
        {/* Left: describe */}
        <section aria-label="Describe your model" style={{ ...card, display: 'flex', flexDirection: 'column', gap: spacing.md }}>
          <div>
            <span style={label}>Type of object</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {STYLES.map(s => <button key={s} type="button" style={chip(style === s)} aria-pressed={style === s} onClick={() => setStyle(style === s ? null : s)}>{s}</button>)}
            </div>
          </div>
          <div>
            <label htmlFor="ai-prompt" style={label}>Describe it</label>
            <textarea id="ai-prompt" style={{ ...input, minHeight: 110, resize: 'vertical' }} value={prompt} maxLength={900}
              onChange={e => setPrompt(e.target.value)} placeholder="e.g. a candle shaped like a twisted cone with a flat base"
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canGenerate) run(fullPrompt()); }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {EXAMPLES.map(ex => <button key={ex} type="button" style={chip(false)} onClick={() => setPrompt(ex)}>{ex}</button>)}
            </div>
          </div>
          <div>
            <label htmlFor="ai-height" style={label}>Height (mm, optional)</label>
            <input id="ai-height" type="number" min={5} max={400} style={input} value={heightMm} onChange={e => setHeightMm(e.target.value)} placeholder="e.g. 80" />
          </div>
          <div>
            <span style={label}>Photo to trace (optional)</span>
            <label style={{ ...btn(false), width: '100%', boxSizing: 'border-box' }}>
              <ImagePlus size={16} aria-hidden="true" /> {image ? 'Change photo' : 'Add a photo'}
              <input type="file" accept="image/*" aria-label="Photo to trace" style={{ display: 'none' }} onChange={async e => { const f = e.target.files?.[0]; setImage(f ? await shrinkImage(f) : null); }} />
            </label>
            {image && <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <img src={image} alt="Photo to trace" style={{ maxHeight: 80, borderRadius: radii.md }} />
              <button type="button" style={btn(false)} onClick={() => setImage(null)} aria-label="Remove photo"><Trash2 size={14} aria-hidden="true" /></button>
            </div>}
          </div>
          <span style={{ flex: 1 }} />
          {!user && <div style={{ fontSize: fontSizes.sm }}>
            <Link to="/auth" search={{ redirect: '/studio/ai' } as never} style={{ color: colors.primary, fontWeight: 700 }}>Sign in</Link> to use the AI Model Maker.
          </div>}
          <button type="button" style={btn(true, !canGenerate)} disabled={!canGenerate} onClick={() => run(fullPrompt())}>
            <Sparkles size={16} aria-hidden="true" /> {busy ? 'Designing… (up to a minute)' : `Generate model · ${cost} credits`}
          </button>
          <div style={{ fontSize: fontSizes.xs, color: colors.textDim, lineHeight: 1.5 }}>
            Credits are only taken if a model is made. Works best for round objects, flat shapes and simple toys. Check sizes before printing.
          </div>
          {err && <div role="alert" style={{ fontSize: fontSizes.sm, color: colors.primary, fontWeight: 600 }}>{err}</div>}
        </section>

        {/* Center: preview */}
        <section aria-label="Preview" className="ai-view" style={{ ...card, padding: 0, position: 'relative', overflow: 'hidden', minHeight: 420, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            {active ? <Preview geometry={active.geometry} /> : (
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', padding: spacing.xl, color: colors.textMuted }}>
                <div>
                  <Sparkles size={40} color={colors.primary} aria-hidden="true" />
                  <p style={{ fontSize: fontSizes.md, fontWeight: 600, color: colors.textPrimary, margin: '12px 0 4px' }}>{busy ? 'Designing your model…' : 'Your model will appear here'}</p>
                  <p style={{ fontSize: fontSizes.sm, margin: 0 }}>Pick a type, describe it, then press Generate.</p>
                </div>
              </div>
            )}
          </div>
          {active && <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderTop: `1px solid ${colors.borderSubtle}` }}>
            <span style={{ fontSize: fontSizes.sm, color: colors.textPrimary, fontWeight: 600 }}>{active.name.replace(/\.stl$/, '')}</span>
            <span style={{ fontSize: fontSizes.xs, color: colors.textMuted }}>{sizeOf(active.geometry)}</span>
            <span style={{ flex: 1 }} />
            <button type="button" style={btn(false)} onClick={() => download(active)}><Download size={15} aria-hidden="true" /> Download STL</button>
            <button type="button" style={btn(true)} onClick={() => useInStudio(active)}><Send size={15} aria-hidden="true" /> Make a mold from this</button>
          </div>}
          {active && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: `0 ${spacing.md}px ${spacing.md}px` }}>
            <span style={{ fontSize: fontSizes.xs, color: colors.textMuted, alignSelf: 'center' }}>Refine:</span>
            {REFINES.map(r => <button key={r} type="button" disabled={busy} style={chip(false)} onClick={() => run(`${active.prompt} Change: ${r.toLowerCase()}.`)}>{r}</button>)}
            <button type="button" disabled={busy} style={chip(false)} onClick={() => run(active.prompt)}><RotateCcw size={11} aria-hidden="true" /> Try again</button>
          </div>}
        </section>

        {/* Right: history */}
        <aside aria-label="This session" style={{ ...card, display: 'flex', flexDirection: 'column', gap: spacing.sm, overflowY: 'auto' }}>
          <span style={label}>This session</span>
          {results.length === 0 && <div style={{ fontSize: fontSizes.sm, color: colors.textDim }}>Models you make appear here so you can compare them.</div>}
          {results.map(r => (
            <button key={r.id} type="button" onClick={() => setActiveId(r.id)} aria-current={r.id === activeId}
              style={{ textAlign: 'left', border: 'none', borderRadius: radii.md, padding: spacing.sm, cursor: 'pointer', fontFamily: fonts.body, background: r.id === activeId ? colors.primaryAlpha : 'transparent', color: colors.textBody }}>
              <div style={{ fontSize: fontSizes.sm, fontWeight: 600, color: r.id === activeId ? colors.primary : colors.textPrimary }}>{r.name.replace(/\.stl$/, '')}</div>
              <div style={{ fontSize: fontSizes.xs, color: colors.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.prompt}</div>
            </button>
          ))}
        </aside>
      </div>
    </div>
  );
}

function Preview({ geometry }: { geometry: THREE.BufferGeometry }) {
  const dark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const bg = useMemo(() => (dark ? '#1c2027' : '#d1d9e6'), [dark]);
  return (
    <Canvas camera={{ position: [120, 90, 120], fov: 45, near: 0.1, far: 5000 }} style={{ position: 'absolute', inset: 0 }}>
      <color attach="background" args={[bg]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[100, 150, 80]} intensity={1.1} />
      <directionalLight position={[-80, 40, -60]} intensity={0.4} />
      <Bounds fit clip observe margin={1.4} key={geometry.uuid}>
        <mesh geometry={geometry}>
          <meshStandardMaterial color="#e8632b" roughness={0.45} metalness={0.05} />
        </mesh>
      </Bounds>
      <gridHelper args={[300, 30, dark ? '#3a414d' : '#aab4c3', dark ? '#2a303a' : '#c3cbd8']} />
      <OrbitControls makeDefault enableDamping />
    </Canvas>
  );
}
