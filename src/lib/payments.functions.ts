import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHmac, timingSafeEqual } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PACK_PRICE_IDS: Record<string, string> = {
  starter: "starter_pack_once", maker: "maker_pack_once", studio: "studio_pack_once",
};

/** Resolves a human-readable Paddle price ID to the provider's internal ID. */
export const resolvePaddlePrice = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({
    priceId: z.enum(["starter_pack_once", "maker_pack_once", "studio_pack_once"]),
    environment: z.enum(["sandbox", "live"]),
  }).parse(d))
  .handler(async ({ data }) => {
    const { gatewayFetch } = await import("./paddle.server");
    const res = await gatewayFetch(data.environment, `/prices?external_id=${encodeURIComponent(data.priceId)}`);
    const json = await res.json();
    if (!json.data?.length) throw new Error("Price not found");
    return json.data[0].id as string;
  });

/** Creates a Razorpay order in INR. The amount comes from the database, never the browser. */
export const createRazorpayOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ packId: z.enum(["starter", "maker", "studio"]) }).parse(d))
  .handler(async ({ data, context }): Promise<
    { ok: true; orderId: string; amount: number; keyId: string; packName: string } | { ok: false; error: string }
  > => {
    const keyId = process.env["RAZORPAY_KEY_ID"], secret = process.env["RAZORPAY_KEY_SECRET"];
    if (!keyId || !secret) return { ok: false, error: "Indian payments aren't set up yet." };
    const { data: pack } = await context.supabase.from("credit_packs")
      .select("id, name, inr").eq("id", data.packId).eq("active", true).maybeSingle();
    if (!pack) return { ok: false, error: "This pack isn't available." };
    const amount = Math.round(Number(pack.inr) * 100);
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Basic " + btoa(`${keyId}:${secret}`) },
      body: JSON.stringify({
        amount, currency: "INR", receipt: `${pack.id}-${Date.now()}`.slice(0, 40),
        notes: { userId: context.userId, packId: pack.id },
      }),
    });
    if (!res.ok) {
      console.error("Razorpay order failed", res.status, await res.text().catch(() => ""));
      return { ok: false, error: "Couldn't start the payment. Please try again." };
    }
    const order = await res.json() as { id: string };
    return { ok: true, orderId: order.id, amount, keyId, packName: pack.name };
  });

/** Verifies the Razorpay payment signature, confirms the order with Razorpay, then adds the credits once. */
export const verifyRazorpayPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    orderId: z.string().min(5).max(64), paymentId: z.string().min(5).max(64), signature: z.string().min(10).max(256),
  }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const keyId = process.env["RAZORPAY_KEY_ID"]!, secret = process.env["RAZORPAY_KEY_SECRET"]!;
    const expected = createHmac("sha256", secret).update(`${data.orderId}|${data.paymentId}`).digest("hex");
    const a = Buffer.from(expected), b = Buffer.from(data.signature);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, error: "Payment could not be verified." };
    const res = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(data.orderId)}`, {
      headers: { Authorization: "Basic " + btoa(`${keyId}:${secret}`) },
    });
    if (!res.ok) return { ok: false, error: "Payment could not be verified." };
    const order = await res.json() as { amount: number; currency: string; status: string; notes?: { userId?: string; packId?: string } };
    if (order.notes?.userId !== context.userId || !order.notes?.packId) return { ok: false, error: "This payment belongs to another account." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("record_purchase", {
      _user: context.userId, _pack_id: order.notes.packId, _price: order.amount / 100,
      _currency: order.currency, _region: "IN", _provider: "razorpay", _payment_ref: data.orderId,
    });
    if (error) { console.error("record_purchase failed", error); return { ok: false, error: "Payment received but credits couldn't be added. Contact us and we'll fix it." }; }
    return { ok: true };
  });
