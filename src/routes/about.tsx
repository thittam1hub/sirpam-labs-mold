import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalFooter } from "@/components/LegalFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/about")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "About — Sirpam 3D Labs Mold" },
      { name: "description", content: "Sirpam 3D Labs builds a browser-based mold maker that turns any 3D model into a printable two-part mold." },
      { property: "og:title", content: "About — Sirpam 3D Labs Mold" },
      { property: "og:description", content: "Who we are and how the mold maker came to be." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="neu-page min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 pb-16">
        <h1 className="text-3xl font-bold">About Sirpam 3D Labs</h1>
        <p className="mt-4 text-muted-foreground">
          Sirpam 3D Labs is a small brand from India building tools for makers who cast at home —
          resin, wax, concrete, chocolate and more. Our mold maker runs in your browser:
          upload a 3D model, and it builds a two-part mold you can print on any FDM or resin printer.
        </p>
        <p className="mt-4 text-muted-foreground">
          The mold engine runs on your device, so your models stay on your computer. Only the optional AI helper sends your description or photo to our AI service. Credits are
          only spent when you export finished files or use the AI helper.
        </p>
        <h2 className="mt-8 text-xl font-semibold">Open source roots</h2>
        <p className="mt-2 text-muted-foreground">
          The mold maker began as the open-source project{" "}
          <a href="https://github.com/matta174/mold-maker" className="text-primary" target="_blank" rel="noreferrer">
            mold-maker by matta174
          </a>
          . We've rebuilt and extended it with repair tools, lock systems, vent controls, a credit
          system and much more — while keeping credit to the original author.
        </p>
        <p className="mt-6 text-sm text-muted-foreground">
          Questions? <Link to="/contact" className="text-primary">Contact us</Link>.
        </p>
      </main>
      <LegalFooter />
    </div>
  );
}
