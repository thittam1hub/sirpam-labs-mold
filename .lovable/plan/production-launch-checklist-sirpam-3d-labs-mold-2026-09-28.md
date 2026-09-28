# Production launch checklist — Sirpam 3D Labs Mold

Status key: DONE = built and checked, OPEN = still needed, BLOCKED = waits on you.

## 1. Must-have before launch (blocking)

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Payments (Razorpay for India, Paddle international) | BLOCKED | Waits on workspace move. Backend purchase recording already built. |
| 2 | Webhook: verify payment signature, then grant credits once | OPEN | Build together with #1. |
| 3 | Inviter bonus on friend's first purchase | OPEN | Needs #1. |
| 4 | Lawyer review of Terms, Privacy, Refund | BLOCKED | Your action. India: DPDP Act 2023 + consumer e-commerce rules. |
| 5 | Grievance officer name + contact on Privacy page (India requirement) | BLOCKED | Needs a named person from you. |
| 6 | Own domain + domain email (replace gmail) | BLOCKED | Your purchase. Improves trust and email delivery. |
| 7 | Branded sign-up / reset emails from your domain | OPEN | After #6. |
| 8 | Real print test of locks, pads, vents, flange bolts | BLOCKED | Needs a physical print by you. |
| 9 | End-to-end test: real AI generation + "Make a mold from this" | OPEN | I can run it. |
| 10 | Security review of the 20 database warnings, document each | OPEN | I can walk through and close or justify each. |
| 11 | Remove leftover test data and the TESTONCE promo; confirm only your account is admin | OPEN | |

## 2. Quality and reliability (strongly recommended)

| # | Item | Status |
|---|---|---|
| 12 | Error tracking for crashes in the Studio and server (logs you can read) | OPEN |
| 13 | Friendly error pages on every route (not blank screens) | OPEN — audit |
| 14 | Dark mode check on Studio layout and AI page | OPEN |
| 15 | Mobile fix: settings panel covering screen during guided tour | OPEN |
| 16 | Automated tests for credit functions (hold, capture, release, refund, referral) | OPEN |
| 17 | Browser support check (Chrome, Safari, Firefox; WebAssembly fallback message) | OPEN |
| 18 | Large-file limits: clear message for STL above size/triangle limit | OPEN — audit |
| 19 | Rate limit on AI generation and contact form | OPEN |
| 20 | Database backups / point-in-time restore confirmed | OPEN — check |

## 3. Growth and discoverability

| # | Item | Status |
|---|---|---|
| 21 | Publish the site, connect Search Console | OPEN |
| 22 | Guide pages for how-to searches ("how to make silicone molds", etc.) | OPEN |
| 23 | Social share images (og:image) for home and pricing | OPEN |
| 24 | Privacy-friendly analytics (cookie-free, so no consent banner) | OPEN |
| 25 | Performance pass: page speed score 90+ on home page | OPEN — measure |

## 4. Already done (for reference)

Credit system (expiring lots, charge-on-success, promo, referral, refunds, receipts, admin), sign-in/sign-up with age 13+ gate, account tabs, legal pages, SEO basics, robots/sitemap, dark mode, emoji-free UI, honest privacy wording, hug/silicone mold features, build notices.

## Proposed order

```text
Now (no blockers):  9, 10, 11, 13, 14, 15, 16, 17, 18, 19, 20, 23, 24, 25
Before publish:     21, 22, 12
After workspace move: 1, 2, 3, then 6, 7
Your actions:       4, 5, 6, 8
```

On approval I will start with the "Now" group and report which items pass.
