# Industry-standard app shell, account area, deep links, performance, and security

## Goal
Create one consistent navigation and account experience across the public site and Studio, make useful UI state shareable through validated URLs, reduce loading delays and duplicate requests, and harden account/data operations.

## 1. Shared navigation and page layout
- Build one reusable, opaque site header for Home and all supporting pages, with consistent links to Studio, Shop, Gallery, Pricing, Help, and the signed-in account menu.
- Give the header stable reserved space while the session loads, preventing the late Sign in/Account layout shift seen today.
- Add a responsive mobile navigation menu with accessible labels, keyboard behavior, active-page states, and no overflowing text.
- Bring the Studio top bar into the same navigation system while preserving its compact tool controls and full-screen workspace.
- Standardize internal navigation on router links so transitions retain cached data and never force avoidable page reloads.
- Use one shared account menu and one safe sign-out flow that clears protected cached data before returning to sign-in/home.

## 2. Organized account page with proper tabs
Use three clear, URL-addressable tabs:
- **Profile** — photo, display name, email summary, save state, and image validation.
- **Credits & history** — balance, monthly allowance, buy-credits CTA, and paginated activity history.
- **Security** — change password, sign out, and a separated destructive account-deletion area with explicit confirmation.

The selected tab will be represented by `?tab=profile`, `?tab=credits`, or `?tab=security`, so links and browser Back/Forward restore the correct view. Invalid values safely fall back to Profile.

## 3. CTA and deep-link rules
- Every sign-in CTA will include a validated same-origin `redirect` query parameter that returns users to the exact page and safe UI state they came from.
- Preserve useful shareable state in URLs:
  - Account tab.
  - Gallery sort/view mode.
  - Studio step and selected tool/panel.
  - Any remaining public form selection where it improves return navigation.
- Keep model geometry, private file paths, secrets, and large project settings out of URLs.
- Use typed query-parameter validation, clean default parameters from URLs, and preserve relevant parameters during navigation.
- Make primary CTAs consistent: “Open Studio” for signed-out/public visitors and “Continue in Studio” or Account for signed-in users, depending on context.

## 4. Remove Quote requests completely
- Remove the quote-request history page and its links.
- Remove the Shop “Send my project” workflow; retain the researched maker directory and direct “Get a quote” links.
- Remove the quote request records, table, access rules, private project-file bucket, and associated stored files through a new database migration/cleanup.
- Remove quote-request cleanup logic from account deletion and update sitemap/navigation references.

## 5. Loading and performance
- Introduce one app-level session source instead of separate session listeners on Home, Studio, Gallery, Shop, and Account.
- Move authenticated page reads to TanStack Query with stable cache keys, explicit stale times, retries, error states, and mutation invalidation.
- Fetch independent account data in parallel rather than in a waterfall.
- Paginate credit history and Gallery entries; sign only images needed for the visible page instead of every stored image.
- Keep the heavy 3D Studio client-only and lazy-loaded; improve its loading screen and prefetch the Studio route on intentional navigation.
- Remove the current route code-splitting warning and verify no new large shared bundle is introduced.
- Add stable loading skeletons/placeholder dimensions so headers, tabs, avatars, and cards do not jump while data arrives.

## 6. Database and security hardening
- Preserve owner-only access for profiles, credits, Gallery rows, and private photos; explicitly project only required columns.
- Validate file type, extension, size, and owner-scoped storage path for profile and Gallery uploads; clean up failed or replaced uploads.
- Keep credit prices and charging authoritative in database functions; explicitly revoke unintended function execution and keep credit grants service-only.
- Review the three current security-function warnings: eliminate unnecessary callable access and document only the authenticated functions that intentionally remain callable.
- Make account deletion more reliable: centralize row cleanup, handle storage cleanup failures clearly, and prevent a partial deletion from appearing successful.
- Remove misleading current-password behavior if the auth provider cannot verify that field; use a verified reauthentication/reset flow instead.

## 7. Accessibility, quality, and verification
- Use semantic tabs with keyboard navigation, visible focus, correct selected states, descriptive status messages, and responsive tables.
- Ensure every page keeps unique metadata and private account pages remain excluded from indexing.
- Test desktop and mobile layouts, direct deep-link refreshes, Back/Forward behavior, signed-in and signed-out CTAs, and sign-in return paths.
- Test profile updates, avatar replacement/removal, credit history pagination, Gallery pagination/sorting, sign-out cache clearing, and account deletion failure handling.
- Run the database linter after migration and verify the final build, browser console, network requests, and route loading behavior.

## Technical notes
- Keep TanStack Router as the navigation source and validate query parameters before use.
- Keep protected reads client-triggered on these public routes; do not place authenticated server functions in public route loaders.
- Continue using row-level owner policies and private storage paths of `<user_id>/…`.
- Preserve the existing 3D mold engine and its byte-identical legacy behavior; this work changes shell/navigation/state handling, not mold generation.
