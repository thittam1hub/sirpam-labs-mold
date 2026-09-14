# Rebrand: Sirpam 3D Labs Mold — "Soft Neumorphic Lab"

Full visual rebrand of the mold-maker app to the new brand, based on the
selected design direction (v2, Soft Neumorphic Lab). All existing features
stay exactly as they are — this is identity + visual redesign only.

## What changes

1. **Brand identity**
   - App name: "Sirpam 3D Labs Mold" (header wordmark: "Sirpam **3D Labs** Mold"
     with the ember-orange accent on "3D Labs").
   - Tagline: "Two-part & silicone mold generator for 3D printing".
   - New logo mark: raised neumorphic rounded square with an ember-orange
     sphere/dot, used in the header.
   - Page title, meta description, and header text updated.

2. **Typography** (locked pick)
   - Headings/wordmark: Space Grotesk.
   - Body/UI text: DM Sans.
   - Loaded via Google Fonts `<link>` (never CSS @import), applied through
     the app's style tokens.

3. **Soft neumorphism visual system** (from the selected prototype)
   - Background: light blue-grey `#E0E5EC`; viewport well `#D1D9E6`.
   - Every surface uses dual shadows — raised: dark `#B8B9BE` bottom-right +
     white top-left; pressed/inset states for active controls, slider wells,
     and selected segments.
   - Accent: ember orange `#E8632B` for active axes, selected mold type,
     toggle-on knobs, slider fills, and the primary Generate/Export buttons
     (with a soft orange glow shadow).
   - Text: warm slate (`#475569` body, `#1E293B` headings, `#94A3B8` captions).
   - Radii: cards 24px, controls 12px, pills fully round; thin custom
     scrollbar.

4. **Restyled components**
   - Header bar with logo mark + wordmark + Load File button (neumorphic).
   - 3D viewport: inset rounded well (32px radius) with a subtle dot grid;
     the drop-zone state restyled to match.
   - Control panel: section cards as raised neumorphic panels with small
     uppercase section labels; sliders become inset tracks with raised
     knobs; segmented controls (axis, mold type, box shape, workflows) use
     raised/inset pressed states; toggles become neumorphic pill switches.
   - Banner/notice styles (mesh repair notice, telemetry modal) restyled to
     the new system.
   - The 3D scene itself (mold colors, parting plane, grid) is untouched.

## Technical notes

- The app styles come from `src/moldmaker/theme.ts` (colors/spacing/styles
  objects consumed as inline styles by `App.tsx`, `ControlPanel.tsx`,
  `ModelViewer.tsx`, `FirstRunTelemetryModal.tsx`). The rebrand rewrites
  those tokens and the affected inline-style blocks — no logic changes.
- Fonts loaded in `src/routes/__root.tsx` head (Space Grotesk + DM Sans).
- Title/meta updated in `src/routes/index.tsx` head().
- Range-input knob styling needs a small CSS block (webkit/moz thumb rules)
  in the app's stylesheet for the raised neumorphic knob.
- No new dependencies; no changes to mold generation, workers, or exports.

## Verification

- Build green, then browser-check: header brand, drop zone, full control
  panel before and after loading the sample model + generating (rigid and
  silicone), toggles, sliders, and banner all render in the new skin with
  readable contrast.
