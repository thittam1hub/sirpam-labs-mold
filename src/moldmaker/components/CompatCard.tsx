// Sirpam 3D Labs Mold — compatibility warning card shared by the Mold step
// and the Finish-step report.
import { checkCompatibility, type CompatInput } from '../mold/materialCompat';
import { colors, radii, spacing, fontSizes, shadows } from '../theme';

const LEVEL_STYLE = {
  ok: { icon: '✓', color: '#3f9e4d', label: 'Good combination' },
  caution: { icon: '⚠', color: '#d9930d', label: 'Check before you pour' },
  blocked: { icon: '✕', color: '#c94436', label: 'Will not work' },
} as const;

export function CompatCard({ input }: { input: CompatInput }) {
  const r = checkCompatibility(input);
  const st = LEVEL_STYLE[r.level];
  if (r.level === 'ok') return null; // stay quiet when everything is fine
  return (
    <div
      role={r.level === 'blocked' ? 'alert' : 'note'}
      style={{
        marginTop: spacing.sm, padding: `${spacing.sm}px ${spacing.md}px`, borderRadius: radii.md,
        background: colors.sectionBg, boxShadow: shadows.inset,
        borderLeft: `3px solid ${st.color}`, fontSize: fontSizes.sm,
      }}
    >
      <div style={{ fontWeight: 700, color: st.color, marginBottom: 2 }}>
        {st.icon} {r.title}
      </div>
      <div style={{ color: colors.textBody, lineHeight: 1.45 }}>{r.detail}</div>
    </div>
  );
}
