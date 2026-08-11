import { beforeEach, describe, expect, it } from "vitest";
import { getAgent, type AgentContext, type ToolDef } from "@/lib/agents";
import { getPnl, postEntries } from "@/lib/ledger";
import { saveOrder } from "@/lib/orders";
import { makeOrder, resetStore } from "./helpers";

/**
 * Agent tools are the hands of an autonomous operator: whatever they do, they do
 * without a human watching. Their handlers carry real logic — order lookup
 * matching, spend de-duplication, period parsing — and until now none of it was
 * tested directly.
 *
 * These exercise the handlers themselves rather than the model's choice to call
 * them, which is the part that can be pinned down deterministically.
 */

const ctx: AgentContext = { orgId: "org1", depth: 0, runId: null };

function tool(agentName: string, toolName: string): ToolDef {
  const found = getAgent(agentName)?.tools().find((t) => t.name === toolName);
  if (!found) throw new Error(`${agentName} has no tool '${toolName}'`);
  return found;
}

beforeEach(resetStore);

describe("support · lookup_order", () => {
  beforeEach(async () => {
    await saveOrder(
      makeOrder({
        tracking_number: "LP123",
        tracking_url: "https://track/LP123",
        stage: "shipped",
      }),
    );
  });

  const lookup = (query: string) => tool("support", "lookup_order").handler(ctx, { query });

  it("finds an order by the number a customer would actually quote", async () => {
    const result = JSON.parse(await lookup("#1001"));
    expect(result.order_number).toBe("#1001");
    expect(result.tracking_number).toBe("LP123");
    expect(result.stage).toBe("shipped");
  });

  it("finds it when the customer omits the hash", async () => {
    expect(JSON.parse(await lookup("1001")).order_number).toBe("#1001");
  });

  it("finds it by email, our id, and the store's id", async () => {
    expect(JSON.parse(await lookup("buyer@example.com")).order_number).toBe("#1001");
    expect(JSON.parse(await lookup("order_1")).order_number).toBe("#1001");
    expect(JSON.parse(await lookup("6001")).order_number).toBe("#1001");
  });

  it("is case-insensitive about the email", async () => {
    expect(JSON.parse(await lookup("BUYER@EXAMPLE.COM")).order_number).toBe("#1001");
  });

  it("says plainly when there is no such order rather than inventing one", async () => {
    const result = await lookup("#9999");
    expect(result).toMatch(/no order matching/i);
    expect(() => JSON.parse(result)).toThrow();
  });

  it("hands the agent the timeline, so replies cite what actually happened", async () => {
    const result = JSON.parse(await lookup("#1001"));
    expect(Array.isArray(result.timeline)).toBe(true);
    expect(result.shipping_to).toBe("San Francisco, United States");
  });
});

describe("finance · record_ad_spend", () => {
  const record = (args: Record<string, unknown>) =>
    tool("finance", "record_ad_spend").handler(ctx, args);

  it("posts the spend to the books", async () => {
    const out = await record({ channel: "tiktok", amount: 240, period: "2026-07-26" });
    expect(out).toMatch(/recorded \$240\.00/i);
    expect((await getPnl("org1", "all")).ad_spend).toBe(240);
  });

  it("refuses to record the same channel and period twice", async () => {
    await record({ channel: "tiktok", amount: 240, period: "2026-07-26" });
    const second = await record({ channel: "tiktok", amount: 240, period: "2026-07-26" });

    expect(second).toMatch(/already recorded/i);
    // The critical part: the second call must not inflate spend.
    expect((await getPnl("org1", "all")).ad_spend).toBe(240);
  });

  it("keeps separate channels and periods separate", async () => {
    await record({ channel: "tiktok", amount: 100, period: "2026-07-26" });
    await record({ channel: "meta", amount: 50, period: "2026-07-26" });
    await record({ channel: "tiktok", amount: 75, period: "2026-07-27" });

    expect((await getPnl("org1", "all")).ad_spend).toBe(225);
  });

  it("rejects a nonsensical amount instead of writing it to the books", async () => {
    for (const amount of [0, -50, "abc"]) {
      expect(await record({ channel: "meta", amount })).toMatch(/must be a positive number/i);
    }
    expect((await getPnl("org1", "all")).ad_spend).toBe(0);
  });
});

