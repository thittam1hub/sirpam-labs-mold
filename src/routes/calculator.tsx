import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { LegalFooter } from "@/components/LegalFooter";
import { Button } from "@/components/ui/button";
import { CASTING_MATERIALS } from "@/moldmaker/utils/tier2";
import {
  HANDLING_ALLOWANCE,
  SILICONE_MOLD_DENSITY_G_CM3,
  SILICONE_MOLD_WALL_MM,
  WORKSHOP_MATERIAL_PROFILES,
  splitByWeight,
  temperatureGuidance,
} from "@/moldmaker/utils/workshopDefaults";

const TITLE = "Silicone & Resin Calculator — How Much to Mix | Sirpam 3D Labs";
const DESC =
  "Free mold material calculator: work out grams of silicone, resin, plaster or wax for a box mold or a casting, split Part A and Part B by weight, and estimate cost in rupees.";

export const Route = createFileRoute("/calculator")({
  staticData: { sitemap: true },
  head: () => ({
    links: [{ rel: "canonical", href: "/calculator" }],
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: "/calculator" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Mold material calculator",
          applicationCategory: "UtilitiesApplication",
          operatingSystem: "Any (web browser)",
          offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
          description: DESC,
        }),
      },
    ],
  }),
  component: CalculatorPage,
});

type Mode = "box" | "cast";
const SILICONE = { id: "silicone_mold", label: "Mold silicone (platinum or tin)", density: SILICONE_MOLD_DENSITY_G_CM3 };
const RATIOS: { label: string; v: [number, number] | null }[] = [
  { label: "Not sure / check TDS", v: null },
  { label: "1 : 1", v: [1, 1] },
  { label: "10 : 1", v: [10, 1] },
  { label: "100 : 5", v: [100, 5] },
  { label: "2 : 1", v: [2, 1] },
  { label: "100 : 70 (plaster)", v: [100, 70] },
];

