# Hold the model on a real stand in Skin + Mother mold

## Problem
In Skin + Mother mold, the model is held by small cone feet and a top pin that stick out from the outer shell into the silicone gap. On small models like the vase, these take up about half the space. They don't look like workshop practice, and the model still looks like it floats.

## How workshops do it
The model is fixed to one solid stand on the base board, usually under its flat bottom or its casting opening. The silicone skin is poured around it, and the outer shell closes over it. The spot where the stand touches the model later becomes the fill hole for casting. Nothing else pokes into the silicone gap.

## What changes
1. **One stand post, no feet and no top pin.** A single sturdy printed post rises from the floor of the bottom shell and holds the model by its bottom (or by its lowest point if it has no flat bottom).
   - Flat bottom: a low plinth the shape of the bottom, with a 1–2 mm collar that grips its edge. The bottom stays open as the casting fill hole.
   - No flat bottom: a round post, about a third of the model's width (6–20 mm), with a shallow cup the model sits in. Where the post was becomes the pour hole for casting.
2. **Sized to the model.** The stand never takes more than a small part of the silicone gap. On very small models it is scaled down, and a notice suggests using a thicker skin.
3. **Nothing on the top half.** The pour hole and vents stay as they are, and no pin reaches down from the top.
4. **Preview:** in Exploded view the model stays on its stand with the bottom shell, so it no longer looks like it floats.
5. **Settings:** "Hold model in place" becomes Auto / Flat base / Stand post / Off. The plain notice and the workshop sheet steps are updated: glue the model to the stand, close the shell, pour.

## Check
Vase and soap samples in Skin + Mother mold: one stand under the model, no cones in the gap, model attached to the bottom shell in Exploded view. All mold tests pass, and the other mold types stay unchanged.

## Technical details
- `siliconeMold.ts`: replace `buildCoreSupports` (feet and pin) with `buildCoreStand`. Post = cylinder from the mother floor to the master's lowest point, radius clamp(0.17 × lateral size, 3, 10) mm, capped at 40% of the skin-gap footprint. Cup = post minus the master. The existing `flatBaseSeat` gets a collar ring (footprint offset +1.5 mm minus footprint, height min(2, skin)) and no longer drills through the floor; the opening is formed by the plinth.
- `coreSupport` values become 'auto' | 'flatBase' | 'post' | 'off'; 'feet' is mapped to 'post' for old saved projects.
- `Scene.tsx` stacked explode: a piece labelled `core` uses the offset of `mother_bottom`.
- Update the tests in `siliconeKit.test.ts` (one stand, total support volume below 15% of the skin volume), `SILICONE_SPEC.md`, `WorkshopSheet` skin steps and the AdvancedMoldPanel options.
