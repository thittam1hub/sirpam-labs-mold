# Hold the model in place in the Skin + Mother mold

## Problem
In Skin + Mother mold the model (core) sits inside the jacket with nothing holding it. Poured silicone can't get under it, so the skin ends up with a hole or thin spot at the bottom.

## Step 1 — Skill
Try again to activate the existing silicone-moldmaking skill and add the core-holding rules to it. If this workspace still blocks it, keep going and tell you who needs to approve it.

## Step 2 — What gets built
1. **Stand-off feet**: 3 small printed cones on the bottom jacket half that the model rests on, lifting it by the skin thickness so silicone flows underneath. They leave tiny pin holes in the skin, sealed with a dab of silicone after.
2. **Hanging pin on top**: a short peg from the top jacket half that touches the model's highest point so it can't float up or tip while pouring.
3. **Flat base option**: if the model has a flat bottom, use it as an open "foot" instead — the jacket grips the edge, and the bottom stays open as the casting fill hole.
4. New Pro setting "Hold model in place": Auto (default) / Feet + pin / Flat base / Off.
5. Plain notice on the Finish step saying how the model is held and to seal the pin holes.

## Step 3 — Also finish from last time
- Plain piece names everywhere: Base plate, Bottom frame, Parting board, Top frame, Pour rods, Mother mold top/bottom, Model.
- Short note under Exploded view: "Pieces are spread apart to show them. Turn off Exploded to see them stacked as you pour."
- Workshop sheet pour order for skin molds.

## Check
Soap sample, Silicone, Skin + Mother mold, Generate: feet and pin visible, gap under the model equals skin thickness; tests pass; other molds unchanged.

## Technical details
- `siliconeMold.ts` skin branch: new `extras.coreSupport` ('auto'|'feet'|'flatBase'|'off'); feet = cones unioned to mother_bottom inside skinOuter, tip touching model's min along axis; top pin from `cavityHighPoints`. Off/omitted = byte-identical (golden test).
- Add `coreSupport` to MoldExtras; Studio passes 'auto'; notice via `notices`.
- Label map for display only; new test in `siliconeKit.test.ts`.
- Update SILICONE_SPEC.md and skill draft.
