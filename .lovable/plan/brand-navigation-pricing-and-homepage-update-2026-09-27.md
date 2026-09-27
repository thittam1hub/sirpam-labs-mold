# Brand, navigation, pricing, and homepage update

## Changes
- Use the existing Sirpam 3D Labs logo consistently in the homepage header/footer and pricing/checkout headers, while preserving the studio logo and branded favicon.
- Give the homepage navigation an opaque surface, stable spacing, and mobile-safe behavior so content never shows through it.
- Replace the homepage image with a newly generated photorealistic two-part 3D-printed mold scene showing realistic print texture, registration features, and a cast part.
- Remove customer-facing labels such as “Standard”, “Emerging markets”, and “Value markets”. Show the automatically selected local price without socioeconomic market categories, with a discreet country/region selector only where needed.
- Update pricing and checkout wording so regional pricing is explained as billing-country localization, a common checkout practice, rather than displaying internal market tiers.

## Verification
- Check the homepage, pricing, and checkout pages at desktop and mobile widths.
- Confirm the logo, solid navigation, new image, regional price presentation, and page metadata render correctly.
- Confirm the preview build has no errors.

## Technical details
- Keep the existing regional price mapping internally so pack amounts do not change; only replace public tier terminology and controls.
- Store the generated homepage image as a project asset and keep the current semantic theme tokens.
