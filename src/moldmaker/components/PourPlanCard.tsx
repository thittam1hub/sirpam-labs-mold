// Sirpam 3D Labs Mold — Finish step: leak check + printable pour card.
import { useMemo } from 'react';
import type * as THREE from 'three';
import type { Axis } from '../types';
import { leakCheck, pourPlan } from '../mold/pourPlan';
import { CASTING_MATERIALS, type CastingMaterialId } from '../utils/tier2';
import { colors, radii, spacing, fontSizes, shadows } from '../theme';

const LEAK_COLOR = { ok: '#3f9e4d', caution: '#d9930d', leak: '#c94436' } as const;

interface Props {
  geometry: THREE.BufferGeometry | null;
  boundingBox: THREE.Box3 | null;
  axis: Axis; offset: number; cutAngle: number; wallMm: number;
  castingMaterial: CastingMaterialId;
}

const esc = (s: string) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);

export function PourPlanCard(p: Props) {
  const leak = useMemo(
    () => (p.geometry && p.boundingBox ? leakCheck(p.geometry, p.axis, p.offset, p.boundingBox, p.wallMm, p.cutAngle) : null),
    [p.geometry, p.boundingBox, p.axis, p.offset, p.wallMm, p.cutAngle],
  );
  const steps = pourPlan(p.castingMaterial);
  const matLabel = CASTING_MATERIALS.find(m => m.id === p.castingMaterial)?.label ?? '';
  const printCard = () => {
    const w = window.open('', '_blank', 'width=600,height=800');
    if (!w) return;
    w.document.write(`<title>Pour card — ${esc(matLabel)}</title><body style="font-family:sans-serif;padding:24px">
      <h1 style="font-size:20px">Pour card — ${esc(matLabel)}</h1>
      <ol>${steps.map(s => `<li style="margin-bottom:10px"><b>${esc(s.label)}:</b> ${esc(s.detail)}</li>`).join('')}</ol>
      ${leak ? `<p><b>Leak check:</b> ${esc(leak.advice)}</p>` : ''}
      <p style="color:#777;font-size:12px">Sirpam 3D Labs Mold — times are typical; follow your material's datasheet.</p></body>`);
    w.document.close(); w.focus(); w.print();
  };
  return (
    <section aria-label="Leak check and pour planner" style={{
      padding: spacing.md, borderRadius: radii.md, background: colors.sectionBg, boxShadow: shadows.inset,
      fontSize: fontSizes.sm, color: colors.textBody,
    }}>
      {leak && (
        <div style={{ marginBottom: spacing.sm, borderLeft: `3px solid ${LEAK_COLOR[leak.level]}`, paddingLeft: spacing.sm }}>
          <div style={{ fontWeight: 700, color: LEAK_COLOR[leak.level] }}>
            Leak check: {Number.isFinite(leak.landMm) ? `${leak.landMm.toFixed(1)} mm seal land` : 'n/a'}
          </div>
          <div>{leak.advice}</div>
        </div>
      )}
      <div style={{ fontWeight: 700, marginBottom: 4 }}>Pour planner — {matLabel}</div>
      <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.45 }}>
        {steps.map(s => <li key={s.label}><strong>{s.label}:</strong> {s.detail}</li>)}
      </ol>
      <button type="button" onClick={printCard} style={{
        marginTop: spacing.sm, padding: `4px ${spacing.sm}px`, borderRadius: radii.sm, border: `1px solid ${colors.primary}`,
        background: 'transparent', color: colors.primary, cursor: 'pointer', fontSize: fontSizes.xs, fontWeight: 600,
      }}>Print pour card</button>
    </section>
  );
}