function num(v: string) {
  const n = parseFloat(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function Field({ label, value, onChange, suffix, hint }: { label: string; value: string; onChange: (v: string) => void; suffix?: string; hint?: string }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <span className="flex items-center rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
        <input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-transparent px-3 py-2 tabular-nums outline-none" />
        {suffix && <span className="px-3 text-xs text-muted-foreground">{suffix}</span>}
      </span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

function CalculatorPage() {
  const [mode, setMode] = useState<Mode>("box");
  const [L, setL] = useState("80");
  const [W, setW] = useState("60");
  const [H, setH] = useState("40");
  const [wall, setWall] = useState(String(SILICONE_MOLD_WALL_MM));
  const [modelVol, setModelVol] = useState("60");
  const [castVol, setCastVol] = useState("60");
  const [materialId, setMaterialId] = useState<string>("pu_resin");
  const [ratioIdx, setRatioIdx] = useState(0);
  const [allowance, setAllowance] = useState(String(HANDLING_ALLOWANCE * 100));
  const [pricePerKg, setPricePerKg] = useState("");
  const [temp, setTemp] = useState(30);

  const material = mode === "box" ? SILICONE : CASTING_MATERIALS.find((m) => m.id === materialId) ?? CASTING_MATERIALS[0];

  const r = useMemo(() => {
    const w = num(wall);
    const boxL = num(L) + 2 * w, boxW = num(W) + 2 * w, boxH = num(H) + 2 * w;
    const boxCm3 = (boxL * boxW * boxH) / 1000;
    const volCm3 = mode === "box" ? Math.max(0, boxCm3 - num(modelVol)) : num(castVol);
    const grams = volCm3 * material.density;
    const total = grams * (1 + num(allowance) / 100);
    const ratio = RATIOS[ratioIdx].v ?? (mode === "cast" ? WORKSHOP_MATERIAL_PROFILES[materialId as keyof typeof WORKSHOP_MATERIAL_PROFILES]?.mixByWeight ?? null : null);
    const split = splitByWeight(total, ratio);
    const cost = num(pricePerKg) > 0 ? (total / 1000) * num(pricePerKg) : null;
    return { boxL, boxW, boxH, volCm3, grams, total, split, ratio, cost };
  }, [mode, L, W, H, wall, modelVol, castVol, material, allowance, ratioIdx, materialId, pricePerKg]);

  const castProfile = mode === "cast" ? CASTING_MATERIALS.find((m) => m.id === materialId) : null;
  const fmt = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

  return (
    <div className="neu-page min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Free workshop tool</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Silicone and resin calculator</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Work out how much to mix before you open the tins. Enter your model size or casting volume, pick a material, and get grams, a Part A / Part B split and an estimated cost.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
          <section aria-label="Inputs" className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <div role="tablist" aria-label="What are you pouring?" className="inline-flex rounded-lg border border-border p-1">
              {([["box", "Mold silicone (box mold)"], ["cast", "Casting material"]] as const).map(([k, label]) => (
                <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${mode === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  {label}
                </button>
              ))}
            </div>

            {mode === "box" ? (
              <div className="mt-6 grid gap-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Master model size</h2>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Length" value={L} onChange={setL} suffix="mm" />
                  <Field label="Width" value={W} onChange={setW} suffix="mm" />
                  <Field label="Height" value={H} onChange={setH} suffix="mm" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Silicone wall around the model" value={wall} onChange={setWall} suffix="mm" hint="10 mm is a common starting point; go thicker for concrete or large parts." />
                  <Field label="Model volume" value={modelVol} onChange={setModelVol} suffix="cm³" hint="From your slicer or CAD, or by water displacement (1 ml = 1 cm³)." />
                </div>
              </div>
            ) : (
              <div className="mt-6 grid gap-4">
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">Material</span>
                  <select value={materialId} onChange={(e) => setMaterialId(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2">
                    {CASTING_MATERIALS.map((m) => <option key={m.id} value={m.id}>{m.label} ({m.density} g/cm³)</option>)}
                  </select>
                </label>
                <Field label="Casting volume" value={castVol} onChange={setCastVol} suffix="cm³" hint="The part's volume, or fill the mold with water and measure it." />
              </div>
            )}

            <div className="mt-6 grid gap-4 border-t border-border pt-6 sm:grid-cols-3">
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Mix ratio by weight</span>
                <select value={ratioIdx} onChange={(e) => setRatioIdx(Number(e.target.value))} className="rounded-md border border-input bg-background px-3 py-2">
                  {RATIOS.map((x, i) => <option key={x.label} value={i}>{x.label}</option>)}
                </select>
              </label>
              <Field label="Extra for cup and spills" value={allowance} onChange={setAllowance} suffix="%" />
              <Field label="Price (optional)" value={pricePerKg} onChange={setPricePerKg} suffix="₹ / kg" hint="What you pay your supplier." />
            </div>

            <label className="mt-6 grid gap-2 text-sm">
              <span className="flex justify-between font-medium"><span>Workshop temperature</span><span className="tabular-nums">{temp} °C</span></span>
              <input type="range" min={15} max={45} value={temp} onChange={(e) => setTemp(Number(e.target.value))} className="accent-primary" />
              <span className="text-xs text-muted-foreground">{temperatureGuidance(temp)}</span>
            </label>
          </section>

          <aside aria-label="Results" className="h-fit rounded-xl border border-border bg-card p-5 sm:p-6 lg:sticky lg:top-20">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Mix this much</p>
            <p className="mt-1 text-5xl font-bold tabular-nums">{fmt(r.total)}<span className="ml-1 text-xl font-medium text-muted-foreground">g</span></p>
            <p className="mt-1 text-sm text-muted-foreground">{material.label}</p>

            <dl className="mt-6 divide-y divide-border text-sm">
              {mode === "box" && <Row k="Mold box inside" v={`${fmt(r.boxL)} × ${fmt(r.boxW)} × ${fmt(r.boxH)} mm`} />}
              <Row k="Volume to fill" v={`${r.volCm3.toLocaleString("en-IN", { maximumFractionDigits: 1 })} cm³`} />
              <Row k="Weight before extra" v={`${fmt(r.grams)} g`} />
              {r.split ? (
                <>
                  <Row k="Part A" v={`${fmt(r.split[0])} g`} strong />
                  <Row k="Part B" v={`${fmt(r.split[1])} g`} strong />
                </>
              ) : (
                <Row k="Part A / Part B" v="Pick the ratio from your TDS" />
              )}
              {r.cost !== null && <Row k="Estimated cost" v={`₹${fmt(r.cost)}`} strong />}
            </dl>

            {castProfile && (
              <p className="mt-4 rounded-md bg-muted p-3 text-xs text-muted-foreground">
                <b className="text-foreground">Tip:</b> {castProfile.notes} Typical demold: {castProfile.demold}.
              </p>
            )}

            <Button asChild className="mt-6 w-full"><Link to="/studio">Design this mold in Studio</Link></Button>
            <p className="mt-3 text-xs text-muted-foreground">Planning numbers only. Your product's data sheet (TDS) is always right about ratio and timing.</p>
          </aside>
        </div>

        <section className="mt-14 grid gap-8 md:grid-cols-3">
          <Explain h="How the box mold number works">
            We add your wall thickness on every side of the model to get the box, take the box volume, subtract the model, and multiply by about {SILICONE_MOLD_DENSITY_G_CM3} g/cm³ for silicone.
          </Explain>
          <Explain h="Why mix extra">
            Some material always stays on the cup, the stick and the walls of the mixing pot. About {HANDLING_ALLOWANCE * 100}% extra stops you running short halfway through a pour.
          </Explain>
          <Explain h="Hot workshops">
            In Indian summers above 30 °C, resin and silicone thicken faster. Mix smaller batches, keep tins in the shade, and pour soon after mixing.
          </Explain>
        </section>
        <LegalFooter />
      </main>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className={`text-right tabular-nums ${strong ? "font-semibold" : ""}`}>{v}</dd>
    </div>
  );
}

function Explain({ h, children }: { h: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-semibold">{h}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
