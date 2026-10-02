import { Link } from '@tanstack/react-router';
import { Box, Scissors, Layers, Wrench, PackageCheck, Sparkles, CircleCheck } from 'lucide-react';
import { colors, radii, spacing, fontSizes, shadows, fonts } from '../../theme';

const STEPS = [
  { name: 'Model', icon: Box, hint: 'Load, repair and size your part' },
  { name: 'Split', icon: Scissors, hint: 'Choose where the mold opens' },
  { name: 'Mold', icon: Layers, hint: 'Mold type, walls, locks, vents' },
  { name: 'Pro', icon: Wrench, hint: 'Advanced features and model tools' },
  { name: 'Finish', icon: PackageCheck, hint: 'Export, report and print plan' },
];

type Props = { step: number; onStep: (n: number) => void; hasModel: boolean; hasMold: boolean };

/** Left workflow rail: task switcher (industry pattern: task left, settings right). */
export default function WorkflowRail({ step, onStep, hasModel, hasMold }: Props) {
  const item = (active: boolean, disabled: boolean): React.CSSProperties => ({
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, width: '100%',
    minHeight: 56, padding: `${spacing.sm}px ${spacing.xs}px`, border: 'none', borderRadius: radii.md, fontFamily: fonts.body,
    background: active ? colors.primaryAlpha : 'transparent', color: active ? colors.primary : colors.textMuted,
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1, textDecoration: 'none',
    fontSize: fontSizes.xs, fontWeight: 600, position: 'relative', lineHeight: 1.2,
  });
  return (
    <nav aria-label="Workflow steps" className="sirpam-rail" style={{
      width: 76, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing.xs,
      padding: `${spacing.lg}px ${spacing.sm}px`, background: colors.panelBg, boxShadow: shadows.raisedSm, zIndex: 2,
    }}>
      {STEPS.map((s, i) => {
        const active = i === step;
        const disabled = !hasModel && i > 0;
        const done = (i === 0 && hasModel && step > 0) || (i === 2 && hasMold) || (hasModel && i < step && i !== 0);
        const Icon = s.icon;
        return (
          <button key={s.name} type="button" disabled={disabled} onClick={() => onStep(i)}
            aria-current={active ? 'step' : undefined}
            title={disabled ? `${s.name} — load a model first` : `${s.name} (${i + 1}) — ${s.hint}`}
            style={item(active, disabled)}>
            <Icon aria-hidden="true" size={20} />
            <span>{s.name}</span>
            {done && !active && <CircleCheck aria-label="done" size={12} style={{ position: 'absolute', top: spacing.xs, right: spacing.xs, color: colors.primary }} />}
          </button>
        );
      })}
      <div className="sirpam-rail-sep" style={{ height: 1, width: '70%', background: colors.borderSubtle, margin: `${spacing.sm}px 0` }} />
      <Link to="/studio/ai" title="AI Model Maker — create a model from a description" style={item(false, false)}>
        <Sparkles aria-hidden="true" size={20} />
        <span>AI Maker</span>
      </Link>
    </nav>
  );
}
