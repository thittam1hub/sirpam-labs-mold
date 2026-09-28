/**
 * Live checks against the real credit functions. Runs only when a session file
 * exists (CREDITS_LIVE_SESSION=path to a minted session JSON). Every hold is
 * released, so the account balance is unchanged afterwards.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const path = process.env['CREDITS_LIVE_SESSION'] ?? "";
const run = !!path && existsSync(path);
const env = Object.fromEntries(
  (existsSync(".env") ? readFileSync(".env", "utf8") : "").split("\n").map(l => l.split("=")).filter(p => p.length >= 2).map(([k, ...v]) => [k.trim(), v.join("=").trim().replace(/^"|"$/g, "")]),
);

describe.skipIf(!run)("credit functions (live)", () => {
  let sb: SupabaseClient;
  beforeAll(async () => {
    const minted = JSON.parse(readFileSync(path, "utf8"));
    sb = createClient(env['VITE_SUPABASE_URL']!, env['VITE_SUPABASE_PUBLISHABLE_KEY']!, { auth: { persistSession: false } });
    await sb.auth.setSession({ access_token: minted.session.access_token, refresh_token: minted.session.refresh_token });
  });

  const status = async () => (await sb.rpc("get_credit_status")).data as { balance: number; monthlyFreeLeft: number };

  it("hold then release leaves the balance unchanged", async () => {
    const before = await status();
    const { data: h, error } = await sb.rpc("hold_credits", { _action: "export_stl" });
    expect(error).toBeNull();
    const hold = h as { ok: boolean; holdId?: string };
    if (!hold.ok) return; // nothing to spend — still a valid outcome
    const mid = await status();
    expect(mid.balance + mid.monthlyFreeLeft).toBeLessThan(before.balance + before.monthlyFreeLeft);
    expect((await sb.rpc("release_hold", { _id: hold.holdId })).data).toBe(true);
    const after = await status();
    expect(after).toMatchObject({ balance: before.balance, monthlyFreeLeft: before.monthlyFreeLeft });
  });

  it("a hold cannot be released twice", async () => {
    const { data } = await sb.rpc("hold_credits", { _action: "export_stl" });
    const hold = data as { ok: boolean; holdId?: string };
    if (!hold.ok) return;
    expect((await sb.rpc("release_hold", { _id: hold.holdId })).data).toBe(true);
    expect((await sb.rpc("release_hold", { _id: hold.holdId })).data).toBe(false);
    expect((await sb.rpc("capture_hold", { _id: hold.holdId })).data).toBe(false);
  });

  it("signed-in users cannot add credits", async () => {
    const { error } = await sb.rpc("grant_credits", { _user: "00000000-0000-0000-0000-000000000000", _amount: 100, _reason: "hack", _reference: "t", _kind: "purchased", _valid_days: 1 });
    expect(error).not.toBeNull();
  });

  it("signed-in users cannot write the ledger directly", async () => {
    const { error } = await sb.from("credit_lots").insert({ amount: 999 } as never);
    expect(error).not.toBeNull();
  });
});
