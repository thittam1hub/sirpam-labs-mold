import { LegalFooter } from "@/components/LegalFooter";
import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/privacy")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Privacy Policy — Sirpam 3D Labs Mold" },
      { name: "description", content: "What Sirpam 3D Labs Mold stores about you and why." },
      { property: "og:title", content: "Privacy Policy — Sirpam 3D Labs Mold" },
      { property: "og:description", content: "What Sirpam 3D Labs Mold stores about you and why." },
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
        </ul>
        <p className="mt-2 text-muted-foreground">Fonts and all other page files are served from our own site, so no third party receives your visit.</p>
        <h2 className="mt-8 text-xl font-semibold">What is stored in your browser</h2>
        <p className="mt-2 text-muted-foreground">Only what the app needs to work: your sign-in session, your light/dark theme choice, your usage-statistics choice, and Studio preferences. We use no advertising or tracking cookies.</p>
        <h2 className="mt-8 text-xl font-semibold">Age requirement</h2>
        <p className="mt-2 text-muted-foreground">You must be 13 or older to create an account or send us a message. If you tell us you are under 13, your account and its data are deleted immediately. If you believe a child under 13 has given us information, email <a href="mailto:sirpam3dlabs@gmail.com" className="text-primary">sirpam3dlabs@gmail.com</a> and we will delete it.</p>
        <h2 className="mt-8 text-xl font-semibold">Payments</h2>
        <p className="mt-2 text-muted-foreground">International orders are sold by Paddle.com, our Merchant of Record, which handles the sale, payments, tax and invoicing. Indian orders are processed by Razorpay. We share your account email and the pack you buy with them; they collect card, UPI or bank details directly, and we never see or store those. We keep a record of each purchase (pack, amount, currency, payment reference) for receipts, refunds and tax records.</p>
        <h2 className="mt-8 text-xl font-semibold">Your choices</h2>
        <p className="mt-2 text-muted-foreground">You can delete gallery items at any time, and ask us to delete your account and data.</p>
        <LegalFooter />
      </main>
    </div>
  );
}
