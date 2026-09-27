import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "My Mold Gallery — Sirpam 3D Labs Mold" },
      { name: "description", content: "Upload photos and notes of the real molds you've printed and cast." },
      { property: "og:title", content: "My Mold Gallery — Sirpam 3D Labs Mold" },
      { property: "og:description", content: "Photos and notes of your printed molds and casts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GalleryPage,
});

type Item = {
  id: string; title: string; notes: string | null; material: string | null; photo_paths: string[]; created_at: string;
  price_paid: number | null; currency: string | null; size_x_mm: number | null; size_y_mm: number | null; size_z_mm: number | null; source: string | null;
  stl_name: string | null; stl_size: string | null; best_settings: string | null; rating: number | null;
};

/** Box volume in cm³ from the mold's outer size. */
const boxCm3 = (it: Item) =>
  it.size_x_mm && it.size_y_mm && it.size_z_mm ? (Number(it.size_x_mm) * Number(it.size_y_mm) * Number(it.size_z_mm)) / 1000 : null;
const perCm3 = (it: Item) => { const v = boxCm3(it); return v && it.price_paid != null ? Number(it.price_paid) / v : null; };

function GalleryPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [material, setMaterial] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [sx, setSx] = useState(""); const [sy, setSy] = useState(""); const [sz, setSz] = useState("");
  const [source, setSource] = useState("");
  const [stlName, setStlName] = useState(""); const [stlSize, setStlSize] = useState(""); const [best, setBest] = useState(""); const [rating, setRating] = useState(0);
  const [sort, setSort] = useState<"new" | "best" | "perCm3" | "price">("new");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    return () => data.subscription.unsubscribe();
  }, []);

  const load = async () => {
    const { data, error } = await supabase.from("gallery_items").select("*").order("created_at", { ascending: false });
    if (error) return setErr(error.message);
    const list = (data ?? []) as Item[];
    setItems(list);
    const paths = list.flatMap((i) => i.photo_paths);
    if (paths.length) {
      const { data: signed } = await supabase.storage.from("mold-photos").createSignedUrls(paths, 3600);
      const map: Record<string, string> = {};
      signed?.forEach((s) => { if (s.path && s.signedUrl) map[s.path] = s.signedUrl; });
      setUrls(map);
    }
  };

  useEffect(() => { if (session) load(); }, [session]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setBusy(true); setErr(null);
    try {
      const paths: string[] = [];
      for (const f of Array.from(files ?? [])) {
        const path = `${session.user.id}/${crypto.randomUUID()}-${f.name.replace(/[^\w.-]/g, "_")}`;
        const { error } = await supabase.storage.from("mold-photos").upload(path, f, { contentType: f.type });
        if (error) throw error;
        paths.push(path);
      }
      const num = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) && n >= 0 ? n : null; };
      const { error } = await supabase.from("gallery_items").insert({
        title, notes: notes || null, material: material || null, photo_paths: paths,
        price_paid: num(price), currency: currency || null, size_x_mm: num(sx), size_y_mm: num(sy), size_z_mm: num(sz), source: source || null,
        stl_name: stlName.trim() || null, stl_size: stlSize.trim() || null, best_settings: best.trim() || null, rating: rating || null,
      });
      if (error) throw error;
      setTitle(""); setNotes(""); setMaterial(""); setFiles(null); setPrice(""); setSx(""); setSy(""); setSz(""); setSource(""); setStlName(""); setStlSize(""); setBest(""); setRating(0);
      (document.getElementById("photos") as HTMLInputElement | null)?.value && ((document.getElementById("photos") as HTMLInputElement).value = "");
      await load();
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Upload failed");
    }
    setBusy(false);
  };

  const remove = async (it: Item) => {
    if (!confirm(`Delete "${it.title}"?`)) return;
    if (it.photo_paths.length) await supabase.storage.from("mold-photos").remove(it.photo_paths);
    await supabase.from("gallery_items").delete().eq("id", it.id);
    load();
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center gap-4 border-b border-border px-6 py-4">
        <a href="/" className="font-bold">Sirpam 3D Labs Mold</a>
        <span className="text-muted-foreground">/ Gallery</span>
        <div className="flex-1" />
        <a href="/shop" className="text-sm">Shop</a>
        {session && <button className="text-sm text-muted-foreground" onClick={() => supabase.auth.signOut()}>Sign out</button>}
      </header>
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="text-3xl font-bold">My printed molds</h1>
        <p className="mt-1 text-muted-foreground">Photos and notes of the real molds you've printed and cast. Only you can see them.</p>

        {!ready ? null : !session ? (
          <div className="mt-8 rounded-2xl border border-border bg-card p-6">
            <p>Sign in to start your gallery.</p>
            <Link to="/auth" className="mt-3 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Sign in</Link>
          </div>
        ) : (
          <>
            <form onSubmit={add} className="mt-6 grid gap-3 rounded-2xl border border-border bg-card p-5 md:grid-cols-2">
              <input required placeholder="Title (e.g. Mushroom candle mold)" value={title} onChange={(e) => setTitle(e.target.value)}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              <input placeholder="Material (e.g. PLA + Smooth-On 25)" value={material} onChange={(e) => setMaterial(e.target.value)}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              <textarea placeholder="Notes: print settings, what worked, what to fix…" value={notes} onChange={(e) => setNotes(e.target.value)}
                className="min-h-20 rounded-lg border border-input bg-background px-3 py-2 text-sm md:col-span-2" />
              <div className="grid grid-cols-[1fr_90px] gap-2">
                <input type="number" min="0" step="0.01" placeholder="What I paid (total)" value={price} onChange={(e) => setPrice(e.target.value)}
                  className="rounded-lg border border-input bg-background px-3 py-2 text-sm" aria-label="Price paid" />
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="rounded-lg border border-input bg-background px-2 py-2 text-sm" aria-label="Currency">
                  {["INR", "USD", "EUR", "GBP"].map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <input placeholder="Made by (e.g. home print, JLC3DP, Craftcloud)" value={source} onChange={(e) => setSource(e.target.value)}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              <div className="grid grid-cols-3 gap-2 md:col-span-2">
                {([["Width mm", sx, setSx], ["Depth mm", sy, setSy], ["Height mm", sz, setSz]] as const).map(([ph, v, set]) => (
                  <input key={ph} type="number" min="0" step="0.1" placeholder={`Mold ${ph}`} value={v} onChange={(e) => set(e.target.value)}
                    className="rounded-lg border border-input bg-background px-3 py-2 text-sm" aria-label={`Mold ${ph}`} />
                ))}
              </div>
              <p className="text-xs text-muted-foreground md:col-span-2">Mold size = the outside box of the printed mold. The Finish step and the mold report show it for each piece.</p>
              <input maxLength={200} placeholder="STL file used (e.g. bala_murugan_v1.stl)" value={stlName} onChange={(e) => setStlName(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              <input maxLength={100} placeholder="STL size (e.g. 60 × 40 × 90 mm)" value={stlSize} onChange={(e) => setStlSize(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              <textarea maxLength={2000} placeholder="Settings that worked best: split axis, wall, clearance, layer height, infill, casting material…" value={best} onChange={(e) => setBest(e.target.value)} className="min-h-16 rounded-lg border border-input bg-background px-3 py-2 text-sm md:col-span-2" />
              <div className="flex items-center gap-1 text-sm md:col-span-2" role="radiogroup" aria-label="How well it worked">
                <span className="mr-2 text-muted-foreground">How well it worked:</span>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button type="button" key={n} aria-label={`${n} of 5`} onClick={() => setRating(n)} className={`text-xl ${n <= rating ? "text-primary" : "text-muted-foreground"}`}>★</button>
                ))}
              </div>
              <input id="photos" type="file" accept="image/*" multiple onChange={(e) => setFiles(e.target.files)} className="text-sm" />
              <button disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                {busy ? "Uploading…" : "Add to gallery"}
              </button>
              {err && <p className="text-sm text-destructive md:col-span-2">{err}</p>}
            </form>

            {items.some((i) => perCm3(i) != null) && (
              <section className="mt-8 rounded-2xl border border-border bg-card p-5">
                <h2 className="text-lg font-semibold">Price per mold size</h2>
                <p className="text-xs text-muted-foreground">Compares what you paid against the size of each mold (outside box). Lower price per cm³ is better value.</p>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-muted-foreground"><th className="py-1 pr-3">Mold</th><th className="pr-3">Made by</th><th className="pr-3">Size (mm)</th><th className="pr-3">Box cm³</th><th className="pr-3">Paid</th><th>Per cm³</th></tr></thead>
                    <tbody>
                      {items.filter((i) => perCm3(i) != null).sort((a, b) => perCm3(a)! - perCm3(b)!).map((it, idx, arr) => (
                        <tr key={it.id} className="border-t border-border">
                          <td className="py-1.5 pr-3 font-medium">{it.title}{idx === 0 && arr.length > 1 && <span className="ml-2 rounded bg-primary px-1.5 text-xs text-primary-foreground">best value</span>}</td>
                          <td className="pr-3">{it.source ?? "—"}</td>
                          <td className="pr-3">{Number(it.size_x_mm)} × {Number(it.size_y_mm)} × {Number(it.size_z_mm)}</td>
                          <td className="pr-3">{boxCm3(it)!.toFixed(0)}</td>
                          <td className="pr-3">{Number(it.price_paid).toFixed(2)} {it.currency}</td>
                          <td>{perCm3(it)!.toFixed(2)} {it.currency}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {new Set(items.filter((i) => perCm3(i) != null).map((i) => i.currency)).size > 1 && (
                  <p className="mt-2 text-xs text-muted-foreground">You used more than one currency — compare rows with the same currency.</p>
                )}
              </section>
            )}

            {items.length > 1 && (
              <div className="mt-6 flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Sort:</span>
                {([["new", "Newest"], ["best", "Worked best"], ["perCm3", "Price per cm³"], ["price", "Price paid"]] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setSort(k)} className={`rounded-full border border-border px-3 py-1 ${sort === k ? "bg-primary text-primary-foreground" : ""}`}>{l}</button>
                ))}
              </div>
            )}

            {items.length === 0 ? (
              <p className="mt-8 text-muted-foreground">No molds yet — add your first one above.</p>
            ) : (
              <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {[...items].sort((a, b) => sort === "new" ? 0
                  : sort === "best" ? ((b.rating ?? 0) - (a.rating ?? 0))
                  : sort === "price" ? (Number(a.price_paid ?? Infinity) - Number(b.price_paid ?? Infinity))
                  : ((perCm3(a) ?? Infinity) - (perCm3(b) ?? Infinity))).map((it) => (
                  <article key={it.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                    {it.photo_paths[0] && urls[it.photo_paths[0]] ? (
                      <img src={urls[it.photo_paths[0]]} alt={it.title} className="aspect-[4/3] w-full object-cover" />
                    ) : (
                      <div className="flex aspect-[4/3] items-center justify-center bg-muted text-sm text-muted-foreground">No photo</div>
                    )}
                    {it.photo_paths.length > 1 && (
                      <div className="flex gap-1 p-2">
                        {it.photo_paths.slice(1).map((p) => urls[p] && (
                          <a key={p} href={urls[p]} target="_blank" rel="noreferrer"><img src={urls[p]} alt="" className="h-12 w-12 rounded object-cover" /></a>
                        ))}
                      </div>
                    )}
                    <div className="p-4">
                      <h2 className="font-semibold">{it.title}</h2>
                      {it.material && <p className="text-xs text-muted-foreground">{it.material}</p>}
                      {(it.price_paid != null || boxCm3(it) != null) && (
                        <p className="mt-1 text-xs">
                          {it.price_paid != null && <>Paid {Number(it.price_paid).toFixed(2)} {it.currency}</>}
                          {it.source && <> · {it.source}</>}
                          {boxCm3(it) != null && <> · {Number(it.size_x_mm)}×{Number(it.size_y_mm)}×{Number(it.size_z_mm)} mm</>}
                          {perCm3(it) != null && <> · <b>{perCm3(it)!.toFixed(2)} {it.currency}/cm³</b></>}
                        </p>
                      )}
                      {(it.stl_name || it.stl_size) && <p className="mt-1 text-xs">STL: {it.stl_name ?? "—"}{it.stl_size && <> · {it.stl_size}</>}</p>}
                      {it.rating && <p className="text-sm text-primary" aria-label={`${it.rating} of 5`}>{"★".repeat(it.rating)}<span className="text-muted-foreground">{"★".repeat(5 - it.rating)}</span></p>}
                      {it.best_settings && <p className="mt-2 rounded-lg bg-muted p-2 text-xs"><b>Best settings:</b> {it.best_settings}</p>}
                      {it.notes && <p className="mt-2 whitespace-pre-wrap text-sm">{it.notes}</p>}
                      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{new Date(it.created_at).toLocaleDateString()}</span>
                        <button onClick={() => remove(it)} className="text-destructive">Delete</button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
