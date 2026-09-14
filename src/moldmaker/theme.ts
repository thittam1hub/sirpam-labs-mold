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
  appBg: '#e0e5ec',
  viewportBg: '#e0e5ec',
  sceneBg: '#d1d9e6',
  panelBg: '#e0e5ec',
  sectionBg: '#e0e5ec',

  // Borders — barely-there; shadow does the real edge work.
  borderPanel: '#c5c9d1',
  borderSection: '#d3d8e0',
  borderSubtle: '#c8cdd6',

  // Brand / primary — Sirpam ember orange.
  primary: '#e8632b',
  primaryAlpha: '#e8632b1f', // 12% alpha via 8-digit hex

  // Text — warm slate ramp on the light shell.
  textPrimary: '#1e293b',
  textBody: '#475569',
  textMuted: '#64748b',
  textDim: '#8b98a9',
  textFaint: '#94a3b8',
  fileInfo: '#4a6f99',

  // Semantic — saturated fills with white text; contrast holds on light bg.
  errorBg: '#b91c1c',
  infoBg: '#b45309',

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
  raised: '6px 6px 12px #b8b9be, -6px -6px 12px #ffffff',
  raisedSm: '3px 3px 6px #b8b9be, -3px -3px 6px #ffffff',
  inset: 'inset 2px 2px 5px #b8b9be, inset -2px -2px 5px #ffffff',
  insetDeep: 'inset 4px 4px 8px #b8b9be, inset -4px -4px 8px #ffffff',
  /** Ember glow for primary actions. */
  primary: '4px 4px 10px rgba(232,99,43,0.35), -4px -4px 8px #ffffff',
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
    border: 2px solid rgba(255,255,255,0.7);
    box-shadow: 2px 2px 5px #b8b9be, -2px -2px 5px #ffffff;
    cursor: pointer;
  }
  [data-sirpam] input[type="range"]::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: ${colors.viewportBg};
    border: 2px solid rgba(255,255,255,0.7);
    box-shadow: 2px 2px 5px #b8b9be, -2px -2px 5px #ffffff;
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
    background: #c8d0d9;
    border-radius: 10px;
  }
`;
