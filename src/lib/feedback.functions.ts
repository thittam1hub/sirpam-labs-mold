import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  category: z.enum(["bug", "idea", "other"]).default("bug"),
  message: z.string().trim().min(10, "Please describe the issue in a few more words.").max(4000),
  email: z.string().trim().email().max(320).optional().or(z.literal("")),
  pageUrl: z.string().max(2000).optional(),
  userAgent: z.string().max(500).optional(),
});

export const submitFeedback = createServerFn({ method: "POST" })
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("feedback_reports").insert({
      category: data.category,
      message: data.message,
      email: data.email || null,
      page_url: data.pageUrl ?? null,
      user_agent: data.userAgent ?? null,
    });
    if (error) throw new Error(`Could not save your report: ${error.message}`);
    return { ok: true };
  });
