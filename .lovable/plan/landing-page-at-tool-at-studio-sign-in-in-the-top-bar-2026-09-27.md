# Landing page at /, tool at /studio, sign-in in the top bar

## Current state (verified)

- `/` opens the 3D mold maker tool directly (`src/routes/index.tsx` lazy-loads `src/moldmaker/App.tsx`). There is no marketing landing page.
- Sign-in exists at `/auth` (email/password + Google) but nothing in the mold maker's top bar links to it. It is only reachable from the Gallery's "Sign in" prompt and the Shop's send-request form.
- The sitemap is driven by each route's `staticData: { sitemap: true }` flag, so new public pages just need that flag.

## Changes

### 1. Move the tool to `/studio`

- Create `src/routes/studio.tsx`: the current contents of `src/routes/index.tsx` (ClientOnly + lazy `MoldMakerApp`), with its own `head()` (title/description/og) and `staticData: { sitemap: true }`.
- Keep localStorage keys (`sirpam.step`, etc.) untouched — they are origin-wide, so users keep their step and projects.

### 2. New landing page at `/` (rich layout, existing Sirpam theme)

Rewrite `src/routes/index.tsx` as an SSR-friendly marketing page using the neumorphic theme (`neu-page` wrapper, `bg-card`/`bg-primary`/Space Grotesk headings — same look as Shop/Gallery). No WebGL, so it renders on the server. Sections:

- **Top nav** — logo + "Sirpam 3D Labs Mold", links: Mold Maker (→ `/studio`), Shop, Gallery, Sign in / account.
- **Hero** — tagline ("Turn any 3D model into a print-ready mold — right in your browser"), sub-line, primary CTA "Open the mold maker" → `/studio`, secondary CTA "Try the sample" → `/studio`.
- **Feature grid** — 6 cards: parting-plane suggestion & split preview, auto sprues/vents/pins, curved splits & multi-part molds, auto-repair of broken STLs, material & cost estimator, print-farm planner.
- **How it works** — 4 steps: upload STL/OBJ → pick the split → generate the mold → export printable STL.
- **Showcase strip** — a hero image of a printed two-part mold (generated once with the image tool, bundled from `src/assets`, imported so the URL is same-origin; used as the landing og:image too).
- **FAQ** — 4–5 items: is it free, does my model leave my computer (no — all in-browser), which printers/materials, what file types, how do I get it printed (Shop link).
- **Footer** — links to `/studio`, `/shop`, `/gallery`, `/auth`.

Own `head()` with unique title/description/og (og:image = the showcase image), `twitter:card`, `staticData: { sitemap: true }`.

### 3. Sign-in in the mold maker top bar (session-aware)

- `TopBar.tsx`: read the session via `supabase.auth.getSession()` + `onAuthStateChange` (same pattern the Gallery uses).
  - Signed out: a "Sign in" pill linking to `/auth` (also added to the mobile ☰ menu).
  - Signed in: show the account email (trimmed) with a small menu offering "Gallery" and "Sign out"; sign out clears the query cache and navigates home, per sign-out hygiene.
- `TopBar.tsx` is rendered inside `ClientOnly`, so using the browser Supabase client there is safe.

### 4. Point existing links at the right places

- `src/lib/error-page.ts` "Go home", `auth.tsx` / `shop.tsx` / `gallery.tsx` brand links: keep pointing at `/` (the landing page is now the right home).
- `auth.tsx` "← Back to mold maker" → back to `/` (landing).
- `__root.tsx` brand link stays `/`.

### 5. Sitemap

- `/`, `/studio`, `/shop` carry `sitemap: true`; `/auth`, `/gallery` stay excluded. The sitemap route picks these up automatically — no list to edit.

## Verification

- `npx tsgo --noEmit` clean.
- Playwright against localhost:8080: landing page renders all sections with no console errors; `/studio` still loads the 3D tool; top bar shows "Sign in" signed out (and account + Sign out after restoring a minted session); sitemap.xml lists `/`, `/studio`, `/shop`.

## Not changing

- All mold-maker internals, worker pipeline, theme tokens, Shop/Gallery/auth functionality.
