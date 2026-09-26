# New Layout: Top Toolbar + Guided Step Panel

Keep every feature, the Molten Ember colours, the fonts and the soft neumorphic style. Only where things sit and how you move through them changes.

## Layout

```text
+--------------------------------------------------------------------------+
| [logo] Sirpam 3D Labs Mold | model.stl | Open  Projects  Undo | Export v |
+--------------------------------------------------+-----------------------+
|                                                  | 1 Model  2 Split      |
|                                                  | 3 Mold   4 Pro        |
|              3D VIEWER (fills space)             | 5 Finish  (stepper)   |
|                                                  |-----------------------|
|  [view chips: Model | Mold | Exploded | Heatmap] |  Step settings        |
|                                                  |  (only this step)     |
|  status pill: "Mold up to date" / warnings       |                       |
|                                     [? ] [Tour]  | [Back]  [Next / Gen.] |
+--------------------------------------------------+-----------------------+
```

## Top toolbar (always visible)
- Brand on the left, then the loaded file name.
- Actions: Open model, Try sample, Projects menu (save, open, import, export .sirpam.json), keyboard help.
- Main action on the right: the Generate button, plus an Export menu (STL / OBJ / 3MF / STEP) that is only active once a mold exists.

## Guided step panel (right, about 380 px)
A stepper at the top shows the 5 steps. Each step can be clicked at any time, shows a tick when done, and only that step's settings show underneath:
1. **Model:** file info, hollow-vessel, mesh repair notice, printer fit.
2. **Split:** axis, position, angle, extra cuts, Suggest Best Split, split line, draft heatmap, custom sprue.
3. **Mold:** Rigid or Silicone, silicone workflow, box shape, form fit, wall, clearance, sprue size.
4. **Pro features:** seal, pry slots, radial split, tray and runners, hollow core, gate advisor, casting material.
5. **Finish:** generate, Material & Cost, export formats, orient for print, save project.

A sticky footer at the bottom has Back and Next. On the last step, Next becomes "Generate Mold" (it changes to "Regenerate" when settings have changed).

## Viewer
- Mold banners (for example the auto-repair notice) move into a small status pill with a dismiss button, so the model stays visible.
- A floating chip group at the bottom-left switches view modes (model, mold, exploded, heatmap). These replace the old "View" section.
- The Tour and "?" buttons sit together in the bottom-right corner. The tour text is updated to match the new steps.

## Smaller screens
- Below 900 px wide, the panel becomes a bottom sheet you can drag up. The stepper turns into a horizontal row of icons, and the toolbar folds its actions into a menu.

## Kept as is
- All mold maths, the export files and saved projects.
- The privacy toggle moves into a small settings menu in the toolbar.

## Technical details
- New `src/moldmaker/components/layout/`: `TopBar.tsx`, `StepPanel.tsx` (stepper + footer), `ViewerChrome.tsx` (status pill, view chips, help/tour cluster).
- Split `ControlPanel.tsx` (1.7k lines) into per-step section components (`steps/ModelStep.tsx`, `SplitStep.tsx`, `MoldStep.tsx`, `ProStep.tsx`, `FinishStep.tsx`). Move the existing JSX blocks over unchanged, and keep the same props and handlers.
- `App.tsx` gets the new grid (`toolbar / viewer + panel`) and a `step` state stored in `localStorage`. The Projects and Export blocks move from the panel into toolbar popovers.
- Styling stays inline using `theme.ts` tokens. No new dependencies.
- Afterwards, check in the browser: load the sample, go through every step, generate rigid and silicone molds, export STL, save and open a project, and check a mobile width. Confirm there are no console errors.
