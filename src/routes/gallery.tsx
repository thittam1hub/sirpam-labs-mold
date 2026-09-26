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

type Item = { id: string; title: string; notes: string | null; material: string | null; photo_paths: string[]; created_at: string };

function GalleryPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [material, setMaterial] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
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
      const { error } = await supabase.from("gallery_items").insert({ title, notes: notes || null, material: material || null, photo_paths: paths });
      if (error) throw error;
      setTitle(""); setNotes(""); setMaterial(""); setFiles(null);
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
              <input id="photos" type="file" accept="image/*" multiple onChange={(e) => setFiles(e.target.files)} className="text-sm" />
              <button disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                {busy ? "Uploading…" : "Add to gallery"}
              </button>
              {err && <p className="text-sm text-destructive md:col-span-2">{err}</p>}
            </form>

            {items.length === 0 ? (
              <p className="mt-8 text-muted-foreground">No molds yet — add your first one above.</p>
            ) : (
              <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((it) => (
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
