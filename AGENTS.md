<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Mold/3D app lives in src/moldmaker (browser-only); see src/moldmaker/AGENTS.md (why: keep engine rules near the code).
- Server/payments/credits rules: see src/lib/AGENTS.md.
- Public pages share SiteHeader + AppSessionProvider; /auth, /gallery, /shop are plain routes outside src/moldmaker (why: one auth listener, 3D app untouched).
- Account tabs, Gallery sorting, Studio step/tool state use validated URL queries (why: shareable views).
- Gallery: table gallery_items (owner-only RLS) + private bucket mold-photos, paths `<user_id>/…` (why: per-user privacy).
- Contact details come only from BUSINESS in src/lib/business.ts (why: one edit updates every page).
- Fonts self-hosted via @fontsource in styles.css (why: no third-party requests on load).
