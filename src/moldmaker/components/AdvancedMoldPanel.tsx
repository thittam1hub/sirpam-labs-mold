import { useMemo, useState } from 'react';
import type * as THREE from 'three';
import type { Axis, MoldMode, SiliconeMoldType } from '../types';
import type { SealType } from '../mold/moldFeatures';
import { colors, radii, spacing, fontSizes, shadows } from '../theme';
import { CASTING_MATERIALS, adviseGate, solidProps, type CastingMaterialId, type GateAdvice } from '../utils/tier2';

export interface Tier2Settings {
  seal: SealType;
  pryPockets: boolean;
  radialSegments: 0 | 3 | 4 | 6;
  siliconeSides: { enabled: boolean; top: number; bottom: number; sides: number };
  cavityCount: number;
  cavitySpacingMm: number;
  orientForPrint: boolean;
  castingMaterial: CastingMaterialId;
  /** Optional so projects saved before these existed still load. */
  hollowCore?: { enabled: boolean; wallMm: number; opening: 'top' | 'bottom' };
  runner?: boolean;
  /** Round 6 (rigid molds). Optional so older projects still load. */
  moldStyle?: 'standard' | 'reliefTray' | 'pressMold' | 'slipCast';
  curvedSplit?: boolean;
  clampBoltMm?: 0 | 3 | 4 | 5;
  autoVents?: boolean;
  standFins?: boolean;
}

export const DEFAULT_TIER2: Tier2Settings = {
  seal: 'pins',
  pryPockets: false,
  radialSegments: 0,
  siliconeSides: { enabled: false, top: 10, bottom: 10, sides: 10 },
  cavityCount: 1,
  cavitySpacingMm: 8,
  orientForPrint: true,
  castingMaterial: 'pu_resin',
  hollowCore: { enabled: false, wallMm: 3, opening: 'top' },
  runner: false,
  moldStyle: 'standard',
  curvedSplit: false,
  clampBoltMm: 0,
  autoVents: false,
  standFins: false,
};

interface Props {
  settings: Tier2Settings;
  onChange: (patch: Partial<Tier2Settings>) => void;
  geometry: THREE.BufferGeometry | null;
  axis: Axis;
  moldMode: MoldMode;
  siliconeType: SiliconeMoldType;
  cutAngle: number;
  formFit: boolean;
  siliconeVolumeCm3: number;
  onApplyGate: (g: GateAdvice) => void;
}

