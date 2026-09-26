# Mold Maker v2 — five new features

Five additions to Sirpam 3D Labs Mold, on top of the existing rigid/silicone workflows. All client-side, in the browser, in keeping with the app's no-signup, no-cloud promise. No changes to mold-generation math, workers, or export files except where noted.

## 1. Split-line preview (see the cut before generating)

- New overlay in the 3D viewer: when a model is loaded, draw the parting plane's intersection with the model as a bright ember-colored line on the surface, plus a faint translucent plane.
- Reuses the parting-plane math already feeding the heatmap (`draftAnalysis.ts`, `planeGeometry.ts`); classification of each triangle vs. the plane is linear in triangles, so it updates live on every slider tick — same pattern as the existing heatmap overlay.
- Shown in both Rigid and Silicone modes; toggleable ("Show split line") and hidden automatically while a mold is generated/generated pieces are displayed.

## 2. Auto-suggest best parting setup

- New "Suggest best split" button near the parting-plane controls.
- Runs in the mold worker (off the UI thread): samples the candidate axes (x/y/z, with a few tilt angles), scores each using the existing draft-heat classification (fewer red/undercut faces, fewer near-vertical yellow faces, more balanced piece heights), and applies the winner to the axis/offset/tilt controls.
- Shows a one-line result in the panel, e.g. "Best: Y axis, 48% up, 6° tilt — 2% undercut faces". User can accept (default) or keep adjusting manually.

## 3. Save / load mold projects (browser-only)

- "Save project" stores the model file reference, parting-plane settings, mold type and all mold parameters, printer preset, and a snapshot name in browser storage (IndexedDB via a tiny wrapper, following the existing `telemetrySettings.ts` local-storage pattern). The model file itself is stored so reopening restores everything.
- A "Projects" section in the control panel lists saved projects (name + date), with Open and Delete. "Save" prompts for a name; re-saving the same name updates it.
- "Export project file" downloads a single `.sirpam.json` (settings + model) that can be shared or backed up; "Import project file" restores it. No accounts, nothing leaves the browser.

## 4. Material & cost estimator

- After a mold is generated, the results area shows per-piece and total estimates: part volume, material weight (PLA/resin toggle, default PLA), estimated print time (volume- and height-based rule of thumb per printer preset), and cost from a user-editable material price per kg.
- For silicone workflows, also shows the existing silicone volume (cm³) with a price per liter input, next to the rigid filament estimate for the box/core.
- Pure client-side math on the generated geometry (triangle volume + bounding box); no generation-time changes.

## 5. Exploded view of mold pieces

- "Explode" slider in the results/viewer area: spreads the generated pieces apart along the parting axis (and outward for additional planes) with an animated slide, so cavities, pins, vents, and internal faces are easy to inspect.
- Slider returns to 0 to snap pieces back together; disabled when nothing is generated or only one piece exists.
- Implemented inside `ModelViewer.tsx` by offsetting piece meshes from their assembled positions — no geometry changes, so exports are untouched.

## Where the work lands (technical)

- `src/moldmaker/mold/` — new `splitLine.ts` (plane/model intersection) and `suggestParting.ts` (scoring), both pure functions; auto-suggest invoked from the worker via a new lightweight message type in `workerProtocol.ts`.
- `src/moldmaker/components/ModelViewer.tsx` — split-line overlay mesh, exploded-view offset state, per-piece volume capture.
- `src/moldmaker/components/ControlPanel.tsx` — Projects section, Suggest button, estimator inputs; styled with existing `theme.ts` neumorphic tokens only.
- `src/moldmaker/App.tsx` — wires state: split-line toggle, suggestion result, saved-project list, estimator settings; passes new props down.
- `src/moldmaker/utils/` — new `projectStorage.ts` (IndexedDB save/load/import/export) and `costEstimate.ts` (volume/weight/time/cost math); `printerPresets.ts` reused for print-time heuristics.
- No new npm dependencies. Exports, generation results, and file formats unchanged (project files are new, additive).

## Order of build

1. Split-line preview (foundational plane math, visible immediately)
2. Auto-suggest (reuses #1's classification)
3. Exploded view (viewer-only)
4. Material & cost estimator
5. Save / load projects

Each step is verified in the browser with the sample model (rigid + silicone two-part) before moving on; final pass covers save → reload → reopen → explode → export.

## Out of scope (this round)

Model transforms, multi-cavity layout, print-readiness report, cloud accounts. Can follow in a later plan.
