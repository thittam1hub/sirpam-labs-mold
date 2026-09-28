import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { REFERRAL_STORAGE_KEY, applyReferral } from "@/lib/credits";
import { deleteMyAccount } from "@/lib/account.functions";

type AppSessionValue = {
  session: Session | null;
  ready: boolean;
  signOut: () => Promise<void>;
};

const AppSessionContext = createContext<AppSessionValue | null>(null);

export function AppSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    let active = true;
    // Remember an invite code from ?ref= on any page; applied once the visitor is signed in.
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref && /^[A-Za-z0-9]{4,20}$/.test(ref)) localStorage.setItem(REFERRAL_STORAGE_KEY, ref.toUpperCase());
    const tryApplyReferral = (s: Session | null) => {
      const stored = localStorage.getItem(REFERRAL_STORAGE_KEY);
      if (!s || !stored) return;
      applyReferral(stored).then((r) => {
        // Keep the code only if the email isn't confirmed yet, so it can be retried later.
        if (r.ok || !/confirm your email/i.test(r.error ?? "")) localStorage.removeItem(REFERRAL_STORAGE_KEY);
      }).catch(() => {});
    };
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setReady(true);
      tryApplyReferral(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      setSession(nextSession);
      setReady(true);
      if (event === "SIGNED_IN") tryApplyReferral(nextSession);
      void router.invalidate();
      if (event !== "SIGNED_OUT") void queryClient.invalidateQueries();
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [queryClient, router]);

  const value = useMemo<AppSessionValue>(() => ({
    session,
    ready,
    signOut: async () => {
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut();
      await router.navigate({ to: "/", replace: true });
    },
  }), [queryClient, ready, router, session]);

  const needsAge = !!session && !session.user.user_metadata?.["age_confirmed_at"];
  return (
    <AppSessionContext.Provider value={value}>
      {children}
      {needsAge && <AgeGate onDone={setSession} signOut={value.signOut} />}
    </AppSessionContext.Provider>
  );
}

/** One-time 13+ confirmation for accounts created without the sign-up form (e.g. Google). */
function AgeGate({ onDone, signOut }: { onDone: (s: Session | null) => void; signOut: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const confirm = async () => {
    setBusy(true); setErr(null);
    const { error } = await supabase.auth.updateUser({ data: { age_confirmed_at: new Date().toISOString() } });
    if (error) { setErr("Could not save. Please try again."); setBusy(false); return; }
    const { data } = await supabase.auth.getSession();
    onDone(data.session);
  };
  const under13 = async () => {
    setBusy(true); setErr(null);
    try { await deleteMyAccount(); } catch { /* still sign out below */ }
    await signOut();
  };
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="age-gate-title" className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-foreground shadow-lg">
        <h2 id="age-gate-title" className="text-lg font-bold">Confirm your age</h2>
        <p className="mt-2 text-sm text-muted-foreground">Sirpam 3D Labs Mold is for people aged 13 and older. Please confirm before continuing.</p>
        <div className="mt-5 space-y-2">
          <button disabled={busy} onClick={confirm} className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">I am 13 or older</button>
          <button disabled={busy} onClick={under13} className="w-full rounded-lg border border-input px-4 py-2 text-sm disabled:opacity-60">I am under 13 (delete my account)</button>
        </div>
        {err && <p role="alert" className="mt-3 text-sm text-destructive">{err}</p>}
      </div>
    </div>
  );
}

export function useAppSession() {
  const value = useContext(AppSessionContext);
  if (!value) throw new Error("useAppSession must be used inside AppSessionProvider");
  return value;
}