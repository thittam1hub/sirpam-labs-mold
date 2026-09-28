import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { describeCharge, daysUntilExpiry, ledgerToCsv, ACTION_COST, type CreditStatus } from "./credits";

const status = (over: Partial<CreditStatus>): CreditStatus =>
  ({ balance: 0, monthlyFreeLeft: 0, nextExpiryAt: null, nextExpiryAmount: 0, ...over }) as CreditStatus;

describe("describeCharge", () => {
  it("uses free monthly credits before paid ones", () => {
    const r = describeCharge("ai_shape", status({ balance: 10, monthlyFreeLeft: 1 }));
    expect(r.affordable).toBe(true);
    expect(r.text).toContain("1 free monthly credit");
    expect(r.text).toContain(`${ACTION_COST.ai_shape - 1} of your 10 credits`);
  });
  it("is not affordable when paid part exceeds balance", () => {
    expect(describeCharge("ai_shape", status({ balance: 0, monthlyFreeLeft: 0 })).affordable).toBe(false);
  });
  it("is affordable from free credits alone", () => {
    const cost = ACTION_COST.ai_shape;
    const r = describeCharge("ai_shape", status({ balance: 0, monthlyFreeLeft: cost }));
    expect(r.affordable).toBe(true);
    expect(r.text).not.toContain("of your");
  });
});

describe("daysUntilExpiry", () => {
  it("returns null when nothing expires", () => {
    expect(daysUntilExpiry(status({}))).toBeNull();
    expect(daysUntilExpiry(status({ nextExpiryAt: new Date().toISOString(), nextExpiryAmount: 0 }))).toBeNull();
  });
  it("rounds up to whole days", () => {
    const at = new Date(Date.now() + 3.2 * 86400000).toISOString();
    expect(daysUntilExpiry(status({ nextExpiryAt: at, nextExpiryAmount: 5 }))).toBe(4);
  });
});

describe("ledgerToCsv", () => {
  it("escapes quotes and keeps a header", () => {
    const csv = ledgerToCsv([{ created_at: "2026-01-01", reason: 'odd "name"', kind: "purchased", status: "captured", delta: -3 } as never]);
    const [head, row] = csv.split("\n");
    expect(head).toBe("Date,Activity,Type,Status,Credits");
    expect(row).toContain('""name""');
    expect(row?.endsWith(",-3")).toBe(true);
  });
});
