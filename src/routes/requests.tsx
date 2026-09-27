import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BrandLink } from "@/components/BrandLink";
import { LegalFooter } from "@/components/LegalFooter";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/requests")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "My quote requests — Sirpam 3D Labs Mold" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RequestsPage,
});

interface QuoteRequest {
  id: string;
  maker: string;
  quantity: number;
  size_class: string;
  casting_material: string | null;
  notes: string | null;
  created_at: string;
}

function RequestsPage() {
  const [rows, setRows] = useState<QuoteRequest[] | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { setRows(null); return; }
      const { data: reqs } = await supabase
        .from("quote_requests")
        .select("id, maker, quantity, size_class, casting_material, notes, created_at")
        .order("created_at", { ascending: false });
      setRows((reqs as QuoteRequest[]) ?? []);
    });
  }, []);

  return (
    <div className="neu-page min-h-screen bg-background text-foreground">
      <header className="mx-auto flex min-h-16 max-w-4xl items-center gap-4 bg-background px-6 py-3 text-sm">
        <BrandLink />
        <div className="flex-1" />
        <Link to="/studio">Mold Maker</Link>
        <Link to="/shop">Shop</Link>
      </header>
      <main className="mx-auto max-w-4xl px-6 pb-16">
        <h1 className="text-3xl font-bold">My quote requests</h1>
        {rows === undefined && <p className="mt-4 text-muted-foreground">Loading…</p>}
        {rows === null && (
          <p className="mt-4">Please <Link to="/auth" search={{ redirect: "/requests" }} className="text-primary">sign in</Link> to see your requests.</p>
        )}
        {rows && rows.length === 0 && (
          <p className="mt-4 text-muted-foreground">
            No requests yet. Send your project to a mold maker from the <Link to="/shop" className="text-primary">Shop</Link>.
          </p>
        )}
        {rows && rows.length > 0 && (
          <div className="mt-6 space-y-4">
            {rows.map((r) => (
              <section key={r.id} className="rounded-3xl bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-semibold">{r.maker}</h2>
                  <span className="text-sm text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {r.quantity} × {r.size_class} mold{r.quantity > 1 ? "s" : ""}
                  {r.casting_material ? ` · ${r.casting_material}` : ""}
                </p>
                {r.notes && <p className="mt-2 text-sm">{r.notes}</p>}
              </section>
            ))}
          </div>
        )}
      </main>
      <LegalFooter />
    </div>
  );
}
