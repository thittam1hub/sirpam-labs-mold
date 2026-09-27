import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
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

type Maker = { name: string; url: string; kind: "print" | "cast"; services: string; pricing: string; formats: string; order: string; region: string; sizes?: [string, string, string]; email?: string };

// Researched Sep 2026 from each company's public pages. Prices are advertised / approximate.
const MAKERS: Maker[] = [
  { name: "Craftcloud", url: "https://craftcloud3d.com/en/upload", kind: "print", services: "Compares 150+ print shops: FDM, resin, SLS, MJF, metal", pricing: "Instant price comparison, no minimum order", formats: "STL, OBJ, STEP, 3MF (up to 500 MB)", order: "Upload online, no account needed", region: "Global", sizes: ["$8–20", "$25–60", "$90–250"] },
  { name: "JLC3DP", url: "https://jlc3dp.com/3d-printing-quote", kind: "print", services: "Resin (SLA), nylon (MJF/SLS), FDM, metal", pricing: "Resin from ~$0.30, nylon from ~$1 per part", formats: "STL, STEP, OBJ, 3MF (100 MB)", order: "Sign up, upload, instant quote", region: "China, ships worldwide", sizes: ["$3–8", "$12–35", "$50–150"] },
  { name: "PCBWay", url: "https://www.pcbway.com/rapid-prototyping/3d-printing/", kind: "cast", services: "FDM, resin, SLS, metal, plus vacuum casting (silicone molds)", pricing: "Instant price for most materials; casting reviewed by hand", formats: "STL, OBJ, STEP", order: "Upload online, or email 3dcnc@pcbway.com", region: "China, ships worldwide", sizes: ["$5–12", "$18–45", "$70–200"], email: "3dcnc@pcbway.com" },
  { name: "Xometry", url: "https://www.xometry.com/capabilities/3d-printing-service/", kind: "cast", services: "All print types, plus urethane casting and injection molding", pricing: "Instant quote in seconds", formats: "STEP, STL, 3MF and many CAD formats", order: "Create account, drag and drop file", region: "US, Europe, Asia", sizes: ["$25–50", "$60–150", "$200–600"] },
  { name: "Treatstock", url: "https://www.treatstock.com/order-upload", kind: "print", services: "Network of independent local print shops", pricing: "Instant quote; FDM cheapest, metal most expensive", formats: "STL, OBJ, 3MF, PLY", order: "Upload and pick a nearby shop", region: "Global", sizes: ["$6–15", "$20–55", "$80–220"] },
  { name: "Shapeways", url: "https://www.shapeways.com/upload-3d-print-files-models", kind: "print", services: "Nylon, resin, steel and lost-wax cast precious metals", pricing: "Instant quote", formats: "STL, OBJ, 3MF, STEP (64 MB)", order: "Log in, upload, instant quote", region: "US / EU, ships worldwide", sizes: ["$15–35", "$45–120", "$180–500"] },
  { name: "Protolabs Network (Hubs)", url: "https://www.hubs.com/3d-printing/", kind: "print", services: "FDM, SLS, MJF, resin via vetted partners", pricing: "Final price incl. shipping at upload, held 30 days", formats: "STL, OBJ, STEP, IGES", order: "Upload, instant quote, pay by card", region: "Europe, North America", sizes: ["$20–45", "$55–140", "$200–550"] },
  { name: "Sculpteo", url: "https://www.sculpteo.com/en/pricing/price-and-delivery/", kind: "print", services: "FDM, resin, SLS, MJF", pricing: "Live price; Economy / Standard / Fast speeds", formats: "STL and common 3D formats", order: "Create account, upload", region: "France, ships worldwide", sizes: ["$15–35", "$45–120", "$170–480"] },
  { name: "Fictiv", url: "https://www.fictiv.com/capabilities/urethane-casting-services", kind: "cast", services: "Urethane casting from silicone molds (they make the mold)", pricing: "Instant quote, no minimum; parts in ~7–10 days", formats: "STEP, STL, IGES", order: "Upload online", region: "US + overseas partners", sizes: ["$30–60", "$70–180", "$250–700"] },
  { name: "Unionfab", url: "https://www.unionfab.com/services/3d-printing", kind: "cast", services: "All print types plus urethane casting", pricing: "Instant quote, no minimum, first-order discount", formats: "STEP, STL, IGES, OBJ", order: "Upload, no account needed for a quote", region: "China, ships worldwide", sizes: ["$4–10", "$15–40", "$60–180"] },
];

function ShopPage() {
  const [pick, setPick] = useState(MAKERS[0]!.name);
  return (
    <div className="neu-page min-h-screen bg-background text-foreground">
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
              {m.sizes && (
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  {(["Small ~5 cm", "Medium ~10 cm", "Large ~20 cm"] as const).map((l, i) => (
                    <div key={l} className="rounded-lg bg-muted p-2"><div className="text-muted-foreground">{l}</div><div className="font-semibold">{m.sizes![i]}</div></div>
                  ))}
                </div>
              )}
              <a href="#send" onClick={() => setPick(m.name)} className="mr-2 mt-4 inline-block rounded-lg border border-border px-4 py-2 text-sm font-semibold">Send my project</a>
              <a href={m.url} target="_blank" rel="noreferrer" className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                Get a quote ↗
              </a>
            </article>
          ))}
        </div>
        <SendForm pick={pick} setPick={setPick} />
        <p className="mt-6 text-xs text-muted-foreground">Price per size is our estimate for one two-part mold printed in the cheapest suitable plastic (resin or PLA-like), before shipping — not a quote. Prices are what each company advertises and change often — the real price comes from their instant quote. Sirpam isn't affiliated with these companies.</p>
      </main>
    </div>
  );
}

