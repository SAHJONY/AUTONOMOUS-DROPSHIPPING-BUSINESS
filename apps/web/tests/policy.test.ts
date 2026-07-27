import { describe, expect, it } from "vitest";
import {
  AUTOPILOT_MAX_AD_BUDGET,
  AUTOPILOT_MAX_ORDER_COST,
  AUTOPILOT_MAX_REFUND,
  isOwnerEmail,
} from "@/lib/config";
import { isAutoApprovable } from "@/lib/store";

/**
 * These thresholds are the boundary between "the business runs itself" and "the
 * owner's money moves without them knowing". They are worth testing precisely.
 */
describe("isAutoApprovable", () => {
  it("places supplier orders unattended only up to the cost cap", () => {
    expect(isAutoApprovable("place_supplier_order", { estimated_cost: AUTOPILOT_MAX_ORDER_COST })).toBe(true);
    expect(isAutoApprovable("place_supplier_order", { estimated_cost: AUTOPILOT_MAX_ORDER_COST + 0.01 })).toBe(false);
  });

  it("escalates an expensive supplier order to the owner", () => {
    expect(isAutoApprovable("place_supplier_order", { estimated_cost: 5000 })).toBe(false);
  });

  it("treats a supplier order with no stated cost as free, not as unlimited", () => {
    // A missing cost reads as 0 and passes the cap — the cap is a spend guard,
    // and the actual spend check happens again inside placeSupplierOrder.
    expect(isAutoApprovable("place_supplier_order", {})).toBe(true);
  });

  it("respects the ad budget and refund ceilings", () => {
    expect(isAutoApprovable("set_ad_budget", { daily_budget: AUTOPILOT_MAX_AD_BUDGET })).toBe(true);
    expect(isAutoApprovable("set_ad_budget", { daily_budget: AUTOPILOT_MAX_AD_BUDGET + 1 })).toBe(false);
    expect(isAutoApprovable("issue_refund", { amount: AUTOPILOT_MAX_REFUND })).toBe(true);
    expect(isAutoApprovable("issue_refund", { amount: AUTOPILOT_MAX_REFUND + 1 })).toBe(false);
  });

  it("allows the reversible actions without a human", () => {
    expect(isAutoApprovable("create_store", { name: "Test" })).toBe(true);
    expect(isAutoApprovable("kill_product", { product_id: "p1" })).toBe(true);
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
