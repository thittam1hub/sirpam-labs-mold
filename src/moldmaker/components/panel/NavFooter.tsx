// Sirpam 3D Labs Mold — step rail (top) and Back/Next/Generate footer that
// drive navigation between the five panel steps.
import { CircleCheck } from 'lucide-react';
import { colors, spacing, fontSizes, shadows, styles } from './tokens';

export const STEP_NAMES = ['Model', 'Split', 'Mold', 'Pro', 'Finish'] as const;

export function StepRail({ step, onStep, hasModel, hasMold }: { step: number; onStep: (n: number) => void; hasModel: boolean; hasMold: boolean }) {
  return (
    <nav aria-label="Steps" className="sirpam-stepper" style={{ display: 'flex', gap: 4, padding: `${spacing.lg}px ${spacing.xl}px ${spacing.sm}px` }}>
      {STEP_NAMES.map((name, i) => {
        const active = i === step;
        const done = (i === 0 && hasModel) || (i === 4 && hasMold) || (hasModel && i < step);
        const disabled = !hasModel && i > 0;
        return (
          <button
            key={name} type="button" disabled={disabled} onClick={() => onStep(i)} aria-current={active ? 'step' : undefined}
            style={{
              flex: 1, border: 'none', background: 'transparent', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: 0, fontFamily: 'inherit',
            }}
          >
            <span style={{
              width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: fontSizes.sm,
              background: active ? colors.primary : colors.sectionBg, color: active ? '#fff' : done ? colors.primary : colors.textMuted,
              boxShadow: active ? shadows.primary : done ? shadows.inset : shadows.raisedSm,
            }}>
              {done && !active ? <CircleCheck aria-hidden="true" size={17} /> : i + 1}
            </span>
            <span style={{ fontSize: fontSizes.xs, fontWeight: 600, color: active ? colors.primary : colors.textMuted }}>{name}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function StepFooter({
  step, onStepChange, hasModel, primaryLabel, primaryDisabled, onGenerate,
}: {
  step: number;
  onStepChange: (n: number) => void;
  hasModel: boolean;
  primaryLabel: string;
  primaryDisabled: boolean;
  onGenerate: () => void;
}) {
  return (
    <div style={{ display: 'flex', gap: spacing.sm, padding: `${spacing.md}px ${spacing.xl}px`, boxShadow: '0 -6px 12px -8px var(--neu-dark)' }}>
      <button
        type="button" style={{ ...styles.button, ...styles.secondaryBtn, flex: 1, ...(step === 0 ? styles.disabledBtn : {}) }}
        disabled={step === 0} onClick={() => onStepChange(Math.max(0, step - 1))}
      >
        Back
      </button>
      {step < 4 ? (
        <button
          type="button" style={{ ...styles.button, ...styles.primaryBtn, flex: 2, ...(!hasModel ? styles.disabledBtn : {}) }}
          disabled={!hasModel} onClick={() => onStepChange(step + 1)}
        >
          Next: {STEP_NAMES[step + 1]}
        </button>
      ) : (
        <button
          type="button" style={{ ...styles.button, ...styles.primaryBtn, flex: 2, ...(primaryDisabled || !hasModel ? styles.disabledBtn : {}) }}
          onClick={onGenerate} disabled={primaryDisabled || !hasModel} aria-live="polite"
        >
          {primaryLabel}
        </button>
      )}
    </div>
  );
}