describe("finance · get_profit_and_loss", () => {
  const pnl = (args: Record<string, unknown> = {}) =>
    tool("finance", "get_profit_and_loss").handler(ctx, args);

  it("tells the agent the books are empty rather than returning misleading zeros", async () => {
    const out = await pnl();
    expect(out).toMatch(/no orders/i);
    expect(out).toMatch(/nothing has sold yet/i);
  });

  it("returns the statement once there is trading", async () => {
    await postEntries("org1", [
      { account: "revenue", amount: 500, dedupe_key: "r1", order_id: "o1" },
      { account: "cogs", amount: 200, dedupe_key: "c1", order_id: "o1" },
    ]);
    const result = JSON.parse(await pnl({ period: "30d" }));
    expect(result.gross_revenue).toBe(500);
    expect(result.gross_profit).toBe(300);
  });

  it("falls back to a sane window when the model invents a period", async () => {
    await postEntries("org1", [
      { account: "revenue", amount: 10, dedupe_key: "r1", order_id: "o1" },
    ]);
    expect(JSON.parse(await pnl({ period: "last-tuesday" })).period.key).toBe("30d");
  });
});

describe("shared · list_orders", () => {
  const list = (args: Record<string, unknown> = {}) =>
    tool("ceo", "list_orders").handler(ctx, args);

  beforeEach(async () => {
    await saveOrder(makeOrder({ id: "a", order_number: "#1", stage: "received" }));
    await saveOrder(
      makeOrder({ id: "b", order_number: "#2", stage: "on_hold", hold_reason: "Unmapped SKU" }),
    );
  });

  it("surfaces the hold reason, so the agent can explain the blockage", async () => {
    const out = await list();
    expect(out).toMatch(/HELD: Unmapped SKU/);
  });

  it("filters to a single stage", async () => {
    const out = await list({ stage: "on_hold" });
    expect(out).toMatch(/#2/);
    expect(out).not.toMatch(/#1\b/);
  });

  it("reports an empty stage honestly", async () => {
    expect(await list({ stage: "delivered" })).toMatch(/no orders in stage 'delivered'/i);
  });
});

describe("finance · compute_unit_economics", () => {
  it("computes per-order profit including fees", async () => {
    const result = JSON.parse(
      await tool("finance", "compute_unit_economics").handler(ctx, {
        price: 39.99,
        cost: 9.5,
        ad_cost_per_order: 8,
      }),
    );
    // 39.99 − 9.50 − 8.00 − (39.99 × 3%) = 21.29
    expect(result.profit_per_order).toBe(21.29);
    expect(result.net_margin_pct).toBeCloseTo(53.24, 1);
  });
});

describe("tool surface", () => {
  /**
   * A lock on this set. Adding a tool that spends money or changes the outside
   * world without `requires_approval` should fail here rather than in production,
   * and quietly *removing* a gate should be equally loud.
   */
  it("gates exactly the actions that move money or reach the outside world", () => {
    const gated = new Set<string>();
    for (const agent of ["ceo", "supplier", "store_builder", "advertising", "support"]) {
      for (const t of getAgent(agent)!.tools()) if (t.requires_approval) gated.add(t.name);
    }
    expect(gated).toEqual(
      new Set([
        "place_supplier_order", // spends cash at the supplier
        "publish_product_to_shopify", // puts a listing in front of customers
        "create_store", // creates a storefront
        "set_ad_budget", // commits ad spend
        "issue_refund", // returns money to a customer
        "kill_product", // retires a product
      ]),
    );
  });

  it("gives every agent the catalog, the order book and the P&L", () => {
    for (const agent of ["ceo", "product_hunter", "supplier", "finance", "support", "marketing"]) {
      const names = getAgent(agent)!.tools().map((t) => t.name);
      expect(names).toContain("list_products");
      expect(names).toContain("list_orders");
      expect(names).toContain("get_profit_and_loss");
    }
  });

  it("declares a schema for every tool the model can call", () => {
    for (const agent of getAgent("ceo") ? ["ceo", "supplier", "finance", "support"] : []) {
      for (const t of getAgent(agent)!.tools()) {
        expect(t.description.length).toBeGreaterThan(20);
        expect(t.input_schema).toHaveProperty("type", "object");
      }
    }
  });
});
