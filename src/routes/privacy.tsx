import { LegalFooter } from "@/components/LegalFooter";
import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/privacy")({
  staticData: { sitemap: true },
  head: () => ({
    links: [{ rel: "canonical", href: "/privacy" }],
    meta: [
      { title: "Privacy Policy — Sirpam 3D Labs Mold" },
      { name: "description", content: "What Sirpam 3D Labs Mold stores about you, why we keep it, who we share it with, and how to download or delete your data under India's DPDP Act." },
      { property: "og:title", content: "Privacy Policy — Sirpam 3D Labs Mold" },
      { property: "og:description", content: "What Sirpam 3D Labs Mold stores about you and why." },
      { property: "og:url", content: "/privacy" },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="neu-page min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-4xl font-bold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated September 2026</p>
        <h2 className="mt-8 text-xl font-semibold">Who we are</h2>
        <p className="mt-2 text-muted-foreground">Sirpam 3D Labs, an individual seller based in India, runs Sirpam 3D Labs Mold and is the data controller for the personal data described here. Contact: <a href="mailto:sirpam3dlabs@gmail.com" className="text-primary">sirpam3dlabs@gmail.com</a>.</p>
        <h2 className="mt-8 text-xl font-semibold">What stays on your device</h2>
        <p className="mt-2 text-muted-foreground">Your 3D models and mold designs are processed in your browser. Projects are saved on your own device unless you upload them.</p>
        <h2 className="mt-8 text-xl font-semibold">What we store</h2>
        <p className="mt-2 text-muted-foreground">Your email address, profile details, credit balance and history, plus gallery photos and notes you choose to add.</p>
        <h2 className="mt-8 text-xl font-semibold">Services we share data with</h2>
        <ul className="mt-2 list-disc space-y-1 pl-6 text-muted-foreground">
          <li><strong>Lovable Cloud</strong> (hosting, database, sign-in, file storage): your email, profile, credit history, gallery photos and notes, and contact messages.</li>
          <li><strong>Google</strong> (only if you choose "Continue with Google"): Google confirms your identity and shares your email and name with us.</li>
          <li><strong>Lovable AI</strong> (only when you use the AI Model Maker): the description and any photo you submit, to generate the shape.</li>
          <li><strong>Usage statistics</strong> (only if you opt in inside the Studio): a few anonymous events such as "mold generated", with no email, name or model files. Off by default; you can turn it off at any time.</li>
          <li><strong>Google Analytics</strong>: anonymous counts of which pages are visited and which tools are used. It never receives your name, email or model files.</li>
          <li><strong>Microsoft Clarity</strong>: anonymised session recordings and heatmaps used to find confusing parts of the app. Anything you type into a form (phone numbers, addresses, notes) is masked and never recorded.</li>
        </ul>
        <p className="mt-2 text-muted-foreground">Fonts and all other page files are served from our own site. The only third-party services that receive your visit are the two analytics services listed above.</p>
        <h2 className="mt-8 text-xl font-semibold">What is stored in your browser</h2>
        <p className="mt-2 text-muted-foreground">Only what the app needs to work: your sign-in session, your light/dark theme choice, your usage-statistics choice, and Studio preferences. We use no advertising cookies. Google Analytics sets one small analytics cookie; Microsoft Clarity sets none.</p>
        <h2 className="mt-8 text-xl font-semibold">Age requirement</h2>
        <p className="mt-2 text-muted-foreground">You must be 13 or older to create an account or send us a message. If you tell us you are under 13, your account and its data are deleted immediately. If you believe a child under 13 has given us information, email <a href="mailto:sirpam3dlabs@gmail.com" className="text-primary">sirpam3dlabs@gmail.com</a> and we will delete it.</p>
        <h2 className="mt-8 text-xl font-semibold">Payments</h2>
        <p className="mt-2 text-muted-foreground">International orders are sold by Paddle.com, our Merchant of Record, which handles the sale, payments, tax and invoicing. Indian orders are processed by Razorpay. We share your account email and the pack you buy with them; they collect card, UPI or bank details directly, and we never see or store those. We keep a record of each purchase (pack, amount, currency, payment reference) for receipts, refunds and tax records.</p>
        <h2 className="mt-8 text-xl font-semibold">Why we use your data, and our legal basis</h2>
        <p className="mt-2 text-muted-foreground"><strong>Providing the service</strong> (account, credits, exports, gallery, AI maker, receipts): needed to perform our contract with you. <strong>Security and fraud prevention</strong> (rate limits, promo and referral abuse checks): our legitimate interest in keeping the service safe. <strong>Support</strong> (contact messages): legitimate interest in answering you. <strong>Usage statistics</strong>: your consent, which you can withdraw at any time. <strong>Purchase and tax records</strong>: legal obligation.</p>
        <h2 className="mt-8 text-xl font-semibold">Other recipients</h2>
        <p className="mt-2 text-muted-foreground">We may share data with professional advisers (such as accountants or lawyers) and with authorities when the law requires it. We never sell your data.</p>
        <h2 className="mt-8 text-xl font-semibold">How long we keep data</h2>
        <p className="mt-2 text-muted-foreground">Account, profile and gallery data are kept while your account is open and deleted within 30 days after you delete it. Contact messages are kept for up to 12 months. Purchase records are kept as long as tax law requires (typically 8 years). Database backups roll off within about 14 days. When data is no longer needed it is deleted or anonymised.</p>
        <h2 className="mt-8 text-xl font-semibold">Security</h2>
        <p className="mt-2 text-muted-foreground">We protect your data with encrypted connections (HTTPS), encryption at rest, per-user access rules in the database, private file storage, and limited access to production systems.</p>
        <h2 className="mt-8 text-xl font-semibold">International transfers</h2>
        <p className="mt-2 text-muted-foreground">Our service providers may process data outside India, including in the EU and the US. Where required, we rely on appropriate safeguards such as standard contractual clauses.</p>
        <h2 className="mt-8 text-xl font-semibold">Your rights</h2>
        <p className="mt-2 text-muted-foreground">You can access, correct, export or delete your data, object to or restrict certain uses, and withdraw consent at any time. You can delete gallery items and your whole account from your Account page, or email us. We reply within one month. You may also complain to your local data protection authority.</p>
        <LegalFooter />
      </main>
    </div>
  );
}
