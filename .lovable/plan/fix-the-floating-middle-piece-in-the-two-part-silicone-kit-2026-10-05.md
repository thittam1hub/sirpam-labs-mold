# Fix the "floating" middle piece in the Two-Part silicone kit

## Why it looks like it floats
The thin middle piece is the **parting board**. In real use it is not floating: it is sandwiched between the bottom frame and the top frame, with the model pressed half into it, while you pour the first half. The Studio is in **Exploded** view, which pulls every piece apart so you can see them.

The problem is how the pieces are pulled apart: they are spread by list position (1st up, 2nd down, 3rd further up, 4th further down...), not by where they really sit in the stack. So the board lands in the middle of the gap and cuts through the frames, and the base plate sticks to the wrong frame. That is the collision in the screenshot.

## What changes
1. **Exploded view follows the real stack.** Pieces are sorted by where they sit along the split direction (base plate, bottom frame, parting board, top frame, pour rods) and spaced apart evenly in that order, so nothing overlaps and the order reads like assembly.
2. **Parting board size matches the frames.** Check the board's outline against the frame's outer outline; if it sticks out past the walls (as it seems to in the screenshot), trim it to the frame outline so it sits flush between them.
3. **Plain piece names** on hover and in the export list: Base plate, Bottom frame, Parting board, Top frame, Pour rods (replaces working names like "frame_top").
4. **Short note under Exploded view** for silicone kits: "Pieces are spread apart to show them. Turn off Exploded to see them stacked as you pour."

## Check
Load the soap sample, Silicone, Two-Part Block, Generate: in Exploded view all five pieces are separated in stack order with no overlap; with Exploded off they sit stacked and touching. Other mold types (two-part rigid, skin + mother) keep looking the same or better.

## Technical details
- `studio/Scene.tsx` `getExplodeOffsetForPiece`: replace index-alternating offsets with an offset computed from each piece's bounding-box centre along `state.axis` relative to the overall centre (rank-based even spacing; ties fall back to current behaviour). Keeps 2-piece molds identical (+1 / -1).
- `mold/siliconeMold.ts` `partingBoard` call: clamp board to the frame's outer lateral box; no change to other kit geometry, golden tests stay byte-identical (shopKit off).
- Label map for display only (`parting_board` → "Parting board" etc.); export file names unchanged unless trivial.
- Add a test that the exploded offsets for the kit produce non-overlapping bounding boxes.
