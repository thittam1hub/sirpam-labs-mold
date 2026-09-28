import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhook, EventName, type PaddleEnv } from "@/lib/paddle.server";

const PRICE_TO_PACK: Record<string, string> = {
  starter_pack_once: "starter", maker_pack_once: "maker", studio_pack_once: "studio",
};
const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND"]);

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

async function handleCompleted(data: any, env: PaddleEnv) {
  const userId = data.customData?.userId;
  const extId = data.items?.[0]?.price?.importMeta?.externalId;
  const packId = extId ? PRICE_TO_PACK[extId] : undefined;
  if (!userId || !packId) { console.warn("Skipping transaction: missing user or pack", data.id); return; }
  const cur = String(data.currencyCode ?? "USD").toUpperCase();
  const raw = Number(data.details?.totals?.total ?? 0);
  const price = ZERO_DECIMAL.has(cur) ? raw : raw / 100;
  const sb = await admin();
  const { error } = await sb.rpc("record_purchase", {
    _user: userId, _pack_id: packId, _price: price, _currency: cur,
    _region: data.address?.countryCode ?? null, _provider: env === "live" ? "paddle" : "paddle_test",
    _payment_ref: data.id,
  });
  if (error) throw error;
}

async function handleAdjustment(data: any, env: PaddleEnv) {
  if (data.action !== "refund" && data.action !== "chargeback") return;
  if (data.status && data.status !== "approved") return;
  const sb = await admin();
  await sb.rpc("reverse_purchase" as never, {
    _provider: env === "live" ? "paddle" : "paddle_test", _payment_ref: data.transactionId,
    _reason: data.action === "chargeback" ? "chargeback" : "refund",
  } as never);
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const env = (new URL(request.url).searchParams.get("env") === "live" ? "live" : "sandbox") as PaddleEnv;
        try {
          const event = await verifyWebhook(request, env);
          switch (event.eventType) {
            case EventName.TransactionCompleted: await handleCompleted(event.data, env); break;
            case EventName.AdjustmentCreated:
            case EventName.AdjustmentUpdated: await handleAdjustment(event.data, env); break;
            default: console.log("Unhandled event:", event.eventType);
          }
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
