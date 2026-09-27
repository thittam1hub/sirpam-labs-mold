# Credits pricing for Sirpam 3D Labs Mold

## What you get
A pay-per-use credits system: a free plan with limits, then credit packs you buy once (no subscription). Credits are spent when you use paid features. Prices adjust by country (cheaper in India and similar markets), the way most global design tools do it.

## Research step (first)
Before prices are final, check what similar mold and 3D tools charge (Meshcast, MoldForge, Moldboxer, Meshmixer-style add-ons, Printables/Thangs paid plans) and how they price by region. The draft below is a starting point and gets adjusted to what the research finds.

## Free plan (sign-in required)
- Basic 2-part box molds, STL export only
- 3 mold exports per month
- Free exports carry a small engraved "Sirpam" watermark
- 10 welcome credits on sign-up to try paid features

## What costs credits (draft)
| Action | Credits |
|---|---|
| Extra STL export beyond free 3 / removing watermark | 1 |
| Pro mold features (curved split, clamps, 3/4-part, silicone, hollow core, trays, relief/press/slip-cast) - per export | 3 |
| STEP or 3MF export | 2 |
| Auto-repair or models over 150k triangles | 2 |
| AI model maker (per shape) | 3 |
| Mold report or print farm plan | 1 |

Previewing and designing stays free; credits are charged only when you export or run AI/repair.

## Credit packs (draft, USD base)
| Pack | Credits | Global price | India / lower-income regions |
|---|---|---|---|
| Starter | 20 | $5 | about Rs 199 |
| Maker | 60 | $12 | about Rs 499 |
| Studio | 200 | $30 | about Rs 1,299 |

Regional prices: 3 tiers (full price for US/EU/UK/AU; about 60% for Latin America, Eastern Europe; about 40% for India, SE Asia, Africa), set by the buyer's country at checkout. Credits never expire.

## Pages and screens
- New Pricing page (/pricing): free vs packs, credit cost table, FAQ, linked from landing page and top bar
- Credit balance in the top bar next to your account
- When a paid action is clicked: shows its cost, then "Use 3 credits" or "Buy credits"
- Account page: balance, purchase history, credit usage history

## Payments
Use Lovable's built-in payments. First I run the eligibility check and recommend one provider, then you confirm. A test mode is set up first so nothing real is charged; live payments need verification. Requires a Lovable Pro plan.

## Technical details
- Tables: `credit_balances` (user_id, balance), `credit_ledger` (user_id, delta, reason, ref, created_at), `monthly_usage` (user_id, month, free_exports). Owner-read RLS; writes only via server functions.
- Server fn `spendCredits(action)` with `requireSupabaseAuth`: checks cost table, deducts atomically (SQL function with row lock), returns new balance; client unlocks the export only on success.
- AI and repair endpoints check/deduct on the server; export gating happens before file download.
- Watermark reuses round-7 engraving (extras), applied only for free exports so paid output stays byte-identical.
- Payment webhook under /api/public/ verifies signature, then adds credits to the ledger.
- Regional prices as separate price entries per tier in the payment provider.

## Open item
Your country of business registration is needed for the payment provider check.
