import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CREDIT_COSTS, CREDIT_PACKS, REGION_TIERS, guessRegion, getCreditStatus, type CreditStatus, type RegionTier } from "@/lib/credits";

export const Route = createFileRoute("/pricing")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Pricing — Sirpam 3D Labs Mold" },
      { name: "description", content: "10 welcome credits and 3 free credits every month. Credit packs with fair regional prices that never expire." },
      { property: "og:title", content: "Pricing — Sirpam 3D Labs Mold" },
      { property: "og:description", content: "Design molds free. Pay per export with credit packs priced for your region." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  const [status, setStatus] = useState<CreditStatus | null>(null);
  const [tier, setTier] = useState<RegionTier>("standard");
  const [india, setIndia] = useState(false);
  useEffect(() => {
    getCreditStatus().then(setStatus).catch(() => {});
    const g = guessRegion();
    setTier(g.tier);
    setIndia(g.india);
  }, []);

  const price = (p: (typeof CREDIT_PACKS)[number]) =>
    tier === "value" && india ? { label: `₹${p.inr.toLocaleString("en-IN")}`, per: `₹${(p.inr / p.credits).toFixed(1)}` }
      : { label: `$${p.usd[tier]}`, per: `$${(p.usd[tier] / p.credits).toFixed(2)}` };

  return (
    <div className="neu-page min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-5 text-sm">
        <Link to="/" className="font-semibold">Sirpam 3D Labs Mold</Link>
        <div className="flex-1" />
        <Link to="/studio">Mold Maker</Link>
        <Link to="/shop">Shop</Link>
        {status && <Link to="/account">Your credits</Link>}
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-16">
        <h1 className="text-4xl font-bold">Simple, pay-as-you-go pricing</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Designing and previewing molds is always free. Sign up and get <b>10 welcome credits</b>, plus <b>3 free credits every month</b>.
          Buy a pack only when you need more — no subscription, and bought credits never expire.
        </p>

        {status && (
          <div className="mt-6 inline-block rounded-2xl bg-card px-5 py-3 shadow-sm">
            You have <b className="text-primary">{status.balance} credits</b> plus <b>{status.monthlyFreeLeft}</b> free this month.{" "}
            <Link to="/account" className="text-primary">See history</Link>
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Prices for:</span>
          {REGION_TIERS.map((r) => (
            <button key={r.id} onClick={() => setTier(r.id)} title={r.examples}
              className={`rounded-full px-4 py-1.5 font-semibold ${tier === r.id ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              {r.name}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{REGION_TIERS.find((r) => r.id === tier)!.examples}. Your region is picked automatically; the final price is set by your billing country at checkout.</p>

        <section className="mt-6 grid gap-6 md:grid-cols-3">
          {CREDIT_PACKS.map((p) => {
            const pr = price(p);
            const best = "best" in p && p.best;
            return (
              <div key={p.id} className={`rounded-3xl bg-card p-6 shadow-sm ${best ? "ring-2 ring-primary" : ""}`}>
                <h2 className="text-xl font-semibold">{p.name} {best && <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">Best value</span>}</h2>
                <p className="mt-2 text-3xl font-bold">{pr.label}</p>
                <p className="mt-4 font-semibold">{p.credits} credits</p>
                <p className="text-sm text-muted-foreground">{pr.per} per credit · never expire</p>
                <button disabled className="mt-6 w-full cursor-not-allowed rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground opacity-60">
                  Checkout coming soon
                </button>
              </div>
            );
          })}
        </section>

        <section className="mt-12 rounded-3xl bg-card p-6 shadow-sm">
          <h2 className="text-2xl font-semibold">What uses credits</h2>
          <table className="mt-4 w-full text-sm">
            <tbody>
              {CREDIT_COSTS.map((c) => (
                <tr key={c.action} className="border-t border-border">
                  <td className="py-2">{c.action}</td>
                  <td className="py-2 text-right font-semibold">{c.cost} credit{c.cost === "1" ? "" : "s"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-xs text-muted-foreground">Prices shown in USD; local prices and sales tax are worked out at checkout.</p>
        </section>

        <p className="mt-8 text-sm text-muted-foreground">
          <Link to="/terms">Terms</Link> · <Link to="/refunds">Refund policy</Link> · <Link to="/privacy">Privacy</Link>
        </p>
      </main>
    </div>
  );
}
