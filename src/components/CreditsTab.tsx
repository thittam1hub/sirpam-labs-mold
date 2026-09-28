import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Download } from "lucide-react";
import {
  ACTION_LABEL, EXPIRY_WARN_DAYS, KIND_LABEL, LOW_BALANCE, STATUS_LABEL, daysUntilExpiry,
  getPurchases, ledgerLabel, ledgerToCsv, redeemPromo,
  type CreditStatus, type LedgerRow, type Purchase,
} from "@/lib/credits";
import { Button } from "@/components/ui/button";

const FILTERS = [
  ["all", "All"], ["spent", "Spent"], ["added", "Added"], ["refunded", "Refunded"], ["expired", "Expired"],
] as const;
type Filter = (typeof FILTERS)[number][0];

export function CreditsTab({ status, rows, onChanged }: { status: CreditStatus; rows: LedgerRow[]; onChanged: () => void }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [month, setMonth] = useState("all");
  const [limit, setLimit] = useState(25);
  const [code, setCode] = useState("");
  const [promoMsg, setPromoMsg] = useState<string | null>(null);
  const [promoBusy, setPromoBusy] = useState(false);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [receipt, setReceipt] = useState<Purchase | null>(null);

  useEffect(() => { getPurchases().then(setPurchases).catch(() => {}); }, [rows]);
  const expiryDays = daysUntilExpiry(status);

  const months = useMemo(() => Array.from(new Set(rows.map((r) => r.created_at.slice(0, 7)))), [rows]);
  const filtered = useMemo(() => rows.filter((r) => {
    if (month !== "all" && !r.created_at.startsWith(month)) return false;
    if (filter === "spent") return r.delta < 0 && r.status !== "refunded" && r.status !== "expired";
    if (filter === "added") return r.delta > 0;
    if (filter === "refunded") return r.status === "refunded";
    if (filter === "expired") return r.status === "expired";
    return true;
  }), [rows, filter, month]);

  const thisMonth = new Date().toISOString().slice(0, 7);
  const usage = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      if (!r.created_at.startsWith(thisMonth) || r.delta >= 0 || !(r.reason in ACTION_LABEL)) continue;
      if (r.status !== "charged" && r.status !== "held") continue;
      map.set(r.reason, (map.get(r.reason) ?? 0) - r.delta);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows, thisMonth]);
  const usedTotal = usage.reduce((s, [, n]) => s + n, 0);

  const downloadCsv = () => {
    const blob = new Blob([ledgerToCsv(filtered)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `sirpam-credits-${month === "all" ? "all" : month}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const redeem = async (e: React.FormEvent) => {
    e.preventDefault();
    setPromoBusy(true); setPromoMsg(null);
    try {
      const r = await redeemPromo(code);
      setPromoMsg(r.ok ? `${r.credits} credits added.` : r.error ?? "Could not use this code.");
      if (r.ok) { setCode(""); onChanged(); }
    } catch { setPromoMsg("Could not use this code. Please try again."); }
    setPromoBusy(false);
  };

  return (
    <>
      {status.balance <= LOW_BALANCE && (
        <div role="status" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-4 text-sm">
          <span>You're running low on credits ({status.balance} left).</span>
          <Button asChild size="sm"><Link to="/pricing">Buy credits</Link></Button>
        </div>
      )}
      {expiryDays !== null && expiryDays <= EXPIRY_WARN_DAYS && expiryDays >= 0 && (
        <div role="status" className="mt-4 rounded-2xl border border-border bg-card p-4 text-sm">
          <b>{status.nextExpiryAmount} credits expire {expiryDays === 0 ? "today" : `in ${expiryDays} day${expiryDays === 1 ? "" : "s"}`}</b>
          {" "}({new Date(status.nextExpiryAt!).toLocaleDateString()}). Use them before then — expired credits can't be restored.
        </div>
      )}
      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl bg-card p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">Your credits</p>
          <p className="mt-1 text-4xl font-bold text-primary">{status.balance}</p>
          {status.nextExpiryAt && (status.nextExpiryAmount ?? 0) > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {status.nextExpiryAmount} expire on {new Date(status.nextExpiryAt).toLocaleDateString()}
            </p>
          )}
        </div>
        <div className="rounded-3xl bg-card p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">Free this month (used first, resets on the 1st)</p>
          <p className="mt-1 text-4xl font-bold">{status.monthlyFreeLeft}<span className="text-lg text-muted-foreground"> / {status.monthlyFreeLimit}</span></p>
        </div>
        <div className="rounded-3xl bg-card p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">Used this month</p>
          <p className="mt-1 text-4xl font-bold">{usedTotal}</p>
          <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
            {usage.slice(0, 4).map(([k, n]) => <li key={k}>{ACTION_LABEL[k]}: {n}</li>)}
          </ul>
        </div>
      </section>
      <div className="mt-4 flex flex-wrap items-start gap-4">
        <Button asChild><Link to="/pricing">Buy credits</Link></Button>
        <form onSubmit={redeem} className="flex flex-wrap items-center gap-2">
          <label htmlFor="promo" className="sr-only">Promo code</label>
          <input id="promo" value={code} onChange={(e) => setCode(e.target.value)} maxLength={40} placeholder="Promo code"
            className="w-40 rounded-lg border border-input bg-background px-3 py-2 text-sm uppercase" />
          <Button type="submit" variant="outline" disabled={promoBusy || code.trim().length < 3}>{promoBusy ? "Applying…" : "Apply"}</Button>
          {promoMsg && <span className="text-sm text-muted-foreground">{promoMsg}</span>}
        </form>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Monthly free credits are used first, then promo and welcome credits, then purchased credits. Welcome credits last 90 days, purchased credits 24 months. You're only charged when an action succeeds.
      </p>

      {purchases.length > 0 && (
        <section className="mt-8 rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Purchases</h2>
          <table className="mt-4 w-full text-sm">
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="py-2 pr-2 text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="py-2 pr-2">{p.pack_name} pack · {p.credits} credits</td>
                  <td className="py-2 pr-2">{p.currency === "INR" ? `₹${Number(p.price).toLocaleString("en-IN")}` : `$${p.price}`}</td>
                  <td className="py-2 pr-2 text-xs text-muted-foreground">{p.status === "refunded" ? "Refunded" : "Paid"}</td>
                  <td className="py-2 text-right">
                    <Button type="button" variant="outline" size="sm" onClick={() => setReceipt(p)}>Receipt</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {receipt && (
        <div role="dialog" aria-modal="true" aria-label="Purchase receipt"
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setReceipt(null)}>
          <div className="w-full max-w-md rounded-3xl bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">Receipt</h3>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Item</dt><dd>{receipt.pack_name} pack — {receipt.credits} credits</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Price</dt><dd>{receipt.currency === "INR" ? `₹${Number(receipt.price).toLocaleString("en-IN")}` : `$${receipt.price}`} {receipt.currency}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Date</dt><dd>{new Date(receipt.created_at).toLocaleString()}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Status</dt><dd>{receipt.status === "refunded" ? `Refunded ${receipt.refunded_at ? new Date(receipt.refunded_at).toLocaleDateString() : ""}` : "Paid"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Reference</dt><dd className="font-mono text-xs">{receipt.id.slice(0, 8)}</dd></div>
            </dl>
            <p className="mt-4 text-xs text-muted-foreground">Sirpam 3D Labs, India · sirpam3dlabs@gmail.com. Credits are valid 24 months from purchase.</p>
            <Button type="button" variant="outline" className="mt-4 w-full" onClick={() => setReceipt(null)}>Close</Button>
          </div>
        </div>
      )}

      <section className="mt-8 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">History</h2>
          <Button type="button" variant="outline" size="sm" onClick={downloadCsv} disabled={filtered.length === 0}>
            <Download className="mr-1 h-4 w-4" aria-hidden /> Download CSV
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {FILTERS.map(([v, l]) => (
            <button key={v} type="button" onClick={() => { setFilter(v); setLimit(25); }}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${filter === v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{l}</button>
          ))}
          <label htmlFor="month" className="sr-only">Month</label>
          <select id="month" value={month} onChange={(e) => { setMonth(e.target.value); setLimit(25); }}
            className="ml-auto rounded-lg border border-input bg-background px-2 py-1 text-xs">
            <option value="all">All months</option>
            {months.map((m) => <option key={m} value={m}>{new Date(`${m}-01T00:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</option>)}
          </select>
        </div>
        {filtered.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No activity.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="mt-4 w-full text-sm">
              <tbody>
                {filtered.slice(0, limit).map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="py-2 pr-2 text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="py-2 pr-2">
                      {ledgerLabel(r.reason)}
                      {r.kind && KIND_LABEL[r.kind] && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">{KIND_LABEL[r.kind]}</span>}
                      {r.reference?.startsWith("monthly_free") && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">Monthly free</span>}
                    </td>
                    <td className="py-2 pr-2 text-xs text-muted-foreground">{STATUS_LABEL[r.status] ?? r.status}</td>
                    <td className={`py-2 text-right font-semibold ${r.delta > 0 ? "text-primary" : ""} ${r.status === "refunded" ? "line-through text-muted-foreground" : ""}`}>
                      {r.delta > 0 ? `+${r.delta}` : r.delta}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > limit && (
          <Button type="button" variant="outline" className="mt-4" onClick={() => setLimit((v) => v + 25)}>Load more history</Button>
        )}
      </section>
    </>
  );
}
