import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandLink } from "@/components/BrandLink";
import { LegalFooter } from "@/components/LegalFooter";

export const Route = createFileRoute("/help")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Help & guides — Sirpam 3D Labs Mold" },
      { name: "description", content: "Step-by-step guide to making a printable two-part mold, print settings and casting tips." },
      { property: "og:title", content: "Help & guides — Sirpam 3D Labs Mold" },
      { property: "og:description", content: "How to make a mold, print it and cast it." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HelpPage,
});

const sections = [
  {
    title: "1. Prepare your model",
    body: "Open the Mold Maker and drop in an STL or OBJ file. If the model is broken (holes, flipped faces), use Repair in the Model step — the tool fixes it automatically and tells you what it changed. Set the final size with Scale & rotate, and pick your printer so the tool can warn you if the mold won't fit your bed.",
  },
  {
    title: "2. Choose the split",
    body: "In the Orient step, pick which way the mold opens. The split line preview shows exactly where the two halves meet. 'Best split' tests many directions and suggests the one with the fewest trapped undercuts. Drag the parting plane in 3D to fine-tune it.",
  },
  {
    title: "3. Set the mold details",
    body: "In the Mold step, choose the mold type (hard printed mold, silicone block, relief tray, press or slip-cast), the wall thickness, the fit gap (0.2 mm suits most home printers), the pour hole size, air vents and the casting material. The casting material sets shrink compensation automatically.",
  },
  {
    title: "4. Pro features",
    body: "The Pro step adds lock styles (round pin, cone key, square key or magnet pockets), clamp wings, stand fins, multi-cavity trays, hollow casts and split into 3 or 4 pieces. Leave everything on Auto and the mold comes out exactly as before.",
  },
  {
    title: "5. Export and print",
    body: "In the Finish step, export both halves as STL (1 credit), or 3MF/STEP (2 credits). Print the halves flat side down, 3–4 walls, 20–40% infill. PETG or ABS/ASA handle resin exotherm better than PLA. No supports needed — the mold is designed to print without them.",
  },
  {
    title: "6. Casting tips",
    body: "Seal FDM molds with a coat of the same resin or a mold sealer so casts release cleanly. Pour slowly at the lowest point, tap the mold to bring bubbles up, and let the vents do their job. For silicone molds, degas if you can and pour in a thin stream.",
  },
];

function HelpPage() {
  return (
    <div className="neu-page min-h-screen bg-background text-foreground">
      <header className="mx-auto flex min-h-16 max-w-4xl items-center gap-4 bg-background px-6 py-3 text-sm">
        <BrandLink />
        <div className="flex-1" />
        <Link to="/studio">Mold Maker</Link>
        <Link to="/pricing">Pricing</Link>
      </header>
      <main className="mx-auto max-w-2xl px-6 pb-16">
        <h1 className="text-3xl font-bold">Help & guides</h1>
        <p className="mt-2 text-muted-foreground">From a 3D model to a finished cast, step by step.</p>
        <div className="mt-6 space-y-4">
          {sections.map((s) => (
            <section key={s.title} className="rounded-3xl bg-card p-6 shadow-sm">
              <h2 className="text-lg font-semibold">{s.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
            </section>
          ))}
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          Still stuck? <Link to="/contact" className="text-primary">Contact us</Link>.
        </p>
      </main>
      <LegalFooter />
    </div>
  );
}
