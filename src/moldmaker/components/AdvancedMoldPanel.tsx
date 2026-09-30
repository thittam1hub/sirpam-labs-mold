import { useMemo, useState } from 'react';
import type * as THREE from 'three';
import type { Axis, MoldMode, SiliconeMoldType } from '../types';
import type { SealType, LockStyle } from '../mold/moldFeatures';
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
  /** Round 7. Optional so older projects still load. */
  volumeLabel?: boolean;
  watermark?: string;
  moldFeet?: boolean;
  gapFiller?: boolean;
  pieceCount?: 2 | 3 | 4;
  /** Round 8 — sizes. 0 = automatic. Optional so older projects still load. */
  wallMm?: number;
  ventDiameterMm?: number;
  /** -1 = automatic, 0 = no vents. */
  ventCount?: number;
  lockStyle?: LockStyle;
  lockDiameterMm?: number;
  lockCount?: 2 | 4;
  flangeMm?: number;
  flangeBoltMm?: number;
  partingBoard?: boolean;
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
  volumeLabel: false,
  watermark: '',
  moldFeet: false,
  gapFiller: false,
  pieceCount: 2,
  wallMm: 0,
  ventDiameterMm: 0,
  ventCount: -1,
  lockStyle: 'round',
  lockDiameterMm: 0,
  lockCount: 4,
  flangeMm: 0,
  flangeBoltMm: 0,
  partingBoard: false,
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


const MOLD_STYLES = [
  ['standard', 'Two-part mold', 'The usual closed mold with a pour hole.'],
  ['reliefTray', 'Relief tray', 'One open tray for flat things: logos, coins, badges. Pour and scrape level.'],
  ['pressMold', 'Press mold', 'Open mold with a handle on the back. Press it into clay, soap or fondant.'],
  ['slipCast', 'Plaster slip-cast', 'Prints your model with a pour funnel on top plus a frame. Pour plaster around it to make a mold for liquid clay.'],
] as const;

