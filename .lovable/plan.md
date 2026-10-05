# Realistic silicone mold builds (shop-floor standard)

## Problem
Today's silicone outputs are geometric boxes around the model. Real mold makers build them differently: the master needs a mounting stand and pour channel, the box comes apart for demolding, two-part molds are poured in two stages with a clay/parting board, and skin molds need registration and a mother mold that actually holds the skin. Our printed pieces skip several of these, so they don't work on a bench.

## Step 1 — Research (agents, before any code)
- Open-source projects: CadQuery/OpenSCAD mold generators, Blender mold add-ons, Meshmixer-style workflows, matching GitHub repos (licence checked; ideas only, no copied code unless MIT/Apache).
- Supplier guides: Smooth-On (box mold, two-piece, brush-on/mother mold), Formlabs and Prusa silicone mold guides, Indian suppliers' TDS.
- Collect concrete numbers: silicone wall 10–15 mm, key size, sprue/vent sizes, box draft, mold-release gaps, pour stages, demold aids.
- Search for and install a mold-making / casting Claude Code skill if one exists; otherwise write a project skill "silicone-moldmaking" holding the gathered rules so future work follows them.
- Output: a short spec in `src/moldmaker/mold/SILICONE_SPEC.md` you can read.

## Step 2 — Rebuild each workflow to the spec

**Open pour box (one part)**
- Separate printed pieces: base plate with a raised plinth/stand the master glues onto, and 4 snap-or-screw walls (no one-piece box you can't get the silicone out of).
- Built-in pour sprue rod and vent rods printed on the plinth so the channels form in the silicone.
- Optional cut guide for the "zig-zag" knife release line.

**Two-part block mold**
- Stage 1 kit: parting board (flat plate cut to the model outline at the split, with key bumps) + box half.
- Stage 2: second box half; keys and a pour sprue + vents on the stage-2 side.
- Split walls bolt/clamp together; mold-release gap on the parting board.
- Printed silicone pour channel as a cone/funnel, not just a hole.

**Skin + mother mold**
- Skin gap with registration ridges/keys on the outside of the skin.
- Two-part mother mold that hugs the skin, with flange, bolt holes and a pour/fill opening.
- Optional printable core (spacer) for pour-in-place skins.

## Step 3 — Studio and guidance
- Silicone settings show only what each workflow needs; each piece gets a plain name ("Base plate", "Wall A", "Parting board", "Mother mold half 1").
- Workshop sheet gets a step-by-step pour order per workflow.
- Silicone amount calculated from the real cavity.

## Step 4 — Checks
- Engine tests per workflow: pieces watertight, assemble without overlap, silicone cavity matches the model + wall.
- Golden test cases updated; rigid molds unchanged.
- Browser check with the sample model for all three workflows, with screenshots.

## Technical details
- Changes in `siliconeMold.ts` (split into `siliconeOpenBox.ts`, `siliconeTwoPart.ts`, `siliconeSkin.ts`), reusing `formFitLocks.ts` (`partingBoard`, `skinRim`, flange) and `moldBox.ts`.
- New options under `SiliconeMoldOptions` with defaults from the spec; old saved projects still open.
- Rule added to `src/moldmaker/AGENTS.md`: silicone tooling follows SILICONE_SPEC.md.
