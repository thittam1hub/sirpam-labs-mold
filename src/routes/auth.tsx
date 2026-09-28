import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { BrandLink } from "@/components/BrandLink";
import { ArrowLeft } from "lucide-react";

const REDIRECT_KEY = "sirpam.authRedirect";

function safeRedirect(value: unknown): string {
  if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/auth")) {
    return value;
  }
  // Default landing after sign-in: the app itself, not the marketing page.
  return "/studio";
}

export const Route = createFileRoute("/auth")({
  staticData: { sitemap: false },
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: safeRedirect(search["redirect"]),
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Sirpam 3D Labs Mold" },
      { name: "description", content: "Sign in to save photos and notes of the molds you've printed." },
      { property: "og:title", content: "Sign in — Sirpam 3D Labs Mold" },
      { property: "og:description", content: "Sign in to keep your mold gallery." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const { redirect } = Route.useSearch();
  const [mode, setMode] = useState<"in" | "up" | "forgot">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgKind, setMsgKind] = useState<"error" | "info">("info");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  const goBack = () => {
    const target = sessionStorage.getItem(REDIRECT_KEY) ?? redirect;
    sessionStorage.removeItem(REDIRECT_KEY);
    nav({ to: safeRedirect(target), replace: true });
  };

  // Already signed in (including just returned from Google): go back to where you came from.
  useEffect(() => {
    let done = false;
    const go = () => { if (!done) { done = true; goBack(); } };
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) go();
      else setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) go();
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setMsgKind(error ? "error" : "info");
      setMsg(error ? error.message : "Check your email for a password reset link.");
    } else if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMsgKind("error");
        setMsg(error.message);
      } else {
        goBack();
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth` },
      });
      setMsgKind(error ? "error" : "info");
      setMsg(error ? error.message : "Check your email to confirm your account, then sign in.");
    }
    setBusy(false);
  };

  const google = async () => {
    sessionStorage.setItem(REDIRECT_KEY, redirect);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) {
      setMsgKind("error");
      setMsg(r.error.message ?? "Google sign-in failed");
      return;
    }
    // In-page (popup) flow: session is already set, so return now.
    if (!r.redirected) {
      const { data } = await supabase.auth.getSession();
      if (data.session) goBack();
    }
  };

  const inputCls = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";

  if (checking) {
    return (
      <div className="neu-page flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
        <p className="text-sm text-muted-foreground">Checking your sign-in…</p>
      </div>
    );
  }

  return (
    <div className="neu-page flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6">
        <BrandLink />
        <Link to="/" className="mt-4 inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft aria-hidden size={15} /> Back to homepage</Link>
        <h1 className="mt-3 text-2xl font-bold">
          {mode === "in" ? "Sign in" : mode === "up" ? "Create account" : "Reset password"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "forgot"
            ? "We'll email you a link to set a new password."
            : "Keep a gallery of the molds you've printed."}
        </p>
        {mode !== "forgot" && (
          <button onClick={google} className="mt-5 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium">
            Continue with Google
          </button>
        )}
        <form onSubmit={submit} className="mt-4 space-y-3">
          <input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          {mode !== "forgot" && (
            <div className="relative">
              <input
                required
                minLength={6}
                type={showPassword ? "text" : "password"}
                placeholder="Password (6+ characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputCls} pr-16`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          )}
          <button disabled={busy} className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {busy ? "Please wait…" : mode === "in" ? "Sign in" : mode === "up" ? "Create account" : "Send reset link"}
          </button>
        </form>
        {msg && (
          <p className={`mt-3 text-sm ${msgKind === "error" ? "text-destructive" : "text-muted-foreground"}`}>{msg}</p>
        )}
        <div className="mt-4 flex items-center justify-between text-sm">
          <button onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(null); }} className="text-primary">
            {mode === "in" ? "No account? Create one" : "Have an account? Sign in"}
          </button>
          {mode === "in" && (
            <button onClick={() => { setMode("forgot"); setMsg(null); }} className="text-muted-foreground">
              Forgot password?
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
