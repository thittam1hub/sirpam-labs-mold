import { Link } from '@tanstack/react-router';
import { Box, Scissors, Layers, Wrench, PackageCheck, Sparkles, CircleCheck, PanelLeftClose } from 'lucide-react';
import { colors, radii, spacing, fontSizes, fonts } from '../../theme';

const STEPS = [
  { name: 'Model', icon: Box, hint: 'Load, repair and size your part' },
  { name: 'Split', icon: Scissors, hint: 'Choose where the mold opens' },
  { name: 'Mold', icon: Layers, hint: 'Mold type, walls, locks, vents' },
  { name: 'Pro', icon: Wrench, hint: 'Advanced features and model tools' },
  { name: 'Finish', icon: PackageCheck, hint: 'Export, report and print plan' },
];

type Props = { step: number; onStep: (n: number) => void; hasModel: boolean; hasMold: boolean; onHide?: () => void };

/** Step tabs at the top of the left settings panel (slicer pattern: tabs, settings, action in one column). */
export default function WorkflowRail({ step, onStep, hasModel, hasMold, onHide }: Props) {
  const tab = (active: boolean, disabled: boolean): React.CSSProperties => ({
    flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
    minHeight: 52, padding: `${spacing.xs}px 2px`, border: 'none', borderRadius: radii.md, fontFamily: fonts.body,
    background: active ? colors.primaryAlpha : 'transparent', color: active ? colors.primary : colors.textMuted,
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1, textDecoration: 'none',
    fontSize: fontSizes.xs, fontWeight: 600, position: 'relative', lineHeight: 1.2,
    boxShadow: active ? `inset 0 -2px 0 ${colors.primary}` : 'none',
  });
  const iconBtn: React.CSSProperties = {
    flexShrink: 0, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: 'none', borderRadius: radii.md, background: 'transparent', color: colors.textMuted, cursor: 'pointer',
  };
  return (
    <div style={{ borderBottom: `1px solid ${colors.borderSubtle}`, padding: `${spacing.sm}px ${spacing.sm}px ${spacing.xs}px` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, padding: `0 ${spacing.xs}px ${spacing.xs}px` }}>
        <span style={{ fontSize: fontSizes.xs, fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 }}>
          Step {step + 1} of 5 · {STEPS[step]?.hint}
        </span>
        <div style={{ display: 'flex', gap: spacing.xs, flexShrink: 0 }}>
          <Link to="/studio/ai" title="AI Model Maker — create a model from a description" aria-label="AI Model Maker" style={iconBtn}>
            <Sparkles size={16} aria-hidden="true" />
          </Link>
          {onHide && (
            <button type="button" className="sirpam-hide-sm" onClick={onHide} title="Hide settings" aria-label="Hide settings panel" aria-expanded style={iconBtn}>
              <PanelLeftClose size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      <nav aria-label="Workflow steps" style={{ display: 'flex', gap: 2 }}>
        {STEPS.map((s, i) => {
          const active = i === step;
          const disabled = !hasModel && i > 0;
          const done = (i === 0 && hasModel && step > 0) || (i === 2 && hasMold) || (hasModel && i < step && i !== 0);
          const Icon = s.icon;
          return (
            <button key={s.name} type="button" disabled={disabled} onClick={() => onStep(i)}
              aria-current={active ? 'step' : undefined}
              title={disabled ? `${s.name} — load a model first` : `${s.name} (${i + 1}) — ${s.hint}`}
              style={tab(active, disabled)}>
              <Icon aria-hidden="true" size={18} />
              <span>{s.name}</span>
              {done && !active && <CircleCheck aria-label="done" size={11} style={{ position: 'absolute', top: 2, right: 4, color: colors.primary }} />}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
