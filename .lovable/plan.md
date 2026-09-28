# Legal exposure audit and fixes

## What the checklist found in this app

| # | Item | Found in the app | Action |
|---|------|------------------|--------|
| 1 | Age gate (COPPA) | Email sign-up and Google sign-in on the sign-in page; Contact form collects name + email. No age check anywhere. | Add "I am 13 or older", checked on the server |
| 2 | Remote fonts | Space Grotesk + DM Sans loaded from Google Fonts on every page (visitor IP goes to Google) | Self-host both fonts |
| 3 | Analytics / replay | No session replay, heatmaps or keystroke tools. Only the Studio's own usage stats: already opt-in, off by default, stored and revocable, no personal data | Add a "turn off" link in Account and in the Privacy page; no other change |
| 4 | Marketing email | The app sends no marketing email. Only sign-in and password emails (exempt). | Mark as transactional-only in code; no sends added |
| 5 | Auto-renewal | No subscriptions: credit packs are one-time and payments are still off | Add a "one-time purchase, no auto-renewal" line next to every buy button; revisit when payments go live |
| 6 | Uploads (DMCA) | Gallery photos and profile pictures, both private to the owner. AI-made models are downloaded, not published. | Add a Copyright page with takedown steps, notice email and repeat-infringer rule; link it in the footer and in the Gallery |
| + | Privacy / Terms | Pages exist and are in the footer, but not linked from sign-up. The list of services we send data to is not complete. | Link both from sign-up; list every service from the code |
| + | Cookies / consent | No tracking cookies. Only sign-in session, theme and usage-stats choice stored in the browser. | Explain this in the Privacy page; no banner needed |
| + | Secrets / data in browser code | Must be checked by scanning the built app | Scan and fix anything found |

## Changes

1. **Age gate**
   - Sign-up form: required "I am 13 or older" checkbox, plus links to Terms and Privacy.
   - Email sign-up goes through a server check that refuses the request before an account is created if the box isn't confirmed. Nothing is stored from a refused attempt.
   - Google sign-in can't be checked beforehand, so on first sign-in a one-time "Confirm you are 13 or older" screen blocks the app (no credits, no data) until confirmed. Choosing "I am under 13" deletes the account at once.
   - The confirmation is saved on the profile with a date.
   - Contact form: the same checkbox, also enforced by the database, so a message can't be saved without it.
2. **Fonts:** install the two fonts as packages, bundle them with the app, remove the Google links.
3. **Usage stats:** keep as is. Add a switch in Account → Profile to turn them on or off, and name the stats service in Privacy.
4. **Email:** a code comment on the auth email setup saying these are transactional only and must not carry marketing.
5. **Purchases:** a "One-time purchase. Credits do not renew automatically." line under the buy buttons on Pricing and Checkout.
6. **Copyright page** (`/copyright`): how to send a notice (to sirpam3dlabs@gmail.com), what to include, counter-notice, and how repeat infringers are handled. A footer link, and a "Report copyright issue" link in the Gallery.
7. **Privacy page:** a list of services taken from the code: Lovable Cloud (database, sign-in, storage), Google (Google sign-in), Lovable AI (AI model maker prompts and photos), and the usage-stats service (only if you opt in). Also what's stored in the browser, and the age rule.
8. **Secrets scan:** build the app, search the files sent to the browser for private keys and service passwords, remove any debug logging of emails or other personal data.

## What you will still have to do

- **Register a DMCA agent** at copyright.gov/dmca-directory ($6). You need a postal address; a home address works but becomes public, so a PO box is common. Then send me the agent name and address, and I'll put them on the Copyright page. Note this is a US process. As an Indian business it's optional, but it gives you safe-harbour protection for US visitors.
- **Postal address:** only needed if you ever send marketing email (not planned).
- **Auto-renewal rules:** only apply if you later add subscriptions. We'd add the renewal terms, a cancel button and reminder emails then.
- A lawyer review of Terms/Privacy before taking payments is recommended; I'm not a lawyer.

## Technical details

- Migration: `profiles.age_confirmed_at timestamptz`; `contact_messages.age_confirmed boolean not null` + check (true).
- `src/lib/signup.functions.ts`: zod-validated server fn (`ageConfirmed: z.literal(true)`) calling `auth.signUp` with a publishable server client; the auth page stops calling `signUp` directly.
- Age screen in `AppSessionProvider`: gate for signed-in users whose profile has no `age_confirmed_at`; the under-13 path calls the existing account-deletion flow.
- Fonts: `@fontsource/space-grotesk` + `@fontsource-variable/dm-sans` imported in `__root.tsx`; remove preconnect/stylesheet links.
- Final report: a Found / Changed / You still need to block for each item, plus a summary table with files.
