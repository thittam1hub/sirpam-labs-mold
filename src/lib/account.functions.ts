import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Permanently deletes the signed-in user's data and auth account.
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const uid = context.userId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Remove storage files owned by the user (paths are `<user_id>/...`).
    for (const bucket of ["mold-photos", "avatars"] as const) {
      const { data: files } = await supabaseAdmin.storage.from(bucket).list(uid, { limit: 1000 });
      if (files && files.length > 0) {
        await supabaseAdmin.storage.from(bucket).remove(files.map((f) => `${uid}/${f.name}`));
      }
    }

    // Rows with ON DELETE CASCADE go with the auth user; clean the rest explicitly.
    await supabaseAdmin.from("gallery_items").delete().eq("user_id", uid);
    await supabaseAdmin.from("credit_ledger").delete().eq("user_id", uid);
    await supabaseAdmin.from("credit_balances").delete().eq("user_id", uid);
    await supabaseAdmin.from("monthly_usage").delete().eq("user_id", uid);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(uid);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
