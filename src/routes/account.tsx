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
  const nav = useNavigate();
  const [status, setStatus] = useState<CreditStatus | null | undefined>(undefined);
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [email, setEmail] = useState<string>("");
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwBusy, setPwBusy] = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);
  const [delBusy, setDelBusy] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [avatarSigned, setAvatarSigned] = useState<string | null>(null);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [profBusy, setProfBusy] = useState(false);
  const [profMsg, setProfMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      setEmail(user?.email ?? "");
      if (!user) return;
      let prof: { display_name: string; avatar_url: string | null } | null = null;
      const got = await supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).maybeSingle();
      prof = got.data;
      if (!prof) {
        const ins = await supabase.from("profiles").insert({ id: user.id }).select("display_name, avatar_url").single();
        prof = ins.data;
      }
      setDisplayName(prof?.display_name ?? "");
      const path = prof?.avatar_url ?? null;
      setAvatarPath(path);
      if (path) {
        const s = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60);
        setAvatarSigned(s.data?.signedUrl ?? null);
      }
    });
    getCreditStatus()
      .then(async (s) => { setStatus(s); if (s) setRows(await getCreditHistory()); })
      .catch(() => setStatus(null));
  }, []);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfBusy(true);
    setProfMsg(null);
    const { data } = await supabase.auth.getUser();
    if (!data.user) { setProfBusy(false); return; }
    const { error } = await supabase.from("profiles").upsert({ id: data.user.id, display_name: displayName.trim() });
    setProfMsg(error ? error.message : "Profile saved.");
    setProfBusy(false);
  };

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setProfMsg(null);
    if (!file.type.startsWith("image/")) { setProfMsg("Please choose an image file."); return; }
    if (file.size > 2 * 1024 * 1024) { setProfMsg("Photo must be under 2 MB."); return; }
    setProfBusy(true);
    const { data } = await supabase.auth.getUser();
    if (!data.user) { setProfBusy(false); return; }
    const uid = data.user.id;
    const ext = (file.name.split(".").pop() ?? "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const path = `${uid}/avatar-${Date.now()}.${ext}`;
    const up = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (up.error) { setProfMsg(up.error.message); setProfBusy(false); return; }
    const upd = await supabase.from("profiles").upsert({ id: uid, avatar_url: path });
    if (upd.error) { setProfMsg(upd.error.message); setProfBusy(false); return; }
    if (avatarPath && avatarPath !== path) await supabase.storage.from("avatars").remove([avatarPath]);
    const s = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60);
    setAvatarPath(path);
    setAvatarSigned(s.data?.signedUrl ?? null);
    setProfMsg("Photo updated.");
    setProfBusy(false);
  };

  const removeAvatar = async () => {
    setProfBusy(true);
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await supabase.from("profiles").upsert({ id: data.user.id, avatar_url: null });
      if (avatarPath) await supabase.storage.from("avatars").remove([avatarPath]);
    }
    setAvatarPath(null);
    setAvatarSigned(null);
    setProfBusy(false);
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwBusy(true);
    setPwMsg(null);
    const { error } = await supabase.auth.updateUser({ password: newPw, current_password: curPw } as never);
    setPwMsg(error ? error.message : "Password updated.");
    setPwBusy(false);
    if (!error) { setCurPw(""); setNewPw(""); }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    nav({ to: "/", replace: true });
  };

  const deleteAccount = async () => {
    setDelBusy(true);
    try {
      await deleteMyAccount();
      await supabase.auth.signOut();
      nav({ to: "/", replace: true });
    } catch (err) {
      setPwMsg(err instanceof Error ? err.message : "Could not delete the account. Please try again.");
      setDelBusy(false);
    }
  };

  return (
    <div className="neu-page min-h-screen bg-background text-foreground">
      <header className="mx-auto flex min-h-16 max-w-4xl items-center gap-4 bg-background px-6 py-3 text-sm">
        <BrandLink />
        <div className="flex-1" />
        <Link to="/studio">Mold Maker</Link>
        <Link to="/pricing">Pricing</Link>
      </header>
      <main className="mx-auto max-w-4xl px-6 pb-16">
        <h1 className="text-3xl font-bold">Your account</h1>
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

            <section className="mt-10 rounded-3xl bg-card p-6 shadow-sm">
              <h2 className="text-xl font-semibold">Account settings</h2>
              <p className="mt-1 text-sm text-muted-foreground">Signed in as {email}</p>

              <form onSubmit={changePassword} className="mt-4 max-w-sm space-y-3">
                <h3 className="text-sm font-semibold">Change password</h3>
                <input required type="password" placeholder="Current password" value={curPw} onChange={(e) => setCurPw(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
                <input required minLength={6} type="password" placeholder="New password (6+ characters)" value={newPw} onChange={(e) => setNewPw(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
                <button disabled={pwBusy} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                  {pwBusy ? "Saving…" : "Update password"}
                </button>
              </form>
              {pwMsg && <p className="mt-3 text-sm text-muted-foreground">{pwMsg}</p>}

              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-4">
                <button onClick={signOut} className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium">Sign out</button>
                {!delConfirm ? (
                  <button onClick={() => setDelConfirm(true)} className="text-sm text-muted-foreground">Delete my account…</button>
                ) : (
                  <span className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-destructive">This permanently deletes your gallery, requests, credits and account.</span>
                    <button onClick={deleteAccount} disabled={delBusy} className="rounded-lg bg-destructive px-3 py-1.5 text-sm font-semibold text-destructive-foreground disabled:opacity-60">
                      {delBusy ? "Deleting…" : "Yes, delete everything"}
                    </button>
                    <button onClick={() => setDelConfirm(false)} className="text-sm text-muted-foreground">Cancel</button>
                  </span>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
