import { supabase } from "@/integrations/supabase/client";

export type CreditAction =
  | "export_stl" | "export_obj" | "export_3mf" | "export_step"
  | "pro_features" | "ai_shape" | "auto_repair" | "mold_report";

export interface CreditStatus { balance: number; freeExportsUsed: number; freeExportsLimit: number }
export interface SpendResult { ok: boolean; charged: number; free?: boolean; balance: number; needed?: number }

export const CREDITS_EVENT = "sirpam:credits";

// Prices mirror the database function spend_credits (the source of truth).
export const CREDIT_COSTS: { action: string; cost: string }[] = [
  { action: "STL or OBJ export (first 3 each month are free)", cost: "1" },
  { action: "3MF or STEP (CAD) export", cost: "2" },
  { action: "AI model maker, per shape", cost: "3" },
  { action: "Automatic repair of a broken model", cost: "2" },
  { action: "One-page mold report", cost: "1" },
];

export const CREDIT_PACKS = [
  { id: "starter", name: "Starter", credits: 20, usd: 5, inr: 199 },
  { id: "maker", name: "Maker", credits: 60, usd: 12, inr: 499, best: true },
  { id: "studio", name: "Studio", credits: 200, usd: 30, inr: 1299 },
];

export async function getCreditStatus(): Promise<CreditStatus | null> {
  const { data: s } = await supabase.auth.getSession();
  if (!s.session) return null;
  const { data, error } = await supabase.rpc("get_credit_status" as never);
  if (error) throw error;
  return data as unknown as CreditStatus;
}

export async function spendCredits(action: CreditAction): Promise<SpendResult> {
  const { data, error } = await supabase.rpc("spend_credits" as never, { _action: action } as never);
  if (error) throw error;
  const r = data as unknown as SpendResult;
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CREDITS_EVENT));
  return r;
}
