# Credit system: production-readiness audit and fixes

## Verdict after reviewing the full system

The credit **engine** (how credits are held, spent, expired, and tracked) is genuinely industry standard — it matches how AI credit apps (Midjourney, Replicate) and print services work: reserve-first charging, charge only on success, expiry batches, full audit ledger, promo codes, admin adjustments. That part is production-ready.

The credit **storefront** (buying) is not production-ready: there is no real payment, no purchase record, no receipt, and no refund path. Below is what is solid, and what must be fixed before real money is involved.

## Already industry standard (no work needed)

- **Usage:** reserve → charge-on-success / auto-refund-on-failure, stale reservations auto-release after 30 min. Prices live only in the database — the browser cannot change them.
- **Expiry:** credits exist in batches with their own expiry dates; spending order is monthly free → promo/welcome → purchased (soonest expiry first). Expired credits are swept automatically and shown in history.
- **Transparency:** balance, free-credits-left, next expiry date, per-feature monthly usage, filterable history, CSV download, low-balance warnings in Account and Studio.
- **Safety:** every balance change goes through database functions scoped to the signed-in user; purchases can only be added by a server-side key with duplicate-protection; admin actions require an admin role and a written reason.

## Gaps to fix (this plan)

### 1. Purchase records (needed before any payment)
- New `purchases` table: who bought which pack, how many credits, price paid, currency, region, payment provider, payment ID, status (paid / refunded / failed).
- Buying a pack writes a purchase row **and** grants credits in one safe step — the existing duplicate-protection key ties them together so a retried payment can never grant twice.
- Account → Credits & history gains a "Purchases" section: pack, date, price, status, receipt.

### 2. Receipts and refund path
- Each purchase gets a receipt page/email-style summary (pack, credits, price, date, payment ID) — industry standard for any paid credit system.
- Admin page gains a **Refund purchase** action: marks the purchase refunded and removes the remaining credits from that purchase batch (never touching other batches), with the reason written into the user's history. This is the safe, auditable version of a chargeback reversal.

### 3. Expiry warnings
- Account page shows a clear warning when credits expire within 14 days ("12 credits expire on 5 Oct").
- The low-balance and expiry warnings also appear as a small banner in the Studio top bar.

### 4. Abuse and rate-limit hardening
- Promo redemption gets a per-user attempt limit (e.g. 10 failed tries per hour) to stop code-guessing.
- Welcome credits are granted once per account ever (already true) — add a note in Terms that multi-account promo abuse voids the credits.
- Region detection (used for showing local prices) stays display-only; the actual charged price is fixed server-side at checkout time so it cannot be spoofed.

### 5. Price/policy single source of truth
- Pack definitions (credits, prices) move into a database table readable by everyone, editable only by admin — so Pricing, Checkout, Help, and prompts always show the same numbers, and price changes never need a code edit.
- Terms/Refund pages already describe expiry; update them to mention receipts and the refund-of-unused-credits rule.

### 6. Payments stay out of scope (as agreed)
- Razorpay/Paddle wiring remains off until after the workspace move. This plan makes everything **payment-ready**: when you enable a provider later, it only needs to call the existing grant function with the purchase reference.

## Technical notes

- One migration: `purchases` table (with GRANTs + owner-only RLS + admin read), `credit_packs` table (public read, admin write), promo attempt limiting inside `redeem_promo`, `refund_purchase` admin function (security definer, has_role-gated).
- Client: new Purchases section in `CreditsTab.tsx`, refund button in `admin.tsx`, expiry banner in Studio `TopBar`, pack prices loaded from the database with the current hardcoded list as fallback.
- No emoji anywhere; dark/light theme aware; build + live test with the test account before finishing.
