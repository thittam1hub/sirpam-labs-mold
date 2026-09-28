import { colors, spacing, fontSizes, fonts } from '../../theme';

type Props = {
  size: { x: number; y: number; z: number } | null;
  triangles: number;
  scale: number;
  hasMold: boolean;
  busy: string | null;
};

/** Bottom status bar: always-visible model facts and job state. */
export default function StatusBar({ size, triangles, scale, hasMold, busy }: Props) {
  const cell: React.CSSProperties = { whiteSpace: 'nowrap' };
  return (
    <footer className="sirpam-status" aria-label="Status" style={{
      display: 'flex', alignItems: 'center', gap: spacing.lg, padding: `4px ${spacing.lg}px`, minHeight: 26,
      fontSize: fontSizes.xs, color: colors.textMuted, background: colors.panelBg, fontFamily: fonts.body,
      borderTop: `1px solid ${colors.borderSubtle}`, overflowX: 'auto',
    }}>
      {size ? <>
        <span style={cell}>Size {(size.x * scale).toFixed(1)} x {(size.y * scale).toFixed(1)} x {(size.z * scale).toFixed(1)} mm</span>
        <span style={cell}>{triangles.toLocaleString()} triangles</span>
        {scale !== 1 && <span style={cell}>Scale {Math.round(scale * 100)}%</span>}
        <span style={cell}>{hasMold ? 'Mold ready' : 'No mold yet'}</span>
      </> : <span style={cell}>No model loaded</span>}
      <span style={{ flex: 1 }} />
      <span role="status" aria-live="polite" style={{ ...cell, color: busy ? colors.primary : colors.textDim, fontWeight: busy ? 600 : 400 }}>
        {busy ?? 'Ready'}
      </span>
      <span className="sirpam-hide-sm" style={{ ...cell, color: colors.textDim }}>Keys 1-5 switch steps</span>
    </footer>
  );
}
