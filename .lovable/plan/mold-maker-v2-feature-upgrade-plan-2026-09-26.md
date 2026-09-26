# Mold Maker v2 — feature upgrade plan

Two parts: an inventory of the mold features we already have (so nothing gets rebuilt by accident), and a confirmed build list plus a ranked backlog of new features modeled on what the best mold tools ship.

## What we already have (current mold features)

- **Model input** — drag-drop / browse STL & OBJ, sample model, auto mesh repair, hollow-vessel hole capping.
- **3D preview** — orbit/zoom/pan, live demoldability heatmap (green/yellow/red by face), wireframe toggle.
- **Parting plane** — axis pick, slide offset, tilt ±30°, extra parting planes, sprue diameter + manual sprue placement, vents, registration pins, wall thickness, clearance, box shapes (rect / cylinder / rounded), form-fit shell.
- **Mold types** — Rigid two-part; Silicone with three workflows (open pour box, two-part block, skin + mother mold), silicone-volume estimate.
- **Output** — STL/OBJ/3MF/STEP ZIP export with per-part naming, printer fit check with presets.
- **Already built, easy to miss**: **Exploded view** — the explode toggle in the viewer already spreads the pieces apart (`explodedView` in App.tsx). So this is NOT part of the new work.

## Tier 1 — build now (confirmed)

### 1. Split-line preview
- Ember-colored line where the parting plane meets the model surface, plus a faint translucent plane, updating live as sliders move.
- Reuses `planeGeometry.ts` plane math + per-triangle classification from `draftAnalysis.ts`; new `mold/splitLine.ts` sibling overlay mounted in App.tsx's scene group (same pattern as HeatmapOverlay). Hidden when generated pieces are shown.

### 2. Auto-suggest best parting setup ("Split advisor")
- Button sweeps candidate axes (x/y/z), offsets, and tilts, scoring each with the existing `undercutFraction` metric (fewest undercut faces, balanced piece heights); applies the winner and shows one line: "Best: Y axis, 48% up, 6° tilt — 2% undercut".
- Extended from the existing `autoDetectPlane` path in `useMoldGenerator.ts` / `generateMold.ts`, running in the worker so the UI stays smooth.

### 3. Save / load projects (browser-only)
- Save named snapshots (model file + all settings) to IndexedDB; Projects list with Open/Delete; export/import a single `.sirpam.json` for backup or sharing.
- New `services/projectStorage.ts` copying the defensive localStorage pattern of `telemetrySettings.ts`; section near the top of ControlPanel.

### 4. Material & cost estimator
- After generation: per-piece and total part volume, material weight (PLA / resin toggle), rough print-time estimate from the printer preset, cost from an editable price per kg; for silicone workflows, the silicone volume (cm³) with price per liter.
- Real mesh volume via the divergence theorem on the generated pieces (siliconeMold already computes volumes this way for its estimate); new `utils/costEstimate.ts`, shown in a ControlPanel section — same inline-derive-then-render pattern the panel already uses.

## Tier 2 — new features borrowed from the best tools (build after Tier 1)

Found studying Meshcast, SpliceSTL, and Mold Studio:

1. **Seal type choice** — tongue-and-groove seal for liquids (wax/resin) vs. registration pins for rigid casts.
2. **Pry pockets** — small notches on the parting face so halves open with a screwdriver.
3. **Material presets** — pick what you're casting (silicone, resin, plaster, wax): auto-sets shrinkage compensation, sprue size, and release tolerance.
4. **Side-specific silicone thickness** — separate side / seam / floor / top thickness instead of one global margin.
5. **Gate advisor** — score pour points across the mold ceiling (least trapped air, fastest fill) and move the sprue automatically.
6. **Multi-cavity tray** — array N copies of the model in one mold for batch casting.
7. **Radial splits** — 3- or 4-piece molds for round/undercut parts, not just two halves.
8. **Auto-orient for printing** — rotate mold pieces to the best print-bed orientation with support hints.

## Where the work lands (technical)

- `src/moldmaker/mold/` — new `splitLine.ts`; auto-suggest extends `generateMold.ts`'s detect path via a new message type in `workerProtocol.ts`.
- `src/moldmaker/App.tsx` — new state (split-line toggle, suggestion result, project list, estimator settings) wired with the existing `(value) => setState(...)` callback idiom; new overlay mounted beside HeatmapOverlay in the scene group.
- `src/moldmaker/components/ControlPanel.tsx` — Projects section (top), Suggest button (Parting Plane section), estimator section (after Dimensions), styled with existing `theme.ts` neumorphic tokens only.
- `src/moldmaker/services/projectStorage.ts` + `src/moldmaker/utils/costEstimate.ts` — new pure modules; `printerPresets.ts` reused for print-time heuristics.
- No new npm dependencies. Mold-generation math, workers' CSG, and export formats stay untouched (project files and estimator are additive).

## Order of build

1. Split-line preview → 2. Auto-suggest → 3. Material & cost estimator → 4. Save/load projects. Tier 2 items follow one at a time, each verified in the browser with the sample model (rigid + silicone two-part) before the next.

## Out of scope (this round)

Cloud accounts, upstream mesh repair tools, CNC/composite outputs.
