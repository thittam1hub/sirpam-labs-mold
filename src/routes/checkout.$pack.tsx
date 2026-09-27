import { useEffect, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { CREDIT_PACKS, REGION_TIERS, guessRegion, type RegionTier } from "@/lib/credits";
import { BUSINESS } from "@/lib/business";
import { LegalFooter } from "@/components/LegalFooter";

export const Route = createFileRoute("/checkout/$pack")({
  loader: ({ params }) => {
    const pack = CREDIT_PACKS.find((p) => p.id === params.pack);
    if (!pack) throw notFound();
    return { id: pack.id };
  },
  head: ({ loaderData }) => {
    const pack = CREDIT_PACKS.find((p) => p.id === loaderData?.id);
    if (!pack) return { meta: [{ title: "Pack not found" }, { name: "robots", content: "noindex" }] };
    const t = `Buy ${pack.name} pack — ${pack.credits} credits | ${BUSINESS.product}`;
    const d = `Checkout for the ${pack.name} credit pack: ${pack.credits} mold credits that never expire.`;
    return {
      meta: [
        { title: t }, { name: "description", content: d },
        { property: "og:title", content: t }, { property: "og:description", content: d },
        { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="neu-page min-h-screen p-12">Pack not found. <Link to="/pricing" className="text-primary">See packs</Link></div>
  ),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { id } = Route.useLoaderData();
  const pack = CREDIT_PACKS.find((p) => p.id === id)!;
  const [tier, setTier] = useState<RegionTier>("standard");
  const [india, setIndia] = useState(false);
  const [agree, setAgree] = useState(false);
  useEffect(() => { const g = guessRegion(); setTier(g.tier); setIndia(g.india); }, []);

  const inr = tier === "value" && india;
  const price = inr ? `₹${pack.inr.toLocaleString("en-IN")}` : `$${pack.usd[tier]}`;
  const mail = `mailto:${BUSINESS.email}?subject=${encodeURIComponent(`Buy ${pack.name} pack (${pack.credits} credits)`)}&body=${encodeURIComponent(`Hi, I'd like to buy the ${pack.name} pack for ${price}. My account email: `)}`;

  return (
    <div className="neu-page min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-2xl px-6 py-12">
        <Link to="/pricing" className="text-sm text-muted-foreground">← Back to pricing</Link>
        <h1 className="mt-4 text-4xl font-bold">Checkout — {pack.name} pack</h1>

        <section className="mt-8 rounded-3xl bg-card p-6 shadow-sm">
          <div className="flex justify-between"><span>{pack.name} pack</span><b>{pack.credits} credits</b></div>
          <div className="mt-2 flex justify-between text-sm text-muted-foreground">
            <span>Region: {REGION_TIERS.find((r) => r.id === tier)!.name}</span>
            <select value={tier} onChange={(e) => setTier(e.target.value as RegionTier)} className="rounded-lg bg-muted px-2 py-1">
              {REGION_TIERS.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="mt-4 flex justify-between border-t border-border pt-4 text-xl"><span>Total</span><b>{price}</b></div>
          <p className="mt-1 text-xs text-muted-foreground">Sales tax, if any, is added based on your billing country. Credits never expire.</p>

          <label className="mt-6 flex items-start gap-2 text-sm">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1" />
            <span>I agree to the <Link to="/terms" className="text-primary">Terms</Link> and <Link to="/refunds" className="text-primary">Refund policy</Link>.</span>
          </label>

          <button disabled className="mt-6 w-full cursor-not-allowed rounded-2xl bg-muted px-4 py-3 font-semibold text-muted-foreground">
            Pay {price} — card payment coming soon
          </button>
          <a href={agree ? mail : undefined} aria-disabled={!agree}
            className={`mt-3 block rounded-2xl px-4 py-3 text-center font-semibold ${agree ? "bg-primary text-primary-foreground" : "pointer-events-none bg-muted text-muted-foreground"}`}>
            Request this pack by email
          </a>
          <p className="mt-3 text-xs text-muted-foreground">Online card payment isn't switched on yet. Email us and we'll add the credits to your account once paid.</p>
        </section>
        <LegalFooter />
      </main>
    </div>
  );
}
