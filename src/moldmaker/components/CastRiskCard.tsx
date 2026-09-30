// Sirpam 3D Labs Mold — "before you generate" card: demolding risk score and
// air-trap check with one-click fixes.
import { useMemo } from 'react';
import type * as THREE from 'three';
import type { Axis } from '../types';
import { demoldRisk, airTrapPoints } from '../mold/castRisk';
import { colors, radii, spacing, fontSizes, shadows } from '../theme';

const LEVEL = {
  low: { color: '#3f9e4d', text: 'Low — should release cleanly' },
  medium: { color: '#d9930d', text: 'Medium — add draft or use flexible silicone' },
  high: { color: '#c94436', text: 'High — the cast may lock in or tear the mold' },
} as const;

interface Props {
  geometry: THREE.BufferGeometry | null;
  boundingBox: THREE.Box3 | null;
  axis: Axis;
  offset: number;
  cutAngle: number;
  autoVents: boolean;
  onAxisChange: (a: Axis) => void;
  onEnableAutoVents: () => void;
}

export function CastRiskCard(p: Props) {
  const risk = useMemo(
    () => (p.geometry && p.boundingBox ? demoldRisk(p.geometry, p.axis, p.offset, p.boundingBox, p.cutAngle) : null),
    [p.geometry, p.boundingBox, p.axis, p.offset, p.cutAngle],
  );
  const traps = useMemo(
    () => (p.geometry && p.boundingBox ? airTrapPoints(p.geometry, p.axis, p.boundingBox) : []),
    [p.geometry, p.boundingBox, p.axis],
  );
  if (!risk) return null;
  const st = LEVEL[risk.level];
  const btn = {
    marginTop: spacing.xs, padding: `4px ${spacing.sm}px`, borderRadius: radii.sm, border: `1px solid ${colors.primary}`,
    background: 'transparent', color: colors.primary, cursor: 'pointer', fontSize: fontSizes.xs, fontWeight: 600,
  } as const;
  return (
    <section aria-label="Before you pour" style={{
      marginTop: spacing.sm, padding: `${spacing.sm}px ${spacing.md}px`, borderRadius: radii.md,
      background: colors.sectionBg, boxShadow: shadows.inset, fontSize: fontSizes.sm, color: colors.textBody,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>Before you pour</div>
      <div>
        Demolding risk: <strong style={{ color: st.color }}>{risk.score}/100</strong>
        <div style={{ height: 6, borderRadius: 3, background: colors.border ?? '#444', margin: '4px 0' }}>
          <div style={{ width: `${Math.max(3, risk.score)}%`, height: '100%', borderRadius: 3, background: st.color }} />
        </div>
        <div style={{ color: st.color, fontSize: fontSizes.xs }}>{st.text}</div>
        <div style={{ fontSize: fontSizes.xs, opacity: 0.8 }}>
          {Math.round(risk.undercutPct * 100)}% undercut faces · {Math.round(risk.dragPct * 100)}% straight walls that may drag
        </div>
        {risk.betterAxis && (
          <button type="button" style={btn} onClick={() => p.onAxisChange(risk.betterAxis!)}>
            Split along {risk.betterAxis.toUpperCase()} instead (risk {risk.betterScore}/100)
          </button>
        )}
      </div>
      <div style={{ marginTop: spacing.sm }}>
        Air traps: <strong style={{ color: traps.length ? '#d9930d' : '#3f9e4d' }}>
          {traps.length ? `${traps.length} likely pocket${traps.length > 1 ? 's' : ''}` : 'none found'}
        </strong>
        {traps.length > 0 && (p.autoVents
          ? <div style={{ fontSize: fontSizes.xs, color: '#3f9e4d' }}>✓ Auto vents are on — a vent will be drilled at each pocket.</div>
          : <>
              <div style={{ fontSize: fontSizes.xs, opacity: 0.8 }}>High spots the pour can't push air out of — they leave bubbles in the cast.</div>
              <button type="button" style={btn} onClick={p.onEnableAutoVents}>Add vents at these spots</button>
            </>)}
      </div>
    </section>
  );
}
