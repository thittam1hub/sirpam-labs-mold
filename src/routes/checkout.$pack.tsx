import { useEffect, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { CREDIT_PACKS, guessRegion, getCreditPacks, type CreditPack } from "@/lib/credits";
import { BUSINESS } from "@/lib/business";
import { LegalFooter } from "@/components/LegalFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createRazorpayOrder, verifyRazorpayPayment, PACK_PRICE_IDS } from "@/lib/payments.functions";
import { initializePaddle, getPaddlePriceId, getPaddleEnvironment, loadRazorpay } from "@/lib/paddle";

export const Route = createFileRoute("/checkout/$pack")({
  staticData: { sitemap: false },
  loader: ({ params }) => {
    const pack = CREDIT_PACKS.find((p) => p.id === params.pack);
    if (!pack) throw notFound();
    return { id: pack.id };
  },
  head: ({ loaderData }) => {
    const pack = CREDIT_PACKS.find((p) => p.id === loaderData?.id);
    if (!pack) return { meta: [{ title: "Pack not found" }, { name: "robots", content: "noindex, nofollow" }] };
    const t = `Buy ${pack.name} pack — ${pack.credits} credits | ${BUSINESS.product}`;
    const d = `Checkout for the ${pack.name} credit pack: ${pack.credits} mold credits, valid for 24 months.`;
    return {
      meta: [
        { title: t }, { name: "description", content: d },
        { property: "og:title", content: t }, { property: "og:description", content: d },
        { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
        { name: "robots", content: "noindex, nofollow" },
      ],
    };
  },
  errorComponent: () => (
    <div className="neu-page min-h-screen p-12">
      <p>We couldn't load this checkout page.</p>
      <Link to="/pricing" className="text-primary">Back to Pricing</Link>
    </div>
  ),
  notFoundComponent: () => (
    <div className="neu-page min-h-screen p-12">Pack not found. <Link to="/pricing" className="text-primary">See packs</Link></div>
  ),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { id } = Route.useLoaderData();
  const fallback = CREDIT_PACKS.find((p) => p.id === id);
  const [pack, setPack] = useState<CreditPack | undefined>(
    fallback ? { ...fallback, usd: { ...fallback.usd } } : undefined);
  const [india, setIndia] = useState(false);
  const [agree, setAgree] = useState(false);
  useEffect(() => {
    const g = guessRegion(); setIndia(g.india);
    getCreditPacks().then((ps) => { const live = ps.find((p) => p.id === id); if (live) setPack(live); }).catch(() => {});
  }, [id]);

  const navigate = useNavigate();
  const createOrder = useServerFn(createRazorpayOrder);
  const verifyPay = useServerFn(verifyRazorpayPayment);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!pack) return null;

  async function pay() {
    setErr(null); setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate({ to: "/auth", search: { redirect: `/checkout/${id}` } as never }); return; }
      const success = `${window.location.origin}/account?tab=credits&checkout=success`;
      if (india) {
        const o = await createOrder({ data: { packId: id as "starter" } });
        if (!o.ok) { setErr(o.error); return; }
        await loadRazorpay();
        const rz = new window.Razorpay({
          key: o.keyId, order_id: o.orderId, amount: o.amount, currency: "INR",
          name: BUSINESS.product, description: `${o.packName} pack`, prefill: { email: user.email },
          handler: async (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
            const v = await verifyPay({ data: { orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature } });
            if (v.ok) window.location.assign(success); else setErr(v.error ?? "Payment could not be verified.");
          },
        });
        rz.on("payment.failed", () => setErr("The payment didn't go through. You weren't charged."));
        rz.open();
      } else {
        await initializePaddle();
        const priceId = await getPaddlePriceId(PACK_PRICE_IDS[id] as "starter_pack_once");
        window.Paddle.Checkout.open({
          items: [{ priceId, quantity: 1 }],
          customer: user.email ? { email: user.email } : undefined,
          customData: { userId: user.id, packId: id },
          settings: { displayMode: "overlay", successUrl: success, allowLogout: false, variant: "one-page" },
        });
      }
    } catch (e) {
      console.error(e); setErr("Couldn't open checkout. Please try again.");
    } finally { setBusy(false); }
  }

  const inr = india;
  const price = inr ? `₹${pack.inr.toLocaleString("en-IN")}` : `$${pack.usd.standard}`;

  return (
    <div className="neu-page min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <Link to="/pricing" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft aria-hidden size={15} /> Back to pricing</Link>
        <h1 className="mt-4 text-4xl font-bold">Checkout — {pack.name} pack</h1>

        <section className="mt-8 rounded-3xl bg-card p-6 shadow-sm">
          <div className="flex justify-between"><span>{pack.name} pack</span><b>{pack.credits} credits</b></div>
          <p className="mt-2 text-sm text-muted-foreground">Price shown in rupees for India and US dollars elsewhere. Checkout may show your local currency and any sales tax.</p>
          <div className="mt-4 flex justify-between border-t border-border pt-4 text-xl"><span>Total</span><b>{price}</b></div>
          <p className="mt-1 text-xs text-muted-foreground">Sales tax, if any, is added based on your billing country. Credits are valid for 24 months.</p>

          <label className="mt-6 flex items-start gap-2 text-sm">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1" />
            <span>I agree to the <Link to="/terms" className="text-primary">Terms</Link> and <Link to="/refunds" className="text-primary">Refund policy</Link>.</span>
          </label>

          <button type="button" disabled={!agree || busy} onClick={pay}
            className="mt-6 w-full rounded-2xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground">
            {busy ? "Opening checkout…" : `Pay ${price}`}
          </button>
          {!agree && <p className="mt-1 text-xs text-muted-foreground">Tick the box above to continue.</p>}
          {err && <p role="alert" className="mt-2 text-sm text-destructive">{err}</p>}
          <p className="mt-3 text-xs text-muted-foreground">
            {india ? "Pay with UPI, cards or netbanking via Razorpay." : "Our order process is conducted by our online reseller Paddle.com, the Merchant of Record for all our orders."}
            {" "}Credits are added as soon as the payment is confirmed.
          </p>
          {getPaddleEnvironment() === "sandbox" && (
            <p className="mt-3 rounded-xl border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
              Preview is in test mode: no real money is charged. Use card 4242 4242 4242 4242.
            </p>
          )}
        </section>
        <LegalFooter />
      </main>
    </div>
  );
}
