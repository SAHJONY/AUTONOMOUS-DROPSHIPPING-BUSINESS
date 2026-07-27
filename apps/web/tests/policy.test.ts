import { describe, expect, it, vi } from "vitest";
import { isOwnerEmail } from "@/lib/config";

/**
 * The approval thresholds are the boundary between "the business runs itself"
 * and "the owner's money moves without them knowing", so they are worth testing
 * precisely — in both postures.
 *
 * Posture 1 (this file's default, and what ships): the master release gate is
 * closed, so nothing is auto-approved regardless of amount.
 * Posture 2 (below, with the gate mocked open): the per-action caps decide.
 */

describe("isAutoApprovable — master gate closed (shipping default)", () => {
  it("auto-approves nothing at all, however small the amount", async () => {
    const { isAutoApprovable } = await import("@/lib/store");
    expect(isAutoApprovable("set_ad_budget", { daily_budget: 1 })).toBe(false);
    expect(isAutoApprovable("issue_refund", { amount: 1 })).toBe(false);
    expect(isAutoApprovable("place_supplier_order", { estimated_cost: 1 })).toBe(false);
    expect(isAutoApprovable("create_store", { name: "Test" })).toBe(false);
    expect(isAutoApprovable("kill_product", { product_id: "p1" })).toBe(false);
    expect(isAutoApprovable("future_capital_action", {})).toBe(false);
  });
});

describe("isAutoApprovable — master gate open", () => {
  it("respects each per-action cap and never auto-approves the uncapped actions", async () => {
    vi.resetModules();
    vi.doMock("@/lib/config", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@/lib/config")>()),
      AUTONOMY_ENABLED: true,
    }));

    const { isAutoApprovable } = await import("@/lib/store");
    const { AUTOPILOT_MAX_AD_BUDGET, AUTOPILOT_MAX_ORDER_COST, AUTOPILOT_MAX_REFUND } =
      await import("@/lib/config");

    // At the cap passes; a cent over escalates to the owner.
    expect(isAutoApprovable("set_ad_budget", { daily_budget: AUTOPILOT_MAX_AD_BUDGET })).toBe(true);
    expect(isAutoApprovable("set_ad_budget", { daily_budget: AUTOPILOT_MAX_AD_BUDGET + 1 })).toBe(false);
    expect(isAutoApprovable("issue_refund", { amount: AUTOPILOT_MAX_REFUND })).toBe(true);
    expect(isAutoApprovable("issue_refund", { amount: AUTOPILOT_MAX_REFUND + 1 })).toBe(false);
    expect(isAutoApprovable("place_supplier_order", { estimated_cost: AUTOPILOT_MAX_ORDER_COST })).toBe(true);
    expect(isAutoApprovable("place_supplier_order", { estimated_cost: AUTOPILOT_MAX_ORDER_COST + 0.01 })).toBe(false);
    expect(isAutoApprovable("place_supplier_order", { estimated_cost: 5000 })).toBe(false);

    // Irreversible or unbounded actions stay with the human even when unlocked.
    expect(isAutoApprovable("create_store", { name: "Test" })).toBe(false);
    expect(isAutoApprovable("kill_product", { product_id: "p1" })).toBe(false);
    // Fail closed: an action nobody has written a policy for is never automatic.
    expect(isAutoApprovable("future_capital_action", {})).toBe(false);

    vi.doUnmock("@/lib/config");
    vi.resetModules();
  });
});

describe("isOwnerEmail", () => {
  it("matches the owner regardless of case or padding", () => {
    expect(isOwnerEmail("sahjonycapitalllc@outlook.com")).toBe(true);
    expect(isOwnerEmail("  SahjonyCapitalLLC@Outlook.com  ")).toBe(true);
  });

  it("does not match anyone else", () => {
    expect(isOwnerEmail("someone@example.com")).toBe(false);
    expect(isOwnerEmail("")).toBe(false);
    expect(isOwnerEmail(null)).toBe(false);
    expect(isOwnerEmail("sahjonycapitalllc@outlook.com.attacker.dev")).toBe(false);
  });
});
