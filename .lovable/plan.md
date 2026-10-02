# Industry-standard defaults for Doctor view and workshop sheet

## Goal
Make the two new tools safe and useful by default without presenting generic estimates as supplier-certified values.

## Changes
- Keep the visual Doctor as an inspection mode rather than permanently obscuring the model; show clear red undercut faces and amber air-pocket markers from the existing deterministic checks.
- Replace one-size-fits-all cure-time calculations with conservative, material-specific reference ranges and clear supplier-datasheet wording.
- Use 25 °C as the standard reference condition, retain an editable workshop-temperature control, and show heat as a caution rather than claiming an exact cure-time conversion.
- Keep weight calculations in grams, by-weight ratios, a 10% handling allowance, and practical print/pour checks; remove unsafe generic advice such as elevated pouring from height.
- Add focused tests for the reference profiles and temperature guidance, then verify the Studio flow and printable sheet in the preview.

## Technical details
- Extract pure workshop calculation/profile helpers so defaults can be tested independently.
- Do not alter mold geometry, generated files, credit use, or existing optional engine behavior.
- Keep the remix unpublished.
