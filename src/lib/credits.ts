import { supabase } from "@/integrations/supabase/client";

export type CreditAction =
  | "export_stl" | "export_obj" | "export_3mf" | "export_step"
  | "pro_features" | "ai_shape" | "auto_repair" | "mold_report";

export interface CreditStatus {
  balance: number; monthlyFreeLeft: number; monthlyFreeLimit: number;
  nextExpiryAmount?: number; nextExpiryAt?: string | null;
}
export interface HoldResult { ok: boolean; holdId?: string; charged?: number; fromFree?: number; balance: number; needed?: number; monthlyFreeLeft?: number }
export type SpendResult = HoldResult;
export interface LedgerRow { id: string; delta: number; reason: string; reference: string | null; created_at: string; kind: string | null; status: string; expires_at: string | null }

export const CREDITS_EVENT = "sirpam:credits";
export const LOW_BALANCE = 2;

/** Credit policy — keep in sync with DB functions and Terms/Refund pages. */
export const CREDIT_POLICY = {
  welcome: 10, welcomeDays: 90, monthlyFree: 3, purchaseMonths: 24,
};

// Mirrors the database function _action_cost (the source of truth).
export const ACTION_COST: Record<CreditAction, number> = {
  export_stl: 1, export_obj: 1, export_3mf: 2, export_step: 2,
  pro_features: 3, ai_shape: 3, auto_repair: 2, mold_report: 1,
};

export const ACTION_LABEL: Record<string, string> = {
  export_stl: "STL export", export_obj: "OBJ export", export_3mf: "3MF export", export_step: "STEP (CAD) export",
  pro_features: "Pro mold features", ai_shape: "AI model maker", auto_repair: "Automatic repair", mold_report: "Mold report",
  welcome: "Welcome credits", purchase: "Credit pack purchase", promo: "Promo code", expired: "Credits expired",
  referral_referee: "Referral bonus (you joined)", referral_referrer: "Referral bonus (friend joined)",
};

export const KIND_LABEL: Record<string, string> = {
  monthly: "Monthly free", welcome: "Welcome", promo: "Promo", bonus: "Bonus", referral: "Referral",
  purchase: "Purchased", mixed: "Mixed", adjustment: "Adjustment",
};
export const STATUS_LABEL: Record<string, string> = {
  held: "In progress", charged: "Charged", refunded: "Refunded", granted: "Added", expired: "Expired",
};

export function ledgerLabel(reason: string): string {
  if (reason.startsWith("admin: ")) return `Adjustment — ${reason.slice(7)}`;
  return ACTION_LABEL[reason] ?? reason;
}

/** Single price list used by Pricing, Help and prompts. */
export const CREDIT_COSTS: { action: string; cost: string }[] = [
  { action: "STL or OBJ export", cost: String(ACTION_COST.export_stl) },
  { action: "3MF or STEP (CAD) export", cost: String(ACTION_COST.export_3mf) },
  { action: "AI model maker, per shape", cost: String(ACTION_COST.ai_shape) },
  { action: "Automatic repair of a broken model", cost: String(ACTION_COST.auto_repair) },
  { action: "One-page mold report", cost: String(ACTION_COST.mold_report) },
];

export type RegionTier = "standard" | "emerging" | "value";

export const REGION_TIERS: { id: RegionTier; name: string; examples: string }[] = [
  { id: "standard", name: "Standard", examples: "US, Canada, EU, UK, Australia, Japan" },
  { id: "emerging", name: "Emerging markets", examples: "Latin America, Eastern Europe, Middle East" },
  { id: "value", name: "Value markets", examples: "India, Southeast Asia, Africa" },
];

// Prices per region tier (USD). India is shown in rupees.
// Fallback copy — the live catalog lives in the credit_packs table (see getCreditPacks).
export const CREDIT_PACKS = [
  { id: "starter", name: "Starter", credits: 20, usd: { standard: 5, emerging: 3, value: 2 }, inr: 199 },
  { id: "maker", name: "Maker", credits: 60, usd: { standard: 12, emerging: 7, value: 5 }, inr: 499, best: true },
  { id: "studio", name: "Studio", credits: 200, usd: { standard: 30, emerging: 18, value: 12 }, inr: 1299 },
] as const;

export type CreditPack = {
  id: string; name: string; credits: number;
  usd: Record<RegionTier, number>; inr: number; best?: boolean;
};

