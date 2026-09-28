import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

/**
 * Email sign-up with a server-side 13+ check. The account is only created
 * when the visitor confirmed they are 13 or older; otherwise nothing is sent
 * to the auth service and nothing is stored.
 */
const schema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(200),
  ageConfirmed: z.literal(true, { errorMap: () => ({ message: "You must be 13 or older to create an account." }) }),
  redirectTo: z.string().url().max(500),
});

export const signUpWithAgeCheck = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const url = process.env["SUPABASE_URL"]!;
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await sb.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: data.redirectTo,
        data: { age_confirmed_at: new Date().toISOString() },
      },
    });
    return { error: error?.message ?? null };
  });
