# Fix the two weak spots found in the engine audit

## What you will notice
1. **Hug-the-model molds on detailed models** come out with an even wall all round. Today, on detailed models (over 20,000 triangles), the app just stretches the model. That leaves thin walls on long or skinny parts and thick walls on round ones.
2. **Tongue-and-groove warning.** If you choose tongue-and-groove but it can't be used (angled split, curved split, hug-the-model mold, or the edge fails to build), you get a clear message and the mold report records what was used instead. Today it quietly switches to plain pins.

## Fix 1 — Even walls on detailed models
Pick the method based on model size. Stop as soon as one gives a clean, valid solid:

```text
<= 20k triangles  -> exact offset (current method, unchanged)
>  20k triangles  -> distance-field offset: sample the model's distance on a grid, rebuild the
                     surface at distance t (the method repair already uses)
                     grid cell = max(t/3, longest side/256), capped so it fits in memory
if that fails      -> simplified copy (about 15k triangles) -> exact offset
last resort        -> today's stretch method, plus a warning
```

- The cavity keeps the full detail. It is still cut with the original model plus clearance. Only the outer wall uses the lighter method, so detail in the cast is never lost.
- Every result goes through the same watertight check the mold build already uses before it is accepted.
- The progress screen shows "Building form-fit shell (n%)" so long waits have a visible reason.

## Fix 2 — Tell the user when a feature falls back
- The mold build returns a list of `notices`: short messages like "Tongue & groove needs a flat, straight split, so keyed pins were used."
- Other features that turn off quietly report the same way: volume label, watermark and mold feet on hug-the-model molds, plus the Fix 1 last-resort stretch.
- Where notices appear: a message after the build, a line in the bottom status strip ("2 notes"), and a "Build notes" section in the mold report.
- Before you build, the Mold step shows a short note under Seal type when your current settings will force the fallback.

## Guarantees
- Molds built without these options stay exactly the same as today, byte for byte. Small models still use the exact method.
- No new downloads or libraries. The work stays inside the existing background worker.
- Prices and credits don't change.

## Verification
- Automated tests:
  - A dense test model (sphere with more than 50k triangles) gives a form-fit wall within ±15% of the chosen thickness.
  - A small model's output is unchanged.
  - Each fallback case produces the expected notice.
  - Existing mold tests still pass.
- Browser check on the sample model: build with form-fit and tongue-and-groove on an angled split, confirm the message, status strip and report entry, in light and dark mode.
- Timing check on a detailed model, before and after.

## Technical details
- `src/moldmaker/mold/moldOffset.ts`: `offsetOutward(wasm, m, t, bbox, onProgress?)` gets the size-based chain. The distance-field step uses `Manifold.levelSet` with a signed distance built from the mesh (reuse the winding sampler from `meshFix.ts`). The simplified-copy step reuses the detail reducer. The function returns `{ solid, method }`.
- `generateMold.ts`: collect `notices: string[]` at the tongue-and-groove gate (line 361, one message per reason: `cutAngle`, `curved`, `formFit`, `applyTongueGroove` returned null) and at the round-7 gates for `formFit`. Return it alongside `repairs`/`labels`.
- `workerProtocol.ts` + `useMoldGenerator.ts`: pass `notices` and form-fit progress messages through (optional field, so older result shapes still load).
- `App.tsx`: store `notices` in state. Show a sonner toast, pass a count to `StatusBar`, and pass them to the report builder.
- Mold step Seal control: a pure `predictSealFallback(state)` helper for the pre-build hint.
- `AGENTS.md`: add a rule that engine fallbacks must emit a notice and never switch silently.
