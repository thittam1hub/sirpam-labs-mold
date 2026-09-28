# Industry-standard credit system for Sirpam 3D Labs Mold

## Where we are today
- Credits are the only way to pay. There is no subscription and no free plan.
- New accounts get 10 welcome credits. Everyone also gets 3 free credits a month, and those are used before paid credits.
- Current costs: STL/OBJ export 1, 3MF/STEP export 2, Pro features 3, AI model maker 3, auto repair 2, mold report 1.
- Credit packs: Starter, Maker and Studio. Prices change by region, and India pays in INR. You see one price and no region labels.
- Molds on free credits get a watermark.
- The Account page already shows your credit balance and history. You get a confirmation prompt before any paid action.
- Checkout pages exist, but the buy buttons are switched off until the workspace move.

## Gaps compared with industry standard
1. No real payment. The buy buttons can't charge anyone yet.
2. Credits never expire and have no rules for what happens after a refund or chargeback.
3. No receipts or invoices, and no GST details for Indian buyers.
4. If an action fails (for example, mold generation crashes), you are not refunded automatically.
5. No promo codes, referral credits or admin-granted credits.
6. No warning when your balance is low, and no summary of what you used.
7. No admin view for support: looking up a user, adjusting credits, handling refunds.
8. Some actions only check credits in the browser. The server has to check credits on every paid action.

## The plan

### Phase 1: Make the system reliable (no payments needed, build now)
- **Charge on success.** Credits are held when an action starts. They are taken only if it succeeds and returned automatically if it fails. History shows "held", "charged" and "refunded".
- **Server checks.** Every paid action (export, AI, repair, report, Pro) is approved on the server before the result is delivered.
- **Credit types, in the order they're used:** monthly free, then promo/bonus (these expire), then purchased (these last 24 months). History shows which kind paid for each action.
- **Clear expiry rules.** Monthly free credits reset on the 1st. Welcome credits last 90 days. Purchased credits last 24 months, which is a common policy. The Terms and Refund pages are updated to match.
- **Price list in one place.** The costs are shown on the Pricing page, in the Help pages and in the confirmation prompts, all from the same list.

### Phase 2: Account experience
- A low-balance banner (2 credits or fewer) in the Studio and on the Account page, with a "Buy credits" link.
- Credits & history tab: filters by type and month, CSV download, and a note on when credits expire.
- A usage summary: credits used this month and on which features.
- Promo codes: enter a code at checkout or on the Account page. Codes can be used once, have limits and an end date.
- Referral: you and a friend each get 5 credits after their first purchase. This is optional and can be turned off.

### Phase 3: Payments (after the workspace move)
- **Razorpay** for India: UPI, cards, netbanking, in INR. It can be connected now without blocking the move.
- **Paddle** for international buyers, switched on after the move. Paddle is the legal seller, so it handles taxes.
- Both go to one secure receiving point on our server. Credits are added only after the payment is verified, and never twice for the same payment.
- Refund or chargeback: the unused credits from that purchase are removed. If some were already spent, your balance can go below zero and new paid actions are blocked until it's topped up.
- A receipt email and a downloadable invoice for each purchase. Indian invoices can include GST details once you register.

### Phase 4: Admin and support
- An admin-only page (protected by admin access stored in the database): look up a user, see their history, grant or remove credits with a written reason, issue refunds, create promo codes.
- A basic revenue and usage dashboard: packs sold, credits used by feature, active buyers.

### Phase 5: Security and checks
- Balances can only be changed by server functions. Every change is recorded in the history log, and log entries can't be edited.
- Duplicate-proof references on every grant, charge and refund.
- Automated tests: charge on success, refund on failure, order credits are used in, expiry, promo limits, duplicate payment notices.

## Technical details
- Database: add `kind` (monthly/welcome/promo/referral/purchase), `expires_at` and `status` (held/charged/refunded/reversed) to the credit history. Add a `credit_holds` table, `promo_codes` + `promo_redemptions`, `purchases` (provider, provider_id unique, amount, currency, status) and `user_roles` + `has_role` for admin.
- Replace `spend_credits` with `hold_credits(action)`, `capture_hold(id)` and `release_hold(id)`. The balance becomes the sum of unexpired entries from the history. A daily expiry job runs through a public cron route that checks a secret.
- Payment notices: `/api/public/webhooks/razorpay` and `/api/public/webhooks/paddle`, with signature checks. They call `grant_credits` with the provider payment id as the duplicate-proof reference.
- Legacy behaviour is kept: existing balances move over as purchased credits.

## Your decisions before build
1. Expiry: purchased credits last 24 months, welcome credits 90 days. OK?
2. Referral program: include it or skip it?
3. Start Phase 3 with Razorpay now, or wait until after the move?
