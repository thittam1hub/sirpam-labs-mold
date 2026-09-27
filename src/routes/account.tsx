import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ACTION_LABEL, getCreditHistory, getCreditStatus, type CreditStatus, type LedgerRow } from "@/lib/credits";
import { BrandLink } from "@/components/BrandLink";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount } from "@/lib/account.functions";

export const Route = createFileRoute("/account")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Your account — Sirpam 3D Labs Mold" },
      { name: "description", content: "See your credit balance, monthly free credits, history and account settings." },
      { property: "og:title", content: "Your account — Sirpam 3D Labs Mold" },
      { property: "og:description", content: "Credit balance and history for your Sirpam account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const [status, setStatus] = useState<CreditStatus | null | undefined>(undefined);
  const [rows, setRows] = useState<LedgerRow[]>([]);

  useEffect(() => {
    getCreditStatus()
      .then(async (s) => { setStatus(s); if (s) setRows(await getCreditHistory()); })
      .catch(() => setStatus(null));
  }, []);

  return (
    <div className="neu-page min-h-screen bg-background text-foreground">
      <header className="mx-auto flex min-h-16 max-w-4xl items-center gap-4 bg-background px-6 py-3 text-sm">
        <BrandLink />
        <div className="flex-1" />
        <Link to="/studio">Mold Maker</Link>
        <Link to="/pricing">Pricing</Link>
      </header>
      <main className="mx-auto max-w-4xl px-6 pb-16">
        <h1 className="text-3xl font-bold">Your credits</h1>
        {status === undefined && <p className="mt-4 text-muted-foreground">Loading…</p>}
        {status === null && (
          <p className="mt-4">Please <Link to="/auth" search={{ redirect: "/account" }} className="text-primary">sign in</Link> to see your credits.</p>
        )}
        {status && (
          <>
            <section className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl bg-card p-6 shadow-sm">
                <p className="text-sm text-muted-foreground">Your credits (never expire)</p>
                <p className="mt-1 text-4xl font-bold text-primary">{status.balance}</p>
              </div>
              <div className="rounded-3xl bg-card p-6 shadow-sm">
                <p className="text-sm text-muted-foreground">Free this month (used first, resets on the 1st)</p>
                <p className="mt-1 text-4xl font-bold">{status.monthlyFreeLeft}<span className="text-lg text-muted-foreground"> / {status.monthlyFreeLimit}</span></p>
              </div>
            </section>
            <Link to="/pricing" className="mt-4 inline-block rounded-full bg-primary px-5 py-2 font-semibold text-primary-foreground">Buy credits</Link>

            <section className="mt-10 rounded-3xl bg-card p-6 shadow-sm">
              <h2 className="text-xl font-semibold">History</h2>
              {rows.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                <table className="mt-4 w-full text-sm">
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-t border-border">
                        <td className="py-2 text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                        <td className="py-2">
                          {ACTION_LABEL[r.reason] ?? r.reason}
                          {r.reference?.startsWith("monthly_free") && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">free monthly</span>}
                        </td>
                        <td className={`py-2 text-right font-semibold ${r.delta > 0 ? "text-primary" : ""}`}>
                          {r.delta > 0 ? `+${r.delta}` : r.delta}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