interface PackRow {
  id: string; name: string; credits: number;
  usd_standard: number; usd_emerging: number; usd_value: number;
  inr: number; best: boolean;
}

/** Live pack catalog from the database; falls back to the bundled list offline. */
export async function getCreditPacks(): Promise<CreditPack[]> {
  try {
    const { data, error } = await supabase
      .from("credit_packs" as never)
      .select("id, name, credits, usd_standard, usd_emerging, usd_value, inr, best, sort")
      .order("sort", { ascending: true });
    if (error || !data?.length) throw error;
    return (data as unknown as PackRow[]).map((r) => ({
      id: r.id, name: r.name, credits: r.credits, inr: r.inr, best: r.best,
      usd: { standard: r.usd_standard, emerging: r.usd_emerging, value: r.usd_value },
    }));
  } catch {
    return CREDIT_PACKS.map((p) => ({ ...p, usd: { ...p.usd } }));
  }
}

export interface Purchase {
  id: string; pack_name: string; credits: number; price: number; currency: string;
  provider: string; status: string; created_at: string; refunded_at: string | null;
}

export async function getPurchases(): Promise<Purchase[]> {
  const { data, error } = await supabase
    .from("purchases" as never)
    .select("id, pack_name, credits, price, currency, provider, status, created_at, refunded_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Purchase[];
}

/** Days until the next credit expiry, or null when nothing expires. */
export function daysUntilExpiry(s: CreditStatus): number | null {
  if (!s.nextExpiryAt || !(s.nextExpiryAmount ?? 0)) return null;
  return Math.ceil((new Date(s.nextExpiryAt).getTime() - Date.now()) / 86400000);
}

export const EXPIRY_WARN_DAYS = 14;

const VALUE_TZ = /^(Asia\/(Kolkata|Calcutta|Dhaka|Karachi|Colombo|Kathmandu|Jakarta|Manila|Ho_Chi_Minh|Saigon|Bangkok|Yangon|Phnom_Penh|Vientiane|Kuala_Lumpur)|Africa\/)/;
const EMERGING_TZ = /^(America\/(Sao_Paulo|Argentina|Buenos_Aires|Bogota|Lima|Santiago|Mexico_City|Caracas|Montevideo|La_Paz|Guayaquil|Asuncion)|Europe\/(Warsaw|Bucharest|Sofia|Kiev|Kyiv|Belgrade|Budapest|Istanbul|Moscow|Minsk|Zagreb|Riga|Vilnius|Tallinn|Chisinau)|Asia\/(Dubai|Riyadh|Baghdad|Tehran|Amman|Beirut|Tbilisi|Yerevan|Baku|Almaty|Tashkent))/;

export function guessRegion(): { tier: RegionTier; india: boolean } {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    const india = /Asia\/(Kolkata|Calcutta)/.test(tz);
    if (VALUE_TZ.test(tz)) return { tier: "value", india };
    if (EMERGING_TZ.test(tz)) return { tier: "emerging", india };
  } catch { /* ignore */ }
  return { tier: "standard", india: false };
}

export async function getCreditStatus(): Promise<CreditStatus | null> {
  const { data, error } = await supabase.rpc("get_credit_status" as never);
  if (error) throw error;
  return data as unknown as CreditStatus;
}

export async function getCreditHistory(limit = 500): Promise<LedgerRow[]> {
  const { data, error } = await supabase
    .from("credit_ledger" as never)
    .select("id, delta, reason, reference, created_at, kind, status, expires_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as LedgerRow[];
}

function notify() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CREDITS_EVENT));
}

/** Reserve credits. They are only charged when captureHold is called. */
export async function holdCredits(action: CreditAction): Promise<HoldResult> {
  const { data, error } = await supabase.rpc("hold_credits" as never, { _action: action } as never);
  if (error) throw error;
  notify();
  return data as unknown as HoldResult;
}
export async function captureHold(id: string): Promise<void> {
  const { error } = await supabase.rpc("capture_hold" as never, { _id: id } as never);
  if (error) console.error("Capture failed:", error);
  notify();
}
export async function releaseHold(id: string): Promise<void> {
  const { error } = await supabase.rpc("release_hold" as never, { _id: id } as never);
  if (error) console.error("Release failed:", error);
  notify();
}

/** Immediate charge (hold + capture). Prefer holdCredits + settle for actions that can fail. */
export async function spendCredits(action: CreditAction): Promise<SpendResult> {
  const { data, error } = await supabase.rpc("spend_credits" as never, { _action: action } as never);
  if (error) throw error;
  notify();
  return data as unknown as SpendResult;
}

