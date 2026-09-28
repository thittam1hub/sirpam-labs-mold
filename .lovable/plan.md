# Studio restructure + dedicated AI Model Maker

## Your question: should controls move to the left?
Industry pattern (Fusion 360, Onshape, Blender, Figma, Bambu Studio, PrusaSlicer, Meshmixer) splits by role, not "all left" or "all right":

- **Left rail = "what am I doing"** — mode/workflow switcher (Model, Repair, Split, Mold, Finish, AI) as a slim icon + label rail, plus a model/parts outline.
- **Center = 3D view** — always the largest area, with floating view tools (fit, section, heatmap toggles) at the bottom.
- **Right panel = "settings for the current step"** — properties/inspector, collapsible.
- **Top bar = file actions + account** (open, save, undo, export, credits, theme).

So: move the step navigation to a left rail, keep detailed settings on the right. This is what slicers and CAD apps do and matches left-to-right reading (choose task, then tune it).

```text
+--------------------------------------------------------------+
| Logo  Project name   Undo Redo  |  Credits  Export  Account  |
+----+---------------------------------------------+-----------+
| M  |                                             | Settings  |
| R  |                3D view                      | for the   |
| S  |                                             | current   |
| Md |                                             | step      |
| F  |        [ fit | section | overlays ]         | (collaps.)|
| AI |                                             |           |
+----+---------------------------------------------+-----------+
| Status: model size, triangles, fit check, job progress       |
+--------------------------------------------------------------+
```

## What gets built
1. **Left workflow rail** — Model, Repair, Split, Mold, Finish + a separate **AI Maker** entry. Shows done/locked state per step (context aware: steps needing a model are dimmed with a hint until one is loaded). Collapses to icons; on mobile becomes a bottom tab bar.
2. **Right inspector** — only the current step's settings, grouped into collapsible sections with "Basic" shown and "Advanced" folded. Resizable and collapsible; width remembered.
3. **Bottom status bar** — model dimensions, triangle count, printer-fit check, running job progress (repair/mold build) with cancel.
4. **Dedicated AI Model Maker page** at `/studio/ai`:
   - Prompt box with example prompts and style chips (vase, figurine base, coaster, chess piece, etc.), size + units inputs.
   - Live 3D preview of the generated shape, history of generations in the session, regenerate / refine ("make it taller", "add a rim").
   - Credit cost shown before generating, charge-on-success (existing hold/capture).
   - "Use in Studio" sends the model straight into the Model step; "Download STL" too.
   - Own page title/description; deep link `?prompt=` supported.
5. **Context awareness** — step order suggestions ("Model has holes, run Repair first"), next-step button at the bottom of each inspector, keyboard shortcuts (1-6 for steps, F fit, Ctrl+Z), empty state with drop zone + "or create with AI".
6. **URL state** — `?step=` and panel state kept in the URL as today; `/studio/ai` links from the rail.

## Kept unchanged
Mold engine, credit rules, all existing settings (just relocated), dark/light themes, no emoji.

## Technical details
- Split `ControlPanel.tsx` (1.7k lines) into `layout/WorkflowRail.tsx`, `layout/Inspector.tsx`, `layout/StatusBar.tsx` and per-step panels (`steps/ModelStep.tsx`, `RepairStep`, `SplitStep`, `MoldStep`, `FinishStep`); App.tsx state stays the single source of truth.
- New route `src/routes/studio.ai.tsx`, browser-only 3D preview lazy-loaded like the Studio; reuses `shapeAi.functions.ts` and `modelTools.buildFromSpec`. Handoff to Studio via in-memory store (sessionStorage fallback) so the model opens without re-upload.
- AI section removed from the Model step; replaced by a link card to `/studio/ai`.
- Verify with Playwright on desktop + mobile, light + dark.
