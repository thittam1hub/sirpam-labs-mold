import { createFileRoute } from "@tanstack/react-router";
import { LegalFooter } from "@/components/LegalFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/licenses")({
  staticData: { sitemap: true },
  head: () => ({
    links: [{ rel: "canonical", href: "/licenses" }],
    meta: [
      { title: "Open-source licenses — Sirpam 3D Labs Mold" },
      { name: "description", content: "The open-source projects and libraries that power Sirpam 3D Labs Mold." },
      { property: "og:title", content: "Open-source licenses — Sirpam 3D Labs Mold" },
      { property: "og:description", content: "Credits and licenses for the libraries we use." },
      { property: "og:url", content: "/licenses" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LicensesPage,
});

const libs = [
  { name: "Three.js", url: "https://threejs.org", note: "3D rendering in the browser (MIT)." },
  { name: "Manifold", url: "https://github.com/elalish/manifold", note: "Solid geometry engine used to build and validate molds (Apache-2.0)." },
  { name: "OpenCascade.js", url: "https://ocjs.org", note: "STEP file export (LGPL-2.1, loaded unmodified)." },
  { name: "React", url: "https://react.dev", note: "User interface (MIT)." },
  { name: "TanStack Router / Start / Query", url: "https://tanstack.com", note: "Routing, server functions and data fetching (MIT)." },
  { name: "Tailwind CSS", url: "https://tailwindcss.com", note: "Styling (MIT)." },
];

function LicensesPage() {
  return (
    <div className="neu-page min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 pb-16">
        <h1 className="text-3xl font-bold">Open-source licenses</h1>
        <p className="mt-2 text-muted-foreground">Sirpam 3D Labs Mold stands on these projects. Thank you to their authors.</p>
        <div className="mt-6 space-y-4">
          {libs.map((l) => (
            <section key={l.name} className="rounded-3xl bg-card p-5 shadow-sm">
              <a href={l.url} target="_blank" rel="noreferrer" className="font-semibold text-primary">{l.name}</a>
              <p className="mt-1 text-sm text-muted-foreground">{l.note}</p>
            </section>
          ))}
        </div>
      </main>
      <LegalFooter />
    </div>
  );
}
