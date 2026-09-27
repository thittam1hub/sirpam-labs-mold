import { supabase } from "@/integrations/supabase/client";

export type CreditAction =
  | "export_stl" | "export_obj" | "export_3mf" | "export_step"
  | "pro_features" | "ai_shape" | "auto_repair" | "mold_report";

export interface CreditStatus { balance: number; monthlyFreeLeft: number; monthlyFreeLimit: number }
export interface SpendResult { ok: boolean; charged: number; fromFree?: number; balance: number; needed?: number; monthlyFreeLeft?: number }
export interface LedgerRow { id: string; delta: number; reason: string; reference: string | null; created_at: string }

export const CREDITS_EVENT = "sirpam:credits";

// Mirrors the database function spend_credits (the source of truth).
export const ACTION_COST: Record<CreditAction, number> = {
  export_stl: 1, export_obj: 1, export_3mf: 2, export_step: 2,
  pro_features: 3, ai_shape: 3, auto_repair: 2, mold_report: 1,
};

export const ACTION_LABEL: Record<string, string> = {
  export_stl: "STL export", export_obj: "OBJ export", export_3mf: "3MF export", export_step: "STEP (CAD) export",
  pro_features: "Pro mold features", ai_shape: "AI model maker", auto_repair: "Automatic repair", mold_report: "Mold report",
  welcome: "Welcome credits", purchase: "Credit pack purchase",
};

export const CREDIT_COSTS: { action: string; cost: string }[] = [
  { action: "STL or OBJ export", cost: "1" },
  { action: "3MF or STEP (CAD) export", cost: "2" },
  { action: "AI model maker, per shape", cost: "3" },
  { action: "Automatic repair of a broken model", cost: "2" },
  { action: "One-page mold report", cost: "1" },
];

export type RegionTier = "standard" | "emerging" | "value";

export const REGION_TIERS: { id: RegionTier; name: string; examples: string }[] = [
  { id: "standard", name: "Standard", examples: "US, Canada, EU, UK, Australia, Japan" },
  { id: "emerging", name: "Emerging markets", examples: "Latin America, Eastern Europe, Middle East" },
  { id: "value", name: "Value markets", examples: "India, Southeast Asia, Africa" },
];

// Prices per region tier (USD). India is shown in rupees.
export const CREDIT_PACKS = [
  { id: "starter", name: "Starter", credits: 20, usd: { standard: 5, emerging: 3, value: 2 }, inr: 199 },
  { id: "maker", name: "Maker", credits: 60, usd: { standard: 12, emerging: 7, value: 5 }, inr: 499, best: true },
  { id: "studio", name: "Studio", credits: 200, usd: { standard: 30, emerging: 18, value: 12 }, inr: 1299 },
] as const;

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
  const { data: s } = await supabase.auth.getSession();
  if (!s.session) return null;
  const { data, error } = await supabase.rpc("get_credit_status" as never);
  if (error) throw error;
  return data as unknown as CreditStatus;
}

export async function getCreditHistory(): Promise<LedgerRow[]> {
  const { data, error } = await supabase
    .from("credit_ledger" as never)
    .select("id, delta, reason, reference, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as unknown as LedgerRow[];
}

export async function spendCredits(action: CreditAction): Promise<SpendResult> {
  const { data, error } = await supabase.rpc("spend_credits" as never, { _action: action } as never);
  if (error) throw error;
  const r = data as unknown as SpendResult;
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CREDITS_EVENT));
  return r;
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
