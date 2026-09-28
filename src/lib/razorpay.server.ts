import { createHmac, timingSafeEqual } from "crypto";

export type RzpEnv = "test" | "live";
export type RzpCreds = { env: RzpEnv; keyId: string; secret: string; provider: "razorpay" | "razorpay_test" };

/** Preview/dev hosts must never touch live money. */
export function isPreviewHost(host: string | null | undefined): boolean {
  const h = (host ?? "").toLowerCase();
  return h.startsWith("localhost") || h.startsWith("127.0.0.1") || h.includes("id-preview--") || h.includes("-dev.lovable.app") || h.includes("preview--");
}

/** Picks Razorpay keys by host: test keys on preview, live keys on the published site. */
export function getRazorpayCreds(host: string | null | undefined): RzpCreds | { error: string } {
  if (isPreviewHost(host)) {
    const keyId = process.env["RAZORPAY_TEST_KEY_ID"], secret = process.env["RAZORPAY_TEST_KEY_SECRET"];
    if (!keyId || !secret) return { error: "Indian test payments aren't set up in the preview yet." };
    if (!keyId.startsWith("rzp_test_")) return { error: "The preview needs Razorpay test keys, not live keys." };
    return { env: "test", keyId, secret, provider: "razorpay_test" };
  }
  const keyId = process.env["RAZORPAY_KEY_ID"], secret = process.env["RAZORPAY_KEY_SECRET"];
  if (!keyId || !secret) return { error: "Indian payments aren't set up yet." };
  return { env: "live", keyId, secret, provider: "razorpay" };
}

export function credsForEnv(env: RzpEnv): RzpCreds | null {
  const keyId = process.env[env === "test" ? "RAZORPAY_TEST_KEY_ID" : "RAZORPAY_KEY_ID"];
  const secret = process.env[env === "test" ? "RAZORPAY_TEST_KEY_SECRET" : "RAZORPAY_KEY_SECRET"];
  if (!keyId || !secret) return null;
  return { env, keyId, secret, provider: env === "test" ? "razorpay_test" : "razorpay" };
}

export function rzpAuth(c: RzpCreds) {
  return "Basic " + btoa(`${c.keyId}:${c.secret}`);
}

export function safeEqualHex(expected: string, given: string): boolean {
  const a = Buffer.from(expected), b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function hmacHex(secret: string, body: string) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

type Order = { id: string; amount: number; amount_paid?: number; currency: string; status: string; notes?: { userId?: string; packId?: string } };

/** Credits an order once it is fully paid. Idempotent by (provider, order id). */
export async function creditPaidOrder(c: RzpCreds, orderId: string, expectUser?: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`, { headers: { Authorization: rzpAuth(c) } });
  if (!res.ok) return { ok: false, error: "Payment could not be verified." };
  const order = (await res.json()) as Order;
  if (order.status !== "paid") return { ok: false, error: "Payment isn't complete yet." };
  const userId = order.notes?.userId, packId = order.notes?.packId;
  if (!userId || !packId) return { ok: false, error: "Payment is missing order details." };
  if (expectUser && userId !== expectUser) return { ok: false, error: "This payment belongs to another account." };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.rpc("record_purchase", {
    _user: userId, _pack_id: packId, _price: order.amount / 100, _currency: order.currency,
    _region: "IN", _provider: c.provider, _payment_ref: order.id,
  });
  if (error) { console.error("record_purchase failed", error); return { ok: false, error: "Payment received but credits couldn't be added. Contact us and we'll fix it." }; }
  return { ok: true };
}
