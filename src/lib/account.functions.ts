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

    // All app rows are removed in one database transaction (as the user), then the auth account.
    const { error: dataErr } = await context.supabase.rpc("delete_my_account_data" as never);
    if (dataErr) throw new Error(dataErr.message);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(uid);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
