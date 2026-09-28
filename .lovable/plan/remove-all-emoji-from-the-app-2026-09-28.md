# Remove all emoji from the app

## Changes
- Replace the homepage feature emoji with matching Lucide icons while preserving the current layout and meaning.
- Replace Gallery star characters with accessible icon-based rating controls and displays.
- Replace Studio check, warning, and mobile-menu glyphs with proper Lucide icons or plain text.
- Remove emoji-like characters from comments and user-facing helper text so the codebase follows the same no-emoji rule consistently.

## Verification
- Scan all application and public text files for emoji and emoji variation selectors after the changes.
- Check the homepage, Gallery, and Studio at desktop and mobile sizes to confirm icons render correctly without overlap.
- Confirm the preview build and browser console remain error-free.

## Technical details
- Reuse the installed `lucide-react` icon library; do not add dependencies.
- Preserve existing accessible labels and add hidden labels where icon-only controls need them.
- Keep ordinary typography and technical symbols such as multiplication signs and units unless they are emoji-rendering pictographs.
