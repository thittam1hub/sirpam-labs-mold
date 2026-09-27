import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/refunds")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Refund Policy — Sirpam 3D Labs Mold" },
      { name: "description", content: "When you can get a refund for Sirpam 3D Labs Mold credit packs." },
      { property: "og:title", content: "Refund Policy — Sirpam 3D Labs Mold" },
      { property: "og:description", content: "When you can get a refund for Sirpam 3D Labs Mold credit packs." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RefundsPage,
});

function RefundsPage() {
  return (
    <div className="neu-page min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-3xl px-6 py-12">
        <Link to="/" className="text-sm text-muted-foreground">← Sirpam 3D Labs Mold</Link>
        <h1 className="mt-4 text-4xl font-bold">Refund Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated September 2026</p>
        <h2 className="mt-8 text-xl font-semibold">Unused credits</h2>
        <p className="mt-2 text-muted-foreground">You can ask for a full refund of a credit pack within 14 days of purchase if none of its credits were used.</p>
        <h2 className="mt-8 text-xl font-semibold">Failed exports</h2>
        <p className="mt-2 text-muted-foreground">If an export was charged but did not produce a file, contact us and we will return those credits.</p>
        <h2 className="mt-8 text-xl font-semibold">How to ask</h2>
        <p className="mt-2 text-muted-foreground">Email us from the address on your account with the date of purchase. Refunds go back to the original payment method.</p>
      </main>
    </div>
  );
}
