# Hug (form-fit) and silicone molds: locks and tuning to industry standard

## How the industry does it (summary of shop practice)

- **Rigid hug molds (printed two-part):** the shell follows the part at an even wall (2–4 mm FDM, 1.5–3 mm resin). A **flat flange** (8–15 mm wide) around the parting line carries the locks: cone or round keys 4–6 mm across, 3–6 of them, 0.15–0.3 mm fit gap, plus bolt/clamp holes through the flange. The flange also gives a flat surface to seal and clamp.
- **Silicone block molds:** the silicone carries its own **keys** (hemispherical "natural keys", 6–10 mm, cast from dimples in the first-pour side). The printed containment box only needs alignment for re-assembly. A pour sprue at the highest point, vents at every local high spot, not at box corners.
- **Skin (glove) molds with a mother mold:** a 3–6 mm silicone skin with a **registration rim / ridges** that lock into the mother mold. The mother mold **hugs the skin** (not a box) at 3–5 mm, split with a flange and bolt holes. The core is printed with a clay-style parting wall for the first half.

## What's in the app now and the gaps

1. **Silicone two-part with form fit: locks float.** The silicone path still places pins at the box corners (the same bug just fixed for rigid). Fix: reuse the new wall-slice lock placer and lock pads.
2. **No parting flange on hug molds.** Locks squeeze into a thin wall or into pads. Add an optional flange (width setting, default 10 mm) around the split, with locks and optional bolt holes in it. This is the standard fix and replaces most pad cases.
3. **Silicone keys are missing.** Two-part block molds should get keys in the silicone itself: small dimples on the parting face so the first pour forms bumps. Printed as removable parting-board keys (a flat plate with bumps), since we print tooling, not silicone.
4. **Skin mold mother mold is a box.** Offer "hug mother mold" (skin offset + wall), with a flange and locks, plus a registration rim ridge on the skin so it can't slip.
5. **Vents on form-fit use box corners.** Place vents at real high points of the cavity (local maxima along the pour direction), capped at the vent count setting.
6. **Sprue on form-fit** should enter at the cavity's highest point, not the box centre.
7. **Defaults review:** a lock-size preset per printer type (FDM/resin), fit gap 0.2 mm FDM / 0.1 mm resin, minimum hug wall 2.4 mm FDM with a warning below it.

Each change is an optional setting, off or unchanged by default, so existing molds build exactly as before. Every fallback shows a build note.

## Order of work

1. Silicone form-fit lock fix (bug, small).
2. Parting flange for rigid and silicone hug molds, with locks and bolt holes.
3. High-point vents and sprue for hug molds.
4. Hug mother mold + skin registration rim.
5. Silicone parting-board keys.
6. Printer-type defaults and thin-wall warning.
7. Checks: engine tests for each piece, then Studio check with the sample model (rigid, silicone two-part, skin) and screenshots of locks attached to the right halves.

## Technical details

- Silicone: `siliconeMold.ts` `splitAndKey` → call `fitFormFitLocks` + radius retry/pad logic from `generateMold.ts` (extract into a shared helper in `formFitLocks.ts`).
- Flange: slab = slice-ring of outer shell offset outward by flange width, extruded ±flangeThickness/2 at the split, unioned before splitting; locks placed with `fitFormFitLocks` on the flange ring; bolt holes as through-cylinders. New `extras.flangeMm`, `extras.flangeBolts`.
- High-point vents: sample master vertices, grid-bucket laterally, keep local maxima along primary axis; new `extras.smartVents`.
- Hug mother mold: `offsetOutwardEx(inflated, wall)` − inflated; rim = thin ring at split added to the inflated skin volume.
- Parting-board keys: new printable piece `parting_board` in silicone two-part output.
- All new features live as optional extras; notices pushed per AGENTS.md rule.