/** Mold-step settings. Single source of truth for mold type, casting material, vents and silicone thickness per side. */
export function MoldCoreSettings(p: { settings: Tier2Settings; onChange: (patch: Partial<Tier2Settings>) => void; moldMode: MoldMode; siliconeType: SiliconeMoldType; formFit: boolean }) {
  const { settings: t, onChange } = p;
  const isRigid = p.moldMode === 'rigid';
  const blockSilicone = p.moldMode === 'silicone' && p.siliconeType !== 'skinCore';
  const style = t.moldStyle ?? 'standard';
  return (
    <div style={s.section}>
      <div style={s.title}>Mold details</div>
      <div style={s.sub}>Casting material</div>
      <select style={s.input} value={t.castingMaterial} aria-label="Casting material"
        onChange={e => onChange({ castingMaterial: e.target.value as CastingMaterialId })}>
        {CASTING_MATERIALS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
      </select>
      <div style={s.hint}>Used everywhere: shrink compensation, cast weight, advisor and report.</div>

      <div style={s.sub}>Copies per mold</div>
      <Slider label="Copies" value={t.cavityCount} min={1} max={9} step={1} unit="×"
        onChange={v => onChange({ cavityCount: v })} />
      <div style={s.hint}>The mold box grows to fit all copies. {isRigid ? 'Copies share one pour hole through a runner channel.' : 'Each copy gets its own pour hole.'}</div>

      {isRigid && (<>
        <div style={s.sub}>Printed mold type</div>
        <div style={s.row}>
          {MOLD_STYLES.map(([id, label]) => (
            <button key={id} style={s.chip(style === id)} onClick={() => onChange({ moldStyle: id })}>{label}</button>
          ))}
        </div>
        <div style={s.hint}>{MOLD_STYLES.find(x => x[0] === style)![2]}{style !== 'standard' && ' The model’s top faces up — use Turn 90° in the Model step if needed.'}</div>

        <div style={s.sub}>Air vents</div>
        <div style={s.row}>
          {([-1, 0, 1, 2, 3, 4] as const).map(n => (
            <button key={n} style={s.chip((t.ventCount ?? -1) === n)} onClick={() => onChange({ ventCount: n })}>{n === -1 ? 'Auto' : n === 0 ? 'Off' : n}</button>
          ))}
        </div>
        <div style={s.hint}>Vent size lives in the Mold step next to the pour hole. Typical: 1.5–3 mm vents.</div>
      </>)}

      {blockSilicone && (<>
        <div style={s.sub}>Silicone thickness per side</div>
        <label style={{ ...s.label, display: 'flex', gap: spacing.xs, alignItems: 'center' }}>
          <input type="checkbox" checked={t.siliconeSides.enabled}
            onChange={e => onChange({ siliconeSides: { ...t.siliconeSides, enabled: e.target.checked } })} />
          Set top / bottom / sides instead of one margin
        </label>
        {t.siliconeSides.enabled && (<>
          {(['top', 'bottom', 'sides'] as const).map(k => (
            <Slider key={k} label={k.charAt(0).toUpperCase() + k.slice(1)} value={t.siliconeSides[k]} min={3} max={40} step={1} unit=" mm"
              onChange={v => onChange({ siliconeSides: { ...t.siliconeSides, [k]: v } })} />
          ))}
          <div style={s.hint}>{p.formFit ? 'Ignored while Form fit shell is on.' : 'Replaces Silicone margin above. Keep at least 5 mm.'}</div>
        </>)}
      </>)}
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
        return (
          <>
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

                <div style={s.sub}>Pieces</div>
                <div style={s.row}>
                  {([2, 3, 4] as const).map(n => (
                    <button key={n} style={s.chip((t.pieceCount ?? 2) === n)} onClick={() => onChange({ pieceCount: n })}>{n} parts</button>
                  ))}
                </div>
                <div style={s.hint}>{t.curvedSplit ? 'Not available with the curved split.' : '3 parts splits the bottom half down the middle, 4 parts splits both — for wide shapes or shapes that would get stuck.'}</div>

                <label style={{ ...s.label, display: 'flex', gap: spacing.xs, alignItems: 'center', marginTop: spacing.md }}>
                  <input type="checkbox" checked={!!t.gapFiller} onChange={e => onChange({ gapFiller: e.target.checked })} />
                  Fill gaps under the model
                </label>
                <div style={s.hint}>{p.formFit ? 'Box molds only (turn off Form fit).' : 'Fills the space under overhangs so the bottom half has nothing to snag on. The cast gets a flat skirt there that you trim off.'}</div>

                <label style={{ ...s.label, display: 'flex', gap: spacing.xs, alignItems: 'center', marginTop: spacing.md }}>
                  <input type="checkbox" checked={!!t.moldFeet} onChange={e => onChange({ moldFeet: e.target.checked })} />
                  Mold feet
                </label>
                <div style={s.hint}>{p.formFit ? 'Box molds only (turn off Form fit).' : 'Four short feet under the mold so small molds sit steady while you pour.'}</div>

                <label style={{ ...s.label, display: 'flex', gap: spacing.xs, alignItems: 'center', marginTop: spacing.md }}>
                  <input type="checkbox" checked={!!t.volumeLabel} onChange={e => onChange({ volumeLabel: e.target.checked })} />
                  Engrave casting volume
                </label>
                <div style={s.hint}>Engraves how much material to mix (e.g. "42 ML") on top of the mold and adds it to the file names.</div>

                <div style={s.sub}>Watermark</div>
                <input
                  value={t.watermark ?? ''}
                  maxLength={24}
                  placeholder="Your name or brand (letters and numbers)"
                  onChange={e => onChange({ watermark: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: radii.md, border: `1px solid ${colors.borderSubtle}`, background: colors.viewportBg, color: colors.textPrimary, fontSize: fontSizes.sm }}
                />
                <div style={s.hint}>Engraved under the bottom half. Text only (A–Z, 0–9, . - &amp; @).</div>
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
              ? t.curvedSplit
                ? 'Not used with the curved split — the halves nest and align themselves.'
                : (p.cutAngle !== 0 || (p.formFit && !isSkin))
                ? 'Needs a flat (untilted) split and a box shell — keyed pins will be used instead.'
                : 'Continuous ridge around the cavity: leak-tight and self-aligning. Best for thin resins and silicone.'
              : 'Four locating pins — quick to print, fine for thicker materials.'}
          </div>

          {t.seal === 'pins' && isRigid && (
            <>
              <div style={s.sub}>Lock type</div>
              <div style={s.row}>
                {([['round', 'Round pin'], ['cone', 'Cone key'], ['square', 'Square key'], ['magnet', 'Magnets']] as const).map(([id, name]) => (
                  <button key={id} style={s.chip((t.lockStyle ?? 'round') === id)} onClick={() => onChange({ lockStyle: id })}>{name}</button>
                ))}
              </div>
              <div style={s.hint}>
                {({
                  round: 'Classic pin and hole. Simple and strong.',
                  cone: 'Tapered key: guides the halves shut and never jams. Best for most printed molds.',
                  square: 'Cannot twist, so the halves stay perfectly lined up.',
                  magnet: 'Pockets for 3 mm thick disc magnets in both halves — glue them in and the mold snaps shut. Needs a flat split.',
                } as const)[t.lockStyle ?? 'round']}
              </div>
              <Slider label={t.lockStyle === 'magnet' ? 'Magnet size' : 'Lock size'} value={t.lockDiameterMm ?? 0} min={0} max={14} step={1}
                unit={(t.lockDiameterMm ?? 0) === 0 ? ' (auto)' : ' mm'} onChange={v => onChange({ lockDiameterMm: v })} />
              <div style={s.sub}>Number of locks</div>
              <div style={s.row}>
                {([2, 4] as const).map(n => (
                  <button key={n} style={s.chip((t.lockCount ?? 4) === n)} onClick={() => onChange({ lockCount: n })}>{n}</button>
                ))}
              </div>
              <div style={s.hint}>0 = sized automatically from the wall. Locks are kept inside the wall so they never break through the edge.</div>
            </>
          )}

          {p.formFit && p.siliconeType !== 'blockOneWay' || p.formFit && isRigid ? (
            <>
              <Slider label="Parting flange" value={t.flangeMm ?? 0} min={0} max={20} step={1}
                unit={(t.flangeMm ?? 0) === 0 ? ' (off)' : ' mm'} onChange={v => onChange({ flangeMm: v })} />
              <div style={s.hint}>A flat rim around the split of the form-fit shell. The locks sit in it, and you can clamp it shut. 8 to 12 mm is typical. Needs a flat, untilted split.</div>
              {(t.flangeMm ?? 0) > 0 && (
                <>
                  <Slider label="Flange bolt holes" value={t.flangeBoltMm ?? 0} min={0} max={8} step={1}
                    unit={(t.flangeBoltMm ?? 0) === 0 ? ' (off)' : ' mm'} onChange={v => onChange({ flangeBoltMm: v })} />
                  <div style={s.hint}>Four through-holes for bolts or clamps, between the locks. M3 = 3 mm, M4 = 4 mm.</div>
                </>
              )}
            </>
          ) : null}
          {p.moldMode === 'silicone' && p.siliconeType === 'blockTwoPart' && (
            <label style={{ ...s.label, display: 'flex', gap: spacing.xs, alignItems: 'center', marginTop: spacing.md }}>
              <input type="checkbox" checked={!!t.partingBoard} onChange={e => onChange({ partingBoard: e.target.checked })} />
              Printable parting board with silicone keys
            </label>
          )}

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
              <div style={s.kv}><span>Suggested pour hole</span><span>{advice.sprueDiameterMm} mm</span></div>
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
      <div style={s.hint}>{mat.label} — change it in the Mold step (“What are you casting?”).</div>
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

      <div style={s.sub}>Print orientation</div>
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
  return JSON.stringify([t.seal, t.pryPockets, t.radialSegments, t.siliconeSides, t.cavityCount, t.cavitySpacingMm, t.hollowCore, t.runner, t.moldStyle, t.curvedSplit, t.clampBoltMm, t.autoVents, t.standFins, t.volumeLabel, t.watermark, t.moldFeet, t.gapFiller, t.pieceCount, t.wallMm, t.ventDiameterMm, t.ventCount, t.lockStyle, t.lockDiameterMm, t.lockCount, t.flangeMm, t.flangeBoltMm, t.partingBoard]);
}
