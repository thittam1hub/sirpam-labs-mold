import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "Mold & Print Services — Sirpam 3D Labs Mold" },
      { name: "description", content: "Online 3D printing and silicone/urethane casting services, their pricing, and how to send them your mold files." },
      { property: "og:title", content: "Mold & Print Services — Sirpam 3D Labs Mold" },
      { property: "og:description", content: "Where to get your mold printed or cast, with pricing and ordering steps." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ShopPage,
});

type Maker = { name: string; url: string; kind: "print" | "cast"; services: string; pricing: string; formats: string; order: string; region: string };

// Researched Sep 2026 from each company's public pages. Prices are advertised / approximate.
const MAKERS: Maker[] = [
  { name: "Craftcloud", url: "https://craftcloud3d.com/en/upload", kind: "print", services: "Compares 150+ print shops: FDM, resin, SLS, MJF, metal", pricing: "Instant price comparison, no minimum order", formats: "STL, OBJ, STEP, 3MF (up to 500 MB)", order: "Upload online, no account needed", region: "Global" },
  { name: "JLC3DP", url: "https://jlc3dp.com/3d-printing-quote", kind: "print", services: "Resin (SLA), nylon (MJF/SLS), FDM, metal", pricing: "Resin from ~$0.30, nylon from ~$1 per part", formats: "STL, STEP, OBJ, 3MF (100 MB)", order: "Sign up, upload, instant quote", region: "China, ships worldwide" },
  { name: "PCBWay", url: "https://www.pcbway.com/rapid-prototyping/3d-printing/", kind: "cast", services: "FDM, resin, SLS, metal, plus vacuum casting (silicone molds)", pricing: "Instant price for most materials; casting reviewed by hand", formats: "STL, OBJ, STEP", order: "Upload online, or email 3dcnc@pcbway.com", region: "China, ships worldwide" },
  { name: "Xometry", url: "https://www.xometry.com/capabilities/3d-printing-service/", kind: "cast", services: "All print types, plus urethane casting and injection molding", pricing: "Instant quote in seconds", formats: "STEP, STL, 3MF and many CAD formats", order: "Create account, drag and drop file", region: "US, Europe, Asia" },
  { name: "Treatstock", url: "https://www.treatstock.com/order-upload", kind: "print", services: "Network of independent local print shops", pricing: "Instant quote; FDM cheapest, metal most expensive", formats: "STL, OBJ, 3MF, PLY", order: "Upload and pick a nearby shop", region: "Global" },
  { name: "Shapeways", url: "https://www.shapeways.com/upload-3d-print-files-models", kind: "print", services: "Nylon, resin, steel and lost-wax cast precious metals", pricing: "Instant quote", formats: "STL, OBJ, 3MF, STEP (64 MB)", order: "Log in, upload, instant quote", region: "US / EU, ships worldwide" },
  { name: "Protolabs Network (Hubs)", url: "https://www.hubs.com/3d-printing/", kind: "print", services: "FDM, SLS, MJF, resin via vetted partners", pricing: "Final price incl. shipping at upload, held 30 days", formats: "STL, OBJ, STEP, IGES", order: "Upload, instant quote, pay by card", region: "Europe, North America" },
  { name: "Sculpteo", url: "https://www.sculpteo.com/en/pricing/price-and-delivery/", kind: "print", services: "FDM, resin, SLS, MJF", pricing: "Live price; Economy / Standard / Fast speeds", formats: "STL and common 3D formats", order: "Create account, upload", region: "France, ships worldwide" },
  { name: "Fictiv", url: "https://www.fictiv.com/capabilities/urethane-casting-services", kind: "cast", services: "Urethane casting from silicone molds (they make the mold)", pricing: "Instant quote, no minimum; parts in ~7–10 days", formats: "STEP, STL, IGES", order: "Upload online", region: "US + overseas partners" },
  { name: "Unionfab", url: "https://www.unionfab.com/services/3d-printing", kind: "cast", services: "All print types plus urethane casting", pricing: "Instant quote, no minimum, first-order discount", formats: "STEP, STL, IGES, OBJ", order: "Upload, no account needed for a quote", region: "China, ships worldwide" },
];

function ShopPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center gap-4 border-b border-border px-6 py-4">
        <a href="/" className="font-bold">Sirpam 3D Labs Mold</a>
        <span className="text-muted-foreground">/ Shop</span>
        <div className="flex-1" />
        <a href="/gallery" className="text-sm">Gallery</a>
      </header>
      <main className="mx-auto max-w-6xl p-6">
        <h1 className="text-3xl font-bold">Get your mold made</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          No printer? These online services print your mold halves, or make a silicone mold and cast parts for you.
        </p>

        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">How to send your project</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
            <li><b>Online services (below)</b> don't open <code>.sirpam.json</code> files. In the mold maker, go to the <b>Finish</b> step and choose <b>Export → STL</b> (or STEP for casting shops). Upload the STL files from the ZIP on their site.</li>
            <li><b>A person or local shop</b> who also uses Sirpam: open <b>Projects → Export .sirpam.json</b> and email or share that file. They open it with <b>Projects → Import</b> and get your model and all your settings.</li>
            <li>For casting services, add a note with the casting material, how many copies you need, and a photo of the finished look you want.</li>
          </ol>
        </section>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {MAKERS.map((m) => (
            <article key={m.name} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-lg font-semibold">{m.name}</h3>
                <span className="rounded-full bg-accent px-2 py-0.5 text-xs">{m.kind === "cast" ? "Print + casting" : "3D printing"}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{m.services}</p>
              <dl className="mt-3 grid grid-cols-[90px_1fr] gap-y-1 text-sm">
                <dt className="text-muted-foreground">Price</dt><dd>{m.pricing}</dd>
                <dt className="text-muted-foreground">Files</dt><dd>{m.formats}</dd>
                <dt className="text-muted-foreground">Ordering</dt><dd>{m.order}</dd>
                <dt className="text-muted-foreground">Where</dt><dd>{m.region}</dd>
              </dl>
              <a href={m.url} target="_blank" rel="noreferrer" className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                Get a quote ↗
              </a>
            </article>
          ))}
        </div>
        <p className="mt-6 text-xs text-muted-foreground">Prices are what each company advertises and change often — the real price comes from their instant quote. Sirpam isn't affiliated with these companies.</p>
      </main>
    </div>
  );
}
