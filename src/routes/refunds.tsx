import { LegalFooter } from "@/components/LegalFooter";
import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/refunds")({
  staticData: { sitemap: true },
  head: () => ({
    links: [{ rel: "canonical", href: "/refunds" }],
    meta: [
      { title: "Refund Policy — Sirpam 3D Labs Mold" },
      { name: "description", content: "When you can get a refund for Sirpam 3D Labs Mold credit packs." },
      { property: "og:title", content: "Refund Policy — Sirpam 3D Labs Mold" },
      { property: "og:description", content: "When you can get a refund for Sirpam 3D Labs Mold credit packs." },
      { property: "og:url", content: "/refunds" },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RefundsPage,
});

function RefundsPage() {
  return (
    <div className="neu-page min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-4xl font-bold">Refund Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated September 2026</p>
        <h2 className="mt-8 text-xl font-semibold">Unused credits</h2>
        <p className="mt-2 text-muted-foreground">We offer a 14-day money-back guarantee: you can ask for a full refund of a credit pack within 14 days of purchase. International orders are refunded by our reseller Paddle: request it at paddle.net or email us. Indian (Razorpay) orders: email sirpam3dlabs@gmail.com with your order details.</p>
        <h2 className="mt-8 text-xl font-semibold">Failed actions</h2>
        <p className="mt-2 text-muted-foreground">Credits are held when an action starts and only charged if it succeeds. If an export, repair, AI model or report fails, the credits go back to your balance automatically, within 30 minutes at most. If something still looks wrong, contact us and we will check it.</p>
        <h2 className="mt-8 text-xl font-semibold">Expiry</h2>
        <p className="mt-2 text-muted-foreground">Purchased credits last 24 months, welcome credits 90 days, and promo credits for the period shown with the code. Expired credits can't be refunded.</p>
        <h2 className="mt-8 text-xl font-semibold">Refunds and chargebacks</h2>
        <p className="mt-2 text-muted-foreground">When a purchase is refunded or charged back, the unused credits from that purchase are removed from your account.</p>
        <h2 className="mt-8 text-xl font-semibold">How to ask</h2>
        <p className="mt-2 text-muted-foreground">Email us from the address on your account with the date of purchase. Refunds go back to the original payment method.</p>
        <LegalFooter />
      </main>
    </div>
  );
}
