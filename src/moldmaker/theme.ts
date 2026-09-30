// Sirpam 3D Labs Mold — Studio design tokens. Colours resolve to CSS
// variables (light/dark set in styles.css) with light-mode fallbacks.

const v = (name: string, fallback: string) => `var(--sm-${name}, ${fallback})`;
const BRAND = '#e8632b';

export const colors = {
  appBg: v('app-bg', '#e0e5ec'),
  viewportBg: v('viewport-bg', '#e0e5ec'),
  sceneBg: '#d1d9e6',
  panelBg: v('panel-bg', '#e0e5ec'),
  sectionBg: v('section-bg', '#e0e5ec'),
  borderPanel: v('border-panel', '#c5c9d1'),
  borderSection: v('border-section', '#d3d8e0'),
  borderSubtle: v('border-subtle', '#c8cdd6'),
  primary: BRAND,
  primaryAlpha: v('primary-alpha', `${BRAND}1f`),
  textPrimary: v('text-primary', '#1e293b'),
  textBody: v('text-body', '#475569'),
  textMuted: v('text-muted', '#64748b'),
  textDim: v('text-dim', '#8b98a9'),
  textFaint: v('text-faint', '#94a3b8'),
  fileInfo: v('file-info', '#4a6f99'),
  errorBg: v('error-bg', '#b91c1c'),
  infoBg: v('info-bg', '#b45309'),
  gridMajor: '#aab4c4',
  gridMinor: '#c3cbd8',
} as const;

export const shadows = {
  raised: 'var(--neu-raised)',
  raisedSm: 'var(--neu-raised-sm)',
  inset: 'var(--neu-inset)',
  insetDeep: 'var(--neu-inset-deep)',
  primary: '4px 4px 10px rgba(232,99,43,0.35), -4px -4px 8px var(--neu-light)',
} as const;

export const radii = { sm: 4, md: 12, lg: 16, xl: 24, pill: 9999 } as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 } as const;
export const fontSizes = { xs: 12, sm: 13, md: 14, lg: 20, xl: 22 } as const;
export const fonts = {
  display: "'Space Grotesk', 'DM Sans', sans-serif",
  body: "'DM Sans', 'Space Grotesk', sans-serif",
} as const;

const thumb = `
    border-radius: 50%;
    background: ${colors.viewportBg};
    border: 2px solid var(--neu-light);
    box-shadow: 2px 2px 5px var(--neu-dark), -2px -2px 5px var(--neu-light);
    cursor: pointer;`;
const track = `
    height: 8px;
    border-radius: ${radii.pill}px;
    background: ${colors.viewportBg};
    box-shadow: ${shadows.inset};`;

/** Global Studio CSS: keyboard focus ring, soft sliders, slim scrollbars. */
export const focusVisibleCss = `
  *:focus-visible { outline: 2px solid ${colors.primary}; outline-offset: 2px; border-radius: 4px; }
  [data-sirpam] input[type="range"] { -webkit-appearance: none; appearance: none; ${track} outline-offset: 4px; cursor: pointer; }
  [data-sirpam] input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 18px; height: 18px; ${thumb} }
  [data-sirpam] input[type="range"]::-moz-range-thumb { width: 14px; height: 14px; ${thumb} }
  [data-sirpam] input[type="range"]::-moz-range-track { ${track} }
  [data-sirpam] ::-webkit-scrollbar { width: 8px; }
  [data-sirpam] ::-webkit-scrollbar-track { background: transparent; }
  [data-sirpam] ::-webkit-scrollbar-thumb { background: var(--sm-border-subtle); border-radius: 10px; }
`;

/** 3D scene colours (WebGL can't read CSS variables). */
export const sceneColors = {
  light: { sceneBg: '#d1d9e6', gridMajor: '#aab4c4', gridMinor: '#c3cbd8' },
  dark: { sceneBg: '#1b1f26', gridMajor: '#3a414d', gridMinor: '#2a3039' },
} as const;
