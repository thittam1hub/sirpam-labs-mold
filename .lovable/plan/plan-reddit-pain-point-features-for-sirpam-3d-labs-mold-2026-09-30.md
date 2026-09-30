# Plan: Reddit pain-point features for Sirpam 3D Labs Mold

Sourced from real mold-maker complaints (r/ResinCasting, r/moldmaking, r/3Dprinting). Ordered by impact vs effort. Each feature ships with engine notices in plain language, per the project's no-silent-fallback rule.

## Phase 1 — Quick wins (ship first)

### 1. Material compatibility advisor
- New module `src/moldmaker/mold/materialCompat.ts`: rules table mapping print material (PLA/PETG/ABS/resin) × casting material × silicone type → OK / caution / blocked, with plain-language reasons (e.g. "sulfur in some resins inhibits platinum-cure silicone").
- Surface as a warning card in the Mold step (AdvancedMoldPanel) and in the Finish-step mold report.
- Unit tests for the rules table.

### 2. Seam / flash trim guide
- Extend the mold report (Finish step) with a "Where to expect flash" section: split-line perimeter length, overhang zones from existing draft analysis, and trimming advice per material.
- Reuse existing split-line + draft data; no new geometry work.

### 3. Structural ribs for large silicone molds
- Optional extra in `proFeatures.ts` style: when silicone mold wall span exceeds a threshold, add rib pockets to the mold box exterior (byte-identical-when-off rule).
- Engine notice when ribs are added or skipped.

## Phase 2 — Flagship

### 4. Air-trap preview
- New analysis in the worker: from the cavity mesh + pour/sprue position, simulate fill direction (upward flood-fill from sprue along the split plane) and flag closed pockets where air cannot escape past the vent radius.
- Render trapped-air zones in the 3D view as an overlay (same pattern as HeatmapOverlay), with a notice listing each zone and a suggested vent position.
- "Add vent here" one-click action that places a vent channel at the suggested point.
- Golden-test coverage: known-trap sample model must flag the trap; clean models must flag none.

### 5. Demolding risk score (undercut + draft)
- Combine existing draft analysis with undercut detection relative to the pull direction; score 0–100 with plain-language explanation and per-face highlight in the viewer.
- Suggest split-axis change when score is high.

## Phase 3 — Delighters

### 6. Leak check
- Validate parting-plane contact: detect gaps between mold halves (registration key clearance, warped split line) and warn before export.

### 7. Cure-time & pour planner
- Per material preset: pot life, demold time, and a printable pour card (grams per part already computed by the material calculator).

## Engineering standards for all phases
- All engine changes are optional `extras` fields; omitted extras reproduce legacy output byte-identically.
- Every fallback or skipped feature pushes a plain-language `notices` entry.
- `bunx tsgo --noEmit` clean; `bunx vitest run src/moldmaker` (33 existing + new tests) green.
- Playwright smoke test per phase: mushroom sample → Mold step → Finish step, no console errors.
- No new upstream-derived code; clean-room rule stands.

## Verification & rollout
- After each phase: typecheck, tests, browser check, then user review before starting the next phase.
- Pre-launch checklist (publish, DNS, Search Console, live Razorpay keys, DPDP details) remains separate and unchanged.
