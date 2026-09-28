import { useEffect, useState } from "react";
import { Copy, Gift } from "lucide-react";
import { applyReferral, getReferralInfo, type ReferralInfo } from "@/lib/credits";
import { Button } from "@/components/ui/button";

export function ReferralCard({ onChanged }: { onChanged: () => void }) {
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => getReferralInfo().then(setInfo).catch(() => {});
  useEffect(() => { void load(); }, []);
  if (!info) return null;

  const link = `${window.location.origin}/auth?mode=signup&ref=${info.code}`;
  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  const apply = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      const r = await applyReferral(code);
      setMsg(r.ok ? `Code accepted. You'll both get ${info.reward} credits after your first successful export or paid tool.` : r.error ?? "Could not use this code.");
      if (r.ok) { setCode(""); void load(); onChanged(); }
    } catch { setMsg("Could not use this code. Please try again."); }
    setBusy(false);
  };

  return (
    <section className="mt-8 rounded-3xl bg-card p-6 shadow-sm">
      <h2 className="flex items-center gap-2 text-xl font-semibold"><Gift className="h-5 w-5 text-primary" aria-hidden /> Invite friends, get credits</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Share your link. When a friend signs up and completes their first successful export or paid tool, you both get {info.reward} credits (valid 90 days).
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input readOnly value={link} aria-label="Your invite link" onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm" />
        <Button type="button" variant="outline" onClick={copy}><Copy className="mr-1 h-4 w-4" aria-hidden />{copied ? "Copied" : "Copy link"}</Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Your code: <b className="tracking-wider text-foreground">{info.code}</b></p>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-2xl bg-background p-3"><dt className="text-xs text-muted-foreground">Waiting</dt><dd className="text-2xl font-bold">{info.pending}</dd></div>
        <div className="rounded-2xl bg-background p-3"><dt className="text-xs text-muted-foreground">Joined</dt><dd className="text-2xl font-bold">{info.rewarded}</dd></div>
        <div className="rounded-2xl bg-background p-3"><dt className="text-xs text-muted-foreground">Credits earned</dt><dd className="text-2xl font-bold text-primary">{info.earned}</dd></div>
      </dl>
      {info.canApply && (
        <form onSubmit={apply} className="mt-4 flex flex-wrap items-center gap-2">
          <label htmlFor="refcode" className="text-sm">Were you invited?</label>
          <input id="refcode" value={code} onChange={(e) => setCode(e.target.value)} maxLength={20} placeholder="Invite code"
            className="w-36 rounded-lg border border-input bg-background px-3 py-2 text-sm uppercase" />
          <Button type="submit" variant="outline" disabled={busy || code.trim().length < 4}>{busy ? "Applying…" : "Apply"}</Button>
        </form>
      )}
      {info.referredStatus === "pending" && (
        <p className="mt-3 text-sm text-muted-foreground">You joined with an invite. Your bonus arrives after your first successful export or paid tool.</p>
      )}
      {msg && <p className="mt-2 text-sm text-muted-foreground" role="status">{msg}</p>}
      <p className="mt-3 text-xs text-muted-foreground">
        Up to {info.monthlyCap} rewarded invites a month. Invite codes work within 7 days of a new account's sign-up, need a confirmed email, and can't be used on your own account. Rewards for fake or duplicate accounts are removed.
      </p>
    </section>
  );
}
