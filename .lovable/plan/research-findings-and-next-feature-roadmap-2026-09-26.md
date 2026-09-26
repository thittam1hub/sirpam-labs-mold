# Research findings and next feature roadmap

Two research teams looked online: one for problems mold makers report today, one for feature ideas from other areas of 3D modeling and printing. Most common complaints (bad meshes, undercuts, bubbles, alignment) are already covered by the app. The gaps and the best new ideas are below, grouped into phases.

## Phase A — Fix real problems users report (not covered today)
1. **Shrink and fit compensation** — choose printer type + cast material; the app scales the mold and adjusts clearances so halves and cores fit (jewelry metal shrink % included).
2. **Leak-proof print guide** — for rigid molds, adds a checklist on the Finish step: suggested wall count, 100% infill near the cavity, and sealing coats (epoxy/XTC). Warns when walls are too thin to seal.
3. **Surface finish advisor** — flags steep, stair-stepped areas that will show layer lines, suggests a better print orientation, and adds sanding/primer tips.
4. **Mold life estimate** — rough number of pulls a silicone or printed mold should survive, based on material, thickness and undercut severity.
5. **Wall thickness heatmap** — color view showing thin spots on the mold and on hollow casts.

## Phase B — New features for other areas
6. **Logo/text emboss + repeat tray** (chocolate, soap, candles) — type text or load an SVG, raise or sink it onto the model, repeat across a tray.
7. **Food/wax/soap preset mode** — one click sets pour-friendly vents, wall thickness and food-safe silicone notes.
8. **Wax tree builder** (jewelry lost-wax) — arranges several small parts on a central sprue at the right angles.
9. **Big-prop splitter** (cosplay) — cuts large models into printer-bed-sized pieces with alignment keys.
10. **Dental/medical model base** — trim plane plus flat or hollow base for scanned models.

## Phase C — Larger, later
11. **Fill preview** — simple animation of how material flows in, highlighting likely air traps and weld lines (estimate, not full simulation).
12. **Print-farm plate packer** — pack molds from several jobs onto one plate with cost split per job.
13. **Text/photo to mold** — describe or upload a photo, AI makes the shape, then it runs through the mold steps. Needs Lovable Cloud + AI; done last.

## Suggested order
Phase A (1-5) first, then 6, 7, 9, 8, 10, then Phase C if you want it.

## Technical details
- All Phase A/B features are browser-only, no new dependencies, and follow the existing optional `extras` pattern so existing molds stay byte-identical.
- New controls go into existing steps: shrink/fit and presets in Mold, emboss/splitter/wax tree/dental in Pro, leak guide/finish advisor/mold life in Finish, thickness heatmap as a new view chip.
- Emboss uses the built-in three.js SVG/font loaders plus Manifold booleans; the splitter extends the radial split code; thickness uses ray casting in the worker.
- Settings persist through project save/load with safe fallbacks for older saves.
- Each phase is verified in the browser (rigid + silicone), including the silicone and project reopen checks that are still open from the layout change.
- Phase C item 13 needs Lovable Cloud and the AI gateway; it is not started without your go-ahead.
