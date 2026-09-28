# Industry-standard fixes from the full app audit

Three separate checks covered the public pages, the Studio, and security. Overall the app is in good shape: every page has proper titles and share previews, the colors follow the light and dark themes, there are no emoji, no broken links, and the sign-in redirect is safe. They found one serious problem plus a set of smaller ones. These are the fixes.

## 1. Must fix (security and money)
- **The AI model maker can be used without paying.** Anyone can call it directly, even without signing in, and use up your AI budget. Fix: require sign-in and take the credits on the server itself, so the Studio button is no longer the only check.
- **Mold report can leave credits "in progress".** If the report fails partway through, the reserved credits aren't returned right away (they come back automatically after 30 minutes). Fix: return them straight away on any failure, the same way the other paid tools already do.
- **Referral farming.** Right now the referral reward can be triggered with a free monthly export. Fix: only reward when the friend completes an action paid with their own credits, not a monthly-free one. Also block reuse of a referral link from an email that previously deleted its account.

## 2. Reliability
- **Account deletion:** do all the cleanup in one safe database step, so a failure can't leave you with a half-deleted account.
- **Pricing, Checkout, Account, Gallery, Admin:** load data the standard cached way, with proper loading and error messages instead of failing silently. This also fixes Gallery updates that can show out of order.
- **Checkout:** add a branded error screen.

## 3. Accessibility
- Add proper labels to the Contact form fields and the Gallery add-mold form (right now some only have faint grey hint text).
- Add column headings to the tables on Pricing and Admin.
- Checkout: turn the "request by email" link into a real button that is shown as disabled until you tick the terms box.
- Replace the browser's plain pop-ups with styled confirmation dialogs (Gallery delete, Admin refund reason).
- Studio: make the toggle switches follow the light and dark themes.

## 4. SEO housekeeping
- Add a robots.txt file that points search engines to your sitemap and keeps them out of Account, Admin, Checkout and Reset password.
- Make the "don't show in search results" setting the same on all private pages.
- Remove a duplicate error message the site logs whenever an error screen appears.

## Technical details
- `src/lib/shapeAi.functions.ts`: add `requireSupabaseAuth`; inside the handler, `context.supabase.rpc('hold_credits', {_action:'ai_shape'})`, then capture on success and release on failure. The client stops calling `reserveFor` for this tool and only shows a confirmation prompt.
- `ModelFixPanels.tsx` MoldReportPanel.open: wrap the work in try/catch and call `charge.fail()` in the catch.
- Migration:
  - `_reward_referral` runs only when the captured hold has `from_free < cost`.
  - New `delete_my_account_data()` security definer function that deletes all user rows in one transaction; the server function calls it, then `auth.admin.deleteUser`.
  - Store a hash of the email of deleted referred accounts to block reuse.
- Convert useEffect fetching to `useQuery` with query keys, invalidated through the credits event and mutations.
- Add `errorComponent` to `checkout.$pack`, a `robots[.]txt` server route, and a shared noindex constant; remove the `console.error` in the root error component.
- Studio toggle thumb uses a surface CSS variable instead of `#fff`.
