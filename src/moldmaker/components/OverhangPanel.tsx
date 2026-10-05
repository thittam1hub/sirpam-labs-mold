import { useMemo, useState } from 'react';
import { pieceDisplayName } from "../utils/pieceNames";
import type * as THREE from 'three';
import { colors, radii, spacing, fontSizes, shadows } from '../theme';
import { overhangCheck } from '../mold/round7';

/** Finish step: which pieces print without supports at the printer's max overhang angle. */
export default function OverhangPanel({ pieces, labels }: { pieces: THREE.BufferGeometry[]; labels: string[] }) {
  const [deg, setDeg] = useState(45);
  const [run, setRun] = useState(0);
  const results = useMemo(
    () => (run ? pieces.map(p => overhangCheck(p, deg)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run, pieces],
  );
  if (!pieces.length) return null;
  return (
    <div style={{ background: colors.sectionBg, borderRadius: radii.xl, padding: spacing.md, boxShadow: shadows.raised, marginTop: spacing.md }}>
      <div style={{ fontWeight: 600, color: colors.textPrimary, fontSize: fontSizes.md }}>Print without supports</div>
      <div style={{ color: colors.textMuted, fontSize: fontSizes.sm, margin: `${spacing.xs}px 0 ${spacing.sm}px` }}>
        Set your printer's safe overhang angle. Each piece is checked in all six flat positions.
      </div>
      <label style={{ fontSize: fontSizes.sm, color: colors.textBody, display: 'block' }}>
        Max overhang: <b>{deg}°</b>
        <input type="range" min={30} max={70} step={5} value={deg} onChange={e => setDeg(+e.target.value)} style={{ width: '100%', accentColor: colors.primary }} />
      </label>
      <button
        onClick={() => setRun(r => r + 1)}
        style={{ marginTop: spacing.sm, padding: '8px 14px', borderRadius: radii.md, border: 'none', background: colors.primary, color: colors.appBg, fontWeight: 600, cursor: 'pointer' }}
      >Check pieces</button>
      {results.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: `${spacing.sm}px 0 0`, fontSize: fontSizes.sm, color: colors.textBody }}>
          {results.map((r, i) => (
            <li key={i} style={{ padding: '4px 0', borderTop: `1px solid ${colors.borderSubtle}` }}>
              <b>{pieceDisplayName(labels[i], i)}</b>: {r.supportFree
                ? <span style={{ color: colors.primary }}>no supports needed</span>
                : <>needs supports on ~{r.overhangCm2.toFixed(1)} cm²</>} — print with the {r.bestDown}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
