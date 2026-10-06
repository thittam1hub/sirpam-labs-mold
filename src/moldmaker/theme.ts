// @ts-nocheck — upstream mold-maker code; type-checked under its own repo tsconfig
/**
 * Design tokens for the Sirpam 3D Labs Mold renderer UI.
 *
 * "Soft Neumorphic Lab" visual system: a light blue-grey shell where every
 * surface is extruded from the background via a pair of shadows (dark
 * bottom-right, white top-left). Interactive controls invert that treatment
 * when active — pressed into the surface — so state reads physically.
 *
 * Centralizing color/radius/spacing/fontSize values here prevents the gradual
 * drift that accumulates when each component hand-rolls its own values. Prefer
 * adding a new token over inlining a raw value in a component.
 */

export const colors = {
  // Background layers — one shared base color is what makes neumorphism
  // work: surfaces are the SAME color as what they sit on, differentiated
  // only by shadow. `viewportBg` doubles as the "well" color for inset
  // controls (inputs, slider tracks); `sceneBg` is the 3D canvas only.
  appBg: 'var(--sm-app-bg, #e0e5ec)',
  viewportBg: 'var(--sm-viewport-bg, #e0e5ec)',
  sceneBg: '#d1d9e6',
  panelBg: 'var(--sm-panel-bg, #e0e5ec)',
  sectionBg: 'var(--sm-section-bg, #e0e5ec)',

  // Borders — barely-there; shadow does the real edge work.
  borderPanel: 'var(--sm-border-panel, #c5c9d1)',
  borderSection: 'var(--sm-border-section, #d3d8e0)',
  borderSubtle: 'var(--sm-border-subtle, #c8cdd6)',

  // Brand / primary — Sirpam ember orange.
  primary: '#e8632b',
  primaryAlpha: 'var(--sm-primary-alpha, #e8632b1f)', // 12% alpha via 8-digit hex

  // Text — warm slate ramp on the light shell.
  textPrimary: 'var(--sm-text-primary, #1e293b)',
  textBody: 'var(--sm-text-body, #475569)',
  textMuted: 'var(--sm-text-muted, #64748b)',
  textDim: 'var(--sm-text-dim, #8b98a9)',
  textFaint: 'var(--sm-text-faint, #94a3b8)',
  fileInfo: 'var(--sm-file-info, #4a6f99)',

  // Semantic — saturated fills with white text; contrast holds on light bg.
  errorBg: 'var(--sm-error-bg, #b91c1c)',
  infoBg: 'var(--sm-info-bg, #b45309)',

  // Scene helpers — soft greys on the light canvas.
  gridMajor: '#aab4c4',
  gridMinor: '#c3cbd8',
} as const;

/**
 * Neumorphic shadow recipes. `raised` lifts a surface off the background;
 * `inset` presses a well into it. Active/selected controls use `inset`,
 * idle controls use `raisedSm`.
 */
export const shadows = {
  raised: 'var(--neu-raised)',
  raisedSm: 'var(--neu-raised-sm)',
  inset: 'var(--neu-inset)',
  insetDeep: 'var(--neu-inset-deep)',
  /** Ember glow for primary actions. */
  primary: '4px 4px 10px rgba(232,99,43,0.35), -4px -4px 8px var(--neu-light)',
} as const;

export const radii = {
  sm: 4,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 9999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
} as const;

export const fontSizes = {
  xs: 12,
  sm: 13,
  md: 14,
  lg: 20,
  xl: 22,
} as const;

/** Locked brand type pairing: Space Grotesk headings, DM Sans body. */
export const fonts = {
  display: "'Space Grotesk', 'DM Sans', sans-serif",
  body: "'DM Sans', 'Space Grotesk', sans-serif",
} as const;

/**
 * Global CSS injected once near the app root (inline styles can't express
 * pseudo-classes or pseudo-elements):
 *
 *  1. focus-visible ring in brand primary on every focusable element.
 *  2. Range inputs rendered as neumorphic inset wells with raised knobs.
 *     Scoped to the moldmaker UI via the `[data-sirpam]` attribute on the
 *     root container so nothing outside the app is affected.
 */
export const focusVisibleCss = `
  *:focus-visible {
    outline: 2px solid ${colors.primary};
    outline-offset: 2px;
    border-radius: 4px;
  }

  [data-sirpam] input[type="range"] {
    -webkit-appearance: none;
    appearance: none;
    height: 8px;
    border-radius: ${radii.pill}px;
    background: ${colors.viewportBg};
    box-shadow: ${shadows.inset};
    outline-offset: 4px;
    cursor: pointer;
  }
  [data-sirpam] input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: ${colors.viewportBg};
    border: 2px solid var(--neu-light);
    box-shadow: 2px 2px 5px var(--neu-dark), -2px -2px 5px var(--neu-light);
    cursor: pointer;
  }
  [data-sirpam] input[type="range"]::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: ${colors.viewportBg};
    border: 2px solid var(--neu-light);
    box-shadow: 2px 2px 5px var(--neu-dark), -2px -2px 5px var(--neu-light);
    cursor: pointer;
  }
  [data-sirpam] input[type="range"]::-moz-range-track {
    height: 8px;
    border-radius: ${radii.pill}px;
    background: ${colors.viewportBg};
    box-shadow: ${shadows.inset};
  }
  [data-sirpam] ::-webkit-scrollbar {
    width: 8px;
  }
  [data-sirpam] ::-webkit-scrollbar-track {
    background: transparent;
  }
  [data-sirpam] ::-webkit-scrollbar-thumb {
    background: var(--sm-border-subtle);
    border-radius: 10px;
  }
`;

/** Three.js can't read CSS variables — resolved scene colours per theme. */
export const sceneColors = {
  light: { sceneBg: '#d1d9e6', gridMajor: '#aab4c4', gridMinor: '#c3cbd8' },
  dark: { sceneBg: '#1b1f26', gridMajor: '#3a414d', gridMinor: '#2a3039' },
} as const;
