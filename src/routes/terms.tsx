import { LegalFooter } from "@/components/LegalFooter";
import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/terms")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Terms of Service — Sirpam 3D Labs Mold" },
      { name: "description", content: "The rules for using Sirpam 3D Labs Mold and buying credits." },
      { property: "og:title", content: "Terms of Service — Sirpam 3D Labs Mold" },
      { property: "og:description", content: "The rules for using Sirpam 3D Labs Mold and buying credits." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="neu-page min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-4xl font-bold">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated 29 September 2026</p>
        <h2 className="mt-8 text-xl font-semibold">Who you are contracting with</h2>
        <p className="mt-2 text-muted-foreground">This service is provided by Sirpam 3D Labs, an individual seller based in India ("we", "us"). When you use Sirpam 3D Labs Mold, your agreement is with Sirpam 3D Labs.</p>
        <h2 className="mt-8 text-xl font-semibold">Acceptance and agreement</h2>
        <p className="mt-2 text-muted-foreground">By accessing or using the service, creating an account, or buying credits, you agree to be bound by these Terms of Service. If you do not agree, you must not use the service. You must be at least 13 years old, and if you use the service for an organisation you confirm you have authority to accept these terms on its behalf.</p>
        <h2 className="mt-8 text-xl font-semibold">Using the service</h2>
        <p className="mt-2 text-muted-foreground">Sirpam 3D Labs Mold lets you design 3D-printable molds in your browser. You are responsible for the models you upload and for having the right to use them.</p>
        <h2 className="mt-8 text-xl font-semibold">Accounts</h2>
        <p className="mt-2 text-muted-foreground">Exports and credits need an account. Keep your sign-in details private; you are responsible for activity on your account.</p>
        <h2 className="mt-8 text-xl font-semibold">Credits</h2>
        <p className="mt-2 text-muted-foreground">Purchased credits are valid for 24 months from purchase. Welcome credits are valid for 90 days, promo credits for the period shown with the code, and the 3 monthly free credits reset on the 1st of each month. Free monthly credits are used first, then promo and welcome credits, then purchased credits. Credits are only charged when an action succeeds; if it fails, they are returned automatically. Credits have no cash value and cannot be transferred. Each action's credit cost is shown on the Pricing page before you use it. Every purchase is recorded and a receipt is available in your Account under Credits &amp; history. Welcome and promo credits are limited to one account per person; credits obtained through multiple accounts or promo abuse may be removed.</p>
        <h2 className="mt-8 text-xl font-semibold">Payments</h2>
        <p className="mt-2 text-muted-foreground">Our order process for international buyers is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for those orders. Paddle provides all customer service inquiries and handles returns, under the <a className="text-primary" href="https://www.paddle.com/legal/checkout-buyer-terms" target="_blank" rel="noopener noreferrer">Paddle Buyer Terms</a>. Orders from India are paid through Razorpay and sold by Sirpam 3D Labs. Refunds follow our Refund policy.</p>
        <h2 className="mt-8 text-xl font-semibold">Your results</h2>
        <p className="mt-2 text-muted-foreground">Molds are generated automatically. Check them before printing or casting; we are not liable for failed prints, casts or materials.</p>
        <h2 className="mt-8 text-xl font-semibold">Prohibited use and misuse</h2>
        <p className="mt-2 text-muted-foreground">You must not use the service unlawfully; commit fraud or send spam; upload content you do not have the right to use; infringe intellectual property or privacy rights; introduce malware; probe, attack or interfere with service security; scrape the service; reverse engineer the software; resell or redistribute the service; or circumvent credit, access or usage limits.</p>
        <h2 className="mt-8 text-xl font-semibold">Ownership and intellectual property</h2>
        <p className="mt-2 text-muted-foreground">Sirpam 3D Labs owns the service and everything in it, including the software, mold engine, documentation, name and logo. We give you a limited, personal, non-transferable right to use the service. You keep ownership of the models you upload and the molds you export.</p>
        <h2 className="mt-8 text-xl font-semibold">Service availability and warranties</h2>
        <p className="mt-2 text-muted-foreground">The service is provided "as is" and "as available". We do not guarantee it will be uninterrupted, error-free or suitable for a particular purpose, and to the fullest extent the law allows we disclaim all implied warranties. Our total liability is limited to the amount you paid us in the 12 months before the claim, and we are not liable for indirect losses such as lost profits or data. Nothing here limits liability that cannot be limited by law.</p>
        <h2 className="mt-8 text-xl font-semibold">Our right to suspend or terminate access</h2>
        <p className="mt-2 text-muted-foreground">Sirpam 3D Labs may suspend or terminate your access if you materially breach these terms, fail to pay or reverse a payment, create a security or fraud risk, or repeatedly or seriously violate our policies. Where practical, we will notify you and give you a reasonable opportunity to correct the issue. You can stop using the service and delete your account at any time from your Account page. When an account is closed, its data is handled as described in our Privacy Policy.</p>
        <h2 className="mt-8 text-xl font-semibold">Governing law</h2>
        <p className="mt-2 text-muted-foreground">These terms are governed by the laws of India.</p>
        <h2 className="mt-8 text-xl font-semibold">Changes</h2>
        <p className="mt-2 text-muted-foreground">We may update these terms or prices; credits you already bought keep their value.</p>
        <LegalFooter />
      </main>
    </div>
  );
}
