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
        <h2 className="mt-8 text-xl font-semibold">Payments</h2>
        <p className="mt-2 text-muted-foreground">Online card payments are not enabled. If they are introduced, this policy will identify the provider and explain what payment information it processes before checkout goes live.</p>
        <h2 className="mt-8 text-xl font-semibold">Your choices</h2>
        <p className="mt-2 text-muted-foreground">You can delete gallery items at any time, and ask us to delete your account and data.</p>
        <LegalFooter />
      </main>
    </div>
  );
}
