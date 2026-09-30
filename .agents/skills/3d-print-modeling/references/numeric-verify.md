# Numeric verify, material, form (extracted 2026-08-24)

Distilled from external CAD agent skills. **Do not adopt their stacks.**
3dvp / this skill stay Python + trimesh/manifold (BREP only for new standalone
parts). Viewer, fitmap, DESIGN-RULES, vitaminspec, and bambu-3mf-export win.

Sources (read, not installed):
- evnchn-agentic/agentic-3d-modeling — verify-by-number, material, photo scale
- earthtojake/text-to-cad — STEP-first for *new BREP* parts, DfAM measure, step.parts
- pzfreo/build123d-mcp — incremental measure loop (we already have shoot + fitmap)
- iancanderson/openscad-agent, swh/openscad-skill — OpenSCAD. **Not for 3dvp.**

3dvp axis: user "height" / "up" = **+Y**, not +Z. text-to-cad assumes +Z. Do not copy that.

## Skip

- Their `~/.venvs/cad`, `gen_step()`, CAD Explorer, OpenSCAD versioning, BOSL2 as the 3dvp engine.
- build123d-mcp as a Hermes MCP unless the user asks. The platform already closes the loop.
- Replacing vitaminspec with step.parts. Catalog first; step.parts only after a miss.

## Keep (cite these)

### Fabrication form (before you extrude)

A 3D solid is not the default. If the load is in-plane (bracket, link, gusset), a
flat plate + DXF may be the part. Loaded pivots want **double shear + bushing**,
not a single-shear washer lap. Reserve full 3D for enclosures, organic shells,
true 3D mates.

### Self-confirming verification (highest-value steal)

A check that uses the **input parameter** as the expected value is not a test.
Probe the **as-built** solid: bbox of the mesh, `signed_distance`, section
edge-to-edge, volume after the boolean. Same trap one level up: placing each
part *by the hole you are checking* cannot fail. Place by an independent datum,
then assert mating-hole coaxiality.

Assert **volume drop after every boolean cut**. Catches inverted extrudes and
missed differences.

### Material realizability (geometry can be true and still unprintable)

- Self-tap into FDM is **not** the metal tap-drill Ø. Pilot nearer pitch/major;
  print a pilot ladder. Tap-drill ≈ minor is for a steel tap to *cut*.
- Press-fit: ~0.05–0.10 mm/side, not ~1 mm.
- Snap/living hinge: derate molded strain numbers hard for FDM; PLA is brittle.
- Do not load interlayer (Z) in tension (already R1.5; keep it in the verify pass).

### Warp is a CAD problem

Large **contiguous** first-layer slabs warp. Gate on contact_area / bbox ≳ 0.6
and span ≳ 150 mm. Skeletonize (rail + ribs + pads), fillet corners, mouse-ears
in the model. Rounding corners does not fix a solid slab.

### Photo reverse-engineer

Credit card = 85.60 × 53.98 mm scale. Known hole patterns give a homography.
Photos do **not** give connector heights; look those up. Carry a SAFE
height-tolerant variant next to a tight one.

### Bought-part STEP (after vitaminspec)

If vitaminspec has no envelope and the part is a named catalog item (servo,
bearing, SHCS), search `https://api.step.parts` (`/v1/parts?q=...`) before
inventing a cube. Download STEP only when you will actually import it
(foreign-cad-import). Record a miss; then use a documented envelope.

### DfAM measure, do not eyeball walls

When asking "is this printable", measure wall / overhang / orientation on the
**exported mesh**, not the screenshot. 3dvp already has `wallcheck.py` and
headless slice (R7.8). Use those. Do not invent a second DfAM report format.
