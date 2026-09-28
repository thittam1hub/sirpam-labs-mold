import { createFileRoute } from "@tanstack/react-router";

/**
 * Razorpay background notifications. Configure in Razorpay Dashboard -> Webhooks:
 *   live: <site>/api/public/payments/razorpay?env=live   events: order.paid, refund.processed
 *   test: <preview>/api/public/payments/razorpay?env=test
 * Every request is signature-checked; credits and refunds are idempotent.
 */
export const Route = createFileRoute("/api/public/payments/razorpay")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const env = new URL(request.url).searchParams.get("env") === "test" ? "test" : "live";
        const secret = process.env[env === "test" ? "RAZORPAY_TEST_WEBHOOK_SECRET" : "RAZORPAY_WEBHOOK_SECRET"];
        const { credsForEnv, hmacHex, safeEqualHex, creditPaidOrder } = await import("@/lib/razorpay.server");
        const c = credsForEnv(env);
        if (!secret || !c) return new Response("Not configured", { status: 503 });
        const body = await request.text();
        const sig = request.headers.get("x-razorpay-signature") ?? "";
        if (!sig || !safeEqualHex(hmacHex(secret, body), sig)) return new Response("Invalid signature", { status: 401 });
        let evt: any;
        try { evt = JSON.parse(body); } catch { return new Response("Bad body", { status: 400 }); }
        try {
          if (evt.event === "order.paid") {
            const orderId = evt.payload?.order?.entity?.id;
            if (orderId) {
              const r = await creditPaidOrder(c, orderId);
              if (!r.ok) throw new Error(r.error);
            }
          } else if (evt.event === "refund.processed") {
            const orderId = evt.payload?.payment?.entity?.order_id;
            if (orderId) {
              const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
              const { error } = await supabaseAdmin.rpc("reverse_purchase", { _provider: c.provider, _payment_ref: orderId, _reason: "refund" });
              if (error) throw error;
            }
          }
          return Response.json({ received: true });
        } catch (e) {
          console.error("Razorpay webhook error", e);
          return new Response("Retry", { status: 500 });
        }
      },
    },
  },
});
