import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BrandLink } from "@/components/BrandLink";

export const Route = createFileRoute("/reset-password")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Set a new password — Sirpam 3D Labs Mold" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // The recovery link lands here with type=recovery in the URL hash.
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setReady(true);
      return;
    }
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setMsg("The two passwords don't match.");
      return;
    }
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMsg(error.message);
      setBusy(false);
    } else {
      nav({ to: "/", replace: true });
    }
  };

  const inputCls = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";

  return (
    <div className="neu-page flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6">
        <BrandLink />
        <h1 className="mt-4 text-2xl font-bold">Set a new password</h1>
        {!ready ? (
          <p className="mt-3 text-sm text-muted-foreground">
            This page only works from the reset link in your email.{" "}
            <Link to="/auth" search={{ redirect: "/studio" }} className="text-primary">Request a new link</Link>.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-3">
            <div className="relative">
              <input
                required
                minLength={6}
                type={showPassword ? "text" : "password"}
                placeholder="New password (6+ characters)"
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
            <input
              required
              minLength={6}
              type={showPassword ? "text" : "password"}
              placeholder="Repeat new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputCls}
            />
            <button disabled={busy} className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              {busy ? "Saving…" : "Save new password"}
            </button>
            {msg && <p className="text-sm text-destructive">{msg}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
