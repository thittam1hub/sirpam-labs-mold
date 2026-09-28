import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
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

async function host() {
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  return getRequestHeader("x-forwarded-host") ?? getRequestHeader("host") ?? "";
}

/** Creates a Razorpay order in INR. The amount comes from the database, never the browser. */
export const createRazorpayOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ packId: z.enum(["starter", "maker", "studio"]) }).parse(d))
  .handler(async ({ data, context }): Promise<
    { ok: true; orderId: string; amount: number; keyId: string; packName: string; test: boolean } | { ok: false; error: string }
  > => {
    const { getRazorpayCreds, rzpAuth } = await import("./razorpay.server");
    const c = getRazorpayCreds(await host());
    if ("error" in c) return { ok: false, error: c.error };
    const { data: pack } = await context.supabase.from("credit_packs")
      .select("id, name, inr").eq("id", data.packId).eq("active", true).maybeSingle();
    if (!pack) return { ok: false, error: "This pack isn't available." };
    const amount = Math.round(Number(pack.inr) * 100);
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: rzpAuth(c) },
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
    return { ok: true, orderId: order.id, amount, keyId: c.keyId, packName: pack.name, test: c.env === "test" };
  });

/** Verifies the Razorpay signature, confirms the order is paid, then adds the credits once. */
export const verifyRazorpayPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    orderId: z.string().min(5).max(64), paymentId: z.string().min(5).max(64), signature: z.string().min(10).max(256),
  }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const { getRazorpayCreds, hmacHex, safeEqualHex, creditPaidOrder } = await import("./razorpay.server");
    const c = getRazorpayCreds(await host());
    if ("error" in c) return { ok: false, error: c.error };
    if (!safeEqualHex(hmacHex(c.secret, `${data.orderId}|${data.paymentId}`), data.signature)) {
      return { ok: false, error: "Payment could not be verified." };
    }
    return creditPaidOrder(c, data.orderId, context.userId);
  });

/** Lets the checkout page wait for a purchase to land (Paddle confirms in the background). */
export const getPurchaseStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ref: z.string().min(5).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase.from("purchases")
      .select("credits, status").eq("user_id", context.userId).eq("payment_ref", data.ref).maybeSingle();
    return { found: !!row, credits: row?.credits ?? 0 };
  });
