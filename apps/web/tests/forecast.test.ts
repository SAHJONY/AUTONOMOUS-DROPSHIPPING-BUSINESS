import { describe, expect, it } from "vitest";
import { buildForecast } from "@/lib/forecast";
import { buildPnl } from "@/lib/ledger";
import type { LedgerEntry } from "@/lib/types";
import { makeProduct } from "./helpers";

const at = "2026-07-20T10:00:00.000Z";
const now = new Date("2026-07-27T10:00:00.000Z");

const entry = (account: LedgerEntry["account"], amount: number, orderId?: string): LedgerEntry => ({
  id: Math.random().toString(36).slice(2),
  org_id: "org1",
  account,
  amount,
  currency: "USD",
  order_id: orderId,
  memo: "",
  dedupe_key: Math.random().toString(36).slice(2),
  occurred_at: at,
  created_at: at,
});

/** Ten $100 orders costing $40 landed apiece. */
function tradingPnl() {
  const entries: LedgerEntry[] = [];
  for (let i = 0; i < 10; i++) {
    entries.push(entry("revenue", 100, `o${i}`));
    entries.push(entry("cogs", -35, `o${i}`));
    entries.push(entry("supplier_shipping", -5, `o${i}`));
  }
  return buildPnl(entries, "90d", now);
}

describe("buildForecast", () => {
  it("falls back to industry defaults when there is nothing to go on", () => {
    const f = buildForecast([]);
    expect(f.assumptions.derived_from_catalog).toBe(false);
    expect(f.assumptions.derived_from_actuals).toBe(false);
    expect(f.assumptions.aov).toBe(40);
    expect(f.assumptions.basis).toMatch(/defaults/i);
  });

  it("derives economics from catalog pricing before any orders exist", () => {
    const f = buildForecast([makeProduct({ price: 50, cost: 15 })]);
    expect(f.assumptions.derived_from_catalog).toBe(true);
    expect(f.assumptions.derived_from_actuals).toBe(false);
    expect(f.assumptions.aov).toBe(50);
    expect(f.assumptions.cogs).toBe(15);
  });

  it("prefers real settled economics once the business is actually trading", () => {
    const f = buildForecast([makeProduct({ price: 50, cost: 15 })], tradingPnl());
    expect(f.assumptions.derived_from_actuals).toBe(true);
    // Real AOV is $100 and real landed cost is $40 — both override the catalog.
    expect(f.assumptions.aov).toBe(100);
    expect(f.assumptions.cogs).toBe(40);
    expect(f.assumptions.basis).toMatch(/10 real orders/);
  });

  it("ignores a sample too small to mean anything", () => {
    const pnl = buildPnl([entry("revenue", 100, "o1"), entry("cogs", -40, "o1")], "90d", now);
    const f = buildForecast([makeProduct({ price: 50, cost: 15 })], pnl);
    expect(f.assumptions.derived_from_actuals).toBe(false);
    expect(f.assumptions.aov).toBe(50);
  });

  it("ignores actuals that have revenue but no recorded cost", () => {
    const entries = Array.from({ length: 8 }, (_, i) => entry("revenue", 100, `o${i}`));
    const f = buildForecast([makeProduct({ price: 50, cost: 15 })], buildPnl(entries, "90d", now));
    expect(f.assumptions.derived_from_actuals).toBe(false);
  });

  it("never lets modelled COGS exceed 90% of AOV", () => {
    const f = buildForecast([makeProduct({ price: 20, cost: 19.5 })]);
    expect(f.assumptions.cogs).toBeLessThanOrEqual(18);
  });

  it("projects twelve months across three scenarios, each internally consistent", () => {
    const f = buildForecast([makeProduct({ price: 50, cost: 15 })]);
    expect(f.scenarios).toHaveLength(3);
    for (const s of f.scenarios) {
      expect(s.months).toHaveLength(12);
      expect(s.annual.revenue).toBe(s.months.reduce((sum, m) => sum + m.revenue, 0));
      expect(s.annual.net).toBe(s.months.reduce((sum, m) => sum + m.net, 0));
      // Cumulative net is a running total of the monthly nets.
      expect(s.months[11].cumulative).toBe(s.months.reduce((sum, m) => sum + m.net, 0));
      expect(s.cpa).toBeCloseTo(f.assumptions.aov / s.roas, 2);
    }
  });

  it("is deterministic — the same inputs always give the same projection", () => {
    const products = [makeProduct({ price: 50, cost: 15 })];
    expect(buildForecast(products)).toEqual(buildForecast(products));
  });
});
