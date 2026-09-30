# Replace the original mold-maker code with our own engine (clean-room rewrite)

## Goal
Remove every piece of code copied from matta174/mold-maker (PolyForm Noncommercial), so Sirpam 3D Labs owns 100% of the Studio and can use it commercially at no cost. You keep every feature you see today: same steps, same buttons, same outputs.

## What gets replaced
42 files in the Studio came from the original project (about 11,900 lines). They fall into four groups:

```text
1. Mold engine     generateMold, moldBox, channelPlacement, planeGeometry, siliconeMold,
                   moldOffset, draftAnalysis, capOpenBoundaries, validateMesh, manifoldBridge,
                   suggestParting, splitLine, constants
2. Worker + files  moldWorker, workerProtocol, useMoldGenerator, exporters, minizip,
                   fileLoader, STEP export (4 files)
3. Screens         App, ControlPanel, ModelViewer, PartingPlane, HeatmapOverlay,
                   SplitLineOverlay, FirstRunTelemetryModal, theme, types
4. Helpers         printerFit, printerPresets, costEstimate, projectStorage, sampleModel,
                   telemetry (4 files)
```

Files we wrote ourselves (hug locks, pro features, round-7 features, model tools, mesh fix, shop panels, print queue, AI maker, advanced panel) stay, only re-pointed at the new engine.

## How it is done (clean-room rules)
- Written from a feature spec, not by editing the old files: each old file is deleted, then a new one is written from the spec of what it must do (inputs, outputs, behaviour). No copied code, comments or names that are unique to the original.
- Built directly on Manifold 3D (Apache-2.0) and Three.js (MIT) — both free for commercial use.
- Telemetry from the original (the first-run "share usage" popup and its sender) is removed, not rewritten: Google Analytics and Clarity already cover this.
- STEP export is rewritten as our own small exporter on OpenCascade (LGPL, allowed commercially when loaded separately, as now). STL, OBJ and 3MF stay.

## Order of work
1. Write the feature spec and a "golden" test set: build molds today for the 4 sample models plus a real STL in rigid, silicone (3 styles), hug, angled split and extra-plane modes; record piece count, volume, bounding box and watertight status.
2. New engine core (group 1), one module at a time, each with unit tests.
3. New worker, file loading and exports (group 2).
4. New Studio screens (group 3), keeping the current layout: left steps, centre 3D view, right settings, bottom status bar. Break the two giant files into smaller pieces.
5. Helpers (group 4).
6. Re-point our own feature files at the new engine; remove the `@ts-nocheck` markers so everything is type-checked.
7. Update the Licenses and About pages: remove the mold-maker credit, list only Manifold, Three.js, OpenCascade, React, TanStack, Tailwind. Add a written note in AGENTS.md recording the clean-room rewrite.
8. Final check that no original file or distinctive phrase remains (automated search).

## Quality bar (acceptance)
- Every golden case builds: same number of pieces, volumes within 2%, watertight, cavity matches the model.
- Exported STL files open cleanly (valid header, closed mesh) — checked by an automated test reading them back.
- Browser check of the full flow on all 4 samples and an uploaded STL: load, set split, build, view, export, save/load project, quote request.
- Build and type-check clean; no new paid services; prices and credits unchanged.

## Honest risks
- This is a large rewrite; small behaviour differences (exact pin positions, spout placement) are likely. The golden tests catch real breakage, not cosmetic shifts.
- It runs over several rounds of work. Until step 8 finishes, the app still contains original code, so do not publish or take paid orders through the Studio until it's done.
- Your saved projects (.sirpam.json) will still open; the file format stays readable.

## Technical details
- Engine API kept stable: `generateMold(geo, bbox, axis, offset, opts)` → `{ pieces, repairs, labels, notices }`, same worker message types, so `moldFeatures`, `proFeatures`, `round7`, `formFitLocks`, `modelTools`, `meshFix` need only import updates.
- Tests with vitest under `src/moldmaker/mold/*.test.ts`; golden fixtures as JSON metrics, not meshes.
- Byte-identical-when-off rule for extras is re-based on the new engine's own output.
