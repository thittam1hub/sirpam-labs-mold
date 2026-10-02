import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { BrandLink } from "@/components/BrandLink";
import { BUSINESS } from "@/lib/business";
import showcase from "@/assets/real-mold-workbench.webp";
import { ArrowRight, Check, Droplet, FileDown, MessageCircle, Plus, ScanSearch, Scissors, Wrench } from "lucide-react";

export const Route = createFileRoute("/")({
  staticData: { sitemap: true },
  head: () => ({
    links: [{ rel: "canonical", href: "/" }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({ "@context": "https://schema.org", "@type": "Organization", name: "Sirpam 3D Labs", url: "https://mold.sirpam3dlabs.in/", logo: "https://mold.sirpam3dlabs.in/logo.svg", sameAs: ["https://sirpam3dlabs.in"] }),
    }],
    meta: [
      { title: "Sirpam 3D Labs Mold — turn any 3D model into a print-ready mold" },
      {
        name: "description",
        content:
          "Upload an STL or OBJ, get a suggested parting plane with auto sprues, vents and pins, and export print-ready two-part mold halves — all in your browser.",
      },
      { property: "og:title", content: "Sirpam 3D Labs Mold — turn any 3D model into a print-ready mold" },
      {
        property: "og:description",
        content:
          "Upload an STL, get a print-ready two-part mold with auto sprues, vents and pins — designed in your browser.",
      },
      { property: "og:url", content: "/" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: "https://mold.sirpam3dlabs.in/og-image.png" },
      { name: "twitter:image", content: "https://mold.sirpam3dlabs.in/og-image.png" },
    ],
  }),
  component: LandingPage,
});

const PROOF = [
  { k: "STL · OBJ · 3MF · STEP", v: "Files you can open" },
  { k: "In your browser", v: "Models stay on your computer" },
  { k: "2, 3 or 4 parts", v: "Straight, angled or curved splits" },
  { k: "India workshop", v: "Printed and shipped from Tamil Nadu" },
];

const STEPS = [
  { n: "01", title: "Load", body: "Drop an STL, OBJ, 3MF or STEP file, or describe a shape to the AI model maker." },
  { n: "02", title: "Split", body: "Accept the suggested parting plane or drag it. The seam previews live in 3D." },
  { n: "03", title: "Check", body: "Mold Doctor flags trapped air, undercuts and thin walls before you print." },
  { n: "04", title: "Build", body: "Halves come out with pour hole, vents and alignment keys, ready to export." },
  { n: "05", title: "Pour", body: "Print the halves, follow the workshop sheet, and cast." },
];

const MATERIALS = ["Platinum silicone", "Tin silicone", "PU resin", "Epoxy", "Plaster", "Concrete", "Candle wax", "Melt and pour soap", "Chocolate"];

const FAQ = [
  { q: "Is it free?", a: "Designing is free. Upload a model, plan the split and preview the mold at no cost. New accounts get 10 welcome credits and 3 free exports every month; after that, exports and pro tools use credit packs." },
  { q: "Does my model leave my computer?", a: "No. All geometry work runs in your browser. Your model is only uploaded if you save it to your private gallery or send it to a print service yourself." },
  { q: "Which printers work?", a: "Any FDM or resin printer can print the mold halves. Material presets set clearance and shrinkage for each casting material." },
  { q: "Can I get STEP files for CAD?", a: "Yes. Export halves as STL, OBJ, 3MF or STEP, so you can keep editing in your own CAD tool." },
  { q: "I don't own a printer. Can you print it?", a: "Yes. Send the mold files on WhatsApp with your city and PIN code. We reply with a price within one working day and ship anywhere in India." },
  { q: "Are the mix ratios on the workshop sheet exact?", a: "No. The sheet gives planning ranges. Always follow the technical data sheet for the exact product you buy." },
];

