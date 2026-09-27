import { useEffect, useState } from 'react';
import { colors, radii, spacing, fontSizes, shadows } from '../theme';

const KEY = 'sirpam.tourSeen.v1';

const STEPS: Array<{ title: string; body: string }> = [
  { title: 'Welcome to Sirpam 3D Labs Mold', body: 'This quick tour shows how to turn any 3D model into a printable mold { title: 'Welcome to Sirpam 3D Labs Mold', body: 'This quick tour shows how to turn any 3D model into a printable mold. Everything happens in five steps on the right, with Back and Next at the bottom. You can reopen this tour anytime with the Tour button.' },
  { title: '1. Model', body: 'Use Open model or Try sample in the top bar, or drop an STL / OBJ onto the viewer. Printer fit lives in this step too. Drag to rotate, scroll to zoom, right-drag to pan.' },
  { title: '2. Split', body: 'Pick the axis and height where the mold opens. Press Suggest Best Split to let the app find the cleanest one, and turn on Split Line to see it on the model.' },
  { title: '3. Mold', body: 'Rigid makes a printed two-part mold. Silicone gives a pour box, two-part block or skin + mother mold. Form fit makes the shell hug the model to save material.' },
  { title: '4. Pro', body: 'Seal type, pry slots, radial splits, multi-cavity trays with runners, a hollow core for vases, and the gate advisor all live in the Pro panel.' },
  { title: '5. Finish', body: 'Press Generate Mold (bottom right or top bar). Use the view buttons on the viewer for exploded / wireframe / heatmap, and Material & Cost for estimates.' },
  { title: 'Export and save', body: 'Use Export in the top bar for STL, OBJ, 3MF or STEP — pieces are oriented flat for printing. Projects in the top bar saves your work in the browser or as a .sirpam.json file to share.' },
];

export default function GuidedTour() {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);

  useEffect(() => {
    try { if (!localStorage.getItem(KEY)) setOpen(true); } catch { /* storage blocked */ }
  }, []);

  const close = () => {
    setOpen(false);
    setI(0);
    try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') setI(v => Math.min(STEPS.length - 1, v + 1));
      if (e.key === 'ArrowLeft') setI(v => Math.max(0, v - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const btn = (primary = false) => ({
    padding: `${spacing.sm}px ${spacing.md}px`, borderRadius: radii.pill, border: 'none', cursor: 'pointer',
    background: primary ? colors.primary : colors.sectionBg, color: primary ? colors.sectionBg : colors.textBody,
    boxShadow: shadows.raisedSm, fontWeight: 600, fontSize: fontSizes.sm,
  });

  if (!open) {
    return (
      <button className="sirpam-hide-sm" aria-label="Start guided tour" onClick={() => setOpen(true)}
        style={{ ...btn(), position: 'fixed', left: 16, bottom: 16, zIndex: 50 }}>
        Tour
      </button>
    );
  }

  const step = STEPS[i]!;
  const last = i === STEPS.length - 1;
  return (
    <div role="dialog" aria-label="Guided tour" style={{
      position: 'fixed', left: 16, bottom: 16, zIndex: 60, width: 340, maxWidth: 'calc(100vw - 32px)',
      background: colors.sectionBg, borderRadius: radii.xl, boxShadow: shadows.raised, padding: spacing.md + 4,
    }}>
      <div style={{ fontSize: fontSizes.xs, color: colors.textDim, marginBottom: spacing.xs }}>
        Step {i + 1} of {STEPS.length}
      </div>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: fontSizes.md, color: colors.textBody, marginBottom: spacing.sm }}>
        {step.title}
      </div>
      <div style={{ fontSize: fontSizes.sm, color: colors.textMuted, lineHeight: 1.5 }}>{step.body}</div>
      <div style={{ display: 'flex', gap: 4, margin: `${spacing.md}px 0` }}>
        {STEPS.map((_, k) => (
          <div key={k} style={{ flex: 1, height: 4, borderRadius: 2, background: k <= i ? colors.primary : colors.textDim, opacity: k <= i ? 1 : 0.3 }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: spacing.sm }}>
        <button style={btn()} onClick={close}>Skip</button>
        <div style={{ display: 'flex', gap: spacing.sm }}>
          {i > 0 && <button style={btn()} onClick={() => setI(i - 1)}>Back</button>}
          <button style={btn(true)} onClick={() => (last ? close() : setI(i + 1))}>{last ? 'Finish' : 'Next'}</button>
        </div>
      </div>
    </div>
  );
}
