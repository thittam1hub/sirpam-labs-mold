import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { LegalFooter } from "@/components/LegalFooter";
import { MessageCircle, ExternalLink } from "lucide-react";
import { BUSINESS } from "@/lib/business";
import { trackEvent } from "@/components/Analytics";

export const Route = createFileRoute("/shop")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Printing & Casting Service — Sirpam 3D Labs Mold" },
      { name: "description", content: "Sirpam 3D Labs prints your mold and casts your parts. Designed here, printed in our workshop, delivered across India." },
      { property: "og:title", content: "Printing & Casting Service — Sirpam 3D Labs Mold" },
      { property: "og:description", content: "We print your mold and cast your parts in our own workshop. Delivered across India." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: "https://mold.sirpam3dlabs.in/og-image.png" },
      { name: "twitter:image", content: "https://mold.sirpam3dlabs.in/og-image.png" },
    ],
  }),
  component: ShopPage,
});

const SERVICES = [
  {
    name: "Mold printing (FDM)",
    blurb: "Your two-part mold printed in tough plastic — the everyday choice for casting wax, plaster, soap and concrete.",
    good: "Molds up to roughly 25 cm, sturdy and low cost",
    materials: "PLA+, PETG, ABS",
  },
  {
    name: "Mold printing (Resin)",
    blurb: "Fine-detail resin printing when the cast part must show crisp lines, lettering or delicate texture.",
    good: "Jewellery, idols, miniatures, detailed keepsakes",
    materials: "Standard, tough and high-temperature resin",
  },
  {
    name: "Silicone molds",
    blurb: "We print the master and pour a food-safe or industrial silicone mold you can reuse hundreds of times.",
    good: "Candles, soap, chocolate, resin art, repeat batches",
    materials: "Platinum and tin-cure silicone",
  },
  {
    name: "Cast parts made for you",
    blurb: "Don't want to cast at all? Send the design and we deliver the finished pieces, ready to use or sell.",
    good: "Small production runs, gifts, retail stock",
    materials: "Resin, wax, plaster, concrete, soap",
  },
];

const STEPS = [
  "Design your mold in the Studio and finish it (Step 4).",
  "Press \"Request a quote\" — your sizes and material volume reach our workshop.",
  "We reply on WhatsApp within 1 working day with the final price, GST and delivery date.",
  "Pay, we print and cast, and courier it anywhere in India with a tracking number.",
];

function ShopPage() {
  const wa = BUSINESS.whatsapp
    ? `https://wa.me/${BUSINESS.whatsapp}?text=${encodeURIComponent("Hi Sirpam 3D Labs, I'd like a quote for printing a mold.")}`
    : null;

  return (
    <div className="neu-page min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="text-3xl font-bold">We print and cast it for you</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          No printer? No problem. Design your mold here and our own workshop prints it, casts it, and delivers it.
          We print and deliver within India only.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link to="/studio" className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
            Design your mold
          </Link>
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackEvent("whatsapp_contact_clicked", { stage: "shop_page" })}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-semibold"
            >
              <MessageCircle aria-hidden size={16} /> Ask for a price on WhatsApp
            </a>
          )}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {SERVICES.map((s) => (
            <article key={s.name} className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-lg font-semibold">{s.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{s.blurb}</p>
              <dl className="mt-3 grid grid-cols-[92px_1fr] gap-y-1 text-sm">
                <dt className="text-muted-foreground">Best for</dt><dd>{s.good}</dd>
                <dt className="text-muted-foreground">Materials</dt><dd>{s.materials}</dd>
              </dl>
            </article>
          ))}
        </div>

        <section className="mt-8 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">How ordering works</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
            {STEPS.map((s) => <li key={s}>{s}</li>)}
          </ol>
          <p className="mt-3 text-sm text-muted-foreground">
            Already have your own printer? Use <b>Finish, then Export</b> in the Studio to download the mold halves as STL or STEP files — they're yours to keep, free.
          </p>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">What a job costs</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Price depends on mold size, material and how many copies you need. The Studio shows a rough material
              estimate in ₹; the final quote adds GST, labour and delivery and always comes from us on WhatsApp first —
              nothing is charged automatically.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">Our main store</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Finished 3D printed products, casting supplies and more are on our main site.
            </p>
            <a
              href="https://sirpam3dlabs.in"
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold"
            >
              Visit sirpam3dlabs.in <ExternalLink aria-hidden size={15} />
            </a>
          </div>
        </section>

        <p className="mt-6 text-xs text-muted-foreground">
          Printing, casting and delivery are offered within India only. Bulk and business orders welcome — mention your
          GSTIN when you ask for a quote and we'll raise a GST invoice.
        </p>
      </main>
      <LegalFooter />
    </div>
  );
}
