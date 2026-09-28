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
- Tier-2 mold features live in src/moldmaker/mold/moldFeatures.ts as optional `extras` passed through the worker; omitted extras must reproduce legacy output (why: keep existing molds byte-identical).
- Dev-only JSX source tags are stripped from src/moldmaker .tsx files via a vite plugin (why: React Three Fiber crashes on dashed data-tsd-source props).
- Layout uses TopBar + step-filtered ControlPanel; public pages share SiteHeader and AppSessionProvider (why: consistent navigation and one auth listener).
- Model-prep tools (emboss, split, wax tree, base, shrink) live in src/moldmaker/mold/modelTools.ts + utils/shopAdvice.ts, run on the main thread, and replace the master via App `replaceModel` with one-level undo (why: they change the model, not the mold, so the worker pipeline stays untouched).
- AI model maker calls Lovable AI from src/lib/shapeAi.functions.ts (server fn, raw streamed HTTP, no new deps); the AI returns a JSON shape spec (lathe/extrude/compound) built client-side with Manifold in modelTools.buildFromSpec (why: no 3D-generation model is available, and the spec is always a clean solid).
- Gallery uses Lovable Cloud: table gallery_items (owner-only RLS) + private bucket mold-photos with paths `<user_id>/…`; /auth page, /gallery, /shop are plain routes outside src/moldmaker (why: keep the 3D app browser-only and untouched).
- Model fix tools (repair, detail reducer, scale/rotate) live in src/moldmaker/mold/meshFix.ts; badly broken meshes fall back to a 3-axis winding-vote grid rebuilt with Manifold levelSet, accepted only if it passes the same validate+Manifold check the mold pipeline runs (why: guarantees 'clean solid' means the mold will build).
- Round-6 rigid features (curved split, clamp wings, auto vents, stand-fins, relief/press/slip-cast styles) live in src/moldmaker/mold/proFeatures.ts as optional extras fields (why: same byte-identical-when-off rule as Tier 2).
- Round-7 features (engraved volume label/watermark via built-in 5x7 pixel font, mold feet, gap filler, 3/4-part split, overhang check) live in src/moldmaker/mold/round7.ts as optional extras (why: same byte-identical-when-off rule; pixel font avoids loading fonts in the worker).
- Account tabs, Gallery sorting, and Studio step/tool state use validated URL queries (why: working views remain safely shareable).

- Credits: balances are expiring lots (credit_lots) spent via hold_credits -> capture_hold/release_hold (security definer, auth.uid()-scoped; stale holds auto-release after 30 min); only grant_credits (service_role, idempotent by reference) adds purchased credits; admin RPCs check has_role (why: charge-on-success, browser can't change prices or mint credits).
- Studio layout: left WorkflowRail (steps), centre 3D view, right ControlPanel inspector (collapsible), bottom StatusBar; AI Model Maker is its own route /studio/ai (studio_.ai.tsx, non-nested) handing models to the Studio via sessionStorage spec in src/lib/aiHandoff.ts (why: CAD/slicer convention — task left, settings right; AI gets full-page room).
- Mold-engine fallbacks (seal, skipped features, offset method) must push a plain-language entry to generateMold's `notices`, never switch silently (why: users must know what they're printing).

- Hug (form-fit) shells, rigid and silicone, plan locks via planHugLocks in src/moldmaker/mold/formFitLocks.ts (real-wall slice → smaller locks → pads, each with a notice); optional extras.flangeMm adds a flat parting flange the locks land in (why: box-corner positions float on hug shells; flange is the shop-standard lock carrier).- Email sign-up goes through src/lib/signup.functions.ts (server-side 13+ check, stamps user_metadata.age_confirmed_at); AppSessionProvider shows a one-time age gate for any session without it; fonts are self-hosted via @fontsource imports in styles.css (why: COPPA age gate and no third-party requests on page load).
- Payments: Paddle (non-India, USD standard price, webhook src/routes/api/public/payments/webhook.ts) and Razorpay (India, INR from credit_packs, signature-verified in src/lib/payments.functions.ts) both credit only via service-role record_purchase; provider refunds call reverse_purchase (why: one idempotent credit path, browser can't set prices).
- Razorpay: preview hosts use RAZORPAY_TEST_* keys (live keys refused), published uses live; webhook src/routes/api/public/payments/razorpay.ts (order.paid, refund.processed) credits idempotently alongside the in-page verify (why: preview never charges real money; closed tabs still get credits).
