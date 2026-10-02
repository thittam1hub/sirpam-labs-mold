// Sirpam 3D Labs Mold — viewport banners: error, info, and repair-progress.
import { colors, radii, spacing, fontSizes, shadows } from '../theme';

export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div role="alert" style={{
      position: 'absolute', top: spacing.lg, left: spacing.lg, right: spacing.lg,
      background: colors.errorBg, color: '#fff', padding: `${spacing.md}px ${spacing.lg}px`,
      borderRadius: radii.lg, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      boxShadow: shadows.raised, fontSize: fontSizes.md, zIndex: 10,
    }}>
      <span>{message}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss error" style={{
        background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.7)',
        borderRadius: radii.sm, padding: `${spacing.xs}px ${spacing.sm + 2}px`,
        cursor: 'pointer', fontSize: fontSizes.xs, marginLeft: spacing.lg,
      }}>Dismiss</button>
    </div>
  );
}

export function InfoBanner({ message, onDismiss, pushDown }: { message: string; onDismiss: () => void; pushDown: boolean }) {
  return (
    <div role="status" style={{
      position: 'absolute', top: pushDown ? spacing.lg + 56 : spacing.lg, left: spacing.lg, right: spacing.lg,
      background: colors.infoBg, color: '#fff', padding: `${spacing.md}px ${spacing.lg}px`,
      borderRadius: radii.lg, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      boxShadow: shadows.raised, fontSize: fontSizes.md, zIndex: 10,
    }}>
      <span>{message}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss notice" style={{
        background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.7)',
        borderRadius: radii.sm, padding: `${spacing.xs}px ${spacing.sm + 2}px`,
        cursor: 'pointer', fontSize: fontSizes.xs, marginLeft: spacing.lg,
      }}>Dismiss</button>
    </div>
  );
}

export function RecoveryBanner({ fileName, onRestore, onDismiss }: { fileName: string; onRestore: () => void; onDismiss: () => void }) {
  const btn = { borderRadius: radii.sm, padding: `${spacing.xs}px ${spacing.md}px`, cursor: 'pointer', fontSize: fontSizes.sm, fontWeight: 600 } as const;
  return (
    <div role="status" style={{
      position: 'absolute', top: spacing.lg, left: spacing.lg, right: spacing.lg, zIndex: 20,
      background: colors.panelBg, color: colors.textPrimary, padding: `${spacing.md}px ${spacing.lg}px`,
      borderRadius: radii.lg, border: `1px solid ${colors.primary}`, boxShadow: shadows.raised,
      display: 'flex', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap', fontSize: fontSizes.md,
    }}>
      <span style={{ flex: 1, minWidth: 220 }}>
        <b>Unfinished work found on this device.</b> Restore "{fileName}" with all your mold settings?
      </span>
      <button type="button" onClick={onRestore} style={{ ...btn, background: colors.primary, color: '#fff', border: 'none' }}>Restore</button>
      <button type="button" onClick={onDismiss} style={{ ...btn, background: 'transparent', color: colors.textMuted, border: `1px solid ${colors.textMuted}` }}>Discard</button>
    </div>
  );
}

export function RepairProgressBanner({ pct, label, sceneBg }: { pct: number; label: string; sceneBg: string }) {
  return (
    <div role="progressbar" aria-label="Repairing model" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} style={{
      position: 'absolute', left: '50%', bottom: 72, transform: 'translateX(-50%)', zIndex: 30,
      width: 'min(420px, 90%)', background: colors.panelBg, borderRadius: radii.xl,
      boxShadow: shadows.raised, padding: '12px 16px', fontSize: fontSizes.sm, color: colors.textPrimary,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <b>Repairing broken spots…</b><span>{Math.round(pct)}%</span>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: sceneBg, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: colors.primary, transition: 'width .3s' }} />
      </div>
      <div style={{ marginTop: 6, color: colors.textMuted }}>{label}</div>
    </div>
  );
}

/** Single color-swatch + label row inside the heatmap legend. */
function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
      <span aria-hidden="true" style={{ width: 12, height: 12, borderRadius: 2, background: color, border: '1px solid rgba(255,255,255,0.2)', flexShrink: 0 }} />
      <span>{label}</span>
    </div>
  );
}

export function HeatmapLegend() {
  return (
    <div role="region" aria-label="Heatmap legend" style={{
      position: 'absolute', bottom: spacing.lg, right: spacing.lg,
      background: 'color-mix(in srgb, var(--sm-panel-bg) 92%, transparent)', border: 'none',
      boxShadow: shadows.raisedSm, borderRadius: radii.md, padding: `${spacing.sm}px ${spacing.md}px`,
      color: colors.textBody, fontSize: fontSizes.xs, display: 'flex', flexDirection: 'column',
      gap: spacing.xs, zIndex: 5, pointerEvents: 'none',
    }}>
      <div style={{ fontWeight: 600, marginBottom: spacing.xs }}>Demoldability</div>
      <LegendRow color="#4ade80" label="Draftable" />
      <LegendRow color="#facc15" label="Marginal" />
      <LegendRow color="#ef4444" label="Undercut" />
    </div>
  );
}

export function FillLegend({ axis, trapCount }: { axis: string; trapCount: number | null }) {
  return (
    <div aria-label="Fill preview legend" style={{
      position: 'absolute', top: spacing.lg, right: spacing.lg, zIndex: 6, padding: `${spacing.sm}px ${spacing.md}px`, maxWidth: 280,
      background: colors.sectionBg, borderRadius: radii.lg, boxShadow: shadows.raisedSm, fontSize: fontSizes.xs, color: colors.textBody,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Fill preview (pour from +{axis.toUpperCase()})</div>
      <div>Orange rises as material fills from the bottom. Red dots = likely air traps{trapCount !== null ? ` (${trapCount})` : ''} — add a vent there.</div>
      <div style={{ opacity: 0.7, marginTop: 4 }}>Estimate only, not a flow simulation.</div>
    </div>
  );
}

export function ThicknessLegend({ min }: { min: number | null }) {
  return (
    <div aria-label="Thickness legend" style={{
      position: 'absolute', top: spacing.lg, right: spacing.lg, zIndex: 6, padding: `${spacing.sm}px ${spacing.md}px`,
      background: colors.sectionBg, borderRadius: radii.lg, boxShadow: shadows.raisedSm, fontSize: fontSizes.xs, color: colors.textBody,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Wall thickness</div>
      <div>Red: under 1.5 mm · Yellow: 1.5–3 mm · Green: 3 mm+</div>
      {min !== null && <div>Thinnest spot: {min.toFixed(1)} mm</div>}
    </div>
  );
}
