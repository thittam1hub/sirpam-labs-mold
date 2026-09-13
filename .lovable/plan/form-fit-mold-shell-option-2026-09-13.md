# Form-Fit Mold Shell Option

## What you'll get

A new **"Form fit shell"** toggle in the Mold Box section. When on, the outer
mold wall follows the shape of your model (like a glove at a fixed distance)
instead of being a plain box, cylinder, or rounded box. This saves a lot of
print material on organic, curvy models.

- Available in both **Rigid** and **Silicone** modes.
- The wall thickness slider controls how far the shell sits from the model.
- Everything else keeps working: split plane, registration pins, pour sprue,
  vents, and the parting-plane angle.
- The Mold Box Shape picker (box / cylinder / rounded) is hidden while form
  fit is on, since the shell shape now comes from the model itself.

## How it works (technical)

- Reuse the existing `offsetOutward` helper (Minkowski-sum offset with a
  fallback for heavy meshes) from `siliconeMold.ts` — move it to a shared
  module (`mold/moldOffset.ts`).
- New `shellFromModel(wasm, master, offsetDistance)` builds the outer solid
  as `offset(master, cavity + wall)` minus the inner cavity:
  - Rigid mode: cavity = master + clearance; shell = offset(master, clearance + wall) − offset(master, clearance).
  - Silicone block modes: cavity = offset(master, silicone margin); shell = offset(cavity, wall) − cavity.
  - Skin mold: unchanged (its mother mold already hugs the inflated model — the toggle is hidden there).
- Splitting, keying, sprue and vents reuse the existing `splitAndKey` /
  `addPourSystem` logic; the envelope AABB becomes the bbox of the offset
  solid so plane/pin placement math is unchanged.
- Performance: form-fit CSG is heavier than box CSG, so show a one-line note
  ("form fit takes longer on complex models") under the toggle.

## UI changes

- `ControlPanel.tsx`: add the toggle under Mold Box, disable/hide the shape
  picker when active; wire a new `onFormFitChange` prop.
- `App.tsx`: add `formFit: boolean` to state, pass through `handleGenerate`
  params snapshot into the worker payload (both `generate` and `silicone`
  request types).
- `workerProtocol.ts`: add optional `formFit?: boolean` to the payload.

## Verification

- Build stays green.
- Browser check: load sample model, turn on form fit (rigid), Generate →
  two halves hugging the mushroom shape; repeat for silicone two-part block.
- Exported files keep their existing names.
