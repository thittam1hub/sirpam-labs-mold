import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { LegalFooter } from "@/components/LegalFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getGuide, GUIDES, type Guide } from "@/lib/guides";
import { AuthorBio } from "@/components/AuthorBio";

export const Route = createFileRoute("/guides/$slug")({
  staticData: { sitemap: false },
  loader: ({ params }) => {
    const guide = getGuide(params.slug);
    if (!guide) throw notFound();
    return { guide };
  },
  head: ({ loaderData }) => {
    const g = loaderData?.guide;
    if (!g) return { meta: [{ title: "Guide not found — Sirpam 3D Labs Mold" }] };
    const path = `/guides/${g.slug}`;
    return {
      meta: [
        { title: `${g.title} — Sirpam 3D Labs Mold` },
        { name: "description", content: g.description },
        { property: "og:title", content: g.title },
        { property: "og:description", content: g.description },
        { property: "og:url", content: path },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
      ],
      links: [{ rel: "canonical", href: path }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: g.title,
            description: g.description,
            image: [g.image],
            datePublished: g.published,
            dateModified: g.updated,
            mainEntityOfPage: { "@type": "WebPage", "@id": `https://mold.sirpam3dlabs.in${path}` },
            author: { "@type": "Organization", name: "Sirpam 3D Labs", url: "https://mold.sirpam3dlabs.in/about" },
            publisher: {
              "@type": "Organization",
              name: "Sirpam 3D Labs",
              url: "https://mold.sirpam3dlabs.in/",
              logo: { "@type": "ImageObject", url: "https://mold.sirpam3dlabs.in/logo.svg" },
            },
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: "https://mold.sirpam3dlabs.in/" },
              { "@type": "ListItem", position: 2, name: "Guides", item: "https://mold.sirpam3dlabs.in/guides" },
              { "@type": "ListItem", position: 3, name: g.title, item: `https://mold.sirpam3dlabs.in${path}` },
            ],
          }),
        },
      ],
    };
  },
  component: GuidePage,
});

function GuidePage() {
  const guide: Guide = Route.useLoaderData().guide;
  const others = GUIDES.filter(g => g.slug !== guide.slug);
  return (
    <div className="neu-page min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 pb-16">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <ol className="flex flex-wrap gap-1">
            <li><Link to="/" className="text-primary">Home</Link> /</li>
            <li><Link to="/guides" className="text-primary">Guides</Link> /</li>
            <li aria-current="page">{guide.title}</li>
          </ol>
        </nav>
        <h1 className="mt-2 text-3xl font-bold">{guide.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{guide.minutes} min read</p>
        {guide.sections.map(s => (
          <section key={s.h} className="mt-8">
            <h2 className="text-xl font-semibold">{s.h}</h2>
            {s.p.map((t, i) => <p key={i} className="mt-2 text-muted-foreground">{t}</p>)}
            {s.steps && (
              <ol className="mt-3 list-decimal space-y-2 pl-6 text-muted-foreground">
                {s.steps.map(t => <li key={t}>{t}</li>)}
              </ol>
            )}
          </section>
        ))}
        <div className="neu-card mt-10 rounded-2xl bg-card p-5">
          <p className="font-semibold">Try it on your own model</p>
          <p className="mt-1 text-sm text-muted-foreground">Designing is free, with 10 welcome credits and 3 free exports every month.</p>
          <Link to="/studio" className="mt-3 inline-block rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Open the Studio</Link>
        </div>
        <AuthorBio />
        <h2 className="mt-10 text-lg font-semibold">More guides</h2>
        <ul className="mt-2 space-y-1">
          {others.map(g => (
            <li key={g.slug}><Link to="/guides/$slug" params={{ slug: g.slug }} className="text-primary">{g.title}</Link></li>
          ))}
        </ul>
      </main>
      <LegalFooter />
    </div>
  );
}
