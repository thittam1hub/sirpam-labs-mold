import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { BrandLink } from "@/components/BrandLink";
import showcase from "@/assets/real-mold-workbench.webp";
import { Droplet, Factory, FlaskConical, RotateCw, Scissors, Wrench } from "lucide-react";

export const Route = createFileRoute("/")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Sirpam 3D Labs Mold — turn any 3D model into a print-ready mold" },
      {
        name: "description",
        content:
          "Browser-based mold maker: upload an STL or OBJ, get a suggested parting plane, auto sprues, vents and pins, and export print-ready two-part mold halves — designed right in your browser.",
      },
      { property: "og:title", content: "Sirpam 3D Labs Mold — turn any 3D model into a print-ready mold" },
      {
        property: "og:description",
        content:
          "Upload an STL, get a print-ready two-part mold with auto sprues, vents and pins — designed in your browser.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "icon", type: "image/svg+xml", href: "/logo.svg" }],
  }),
  component: LandingPage,
});

const FEATURES = [
  {
    title: "Smart parting plane",
    body: "The app suggests the best place to split your model and previews the split line in 3D before you commit.",
    icon: Scissors,
  },
  {
    title: "Sprues, vents & pins",
    body: "Pour hole, air vents and registration pins are generated automatically — no CAD work needed.",
    icon: Droplet,
  },
  {
    title: "Curved & multi-part molds",
    body: "Curved split lines for shapes that won't pull straight out, plus 3- or 4-piece molds for wide models.",
    icon: RotateCw,
  },
  {
    title: "Auto-repair broken STLs",
    body: "Holes and broken spots in your mesh are fixed automatically, so the mold still builds.",
    icon: Wrench,
  },
  {
    title: "Material & cost estimator",
    body: "See how much casting material to mix and what the print will cost before you print.",
    icon: FlaskConical,
  },
  {
    title: "Print-farm planner",
    body: "Making many molds? Find out how many printer plates you need and what each mold costs.",
    icon: Factory,
  },
];

const STEPS = [
  { n: 1, title: "Upload your model", body: "Drop in an STL or OBJ file — or describe the shape and let the AI model maker build it." },
  { n: 2, title: "Pick the split", body: "Drag the suggested parting plane, preview the split line, and choose your mold options." },
  { n: 3, title: "Generate the mold", body: "Two (or more) mold halves with sprues, vents and pins — built in seconds." },
  { n: 4, title: "Print & cast", body: "Export printable STLs, print them, and pour. Send them to a service with one click if you don't own a printer." },
];

const FAQ = [
  { q: "Is it free?", a: "Designing is free — upload a model, plan the split and preview the mold at no cost. New accounts get 10 welcome credits and 3 free exports every month; after that, exporting and pro tools use credit packs." },
  { q: "Does my model leave my computer?", a: "No. All the geometry work happens in your browser. Your model is only uploaded anywhere if you sign in and save it to your own private gallery, or send it to a print service yourself." },
  { q: "Which printers and materials work?", a: "Any FDM or resin printer works for the mold halves. The built-in presets cover casting chocolate, candle wax, soap, concrete, resin and more, each with the right shrinkage and clearance." },
  { q: "What file types can I open and export?", a: "Open STL, OBJ, 3MF and STEP files. Export mold halves as STL, OBJ, 3MF or STEP." },
  { q: "I don't own a 3D printer — can I still use it?", a: "Yes. Export the mold files and send them to any of the ten print and casting services listed on our Shop page, with price estimates per mold size." },
];

function LandingPage() {
  return (
    <div className="neu-page min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-6 pt-14 pb-10 text-center">
          <p className="mx-auto mb-4 inline-block rounded-full bg-accent px-3 py-1 text-xs font-semibold tracking-wide uppercase">
            Mold design runs in your browser · your models stay on your computer
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
            Turn any 3D model into a <span className="text-primary">print-ready mold</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Upload an STL or OBJ and Sirpam suggests the parting plane, then builds two-part mold halves
            with sprues, vents and pins — ready to print and pour.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/studio" className="rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground">
              Open the mold maker
            </Link>
            <Link to="/studio" className="rounded-lg border border-border px-6 py-3 text-base font-semibold">
              Try the sample model
            </Link>
          </div>
          <img
            src={showcase}
            alt="An open two-part 3D-printed duck mold with registration pins, pour spout and vents, beside the finished yellow cast duck"
            width={1600}
            height={1008}
            fetchPriority="high"
            className="mx-auto mt-10 aspect-[8/5] w-full max-w-4xl rounded-2xl border border-border object-cover shadow-lg"
          />
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-6 py-12">
          <h2 className="text-center text-3xl font-bold">Everything a mold needs, built in</h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">
            The details that make or break a cast — parting, venting, alignment, shrinkage — handled for you.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => {
              const FeatureIcon = f.icon;
              return (
                <article key={f.title} className="rounded-2xl border border-border bg-card p-5">
                  <FeatureIcon aria-hidden size={24} className="text-primary" />
                  <h3 className="mt-2 text-lg font-semibold">{f.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
                </article>
              );
            })}
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-6xl px-6 py-12">
          <h2 className="text-center text-3xl font-bold">From model to cast in four steps</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <article key={s.n} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground">
                  {s.n}
                </div>
                <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-6 py-12">
          <h2 className="text-center text-3xl font-bold">Questions people ask</h2>
          <div className="mt-8 space-y-3">
            {FAQ.map((f) => (
              <details key={f.q} className="rounded-2xl border border-border bg-card p-5">
                <summary className="cursor-pointer font-semibold">{f.q}</summary>
                <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="mx-auto max-w-3xl px-6 pb-16 text-center">
          <h2 className="text-3xl font-bold">Ready to make your first mold?</h2>
          <Link to="/studio" className="mt-6 inline-block rounded-lg bg-primary px-8 py-3 text-base font-semibold text-primary-foreground">
            Open the mold maker
          </Link>
        </section>
      </main>

      <footer className="border-t border-border px-6 py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 text-sm">
          <BrandLink />
          <div className="flex-1" />
          <Link to="/studio">Mold Maker</Link>
          <Link to="/shop">Shop</Link>
          <Link to="/gallery">Gallery</Link>
          <Link to="/auth" search={{ redirect: "/studio" }}>Sign in</Link>
        </div>
        <div className="mx-auto mt-3 flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {BUSINESS.whatsapp && (
            <a href={`https://wa.me/${BUSINESS.whatsapp}`} target="_blank" rel="noopener noreferrer" className="text-primary">
              WhatsApp +91 {BUSINESS.whatsapp.slice(2)}
            </a>
          )}
          <a href={`mailto:${BUSINESS.email}`} className="text-primary">{BUSINESS.email}</a>
          <span>Prints and dispatches within India only.</span>
        </div>
      </footer>
    </div>
  );
}
