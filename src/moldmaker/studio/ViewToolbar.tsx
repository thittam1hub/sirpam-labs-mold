// Sirpam 3D Labs Mold — bottom-center view toggle pills (wireframe/heatmap/etc).
import { colors, radii, spacing, fontSizes, shadows } from '../theme';

export interface ViewToolbarProps {
  wireframe: boolean;
  onToggleWireframe: () => void;
  showHeatmap: boolean;
  onToggleHeatmap: () => void;
  showThickness: boolean;
  onToggleThickness: () => void;
  showFill: boolean;
  onToggleFill: () => void;
  showDoctor: boolean;
  onToggleDoctor: () => void;
  explodedView: boolean;
  onToggleExplode: () => void;
  showOriginal: boolean;
  onToggleOriginal: () => void;
  moldGenerated: boolean;
}

/** Toolbar of view-only toggles, floating bottom-center over the viewport. */
export default function ViewToolbar(p: ViewToolbarProps) {
  const items: Array<[string, boolean, () => void, boolean]> = [
    ['Wireframe', p.wireframe, p.onToggleWireframe, true],
    ['Heatmap', p.showHeatmap, p.onToggleHeatmap, true],
    ['Thickness', p.showThickness, p.onToggleThickness, true],
    ['Doctor view', p.showDoctor, p.onToggleDoctor, true],
    ['Fill preview', p.showFill, p.onToggleFill, true],
    ['Exploded', p.explodedView, p.onToggleExplode, p.moldGenerated],
    ['Original', p.showOriginal, p.onToggleOriginal, p.moldGenerated],
  ];
  return (
    <div role="toolbar" aria-label="View options" style={{
      position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: spacing.lg, display: 'flex', gap: 4, padding: 4,
      background: colors.sectionBg, borderRadius: radii.pill, boxShadow: shadows.raisedSm, zIndex: 6, flexWrap: 'wrap',
    }}>
      {items.filter(c => c[3]).map(([label, on, fn]) => (
        <button key={label} type="button" aria-pressed={on} onClick={fn} style={{
          border: 'none', borderRadius: radii.pill, padding: `6px ${spacing.md}px`, cursor: 'pointer', fontFamily: 'inherit',
          fontSize: fontSizes.xs, fontWeight: 600, background: colors.sectionBg,
          color: on ? colors.primary : colors.textMuted, boxShadow: on ? shadows.inset : 'none',
        }}>{label}</button>
      ))}
    </div>
  );
}
