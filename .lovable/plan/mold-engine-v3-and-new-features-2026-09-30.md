# Mold engine v3 and new features

## Skills
- Already active and used for this work: threejs-fundamentals, threejs-geometry, performance-pro.
- Install as step 0: **3d-print-modeling** (open source, found earlier). It adds mesh-quality and printability checks for the engine work.

## Already built (not repeated)
Rigid, silicone (3 styles) and hug molds, angled and curved splits, 3- and 4-part splits, locks, vents, auto sprue, multi-cavity, material presets and calculator, air-trap preview, demolding risk, leak check, pour planner, ribs, compatibility advisor, trim guide, clamp wings, feet, label.

## Phase A — Engine strength (users notice fewer failures and faster builds)
1. **Faster builds on big models**: split the work across two background threads and reuse cached results when only one setting changes. Target: rebuild after a slider change in under 2 s on the sample models.
2. **Auto draft angle**: offer to add 1–3° of draft to steep walls on the cavity side so casts release without tearing.
3. **Smart split surface**: a stepped or curved split that follows the model's widest outline instead of a flat cut. This reduces undercuts on figurines.
4. **Stronger repair step**: give a clear "fixed N holes / flipped N faces" summary before building, and block the build if the model will fail.

## Phase B — New mold types
5. **Core pins and inserts**: place a removable pin for through-holes, such as a bead hole or a candle wick channel.
6. **Runner system for multi-cavity**: one pour cup feeding every cavity through balanced channels.
7. **Printable pour funnel and clamp jig**: extra pieces that print alongside the mold.
8. **Candle and soap preset molds**: wick hole, flat base and easy-release walls, for popular Indian craft uses.

## Phase C — Related features
9. **Clamp-wing pressure lands**: flat seats so clamps press evenly. This is the one item left from the Reddit research.
10. **Casting cost per piece**: material plus print cost divided by the expected mold life, in rupees.
11. **Mold life estimate**: expected number of casts by material, such as silicone with resin or PLA with wax.
12. **Print settings card**: recommended layer height, walls and infill for each mold piece, plus a printable one-page sheet.

## Rules kept
- Every new engine option is optional. With it off, the output stays byte-identical, and the golden tests must pass.
- Any fallback shows a plain-language note.
- No new paid services. India-only printing and delivery.
- Nothing is published from this remix copy.

## Order and checks
A1 → A2 → A4 → C9 → C12 → B5 → B6 → A3 → B7 → B8 → C10 → C11. After each item: automated tests, then a browser build of the sample models in rigid and silicone.

## Technical details
- New engine code goes in `src/moldmaker/mold/v3Features.ts` as optional `extras`. Threading changes go in `moldWorker.ts` and `useMoldGenerator.ts`.
- Draft and core pins use Manifold boolean operations on the cavity only. The runner reuses the channel placement code.
- New tests: one test file per feature, plus golden case additions.
