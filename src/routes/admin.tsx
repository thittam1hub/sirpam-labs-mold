import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { useAppSession } from "@/components/AppSession";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ACTION_LABEL, KIND_LABEL, STATUS_LABEL, ledgerLabel } from "@/lib/credits";

export const Route = createFileRoute("/admin")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Admin — Sirpam 3D Labs Mold" },
      { name: "description", content: "Credits administration for Sirpam 3D Labs Mold." },
      { property: "og:title", content: "Admin — Sirpam 3D Labs Mold" },
      { property: "og:description", content: "Credits administration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

type Promo = { code: string; credits: number; max_redemptions: number | null; redeemed_count: number; expires_at: string | null; credit_valid_days: number; active: boolean };
type Overview = { users: number; activeLast30: number; purchases: number; creditsSold: number; usageByAction: Record<string, number>; promos: Promo[] };
type FoundUser = { id: string; email: string; createdAt: string; balance: number;
  history: { id: string; delta: number; reason: string; kind: string | null; status: string; created_at: string }[] };
type AdminPurchase = { id: string; pack_name: string; credits: number; price: number; currency: string;
  provider: string; payment_ref: string | null; status: string; created_at: string; refunded_at: string | null };

const rpc = async <T,>(fn: string, args?: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.rpc(fn as never, args as never);
  if (error) throw new Error(error.message);
  return data as T;
};
const input = "rounded-lg border border-input bg-background px-3 py-2 text-sm";

function AdminPage() {
  const { session, ready } = useAppSession();
  const [overview, setOverview] = useState<Overview | null | undefined>(undefined);
  const [email, setEmail] = useState("");
  const [user, setUser] = useState<FoundUser | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [purchases, setPurchases] = useState<AdminPurchase[]>([]);
  const [promo, setPromo] = useState({ code: "", credits: "5", max: "100", expires: "", days: "90" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => rpc<Overview>("admin_overview").then(setOverview).catch(() => setOverview(null)), []);
  useEffect(() => { if (ready && session) void load(); else if (ready) setOverview(null); }, [ready, session, load]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setMsg(null);
    try { await fn(); } catch (e) { setMsg(e instanceof Error ? e.message : "Something went wrong."); }
    setBusy(false);
  };
  const find = (e: React.FormEvent) => { e.preventDefault(); void run(async () => {
    const u = await rpc<FoundUser | null>("admin_find_user", { _email: email });
    setUser(u); if (!u) { setMsg("No user with that email."); setPurchases([]); return; }
    setPurchases(await rpc<AdminPurchase[]>("admin_list_purchases", { _email: email }));
  }); };
  const refund = (p: AdminPurchase) => void run(async () => {
    const why = window.prompt(`Refund ${p.pack_name} pack (${p.credits} credits)? Remaining credits from this purchase are removed. Reason:`);
    if (!why || why.trim().length < 3) return;
    const r = await rpc<{ removed: number; balance: number }>("admin_refund_purchase", { _purchase: p.id, _reason: why.trim() });
    setMsg(`Refunded — removed ${r.removed} remaining credits. New balance: ${r.balance}.`);
    if (user) {
      setPurchases(await rpc<AdminPurchase[]>("admin_list_purchases", { _email: user.email }));
      setUser(await rpc<FoundUser>("admin_find_user", { _email: user.email }));
    }
  });
  const adjust = (e: React.FormEvent) => { e.preventDefault(); if (!user) return; void run(async () => {
    const n = parseInt(amount, 10);
    if (!Number.isFinite(n) || n === 0) throw new Error("Enter a non-zero whole number.");
    await rpc("admin_adjust_credits", { _user: user.id, _amount: n, _reason: reason });
    setAmount(""); setReason("");
    setUser(await rpc<FoundUser>("admin_find_user", { _email: user.email }));
    setMsg("Credits updated.");
  }); };
  const createPromo = (e: React.FormEvent) => { e.preventDefault(); void run(async () => {
    await rpc("admin_create_promo", {
      _code: promo.code, _credits: parseInt(promo.credits, 10), _max: promo.max ? parseInt(promo.max, 10) : null,
      _expires: promo.expires ? new Date(`${promo.expires}T23:59:59`).toISOString() : null, _valid_days: parseInt(promo.days, 10) || 90,
    });
    setPromo({ ...promo, code: "" }); await load(); setMsg("Promo code created.");
  }); };
  const togglePromo = (p: Promo) => void run(async () => { await rpc("admin_set_promo_active", { _code: p.code, _active: !p.active }); await load(); });

  return (
    <div className="neu-page min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 pb-16">
        <h1 className="mt-8 text-3xl font-bold">Credits admin</h1>
        {overview === undefined && <Skeleton className="mt-6 h-40 w-full" />}
        {overview === null && (
          <p className="mt-6">This page is for administrators. <Link to="/account" search={{ tab: "profile" }} className="text-primary">Back to your account</Link></p>
        )}
        {overview && (
          <>
            {msg && <p role="status" className="mt-4 rounded-lg bg-muted p-3 text-sm">{msg}</p>}
            <section className="mt-6 grid gap-4 sm:grid-cols-4">
              {[["Accounts", overview.users], ["Active (30 days)", overview.activeLast30], ["Packs sold", overview.purchases], ["Credits sold", overview.creditsSold]].map(([l, v]) => (
                <div key={l} className="rounded-3xl bg-card p-5 shadow-sm"><p className="text-sm text-muted-foreground">{l}</p><p className="mt-1 text-3xl font-bold">{v}</p></div>
              ))}
            </section>
            <section className="mt-6 rounded-lg border border-border bg-card p-6 shadow-sm">
              <h2 className="text-xl font-semibold">Credits used by feature (30 days)</h2>
              <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
                {Object.entries(overview.usageByAction).length === 0 && <li className="text-muted-foreground">No usage yet.</li>}
                {Object.entries(overview.usageByAction).map(([k, n]) => <li key={k}>{ACTION_LABEL[k] ?? k}: <strong>{n}</strong></li>)}
              </ul>
            </section>

            <section className="mt-6 rounded-lg border border-border bg-card p-6 shadow-sm">
              <h2 className="text-xl font-semibold">Look up a user</h2>
              <form onSubmit={find} className="mt-3 flex flex-wrap gap-2">
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" className={`${input} w-72`} aria-label="User email" />
                <Button disabled={busy}>Find</Button>
              </form>
              {user && (
                <div className="mt-5">
                  <p className="text-sm"><strong>{user.email}</strong> · joined {new Date(user.createdAt).toLocaleDateString()} · balance <strong className="text-primary">{user.balance}</strong></p>
                  <form onSubmit={adjust} className="mt-3 flex flex-wrap gap-2">
                    <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="+5 or -3" className={`${input} w-28`} aria-label="Credit change" />
                    <input required minLength={3} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (shown in their history)" className={`${input} w-72`} aria-label="Reason" />
                    <Button disabled={busy}>Apply</Button>
                  </form>
                  <p className="mt-1 text-xs text-muted-foreground">Added credits are bonus credits valid for 365 days. For refunds of failed actions, the system returns credits automatically.</p>
                  <div className="mt-4 max-h-80 overflow-auto">
                    <table className="w-full text-sm"><thead className="sr-only"><tr><th scope="col">Date</th><th scope="col">Activity</th><th scope="col">Status</th><th scope="col">Credits</th></tr></thead><tbody>
                      {user.history.map((r) => (
                        <tr key={r.id} className="border-t border-border">
                          <td className="py-1.5 pr-2 text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                          <td className="py-1.5 pr-2">{ledgerLabel(r.reason)} <span className="text-xs text-muted-foreground">{KIND_LABEL[r.kind ?? ""] ?? ""}</span></td>
                          <td className="py-1.5 pr-2 text-xs text-muted-foreground">{STATUS_LABEL[r.status] ?? r.status}</td>
                          <td className="py-1.5 text-right font-semibold">{r.delta > 0 ? `+${r.delta}` : r.delta}</td>
                        </tr>
                      ))}
                    </tbody></table>
                  </div>
                  {purchases.length > 0 && (
                    <div className="mt-5">
                      <h3 className="font-semibold">Purchases</h3>
                      <table className="mt-2 w-full text-sm"><thead className="sr-only"><tr><th scope="col">Date</th><th scope="col">Pack</th><th scope="col">Payment</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead><tbody>
                        {purchases.map((p) => (
                          <tr key={p.id} className="border-t border-border">
                            <td className="py-1.5 pr-2 text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
                            <td className="py-1.5 pr-2">{p.pack_name} · {p.credits} credits · {p.currency === "INR" ? `₹${Number(p.price).toLocaleString("en-IN")}` : `$${p.price}`}</td>
                            <td className="py-1.5 pr-2 text-xs text-muted-foreground">{p.provider}{p.payment_ref ? ` · ${p.payment_ref}` : ""}</td>
                            <td className="py-1.5 pr-2 text-xs">{p.status}</td>
                            <td className="py-1.5 text-right">
                              {p.status === "paid" && <Button size="sm" variant="outline" disabled={busy} onClick={() => refund(p)}>Refund</Button>}
                            </td>
                          </tr>
                        ))}
                      </tbody></table>
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="mt-6 rounded-lg border border-border bg-card p-6 shadow-sm">
              <h2 className="text-xl font-semibold">Promo codes</h2>
              <form onSubmit={createPromo} className="mt-3 grid gap-2 sm:grid-cols-6">
                <input required pattern="[A-Za-z0-9_\-]{3,40}" value={promo.code} onChange={(e) => setPromo({ ...promo, code: e.target.value.toUpperCase() })} placeholder="CODE" className={`${input} sm:col-span-2`} aria-label="Code" />
                <input type="number" min={1} max={1000} required value={promo.credits} onChange={(e) => setPromo({ ...promo, credits: e.target.value })} className={input} aria-label="Credits" title="Credits" />
                <input type="number" min={1} value={promo.max} onChange={(e) => setPromo({ ...promo, max: e.target.value })} placeholder="Max uses" className={input} aria-label="Max uses" title="Max uses (empty = unlimited)" />
                <input type="date" value={promo.expires} onChange={(e) => setPromo({ ...promo, expires: e.target.value })} className={input} aria-label="Code end date" title="Code end date" />
                <Button disabled={busy}>Create</Button>
              </form>
              <p className="mt-1 text-xs text-muted-foreground">Credits from a code last
                <input type="number" min={1} max={730} value={promo.days} onChange={(e) => setPromo({ ...promo, days: e.target.value })} className="mx-1 w-16 rounded border border-input bg-background px-1" aria-label="Days valid" /> days.</p>
              <table className="mt-4 w-full text-sm"><thead className="sr-only"><tr><th scope="col">Code</th><th scope="col">Credits</th><th scope="col">Used</th><th scope="col">Ends</th><th scope="col">Action</th></tr></thead><tbody>
                {overview.promos.map((p) => (
                  <tr key={p.code} className="border-t border-border">
                    <td className="py-2 font-semibold">{p.code}</td>
                    <td className="py-2">{p.credits} credits · {p.credit_valid_days} days</td>
                    <td className="py-2 text-muted-foreground">{p.redeemed_count}{p.max_redemptions ? ` / ${p.max_redemptions}` : ""} used</td>
                    <td className="py-2 text-muted-foreground">{p.expires_at ? `ends ${new Date(p.expires_at).toLocaleDateString()}` : "no end date"}</td>
                    <td className="py-2 text-right"><Button size="sm" variant="outline" disabled={busy} onClick={() => togglePromo(p)}>{p.active ? "Turn off" : "Turn on"}</Button></td>
                  </tr>
                ))}
              </tbody></table>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
