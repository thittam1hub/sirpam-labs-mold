// Sirpam 3D Labs Mold — keyboard-shortcut cheat-sheet overlay.
import { Fragment } from 'react';
import { colors, radii, spacing, fontSizes, shadows } from '../theme';

const ROWS: Array<[string, string]> = [
  ['?', 'Toggle this cheat sheet'],
  ['O', 'Open a file (browse)'],
  ['G', 'Generate mold'],
  ['A', 'Auto-detect parting plane'],
  ['H', 'Toggle demoldability heatmap'],
  ['W', 'Toggle wireframe'],
  ['E', 'Toggle exploded view'],
  ['X / Y / Z', 'Set parting axis'],
  ['1-5', 'Jump to a workflow step'],
  ['Esc', 'Close this overlay'],
];

/**
 * Triggered by `?`, dismissed by Escape or clicking the backdrop. Uses
 * role="dialog" + aria-modal so screen readers announce it as modal; no
 * focusable form fields inside, so the platform focus-trap is sufficient.
 */
export default function ShortcutsSheet({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(30,41,59,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: colors.panelBg, borderRadius: radii.lg, padding: `${spacing.xl}px ${spacing.xl + spacing.sm}px`,
          color: colors.textPrimary, minWidth: 360, maxWidth: 480, boxShadow: shadows.raised, border: 'none',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
          <div style={{ fontSize: fontSizes.lg, fontWeight: 600 }}>Keyboard Shortcuts</div>
          <button type="button" onClick={onClose} aria-label="Close shortcuts" style={{
            background: 'transparent', color: colors.textMuted, border: 'none', fontSize: fontSizes.lg, cursor: 'pointer', padding: spacing.xs, lineHeight: 1,
          }}>×</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: spacing.lg, rowGap: spacing.sm }}>
          {ROWS.map(([key, label]) => (
            <Fragment key={key}>
              <kbd style={{
                background: colors.sectionBg, border: `1px solid ${colors.borderSection}`, borderRadius: radii.sm,
                padding: `${spacing.xs}px ${spacing.sm}px`, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: fontSizes.sm, color: colors.textPrimary, whiteSpace: 'nowrap', textAlign: 'center',
              }}>{key}</kbd>
              <span style={{ fontSize: fontSizes.sm, color: colors.textBody, alignSelf: 'center' }}>{label}</span>
            </Fragment>
          ))}
        </div>
        <div style={{ marginTop: spacing.lg, fontSize: fontSizes.xs, color: colors.textDim, textAlign: 'center' }}>
          Press <kbd style={{ background: colors.sectionBg, border: `1px solid ${colors.borderSection}`, borderRadius: radii.sm, padding: `0 ${spacing.xs}px`, fontFamily: 'ui-monospace, monospace', fontSize: fontSizes.xs }}>?</kbd> anytime to reopen
        </div>
      </div>
    </div>
  );
}
