import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { getCreditHistory, getCreditStatus, type CreditStatus, type LedgerRow } from "@/lib/credits";
import { CreditsTab } from "@/components/CreditsTab";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount } from "@/lib/account.functions";
import { SiteHeader } from "@/components/SiteHeader";
import { useAppSession } from "@/components/AppSession";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const accountTabs = ["profile", "credits", "security"] as const;
type AccountTab = (typeof accountTabs)[number];

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
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { tab?: AccountTab } => ({
    tab: accountTabs.includes(search["tab"] as AccountTab) ? search["tab"] as AccountTab : "profile",
  }),
  component: AccountPage,
});

function AccountPage() {
  const { session, ready, signOut } = useAppSession();
  const tab = Route.useSearch().tab ?? "profile";
  const [status, setStatus] = useState<CreditStatus | null | undefined>(undefined);
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [reload, setReload] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState<string>("");
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
    if (!ready) return;
    if (!session) { setStatus(null); return; }
    let active = true;
    const load = async () => {
      const user = session.user;
      setEmail(user?.email ?? "");
      const profilePromise = supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).maybeSingle();
      const creditPromise = getCreditStatus();
      const historyPromise = getCreditHistory();
      void supabase.from("user_roles" as never).select("role").eq("role", "admin").maybeSingle().then(({ data }) => { if (active) setIsAdmin(!!data); });
      const [got, creditStatus, creditRows] = await Promise.all([profilePromise, creditPromise, historyPromise]);
      let prof = got.data as { display_name: string; avatar_url: string | null } | null;
      if (!prof && !got.error) {
        const inserted = await supabase.from("profiles").insert({ id: user.id }).select("display_name, avatar_url").single();
        prof = inserted.data;
      }
      if (!active) return;
      setDisplayName(prof?.display_name ?? "");
      const path = prof?.avatar_url ?? null;
      setAvatarPath(path);
      if (path) {
        const s = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60);
        if (active) setAvatarSigned(s.data?.signedUrl ?? null);
      }
      setStatus(creditStatus);
      setRows(creditRows);
    };
    load().catch(() => { if (active) setStatus(null); });
    return () => { active = false; };
  }, [ready, session, reload]);

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
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPwMsg(error ? error.message : "Password updated.");
    setPwBusy(false);
    if (!error) setNewPw("");
  };

  const deleteAccount = async () => {
    setDelBusy(true);
    try {
      await deleteMyAccount();
      await supabase.auth.signOut();
      window.location.assign("/");
    } catch (err) {
      setPwMsg(err instanceof Error ? err.message : "Could not delete the account. Please try again.");
      setDelBusy(false);
    }
  };

  return (
    <div className="neu-page min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 pb-16">
        <h1 className="mt-8 text-3xl font-bold">Your account</h1>
        <nav aria-label="Account sections" className="mt-6 flex gap-1 overflow-x-auto border-b border-border">
          {([['profile', 'Profile'], ['credits', 'Credits & history'], ['security', 'Security']] as const).map(([value, label]) => (
            <Link key={value} to="/account" search={{ tab: value }} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${tab === value ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>{label}</Link>
          ))}
          {isAdmin && <Link to="/admin" className="ml-auto whitespace-nowrap px-4 py-3 text-sm font-semibold text-muted-foreground">Admin</Link>}
        </nav>
        {status === undefined && <div className="mt-6 space-y-3"><Skeleton className="h-8 w-48" /><Skeleton className="h-40 w-full" /></div>}
        {status === null && (
          <p className="mt-4">Please <Link to="/auth" search={{ redirect: "/account" }} className="text-primary">sign in</Link> to see your credits.</p>
        )}
        {status && (
          <>
            {tab === "credits" && <CreditsTab status={status} rows={rows} onChanged={() => setReload((n) => n + 1)} />}

            {tab === "profile" && <section className="mt-8 rounded-lg border border-border bg-card p-6 shadow-sm">
              <h2 className="text-xl font-semibold">Profile</h2>
              <div className="mt-4 flex flex-wrap items-center gap-5">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-muted shadow-sm">
                  {avatarSigned ? (
                    <img src={avatarSigned} alt="Your photo" className="h-20 w-20 object-cover" />
                  ) : (
                    <span className="text-2xl font-bold text-muted-foreground">
                      {(displayName || email || "?").trim().charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="space-y-2 text-sm">
                  <label className="inline-block cursor-pointer rounded-lg border border-input bg-background px-4 py-2 font-medium">
                    {avatarSigned ? "Change photo" : "Upload photo"}
                    <input type="file" accept="image/*" className="hidden" onChange={uploadAvatar} disabled={profBusy} />
                  </label>
                  {avatarSigned && (
                     <Button type="button" variant="ghost" size="sm" onClick={removeAvatar} disabled={profBusy} className="ml-2">
                      Remove photo
                     </Button>
                  )}
                  <p className="text-xs text-muted-foreground">JPG or PNG, up to 2 MB. Only you can see your profile.</p>
                </div>
              </div>

              <form onSubmit={saveProfile} className="mt-6 max-w-sm space-y-3">
                <label htmlFor="display-name" className="text-sm font-semibold">Display name</label>
                <input id="display-name" type="text" maxLength={60} placeholder="How should we greet you?"
                  value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
                 <Button disabled={profBusy}>
                  {profBusy ? "Saving…" : "Save profile"}
                 </Button>
              </form>
              {profMsg && <p className="mt-3 text-sm text-muted-foreground">{profMsg}</p>}
            </section>}


            {tab === "security" && <section className="mt-8 rounded-lg border border-border bg-card p-6 shadow-sm">
              <h2 className="text-xl font-semibold">Security</h2>
              <p className="mt-1 text-sm text-muted-foreground">Signed in as {email}</p>

              <form onSubmit={changePassword} className="mt-4 max-w-sm space-y-3">
                <h3 className="text-sm font-semibold">Change password</h3>
                <input required minLength={6} type="password" placeholder="New password (6+ characters)" value={newPw} onChange={(e) => setNewPw(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
                 <Button disabled={pwBusy}>
                  {pwBusy ? "Saving…" : "Update password"}
                 </Button>
              </form>
              {pwMsg && <p className="mt-3 text-sm text-muted-foreground">{pwMsg}</p>}

              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-4">
                 <Button variant="outline" onClick={() => void signOut()}>Sign out</Button>
                {!delConfirm ? (
                   <Button type="button" variant="ghost" size="sm" onClick={() => setDelConfirm(true)}>Delete my account…</Button>
                ) : (
                  <span className="flex flex-wrap items-center gap-2 text-sm">
                     <span className="text-destructive">This permanently deletes your gallery, credits and account.</span>
                     <Button type="button" variant="destructive" size="sm" onClick={deleteAccount} disabled={delBusy}>
                      {delBusy ? "Deleting…" : "Yes, delete everything"}
                     </Button>
                     <Button type="button" variant="ghost" size="sm" onClick={() => setDelConfirm(false)}>Cancel</Button>
                  </span>
                )}
              </div>
            </section>}
          </>
        )}
      </main>
    </div>
  );
}