export async function redeemPromo(code: string): Promise<{ ok: boolean; credits?: number; error?: string }> {
  const { data, error } = await supabase.rpc("redeem_promo" as never, { _code: code } as never);
  if (error) throw error;
  notify();
  return data as unknown as { ok: boolean; credits?: number; error?: string };
}

/** Referral program — rules live in DB functions (get_referral_info / apply_referral). */
export interface ReferralInfo {
  code: string; pending: number; rewarded: number; earned: number; reward: number; monthlyCap: number;
  referredStatus: string | null; canApply: boolean;
}
export const REFERRAL_STORAGE_KEY = "sirpam:ref";

export async function getReferralInfo(): Promise<ReferralInfo> {
  const { data, error } = await supabase.rpc("get_referral_info" as never);
  if (error) throw error;
  return data as unknown as ReferralInfo;
}

export async function applyReferral(code: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc("apply_referral" as never, { _code: code } as never);
  if (error) throw error;
  return data as unknown as { ok: boolean; error?: string };
}

/** Handle for a reserved charge: call succeed() when the action worked, fail() otherwise. */
export interface Charge { holdId: string; succeed: () => Promise<void>; fail: () => Promise<void> }

/**
 * Shared charge flow for paid tools: requires sign-in, confirms the cost,
 * and holds the credits. Returns a Charge (settle it!) or null when the
 * action must not proceed.
 */
export async function reserveFor(
  action: CreditAction,
  onMessage: (msg: string) => void,
): Promise<Charge | null> {
  try {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) {
      onMessage(`Please sign in to use ${ACTION_LABEL[action]} — you get ${CREDIT_POLICY.welcome} welcome credits plus ${CREDIT_POLICY.monthlyFree} free credits every month.`);
      window.setTimeout(() => window.location.assign(`/auth?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`), 1800);
      return null;
    }
    const status = await getCreditStatus();
    if (status) {
      const c = describeCharge(action, status);
      if (!c.affordable) {
        if (window.confirm(`${c.text.split('.')[0]}. You don't have enough credits. Open the Pricing page to buy more?`)) window.location.assign('/pricing');
        return null;
      }
      if (!window.confirm(`${c.text}\nYou're only charged if it succeeds.\n\nContinue?`)) return null;
    }
    const r = await holdCredits(action);
    if (!r.ok || !r.holdId) {
      onMessage(`${ACTION_LABEL[action]} needs ${r.needed} credit(s) and you have ${r.balance}. Get more on the Pricing page (/pricing).`);
      return null;
    }
    const id = r.holdId;
    let settled = false;
    return {
      holdId: id,
      succeed: async () => { if (!settled) { settled = true; await captureHold(id); } },
      fail: async () => { if (!settled) { settled = true; await releaseHold(id); } },
    };
  } catch (e) {
    console.error('Credit check failed:', e);
    onMessage('Could not check your credits. Please try again.');
    return null;
  }
}

/** Legacy boolean flow: charges immediately on success of the hold. */
export async function chargeFor(action: CreditAction, onMessage: (msg: string) => void): Promise<boolean> {
  const c = await reserveFor(action, onMessage);
  if (!c) return false;
  await c.succeed();
  return true;
}

export function ledgerToCsv(rows: LedgerRow[]): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = ["Date,Activity,Type,Status,Credits"];
  for (const r of rows) {
    lines.push([r.created_at, esc(ledgerLabel(r.reason)), KIND_LABEL[r.kind ?? ""] ?? "", STATUS_LABEL[r.status] ?? r.status, String(r.delta)].join(","));
  }
  return lines.join("\n");
}

/** Describe what an action will use, for the confirm prompt. */
export function describeCharge(action: CreditAction, s: CreditStatus): { text: string; affordable: boolean } {
  const cost = ACTION_COST[action];
  const fromFree = Math.min(s.monthlyFreeLeft, cost);
  const fromPaid = cost - fromFree;
  const parts: string[] = [];
  if (fromFree) parts.push(`${fromFree} free monthly credit${fromFree > 1 ? "s" : ""}`);
  if (fromPaid) parts.push(`${fromPaid} of your ${s.balance} credits`);
  return {
    text: `${ACTION_LABEL[action]} costs ${cost} credit${cost > 1 ? "s" : ""}. This will use ${parts.join(" + ")}.`,
    affordable: s.balance >= fromPaid,
  };
}
