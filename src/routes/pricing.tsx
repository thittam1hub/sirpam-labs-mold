import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CREDIT_COSTS, CREDIT_PACKS, guessRegion, getCreditPacks, getCreditStatus, type CreditPack, type CreditStatus, type RegionTier } from "@/lib/credits";
import { SiteHeader } from "@/components/SiteHeader";
import { Info } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Pricing — Sirpam 3D Labs Mold" },
      { name: "description", content: "10 welcome credits and 3 free credits every month. Credit packs with fair regional prices, valid for 24 months." },
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
  const [packs, setPacks] = useState<CreditPack[]>(CREDIT_PACKS.map((p) => ({ ...p, usd: { ...p.usd } })));
  useEffect(() => {
    getCreditStatus().then(setStatus).catch(() => {});
    getCreditPacks().then(setPacks).catch(() => {});
    const g = guessRegion();
    setTier(g.tier);
    setIndia(g.india);
  }, []);

  const price = (p: CreditPack) =>
    tier === "value" && india ? { label: `₹${p.inr.toLocaleString("en-IN")}`, per: `₹${(p.inr / p.credits).toFixed(1)}` }
      : { label: `$${p.usd[tier]}`, per: `$${(p.usd[tier] / p.credits).toFixed(2)}` };

  return (
    <div className="neu-page min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-6 pb-16">
        <h1 className="text-4xl font-bold">Simple, pay-as-you-go pricing</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Designing and previewing molds is always free. Sign up and get <b>10 welcome credits</b>, plus <b>3 free credits every month</b>.
          Buy a pack only when you need more — no subscription, and bought credits last 24 months. You're only charged when an action succeeds.
        </p>

        {status && (
          <div className="mt-6 inline-block rounded-2xl bg-card px-5 py-3 shadow-sm">
            You have <b className="text-primary">{status.balance} credits</b> plus <b>{status.monthlyFreeLeft}</b> free this month.{" "}
             <Link to="/account" search={{ tab: "credits" }} className="text-primary">See history</Link>
          </div>
        )}

        <div className="mt-8 inline-flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm text-muted-foreground">
          <Info aria-hidden size={16} />
          Local pricing has been applied automatically. Final currency and tax follow your billing country.
        </div>

        <section className="mt-6 grid gap-6 md:grid-cols-3">
          {packs.map((p) => {
            const pr = price(p);
            const best = "best" in p && p.best;
            return (
              <div key={p.id} className={`rounded-3xl bg-card p-6 shadow-sm ${best ? "ring-2 ring-primary" : ""}`}>
                <h2 className="text-xl font-semibold">{p.name} {best && <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">Best value</span>}</h2>
                <p className="mt-2 text-3xl font-bold">{pr.label}</p>
                <p className="mt-4 font-semibold">{p.credits} credits</p>
                <p className="text-sm text-muted-foreground">{pr.per} per credit · valid 24 months</p>
                <Link to="/checkout/$pack" params={{ pack: p.id }}
                  className={`mt-6 block rounded-2xl px-4 py-2.5 text-center font-semibold ${best ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  Buy {p.name}
                </Link>
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
          <p className="mt-4 text-xs text-muted-foreground">The displayed amount is a local estimate. Final currency and sales tax are worked out from your billing country at checkout.</p>
        </section>

        <p className="mt-8 text-sm text-muted-foreground">
          <Link to="/terms">Terms</Link> · <Link to="/refunds">Refund policy</Link> · <Link to="/privacy">Privacy</Link>
        </p>
      </main>
    </div>
  );
}
