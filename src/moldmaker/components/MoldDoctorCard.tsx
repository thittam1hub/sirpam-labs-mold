// Mold Doctor + Co-Pilot card: findings, optional on-device explanation, and
// sentence-to-settings with a preview before applying.
import { useEffect, useMemo, useState } from 'react';
import type * as THREE from 'three';
import type { Axis } from '../types';
import { colors, radii, spacing, fontSizes, shadows } from '../theme';
import { diagnose, explainFindings, doctorAiReady, parseCommand, describePatch, type CopilotPatch } from '../moldDoctorAi';

const DOT = { ok: '#3f9e4d', warn: '#d9930d', bad: '#c94436' } as const;

interface Props {
  geometry: THREE.BufferGeometry | null;
  boundingBox: THREE.Box3 | null;
  axis: Axis; offset: number; cutAngle: number;
  autoVents: boolean; moldMode: string;
  onApply: (p: CopilotPatch) => void;
}

export function MoldDoctorCard(p: Props) {
  const [aiReady, setAiReady] = useState(false);
  const [tips, setTips] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cmd, setCmd] = useState('');
  const [pending, setPending] = useState<{ patch: CopilotPatch; via: string } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => { void doctorAiReady().then(setAiReady); }, []);
  const findings = useMemo(
    () => (p.geometry && p.boundingBox ? diagnose(p.geometry, p.boundingBox, p.axis, p.offset, p.cutAngle, { autoVents: p.autoVents, moldMode: p.moldMode }) : []),
    [p.geometry, p.boundingBox, p.axis, p.offset, p.cutAngle, p.autoVents, p.moldMode],
  );
  useEffect(() => { setTips(null); }, [findings]);
  if (!p.geometry) return null;

  const btn = { padding: `4px ${spacing.sm}px`, borderRadius: radii.sm, border: `1px solid ${colors.primary}`, background: 'transparent', color: colors.primary, cursor: 'pointer', fontSize: fontSizes.xs, fontWeight: 600 } as const;

  async function explain() { setBusy(true); setTips((await explainFindings(findings)) ?? 'On-device AI could not answer right now. The checks above still apply.'); setBusy(false); }
  async function run() {
    if (!cmd.trim()) return;
    setBusy(true); setNote(null);
    const r = await parseCommand(cmd);
    setBusy(false);
    if (!Object.keys(r.patch).length) { setPending(null); setNote('Could not find a setting in that. Try "silicone mold, split along x, 6 mm pour hole, add vents".'); return; }
    setPending(r);
  }

  return (
    <section aria-label="Mold Doctor" style={{ marginTop: spacing.sm, padding: `${spacing.sm}px ${spacing.md}px`, borderRadius: radii.md, background: colors.sectionBg, boxShadow: shadows.inset, fontSize: fontSizes.sm, color: colors.textBody }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>Mold Doctor <span style={{ fontWeight: 400, fontSize: fontSizes.xs, color: colors.textMuted }}>free · runs on your device</span></div>
      <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
        {findings.map((f, i) => (
          <li key={i} style={{ display: 'flex', gap: 6, fontSize: fontSizes.xs, marginBottom: 3 }}>
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: 4, background: DOT[f.level], marginTop: 4, flexShrink: 0 }} />{f.text}
          </li>
        ))}
      </ul>
      {aiReady && !tips && <button type="button" style={{ ...btn, marginTop: 4 }} disabled={busy} onClick={explain}>{busy ? 'Thinking…' : 'Explain in plain words'}</button>}
      {tips && <div style={{ marginTop: 6, fontSize: fontSizes.xs, whiteSpace: 'pre-line', color: colors.textMuted }}>{tips}</div>}

      <div style={{ fontWeight: 700, marginTop: spacing.sm, marginBottom: 4 }}>Tell the Co-Pilot</div>
      <form onSubmit={e => { e.preventDefault(); void run(); }} style={{ display: 'flex', gap: 4 }}>
        <input aria-label="Describe the mold settings you want" value={cmd} onChange={e => setCmd(e.target.value)}
          placeholder="silicone mold, split along x, 6 mm pour hole"
          style={{ flex: 1, minWidth: 0, padding: '4px 6px', borderRadius: radii.sm, border: `1px solid ${colors.borderSection}`, background: 'transparent', color: colors.textBody, fontSize: fontSizes.xs }} />
        <button type="submit" style={btn} disabled={busy}>Go</button>
      </form>
      {note && <div style={{ fontSize: fontSizes.xs, color: '#d9930d', marginTop: 4 }}>{note}</div>}
      {pending && (
        <div style={{ marginTop: 6, fontSize: fontSizes.xs }}>
          <div>This will change:</div>
          <ul style={{ margin: '2px 0 4px 16px', padding: 0 }}>{describePatch(pending.patch).map(d => <li key={d}>{d}</li>)}</ul>
          <button type="button" style={btn} onClick={() => { p.onApply(pending.patch); setPending(null); setCmd(''); setNote('Applied. Generate the mold to see it.'); }}>Apply</button>{' '}
          <button type="button" style={{ ...btn, borderColor: colors.borderSection, color: colors.textMuted }} onClick={() => setPending(null)}>Cancel</button>
        </div>
      )}
    </section>
  );
}