const s = {
  section: { background: colors.sectionBg, borderRadius: radii.xl, padding: spacing.md + 4, boxShadow: shadows.raised },
  title: { fontSize: fontSizes.sm, fontWeight: 600, color: colors.textDim, marginBottom: spacing.sm + 2, textTransform: 'uppercase' as const, letterSpacing: 1.5 },
  sub: { fontSize: fontSizes.xs, fontWeight: 600, color: colors.textMuted, margin: `${spacing.md}px 0 ${spacing.xs}px`, textTransform: 'uppercase' as const, letterSpacing: 1 },
  label: { fontSize: fontSizes.sm, color: colors.textBody },
  hint: { fontSize: fontSizes.xs, color: colors.textDim, lineHeight: 1.4, marginTop: spacing.xs },
  row: { display: 'flex', gap: spacing.xs, flexWrap: 'wrap' as const },
  chip: (active: boolean) => ({
    flex: 1, minWidth: 48, padding: `${spacing.sm}px ${spacing.sm}px`, borderRadius: radii.md, border: 'none',
    background: colors.sectionBg, boxShadow: active ? shadows.inset : shadows.raisedSm,
    color: active ? colors.primary : colors.textMuted, cursor: 'pointer', fontWeight: 600, fontSize: fontSizes.sm,
  }),
  btn: {
    width: '100%', padding: `${spacing.sm}px ${spacing.md}px`, borderRadius: radii.pill, border: 'none', cursor: 'pointer',
    background: colors.sectionBg, color: colors.textBody, boxShadow: shadows.raisedSm, fontWeight: 600, fontSize: fontSizes.sm,
  },
  kv: { display: 'flex', justifyContent: 'space-between', fontSize: fontSizes.sm, color: colors.textBody, padding: '2px 0' },
  input: {
    width: '100%', padding: `${spacing.xs + 2}px ${spacing.sm}px`, borderRadius: radii.md, border: 'none',
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

export default function AdvancedMoldPanel(p: Props) {
  const { settings: t, onChange } = p;
  const [advice, setAdvice] = useState<GateAdvice | null>(null);
  const isRigid = p.moldMode === 'rigid';
  const isSkin = p.moldMode === 'silicone' && p.siliconeType === 'skinCore';
  const isOpenBox = p.moldMode === 'silicone' && p.siliconeType === 'blockOneWay';
  const hasSplit = !isOpenBox;
  const blockSilicone = p.moldMode === 'silicone' && !isSkin;

  const mat = CASTING_MATERIALS.find(m => m.id === t.castingMaterial) ?? CASTING_MATERIALS[0]!;
  const partCm3 = useMemo(() => (p.geometry ? solidProps(p.geometry).volume / 1000 : 0), [p.geometry]);
  const castGrams = partCm3 * mat.density * t.cavityCount;

  return (
    <div style={s.section}>
      <div style={s.title}>Pro Mold Features</div>

      {isRigid && (() => {
        const style = t.moldStyle ?? 'standard';
        const std = style === 'standard';
        const STYLES = [
          ['standard', 'Two-part mold', 'The usual closed mold with a pour hole.'],
          ['reliefTray', 'Relief tray', 'One open tray for flat things: logos, coins, badges. Pour and scrape level.'],
          ['pressMold', 'Press mold', 'Open mold with a handle on the back. Press it into clay, soap or fondant.'],
          ['slipCast', 'Plaster slip-cast', 'Prints your model with a pour funnel on top plus a frame. Pour plaster around it to make a mold for liquid clay.'],
        ] as const;
        return (
          <>
            <div style={s.sub}>Mold type</div>
            <div style={s.row}>
              {STYLES.map(([id, label]) => (
                <button key={id} style={s.chip(style === id)} onClick={() => onChange({ moldStyle: id })}>{label}</button>
              ))}
            </div>
            <div style={s.hint}>{STYLES.find(x => x[0] === style)![2]}{!std && ' The model’s top faces up — use Turn 90° in the Model step if needed.'}</div>

            {std && (
              <>
                <label style={{ ...s.label, display: 'flex', gap: spacing.xs, alignItems: 'center', marginTop: spacing.md }}>
                  <input type="checkbox" checked={!!t.curvedSplit} onChange={e => onChange({ curvedSplit: e.target.checked })} />
                  Curved split line (follows the model)
                </label>
                <div style={s.hint}>
                  {p.cutAngle !== 0 ? 'Needs an untilted split — set the tilt back to 0°.' :
                    'The cut runs through the middle of the part everywhere, so each half pulls straight off. The halves nest into each other, so no pins are needed.'}
                </div>

                <div style={s.sub}>Clamp wings</div>
                <div style={s.row}>
                  {([0, 3, 4, 5] as const).map(n => (
                    <button key={n} style={s.chip((t.clampBoltMm ?? 0) === n)} onClick={() => onChange({ clampBoltMm: n })}>
                      {n === 0 ? 'Off' : `M${n} bolts`}
                    </button>
                  ))}
                </div>
                <div style={s.hint}>{t.curvedSplit ? 'Not available with the curved split.' : 'Flanges with bolt holes on two sides — bolt the halves tight so nothing leaks.'}</div>

                <label style={{ ...s.label, display: 'flex', gap: spacing.xs, alignItems: 'center', marginTop: spacing.md }}>
                  <input type="checkbox" checked={!!t.autoVents} onChange={e => onChange({ autoVents: e.target.checked })} />
                  Automatic air vents
                </label>
                <div style={s.hint}>Adds thin air holes above every high spot where bubbles would get stuck.</div>

                <label style={{ ...s.label, display: 'flex', gap: spacing.xs, alignItems: 'center', marginTop: spacing.md }}>
                  <input type="checkbox" checked={!!t.standFins} onChange={e => onChange({ standFins: e.target.checked })} />
                  Stand-fins
                </label>
                <div style={s.hint}>{t.curvedSplit ? 'Not available with the curved split.' : 'Four fins under the bottom half so a rounded (form-fit) mold stands level while you pour.'}</div>
              </>
            )}
          </>
        );
      })()}

      {hasSplit && (
        <>
          <div style={s.sub}>Seal between halves</div>
          <div style={s.row}>
            <button style={s.chip(t.seal === 'pins')} onClick={() => onChange({ seal: 'pins' })}>Keyed pins</button>
            <button style={s.chip(t.seal === 'tongueGroove')} onClick={() => onChange({ seal: 'tongueGroove' })}>Tongue &amp; groove</button>
          </div>
          <div style={s.hint}>
            {t.seal === 'tongueGroove'
              ? (p.cutAngle !== 0 || (p.formFit && !isSkin))
                ? 'Needs a flat (untilted) split and a box shell — keyed pins will be used instead.'
                : 'Continuous ridge around the cavity: leak-tight and self-aligning. Best for thin resins and silicone.'
              : 'Four locating pins — quick to print, fine for thicker materials.'}
          </div>

          <label style={{ ...s.label, display: 'flex', gap: spacing.xs, alignItems: 'center', marginTop: spacing.md }}>
            <input type="checkbox" checked={t.pryPockets} onChange={e => onChange({ pryPockets: e.target.checked })} />
            Pry slots on the split line
          </label>
          <div style={s.hint}>Two screwdriver notches so the halves open without damaging the cavity.</div>
        </>
      )}

      <div style={s.sub}>Radial split (around the part)</div>
      <div style={s.row}>
        {([0, 3, 4, 6] as const).map(n => (
          <button key={n} style={s.chip(t.radialSegments === n)} onClick={() => onChange({ radialSegments: n })}>
            {n === 0 ? 'Off' : `${n} parts`}
          </button>
        ))}
      </div>
      <div style={s.hint}>
        For vases, busts and tall round parts. Each mold piece is also cut into wedges around the pour axis — hold them together with rubber bands or clamps.
      </div>

      {blockSilicone && (
        <>
          <div style={s.sub}>Silicone thickness per side</div>
          <label style={{ ...s.label, display: 'flex', gap: spacing.xs, alignItems: 'center' }}>
            <input type="checkbox" checked={t.siliconeSides.enabled}
              onChange={e => onChange({ siliconeSides: { ...t.siliconeSides, enabled: e.target.checked } })} />
            Set top / bottom / sides separately
          </label>
          {t.siliconeSides.enabled && (
            <>
              {(['top', 'bottom', 'sides'] as const).map(k => (
                <Slider key={k} label={k.charAt(0).toUpperCase() + k.slice(1)} value={t.siliconeSides[k]} min={3} max={40} step={1} unit=" mm"
                  onChange={v => onChange({ siliconeSides: { ...t.siliconeSides, [k]: v } })} />
              ))}
              <div style={s.hint}>
                {p.formFit ? 'Ignored while Form fit shell is on.' : 'Thicker walls where the mold flexes most; thinner where it rests. Keep at least 5 mm.'}
              </div>
            </>
          )}
        </>
      )}

      {!isSkin && (
        <>
          <div style={s.sub}>Multi-cavity tray</div>
          <Slider label="Copies" value={t.cavityCount} min={1} max={9} step={1} unit="×"
            onChange={v => onChange({ cavityCount: v })} />
          {t.cavityCount > 1 && (
            <Slider label="Gap between copies" value={t.cavitySpacingMm} min={3} max={30} step={1} unit=" mm"
              onChange={v => onChange({ cavitySpacingMm: v })} />
          )}
          {isRigid && t.cavityCount > 1 && (
            <label style={{ ...s.label, display: 'flex', gap: spacing.xs, alignItems: 'center', marginTop: spacing.sm }}>
              <input type="checkbox" checked={!!t.runner} onChange={e => onChange({ runner: e.target.checked })} />
              One pour hole with runners
            </label>
          )}
          <div style={s.hint}>
            Cast several parts per pour. {isOpenBox ? '' : (isRigid && t.runner && t.cavityCount > 1)
              ? 'A single central pour hole feeds every cavity through channels on the split line.'
              : 'Each cavity gets its own sprue.'}
          </div>
        </>
      )}

      {isRigid && (() => {
        const h = t.hollowCore ?? DEFAULT_TIER2.hollowCore!;
        const set = (patch: Partial<typeof h>) => onChange({ hollowCore: { ...h, ...patch } });
        return (
          <>
            <div style={s.sub}>Hollow casting (vases, cups)</div>
            <label style={{ ...s.label, display: 'flex', gap: spacing.xs, alignItems: 'center' }}>
              <input type="checkbox" checked={h.enabled} onChange={e => set({ enabled: e.target.checked })} />
              Add a printable inner core
            </label>
            {h.enabled && (
              <>
                <Slider label="Cast wall thickness" value={h.wallMm} min={1} max={15} step={0.5} unit=" mm"
                  onChange={v => set({ wallMm: v })} />
                <div style={s.row}>
                  <button style={s.chip(h.opening === 'top')} onClick={() => set({ opening: 'top' })}>Opening on top</button>
                  <button style={s.chip(h.opening === 'bottom')} onClick={() => set({ opening: 'bottom' })}>Opening on bottom</button>
                </div>
              </>
            )}
            <div style={s.hint}>
              {h.enabled && t.cavityCount > 1
                ? 'Only works with a single copy — turn the tray off to use it.'
                : 'Casts the part hollow: a core piece slides in through the opening and its flange sits on the mold. Pour hole moves into the wall.'}
            </div>
          </>
        );
      })()}

      {isRigid && (
        <>
          <div style={s.sub}>Gate advisor</div>
          <button style={s.btn} disabled={!p.geometry}
            onClick={() => p.geometry && setAdvice(adviseGate(p.geometry, p.axis))}>
            Analyse pour gate
          </button>
          {advice && (
            <div style={{ marginTop: spacing.sm }}>
              <div style={s.kv}><span>Part volume</span><span>{advice.partVolumeCm3.toFixed(1)} cm³</span></div>
              <div style={s.kv}><span>Sprue diameter</span><span>{advice.sprueDiameterMm} mm</span></div>
              <div style={s.kv}><span>Vents needed</span><span>{advice.ventCount}</span></div>
              <div style={s.kv}><span>Est. pour time</span><span>~{Math.max(1, Math.round(advice.fillSeconds))} s</span></div>
              <ul style={{ ...s.hint, paddingLeft: 16, margin: `${spacing.xs}px 0` }}>
                {advice.tips.map(x => <li key={x}>{x}</li>)}
              </ul>
              <button style={{ ...s.btn, background: colors.primary, color: '#fff', boxShadow: shadows.primary }}
                onClick={() => p.onApplyGate(advice)}>
                Apply sprue size &amp; position
              </button>
            </div>
          )}
        </>
      )}

      <div style={s.sub}>Casting material</div>
      <select style={s.input} value={t.castingMaterial} aria-label="Casting material"
        onChange={e => onChange({ castingMaterial: e.target.value as CastingMaterialId })}>
        {CASTING_MATERIALS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
      </select>
      <div style={{ marginTop: spacing.sm }}>
        <div style={s.kv}><span>Cast weight{t.cavityCount > 1 ? ` (×${t.cavityCount})` : ''}</span><span>{castGrams.toFixed(0)} g</span></div>
        <div style={s.kv}><span>Mold silicone</span><span>{mat.silicone}</span></div>
        <div style={s.kv}><span>Hardness</span><span>Shore {mat.shore}</span></div>
        <div style={s.kv}><span>Release agent</span><span>{mat.release}</span></div>
        <div style={s.kv}><span>Demold after</span><span>{mat.demold}</span></div>
        <div style={s.kv}><span>Pour temperature</span><span>≤ {mat.pourTempC} °C</span></div>
        {isRigid && mat.pourTempC > 55 && (
          <div style={{ ...s.hint, color: colors.primary }}>
            PLA softens near 55 °C — print this mold in PETG/ASA or resin, or use a silicone mold.
          </div>
        )}
        <div style={s.hint}>{mat.notes} Typical datasheet values — check your supplier’s sheet.</div>
      </div>

      <div style={s.sub}>Export</div>
      <label style={{ ...s.label, display: 'flex', gap: spacing.xs, alignItems: 'center' }}>
        <input type="checkbox" checked={t.orientForPrint} onChange={e => onChange({ orientForPrint: e.target.checked })} />
        Auto-orient pieces for printing
      </label>
      <div style={s.hint}>Each exported piece is laid on its flattest side with the fewest overhangs, sitting on the print bed.</div>
    </div>
  );
}

/** Key of the Tier-2 settings that affect geometry (used for staleness). */
export function tier2GeomKey(t: Tier2Settings | undefined): string {
  if (!t) return '';
  return JSON.stringify([t.seal, t.pryPockets, t.radialSegments, t.siliconeSides, t.cavityCount, t.cavitySpacingMm, t.hollowCore, t.runner, t.moldStyle, t.curvedSplit, t.clampBoltMm, t.autoVents, t.standFins]);
}
