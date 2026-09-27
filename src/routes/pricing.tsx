import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CREDIT_COSTS, CREDIT_PACKS, getCreditStatus, type CreditStatus } from "@/lib/credits";

export const Route = createFileRoute("/pricing")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Pricing — Sirpam 3D Labs Mold" },
      { name: "description", content: "Free plan with 3 STL exports a month and 10 welcome credits. Pay only for what you export — credit packs that never expire." },
      { property: "og:title", content: "Pricing — Sirpam 3D Labs Mold" },
      { property: "og:description", content: "Design molds free. Pay per export with credit packs that never expire." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  const [status, setStatus] = useState<CreditStatus | null>(null);
  useEffect(() => { getCreditStatus().then(setStatus).catch(() => {}); }, []);

  return (
    <div className="neu-page min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-5 text-sm">
        <Link to="/" className="font-semibold">Sirpam 3D Labs Mold</Link>
        <div className="flex-1" />
        <Link to="/studio">Mold Maker</Link>
        <Link to="/shop">Shop</Link>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-16">
        <h1 className="text-4xl font-bold">Simple, pay-as-you-go pricing</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Designing and previewing molds is always free. You only use credits when you export or use the heavy tools. Credits never expire — no subscription.
        </p>

        {status && (
          <div className="mt-6 inline-block rounded-2xl bg-card px-5 py-3 shadow-sm">
            You have <b className="text-primary">{status.balance} credits</b> and{" "}
            <b>{Math.max(0, status.freeExportsLimit - status.freeExportsUsed)}</b> free exports left this month.
          </div>
        )}

        <section className="mt-10 grid gap-6 md:grid-cols-4">
          <div className="rounded-3xl bg-card p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Free</h2>
            <p className="mt-2 text-3xl font-bold">$0</p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>3 STL/OBJ exports every month</li>
              <li>10 welcome credits when you sign up</li>
              <li>All design tools, free preview</li>
            </ul>
            <Link to="/auth" className="mt-6 block rounded-full bg-muted px-4 py-2 text-center font-semibold">Sign up free</Link>
          </div>
          {CREDIT_PACKS.map((p) => (
            <div key={p.id} className={`rounded-3xl bg-card p-6 shadow-sm ${p.best ? "ring-2 ring-primary" : ""}`}>
              <h2 className="text-xl font-semibold">{p.name} {p.best && <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">Best value</span>}</h2>
              <p className="mt-2 text-3xl font-bold">${p.usd}</p>
              <p className="text-sm text-muted-foreground">about ₹{p.inr.toLocaleString("en-IN")} in India</p>
              <p className="mt-4 font-semibold">{p.credits} credits</p>
              <p className="text-sm text-muted-foreground">${(p.usd / p.credits).toFixed(2)} per credit · never expire</p>
              <button disabled className="mt-6 w-full cursor-not-allowed rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground opacity-60">
                Checkout coming soon
              </button>
            </div>
          ))}
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
