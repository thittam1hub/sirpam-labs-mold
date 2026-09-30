import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalFooter } from "@/components/LegalFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { GUIDES } from "@/lib/guides";

export const Route = createFileRoute("/guides/")({
  staticData: { sitemap: true },
  head: () => ({
    links: [{ rel: "canonical", href: "/guides" }],
    meta: [
      { title: "Mold making guides — Sirpam 3D Labs Mold" },
      { name: "description", content: "Free guides on making silicone molds, 3D printed molds and turning STL files into molds." },
      { property: "og:title", content: "Mold making guides — Sirpam 3D Labs Mold" },
      { property: "og:description", content: "Learn silicone mold making and 3D printed molds, step by step." },
      { property: "og:url", content: "/guides" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GuidesPage,
});

function GuidesPage() {
  return (
    <div className="neu-page min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 pb-16">
        <h1 className="text-3xl font-bold">Mold making guides</h1>
        <p className="mt-3 text-muted-foreground">Practical, step-by-step guides for makers casting at home.</p>
        <ul className="mt-8 grid gap-4">
          {GUIDES.map(g => (
            <li key={g.slug}>
              <Link to="/guides/$slug" params={{ slug: g.slug }} className="neu-card block rounded-2xl bg-card p-5 hover:text-primary">
                <h2 className="text-xl font-semibold">{g.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{g.description}</p>
                <p className="mt-2 text-xs text-muted-foreground">{g.minutes} min read</p>
              </Link>
            </li>
          ))}
        </ul>
        <section className="mt-10 rounded-3xl bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold">New to mold making?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Start with the silicone hardness guide to pick the right material for your master, then follow the
            bubble-free pouring guide before your first cast. Every guide is written for makers in India — the
            materials named are ones you can actually buy here, and temperatures assume a warm workshop, not an
            air-conditioned lab.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Have a topic you'd like covered, or a problem these guides didn't solve?{" "}
            <Link to="/contact" className="text-primary">Tell us</Link> — we write new guides from real reader questions.
          </p>
        </section>
      </main>
      <LegalFooter />
    </div>
  );
}
