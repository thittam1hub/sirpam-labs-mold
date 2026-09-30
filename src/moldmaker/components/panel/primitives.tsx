// Sirpam 3D Labs Mold — small reusable UI atoms shared by every panel step.
import { colors } from '../../theme';

/**
 * Accessible toggle switch rendered as a real <button role="switch"> so
 * screen readers announce state changes and keyboard users can reach it —
 * a plain clickable <div> would offer neither.
 */
export function ToggleSwitch({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={label}
      onClick={onClick}
      style={{
        width: 40,
        height: 22,
        borderRadius: 999,
        border: 'none',
        cursor: 'pointer',
        padding: 2,
        background: active ? colors.primary : colors.sectionBg,
        boxShadow: active ? 'none' : 'var(--neu-inset)',
        display: 'flex',
        justifyContent: active ? 'flex-end' : 'flex-start',
        transition: 'background 0.15s',
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          display: 'block',
        }}
      />
    </button>
  );
}
