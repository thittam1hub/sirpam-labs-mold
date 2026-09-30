// Sirpam 3D Labs Mold — empty-state overlay: drop hint, browse button, samples, AI link.
import { Link } from '@tanstack/react-router';
import { colors, radii, spacing, fontSizes, shadows, fonts } from '../theme';
import { SAMPLE_TEMPLATES, type SampleTemplateId } from '../utils/sampleTemplates';

export interface DropZoneProps {
  onLoadFile: () => void;
  onLoadTemplate: (id: SampleTemplateId) => void;
}

/**
 * Two-action empty state (load file vs. try sample) so first-time users
 * aren't stuck without an STL handy. Pointer events fall through everywhere
 * except real buttons/links, so the empty 3D scene stays orbit-able.
 */
export default function DropZone({ onLoadFile, onLoadTemplate }: DropZoneProps) {
  return (
    <div
      style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'color-mix(in srgb, var(--sm-panel-bg) 88%, transparent)',
        color: colors.textPrimary,
        fontFamily: fonts.body,
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      <svg
        aria-hidden="true"
        width="64" height="64" viewBox="0 0 24 24"
        fill="none" stroke={colors.primary}
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ marginBottom: spacing.lg }}
      >
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
      <div style={{ fontSize: fontSizes.lg, fontWeight: 600, marginBottom: spacing.sm }}>
        Drop a 3D model here
      </div>
      <div style={{ fontSize: fontSizes.md, color: colors.textFaint, marginBottom: spacing.lg }}>
        Supports STL and OBJ files
      </div>
      <div style={{ display: 'flex', gap: spacing.md, pointerEvents: 'auto' }}>
        <button
          type="button"
          onClick={onLoadFile}
          style={{
            background: colors.primary, color: '#fff', border: 'none', borderRadius: radii.pill,
            padding: `${spacing.md}px ${spacing.xl}px`, fontSize: fontSizes.md, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit', boxShadow: shadows.primary,
          }}
          aria-label="Load a 3D model file"
        >
          Browse Files
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs, alignItems: 'center', pointerEvents: 'auto' }}>
          <span style={{ fontSize: fontSizes.sm, color: colors.textFaint }}>or try a sample model</span>
          <div style={{ display: 'flex', gap: spacing.xs, flexWrap: 'wrap', justifyContent: 'center' }}>
            {SAMPLE_TEMPLATES.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => onLoadTemplate(t.id)}
                title={t.hint}
                style={{
                  background: colors.sectionBg, color: colors.textBody, border: 'none', borderRadius: radii.pill,
                  padding: `${spacing.sm}px ${spacing.md}px`, fontSize: fontSizes.sm, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit', boxShadow: shadows.raisedSm,
                }}
                aria-label={`Load the sample ${t.label} model`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <Link to="/studio/ai" style={{ display: 'inline-block', marginTop: spacing.lg, color: colors.primary, fontWeight: 700, fontSize: fontSizes.sm, pointerEvents: 'auto' }}>
        or create a model with AI
      </Link>
    </div>
  );
}
