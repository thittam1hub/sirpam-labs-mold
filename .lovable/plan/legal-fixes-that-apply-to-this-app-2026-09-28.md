# Legal fixes that apply to this app

Only the items that fit Sirpam 3D Labs Mold are kept. The rest of the checklist doesn't apply, for the reasons below.

## Skipped (not relevant to this app)

- **Session replay / analytics:** the app has no replay, heatmap or keystroke tools. The Studio's usage stats are already opt-in, off by default, and can be turned off again.
- **Marketing email rules:** the app sends no marketing email, only sign-in and password emails.
- **Auto-renewal rules:** there are no subscriptions. Credit packs are one-time purchases, and payments are still off.
- **DMCA agent and takedown page:** Gallery photos and profile pictures are private to their owner, and nothing users upload is shown publicly. Worth adding only if you later make content public.
- **Cookie banner:** there are no tracking cookies. The browser only stores the sign-in session, the theme choice, and the usage-stats choice.

## What will be fixed

1. **Age check (13+)**
   - Sign-up form: a required "I am 13 or older" checkbox, plus links to Terms and Privacy.
   - Email sign-up is checked on the server, so an account can't be created without the confirmation.
   - Google sign-in: on the first visit, a one-time "Confirm you are 13 or older" screen appears before the app can be used. Choosing "under 13" deletes the account right away.
   - Contact form: the same checkbox, also checked by the database.
2. **Fonts from Google:** the two fonts are bundled with the app instead of loaded from Google, so visitors' addresses are no longer sent to Google.
3. **Privacy page:** a list of every outside service the app actually sends data to (Lovable Cloud for database, sign-in and storage; Google for Google sign-in; Lovable AI for AI Model Maker prompts and photos; the usage-stats service only if you opt in). It also covers what's stored in the browser and the 13+ rule.
4. **Hidden keys and personal data check:** scan the app code that runs in visitors' browsers for private keys, and remove any logging of emails or personal details.

At the end you get a short Found / Changed / Still to do note per item.

## What you still have to do

Nothing is required now. Get a lawyer to review Terms and Privacy before payments go live.

## Technical details

- Migration: `profiles.age_confirmed_at timestamptz`; `contact_messages.age_confirmed boolean not null default false` + check (age_confirmed).
- `src/lib/signup.functions.ts`: zod server fn (`ageConfirmed: z.literal(true)`) that performs `auth.signUp` with a publishable server client; the auth page calls it instead of `signUp` directly.
- Age gate in `AppSessionProvider` for signed-in users without `age_confirmed_at`; the under-13 path uses the existing account-deletion flow.
- Fonts: `@fontsource/space-grotesk` + `@fontsource-variable/dm-sans` imported in the root route; remove the Google preconnect and stylesheet links.
- Scan the built client bundle for `service_role`, `sk_`, and secret env names; check `console.log` calls in `src/lib` and `src/routes`.
