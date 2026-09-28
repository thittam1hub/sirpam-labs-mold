import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const vec3 = z.tuple([z.number(), z.number(), z.number()]);
const pt = z.tuple([z.number(), z.number()]);

export const ShapeSpec = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("lathe"), name: z.string().default("shape"), profile: z.array(pt).min(3).max(200) }),
  z.object({
    kind: z.literal("extrude"), name: z.string().default("shape"), outline: z.array(pt).min(3).max(400),
    holes: z.array(z.array(pt).min(3)).optional(), height: z.number().positive().max(500),
  }),
  z.object({
    kind: z.literal("compound"), name: z.string().default("shape"),
    parts: z.array(z.object({
      shape: z.enum(["box", "sphere", "cylinder", "cone"]), size: vec3,
      pos: vec3.default([0, 0, 0]), rot: vec3.default([0, 0, 0]), op: z.enum(["add", "subtract"]).default("add"),
    })).min(1).max(40),
  }),
]);
export type ShapeSpec = z.infer<typeof ShapeSpec>;

// Requires sign-in and an open 'ai_shape' credit hold owned by the caller; the hold is
// captured here on AI success, so the endpoint can't be used without paying.
export const generateShape = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    prompt: z.string().max(1000),
    image: z.string().max(6_000_000).startsWith("data:image/").optional(),
    holdId: z.string().uuid(),
  }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; spec: ShapeSpec } | { ok: false; error: string }> => {
    const { generateShapeJson, AiError } = await import("./shapeAi.server");
    const key = process.env['LOVABLE_API_KEY'];
    if (!key) return { ok: false, error: "AI is not configured for this app." };
    if (!data.prompt.trim() && !data.image) return { ok: false, error: "Describe an object or add a photo." };
    const { data: hold } = await context.supabase.from("credit_holds")
      .select("id, action, status, created_at").eq("id", data.holdId).eq("user_id", context.userId).maybeSingle();
    if (!hold || hold.action !== "ai_shape" || hold.status !== "held"
      || Date.now() - new Date(hold.created_at).getTime() > 25 * 60_000) {
      return { ok: false, error: "Your credit reservation expired. Please try again." };
    }
    // Fair-use limit: at most 20 AI generations per person per hour.
    const { count } = await context.supabase.from("credit_holds")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId).eq("action", "ai_shape")
      .gte("created_at", new Date(Date.now() - 3600_000).toISOString());
    if ((count ?? 0) > 20) {
      return { ok: false, error: "You've made a lot of models in the last hour. Please wait a little and try again — your credits weren't used." };
    }
    try {
      const raw = await generateShapeJson(key, data.prompt, data.image);
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) return { ok: false, error: "The AI reply was not a shape. Try again with a simpler description." };
      const parsed = ShapeSpec.safeParse(JSON.parse(m[0]));
      if (!parsed.success) return { ok: false, error: "The AI made a shape the app can't build. Try a simpler description." };
      const { data: captured } = await context.supabase.rpc("capture_hold", { _id: data.holdId });
      if (!captured) return { ok: false, error: "Your credit reservation expired. Please try again." };
      return { ok: true, spec: parsed.data };
    } catch (e) {
      if (e instanceof AiError) return { ok: false, error: e.message };
      console.error("generateShape failed", e);
      return { ok: false, error: "Something went wrong talking to the AI." };
    }
  });
