import { useEffect, useRef, useState } from 'react';
import { colors, radii, spacing, fontSizes, shadows, fonts } from '../../theme';

type Fmt = 'stl' | 'obj' | '3mf' | 'step';

interface Props {
  fileName: string | null;
  hasModel: boolean;
  hasMold: boolean;
  generateLabel: string;
  generateDisabled: boolean;
  stepExporting: boolean;
  onOpen: () => void;
  onSample: () => void;
  onProjects: () => void;
  onHelp: () => void;
  onGenerate: () => void;
  onExport: (f: Fmt) => void;
}

const pill = (primary = false, disabled = false) => ({
  padding: `${spacing.sm}px ${spacing.md + 2}px`, borderRadius: radii.pill, border: 'none',
  cursor: disabled ? 'default' : 'pointer', whiteSpace: 'nowrap' as const, fontFamily: 'inherit',
  background: primary ? colors.primary : colors.sectionBg,
  color: primary ? '#fff' : colors.textBody,
  boxShadow: disabled ? 'none' : primary ? shadows.primary : shadows.raisedSm,
  opacity: disabled ? 0.5 : 1, fontWeight: 600, fontSize: fontSizes.sm,
});

export default function TopBar(p: Props) {
  const [menu, setMenu] = useState<null | 'export' | 'more'>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setMenu(null); };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [menu]);

  const menuBox = {
    position: 'absolute' as const, top: 'calc(100% + 8px)', right: 0, zIndex: 40, minWidth: 200,
    background: colors.sectionBg, borderRadius: radii.lg, boxShadow: shadows.raised, padding: spacing.sm,
    display: 'flex', flexDirection: 'column' as const, gap: 4,
  };
  const item = { ...pill(), boxShadow: 'none', textAlign: 'left' as const, borderRadius: radii.md };

  return (
    <header ref={ref} className="sirpam-topbar" style={{
      display: 'flex', alignItems: 'center', gap: spacing.md, padding: `${spacing.sm + 2}px ${spacing.lg}px`,
      background: colors.panelBg, boxShadow: shadows.raisedSm, zIndex: 20, fontFamily: fonts.body, minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, minWidth: 0, flexShrink: 0 }}>
        <span aria-hidden style={{ width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', boxShadow: shadows.raisedSm, color: colors.primary }}>●</span>
        <span style={{ fontFamily: fonts.heading, fontWeight: 700, fontSize: fontSizes.lg, color: colors.textPrimary, whiteSpace: 'nowrap' }}>
          Sirpam <span style={{ color: colors.primary }}>3D Labs</span> Mold
        </span>
      </div>
      {p.fileName && (
        <span className="sirpam-hide-sm" style={{ fontSize: fontSizes.sm, color: colors.textDim, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          / {p.fileName}
        </span>
      )}
      <div style={{ flex: 1 }} />
      <div className="sirpam-hide-sm" style={{ display: 'flex', gap: spacing.sm }}>
        <button type="button" style={pill()} onClick={p.onOpen}>Open model</button>
        <button type="button" style={pill()} onClick={p.onSample}>Try sample</button>
        <button type="button" style={pill()} onClick={p.onProjects}>Projects</button>
        <button type="button" style={pill()} onClick={p.onHelp} aria-label="Keyboard shortcuts">?</button>
      </div>
      <div className="sirpam-show-sm" style={{ position: 'relative' }}>
        <button type="button" style={pill()} onClick={() => setMenu(menu === 'more' ? null : 'more')} aria-label="More actions">☰</button>
        {menu === 'more' && (
          <div style={menuBox}>
            <button type="button" style={item} onClick={() => { setMenu(null); p.onOpen(); }}>Open model</button>
            <button type="button" style={item} onClick={() => { setMenu(null); p.onSample(); }}>Try sample</button>
            <button type="button" style={item} onClick={() => { setMenu(null); p.onProjects(); }}>Projects</button>
            <button type="button" style={item} onClick={() => { setMenu(null); p.onHelp(); }}>Keyboard shortcuts</button>
          </div>
        )}
      </div>
      <button type="button" style={pill(true, p.generateDisabled || !p.hasModel)}
        disabled={p.generateDisabled || !p.hasModel} onClick={p.onGenerate}>
        {p.generateLabel}
      </button>
      <div style={{ position: 'relative' }}>
        <button type="button" style={pill(false, !p.hasMold)} disabled={!p.hasMold}
          onClick={() => setMenu(menu === 'export' ? null : 'export')} aria-haspopup="menu">
          Export ▾
        </button>
        {menu === 'export' && (
          <div role="menu" style={menuBox}>
            {([['stl', 'STL'], ['obj', 'OBJ'], ['3mf', '3MF'], ['step', 'STEP (CAD)']] as const).map(([f, l]) => (
              <button key={f} role="menuitem" type="button" style={item} disabled={p.stepExporting}
                onClick={() => { setMenu(null); p.onExport(f); }}>
                {f === 'step' && p.stepExporting ? 'Exporting STEP…' : l}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
