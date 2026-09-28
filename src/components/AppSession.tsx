import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { REFERRAL_STORAGE_KEY, applyReferral } from "@/lib/credits";

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

  return <AppSessionContext.Provider value={value}>{children}</AppSessionContext.Provider>;
}

export function useAppSession() {
  const value = useContext(AppSessionContext);
  if (!value) throw new Error("useAppSession must be used inside AppSessionProvider");
  return value;
}