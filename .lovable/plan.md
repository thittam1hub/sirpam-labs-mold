# Overall app improvement checklist — Sirpam 3D Labs Mold

A full-app review of what exists today, grouped by area, with status for each item.
DONE = built and verified. OPEN = improvement opportunity, ready to build.
BLOCKED = waits on you (money, a decision, or an outside service).

## 1. Product and UX

| # | Item | Status |
|---|---|---|
| 1 | Browser-only mold maker: STL/OBJ/3MF/STEP in, two-part mold STL/OBJ/3MF/STEP out | DONE |
| 2 | Pro features: curved split, clamp wings, vents, flange, 3/4-part, overhang check | DONE |
| 3 | Hug/form-fit and silicone molds, printer presets, thin-wall warning | DONE |
| 4 | AI model maker from a text description | DONE |
| 5 | Auto-repair for broken meshes, with a guaranteed clean-solid fallback | DONE |
| 6 | Guided onboarding for first-time makers (short, skippable hints on each step) | OPEN |
| 7 | Template gallery: a few ready-made sample models to try in one click | OPEN |
| 8 | Save/restore work-in-progress projects to the cloud (drafts, not just gallery) | OPEN |
| 9 | Batch export: ZIP with both halves, report and print settings in one download | OPEN — check current state |
| 10 | Refactor the two largest files (Studio app ~95 KB, control panel ~73 KB) into smaller modules so future changes stay safe | OPEN |

## 2. Accounts, credits and payments

| # | Item | Status |
|---|---|---|
| 11 | Credit system: expiring lots, charge-on-success, refunds on failure, promo, referral | DONE |
| 12 | Razorpay (India, INR) and Paddle (international) checkout with verified crediting | DONE — code live |
| 13 | Go live with payments: Razorpay live keys + verification in the Payments tab | BLOCKED — your action |
| 14 | Inviter bonus already wired; verify it fires on the first real purchase | BLOCKED — needs #13 |
| 15 | Receipt emails from your own domain (needs domain email) | BLOCKED — needs domain |

## 3. Reliability and testing

| # | Item | Status |
|---|---|---|
| 16 | Credit engine tests (holds, expiry, limits) | DONE — 10 passing |
| 17 | Mold engine tests (offset, hug shells) | DONE |
| 18 | UI/flow tests for sign-up, quote request, gallery add/delete | OPEN |
| 19 | Friendly error and missing-page screens site-wide | DONE |
| 20 | Large-file limits with clear messages (200 MB, 2M triangles) | DONE |
| 21 | Rate limits on AI maker and contact form | DONE |
| 22 | Crash/error tracking in production | OPEN — enable after publish |

## 4. Performance

| # | Item | Status |
|---|---|---|
| 23 | Heavy 3D Studio lazy-loaded, worker-based mold generation | DONE |
| 24 | Homepage hero compressed to WebP | DONE |
| 25 | Page-speed pass on home page (target 90+) | OPEN — measure on the live site |
| 26 | Standard cached data loading with loading/error states on all data pages | DONE (audit fixes) |

## 5. SEO and growth

| # | Item | Status |
|---|---|---|
| 27 | Unique titles/descriptions, robots.txt, sitemap, Search Console tag | DONE |
| 28 | Guide pages (silicone molds, STL-to-mold, 3D-printed molds) | DONE |
| 29 | Social share images (og:image) for home and pricing | OPEN — needs the published URL |
| 30 | Publish + connect Search Console | OPEN |
| 31 | Privacy-friendly visitor stats (built-in hosting) | DONE |
| 32 | Link from sirpam3dlabs.in main site to the mold app | OPEN — your action |

## 6. Analytics

| # | Item | Status |
|---|---|---|
| 33 | Google Analytics 4 with page-view tracking across SPA navigation | DONE — verified |
| 34 | Microsoft Clarity session recordings, form inputs masked | DONE — live |
| 35 | Custom events (mold generated, export clicked, quote requested, WhatsApp clicked) | OPEN |
| 36 | Privacy page wording: mention analytics tools | OPEN — small edit |

## 7. India compliance and workshop operations

| # | Item | Status |
|---|---|---|
| 37 | India-only printing, WhatsApp-first contact (+91 9789391798) everywhere | DONE |
| 38 | Print queue into your Google Sheet, status tracking | DONE |
| 39 | Grievance officer on the Privacy page | BLOCKED — needs a name from you |
| 40 | Lawyer review of Terms, Privacy, Refund | BLOCKED — your action |
| 41 | GSTIN on invoices for business buyers | OPEN — after payments go live |
| 42 | Sheet notification rules (email ping on new order) | OPEN — one-minute setup in Google Sheets |

## 8. Physical and launch

| # | Item | Status |
|---|---|---|
| 43 | Real print test of locks, pads, vents, flange bolts | BLOCKED — your action |
| 44 | Custom domain mold.sirpam3dlabs.in + DNS | BLOCKED — your action |
| 45 | End-to-end signed-in test: sign in, generate a mold, send one quote request | OPEN — needs you signed in in the preview |
| 46 | Publish the site | OPEN |

## Proposed order

```text
Now (no blockers):    6, 7, 8, 10, 18, 22, 29*, 35, 36, 42
Your actions:         13, 15, 32, 39, 40, 43, 44
After publish:        22, 25, 29, 30, 46
After payments live:  14, 41
```

(*item 29 can be built now and pointed at the live URL at publish.)

On approval I will start with the "Now" group and report item by item which ones pass.