function LandingPage() {
  const wa = BUSINESS.whatsapp ? `https://wa.me/${BUSINESS.whatsapp}` : "/contact";
  return (
    <div className="neu-page min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main>
        {/* Hero: split, text left, real photo right */}
        <section className="relative overflow-hidden border-b border-border">
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:32px_32px]" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-6 py-14 md:grid-cols-[1.05fr_1fr] md:py-20">
            <div>
              <p className="mb-5 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-primary" /> Mold design software
              </p>
              <h1 className="text-4xl font-bold leading-[1.05] tracking-tight md:text-5xl lg:text-6xl">
                From 3D model to <span className="text-primary">print-ready mold</span> in minutes.
              </h1>
              <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-muted-foreground">
                Pick the split, check for trapped air, and export mold halves with pour hole, vents and keys.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/studio" className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground transition active:scale-[0.98]">
                  Open the studio <ArrowRight size={18} aria-hidden />
                </Link>
                <Link to="/guides" className="rounded-lg border border-border bg-card px-6 py-3 font-semibold transition active:scale-[0.98]">
                  Read the guides
                </Link>
              </div>
            </div>
            <figure className="relative">
              <img
                src={showcase}
                alt="An open two-part 3D-printed duck mold with alignment keys, pour spout and vents, beside the finished yellow cast duck"
                width={1600}
                height={1008}
                fetchPriority="high"
                className="aspect-[8/5] w-full rounded-xl border border-border object-cover shadow-lg"
              />
              <figcaption className="absolute -bottom-4 left-4 rounded-lg border border-border bg-card px-3 py-2 font-mono text-xs shadow-md">
                Two-part mold · printed in PLA · cast in PU resin
              </figcaption>
            </figure>
          </div>
        </section>

        {/* Proof strip */}
        <section aria-label="At a glance" className="border-b border-border">
          <dl className="mx-auto grid max-w-7xl grid-cols-2 divide-border px-6 md:grid-cols-4 md:divide-x">
            {PROOF.map((p) => (
              <div key={p.k} className="py-6 md:px-6 first:md:pl-0">
                <dt className="font-mono text-sm font-semibold">{p.k}</dt>
                <dd className="mt-1 text-sm text-muted-foreground">{p.v}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Capabilities bento */}
        <section className="mx-auto max-w-7xl px-6 py-20">
          <h2 className="max-w-2xl text-3xl font-bold tracking-tight md:text-4xl">The parts of mold making that usually go wrong, handled.</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-6">
            <article className="rounded-xl bg-primary p-7 text-primary-foreground md:col-span-4 md:row-span-2">
              <Scissors size={28} aria-hidden />
              <h3 className="mt-6 text-2xl font-bold">Parting that follows the shape</h3>
              <p className="mt-3 max-w-[48ch] opacity-90">
                The studio tests every axis and suggests the split along the widest outline. Use straight, angled or curved seams, or cut into 3 or 4 pieces for wide parts.
              </p>
              <ul className="mt-6 grid gap-2 font-mono text-sm sm:grid-cols-2">
                <li>Widest-outline search</li><li>Angled and curved splits</li><li>3 and 4 part molds</li><li>Hug and box shells</li>
              </ul>
            </article>
            <article className="rounded-xl border border-border bg-card p-6 md:col-span-2">
              <Droplet size={24} className="text-primary" aria-hidden />
              <h3 className="mt-4 text-lg font-semibold">Pour hole, vents, keys</h3>
              <p className="mt-2 text-sm text-muted-foreground">Placed automatically, with core pins and clamp seats when you need them.</p>
            </article>
            <article className="rounded-xl border border-border bg-card p-6 md:col-span-2">
              <Wrench size={24} className="text-primary" aria-hidden />
              <h3 className="mt-4 text-lg font-semibold">Mesh repair and draft</h3>
              <p className="mt-2 text-sm text-muted-foreground">Closes holes, flips inside-out faces and adds 0.5 to 3 degree draft.</p>
            </article>
            <article className="rounded-xl border border-border bg-muted p-6 md:col-span-3">
              <ScanSearch size={24} className="text-primary" aria-hidden />
              <h3 className="mt-4 text-lg font-semibold">Mold Doctor</h3>
              <p className="mt-2 text-sm text-muted-foreground">Paints faces that will lock or tear in red and pins trapped air. Runs on your device for free.</p>
            </article>
            <article className="rounded-xl border border-border bg-muted p-6 md:col-span-3">
              <FileDown size={24} className="text-primary" aria-hidden />
              <h3 className="mt-4 text-lg font-semibold">Exports for any workflow</h3>
              <p className="mt-2 text-sm text-muted-foreground">STL and 3MF for slicers, STEP for CAD. Multi-cavity layouts for small batches.</p>
            </article>
          </div>
        </section>

        {/* Process: horizontal timeline */}
        <section className="border-y border-border bg-card">
          <div className="mx-auto max-w-7xl px-6 py-20">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">How a mold gets made</h2>
            <ol className="relative mt-12 grid gap-8 md:grid-cols-5 md:gap-6">
              <span aria-hidden className="absolute left-0 right-0 top-5 hidden h-px bg-border md:block" />
              {STEPS.map((s) => (
                <li key={s.n} className="relative">
                  <span className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background font-mono text-sm font-semibold text-primary">{s.n}</span>
                  <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Workshop sheet: split with materials */}
        <section className="mx-auto grid max-w-7xl gap-12 px-6 py-20 md:grid-cols-2 md:items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">A printable sheet for the workshop floor</h2>
            <p className="mt-4 max-w-[55ch] leading-relaxed text-muted-foreground">
              Every mold comes with one A4 page: grams to mix, Part A and Part B split, silicone needed, printer settings and a pour checklist. Warm-workshop cautions are included for Indian summers.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {["Weights from the actual cavity volume", "Working ranges at 25 °C, with heat warnings", "Always defers to your product's data sheet"].map((t) => (
                <li key={t} className="flex gap-3"><Check size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden />{t}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-card p-6 shadow-md">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">Material presets</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {MATERIALS.map((m) => (
                <span key={m} className="rounded-full border border-border bg-background px-3 py-1.5 text-sm">{m}</span>
              ))}
            </div>
            <p className="mt-6 border-t border-border pt-4 text-sm text-muted-foreground">
              Each preset sets clearance, shrinkage and release advice for that material.
            </p>
          </div>
        </section>

        {/* Print with us band */}
        <section className="mx-auto max-w-7xl px-6">
          <div className="grid gap-6 rounded-xl bg-foreground p-8 text-background md:grid-cols-[1fr_auto] md:items-center md:p-12">
            <div>
              <h2 className="text-2xl font-bold md:text-3xl">No printer? We print it for you.</h2>
              <p className="mt-2 max-w-[60ch] opacity-80">
                Send your mold files with your city and PIN code. Price within one working day, shipped anywhere in India.
              </p>
            </div>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground transition active:scale-[0.98]">
              <MessageCircle size={18} aria-hidden /> Message on WhatsApp
            </a>
          </div>
        </section>

        {/* FAQ: two-column */}
        <section className="mx-auto grid max-w-7xl gap-10 px-6 py-20 md:grid-cols-[1fr_2fr]">
          <div>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Questions</h2>
            <p className="mt-3 text-muted-foreground">
              Something else? <Link to="/help" className="text-primary underline-offset-4 hover:underline">Visit the help page</Link>.
            </p>
          </div>
          <div className="divide-y divide-border border-y border-border">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  {f.q}
                  <Plus size={18} aria-hidden className="shrink-0 text-primary transition group-open:rotate-45" />
                </summary>
                <p className="mt-3 max-w-[65ch] text-sm leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 md:grid-cols-[2fr_1fr_1fr]">
          <div>
            <BrandLink />
            <p className="mt-3 max-w-[40ch] text-sm text-muted-foreground">Mold design software and print service. Prints and dispatches within India only.</p>
          </div>
          <nav aria-label="Product" className="flex flex-col gap-2 text-sm">
            <Link to="/studio">Studio</Link>
            <Link to="/pricing">Pricing</Link>
            <Link to="/guides">Guides</Link>
            <Link to="/gallery">Gallery</Link>
          </nav>
          <div className="flex flex-col gap-2 text-sm">
            {BUSINESS.whatsapp && <a href={wa} target="_blank" rel="noopener noreferrer" className="text-primary">WhatsApp +91 {BUSINESS.whatsapp.slice(2)}</a>}
            <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>
            <Link to="/shop">Print service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