const SIZES = ["Small (~5 cm)", "Medium (~10 cm)", "Large (~20 cm)"];

function SendForm({ pick, setPick }: { pick: string; setPick: (v: string) => void }) {
  const [session, setSession] = useState<Session | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [qty, setQty] = useState("1");
  const [size, setSize] = useState(SIZES[1]!);
  const [material, setMaterial] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ link: string | null } | null>(null);
  const maker = MAKERS.find((m) => m.name === pick) ?? MAKERS[0]!;

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    return () => data.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    const q = parseInt(qty, 10);
    if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email) || !(q > 0 && q <= 10000)) { setErr("Please fill in your name, a valid email and a quantity."); return; }
    if (file && file.size > 50 * 1024 * 1024) { setErr("The file is bigger than 50 MB."); return; }
    setBusy(true); setErr(null);
    try {
      let path: string | null = null;
      if (file) {
        path = `${session.user.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
        const { error } = await supabase.storage.from("project-files").upload(path, file);
        if (error) throw error;
      }
      const { error } = await supabase.from("quote_requests").insert({
        maker: maker.name, contact_name: name.trim().slice(0, 120), contact_email: email.trim().slice(0, 200),
        quantity: q, size_class: size, casting_material: material.trim().slice(0, 120) || null,
        notes: notes.trim().slice(0, 2000) || null, project_path: path,
      });
      if (error) throw error;
      let link: string | null = null;
      if (path) {
        const { data } = await supabase.storage.from("project-files").createSignedUrl(path, 60 * 60 * 24 * 7);
        link = data?.signedUrl ?? null;
      }
      setDone({ link });
    } catch (x) { setErr(x instanceof Error ? x.message : "Could not send"); }
    setBusy(false);
  };

  const body = encodeURIComponent(
    `Hello ${maker.name},\n\nI'd like a quote for a mold.\nQuantity: ${qty}\nSize: ${size}\nCasting material: ${material || "-"}\n${notes ? `Notes: ${notes}\n` : ""}${done?.link ? `Project file (link valid 7 days): ${done.link}\n` : ""}\nThanks,\n${name}\n${email}`,
  );
  const inp = "rounded-lg border border-input bg-background px-3 py-2 text-sm";

  return (
    <section id="send" className="mt-8 rounded-2xl border border-border bg-card p-5">
      <h2 className="text-lg font-semibold">Send my project to a mold maker</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Attach your exported STL/STEP ZIP (best — every service accepts it) or your .sirpam.json project. We save the request and give you a private download link to pass on.
      </p>
      {!session ? (
        <a href="/auth" className="mt-3 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Sign in to send a request</a>
      ) : done ? (
        <div className="mt-3 space-y-2 text-sm">
          <p><b>Request saved.</b> Last step — send it to {maker.name}:</p>
          <div className="flex flex-wrap gap-2">
            {maker.email && <a className="rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground" href={`mailto:${maker.email}?subject=${encodeURIComponent("Mold quote request")}&body=${body}`}>Email {maker.name}</a>}
            <a className="rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground" href={maker.url} target="_blank" rel="noreferrer">Open {maker.name} upload page ↗</a>
            <button className="rounded-lg border border-border px-4 py-2" onClick={() => navigator.clipboard.writeText(decodeURIComponent(body))}>Copy request text</button>
            <button className="rounded-lg border border-border px-4 py-2" onClick={() => setDone(null)}>New request</button>
          </div>
          {done.link && <p className="break-all text-xs text-muted-foreground">Private file link (7 days): {done.link}</p>}
        </div>
      ) : (
        <form onSubmit={submit} className="mt-3 grid gap-3 md:grid-cols-2">
          <select value={maker.name} onChange={(e) => setPick(e.target.value)} className={inp} aria-label="Mold maker">
            {MAKERS.map((m) => <option key={m.name}>{m.name}</option>)}
          </select>
          <select value={size} onChange={(e) => setSize(e.target.value)} className={inp} aria-label="Mold size">
            {SIZES.map((z) => <option key={z}>{z}</option>)}
          </select>
          <input required maxLength={120} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} className={inp} />
          <input required type="email" maxLength={200} placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} className={inp} />
          <input type="number" min={1} max={10000} placeholder="How many" value={qty} onChange={(e) => setQty(e.target.value)} className={inp} aria-label="Quantity" />
          <input maxLength={120} placeholder="Casting material (e.g. resin, wax, chocolate)" value={material} onChange={(e) => setMaterial(e.target.value)} className={inp} />
          <textarea maxLength={2000} placeholder="Notes: finish, colour, deadline…" value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inp} min-h-20 md:col-span-2`} />
          <input type="file" accept=".json,.sirpam,.zip,.stl,.step,.stp,.3mf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" aria-label="Project file" />
          <button disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{busy ? "Sending…" : `Send to ${maker.name}`}</button>
          {err && <p className="text-sm text-destructive md:col-span-2">{err}</p>}
        </form>
      )}
    </section>
  );
}
