# Page audit: what exists, what's partial, what's missing

## Already built (15 pages)
Home, Studio (mold tool), Pricing, Checkout (x3 packs), Shop, Gallery, Your credits (/account), Sign in, Terms, Refunds, Privacy, sitemap, 404 page, error page.

## Partially built (fix these)
1. **Checkout** - "Pay" is greyed out; buying is by email only. Stays this way until payments are turned on after the workspace move.
2. **Sign in** - no "Forgot password" / reset-password page, and no Google sign-in button.
3. **Your credits (/account)** - only credits + history. Missing: profile (name, email), change password, sign out, delete my account and data (Privacy page promises this).
4. **Gallery** - works, but has its own sign-out button and no public/shared view.
5. **Shop** - request form works, but you can't see your past requests or their status.

## Missing (build these)
1. **Reset password page** - where the email link lands to set a new password.
2. **Contact / Support page** - form + email (sirpam3dlabs@gmail.com); linked from footer, checkout and legal pages.
3. **About page** - who Sirpam 3D Labs is, the open-source origin credit (mold-maker by matta174, required by its licence).
4. **Help / Guides page** - how to make a mold step by step, print settings, casting tips, FAQ.
5. **My quote requests page** - list of projects sent to makers.
6. **Cookie notice / Licenses (open-source credits)** - small page listing libraries used.

## Nice to have later
- Changelog ("What's new"), status page, blog/tutorials for SEO, public shared-gallery links.

## Order
1. Reset password + Google sign-in
2. Account settings (profile, password, delete account)
3. Contact, About, Help, Licenses pages (shared header/footer, own titles for search)
4. My quote requests
5. Add all new pages to footer, top menu and sitemap

## Technical notes
- New routes: reset-password.tsx, contact.tsx, about.tsx, help.tsx, licenses.tsx, account.requests or requests.tsx; each with own head().
- Contact form saves to a new `contact_messages` table (insert-only for anyone, GRANT + RLS) and opens mailto as backup.
- Delete account: server function with auth check, removes user's rows + storage files, then deletes the user.
- Google provider configured in the same step.
