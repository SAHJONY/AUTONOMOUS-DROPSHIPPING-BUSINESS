import { beforeEach, describe, expect, it } from "vitest";
import {
  buildPnl,
  getPnl,
  listLedger,
  normalizeAmount,
  paymentFeeFor,
  periodBounds,
  postEntries,
  postEntry,
} from "@/lib/ledger";
import type { LedgerEntry } from "@/lib/types";
import { resetStore } from "./helpers";

const entry = (over: Partial<LedgerEntry>): LedgerEntry => ({
  id: Math.random().toString(36).slice(2),
  org_id: "org1",
  account: "revenue",
  amount: 0,
  currency: "USD",
  memo: "",
  dedupe_key: Math.random().toString(36).slice(2),
  occurred_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  ...over,
});

describe("normalizeAmount", () => {
  it("forces cost accounts negative whichever sign the caller passes", () => {
    expect(normalizeAmount("cogs", 30)).toBe(-30);
    expect(normalizeAmount("cogs", -30)).toBe(-30);
    expect(normalizeAmount("refunds", 12.5)).toBe(-12.5);
    expect(normalizeAmount("ad_spend", 100)).toBe(-100);
  });

  it("forces income accounts positive", () => {
    expect(normalizeAmount("revenue", 40)).toBe(40);
    expect(normalizeAmount("revenue", -40)).toBe(40);
    expect(normalizeAmount("shipping_income", -5)).toBe(5);
  });
});

describe("paymentFeeFor", () => {
  it("applies the standard online card rate", () => {
    // 2.9% + $0.30 on a $100 order.
    expect(paymentFeeFor(100)).toBe(3.2);
  });

  it("charges nothing on a zero-value order", () => {
    expect(paymentFeeFor(0)).toBe(0);
    expect(paymentFeeFor(-10)).toBe(0);
  });
});

describe("buildPnl", () => {
  it("computes the full statement from entries", () => {
    const now = new Date("2026-07-27T12:00:00Z");
    const at = "2026-07-20T12:00:00Z";
    const pnl = buildPnl(
      [
        entry({ account: "revenue", amount: 200, order_id: "o1", units: 2, occurred_at: at }),
        entry({ account: "revenue", amount: 100, order_id: "o2", units: 1, occurred_at: at }),
        entry({ account: "shipping_income", amount: 10, order_id: "o1", occurred_at: at }),
        entry({ account: "discount", amount: -20, order_id: "o1", occurred_at: at }),
        entry({ account: "cogs", amount: -90, order_id: "o1", occurred_at: at }),
        entry({ account: "supplier_shipping", amount: -12, order_id: "o1", occurred_at: at }),
        entry({ account: "payment_fees", amount: -9, order_id: "o1", occurred_at: at }),
        entry({ account: "refunds", amount: -30, order_id: "o2", occurred_at: at }),
        entry({ account: "ad_spend", amount: -50, occurred_at: at }),
        entry({ account: "tax", amount: 24, order_id: "o1", occurred_at: at }),
      ],
      "30d",
      now,
    );

    // 300 revenue + 10 shipping - 20 discount - 30 refunds
    expect(pnl.net_revenue).toBe(260);
    // 260 - 90 cogs - 12 supplier shipping - 9 fees
    expect(pnl.gross_profit).toBe(149);
    // 149 - 50 ad spend
    expect(pnl.net_profit).toBe(99);
    expect(pnl.orders).toBe(2);
    expect(pnl.units).toBe(3);
    expect(pnl.net_margin_pct).toBeCloseTo(38.08, 1);
    // AOV excludes refunds: (300 + 10 - 20) / 2
    expect(pnl.aov).toBe(145);
    expect(pnl.profit_per_order).toBe(49.5);
  });

  it("keeps sales tax out of revenue and profit — it is money held for the state", () => {
    const now = new Date("2026-07-27T12:00:00Z");
    const at = "2026-07-26T12:00:00Z";
    const pnl = buildPnl(
      [
        entry({ account: "revenue", amount: 100, order_id: "o1", occurred_at: at }),
        entry({ account: "tax", amount: 8.25, order_id: "o1", occurred_at: at }),
      ],
      "30d",
      now,
    );
    expect(pnl.net_revenue).toBe(100);
    expect(pnl.net_profit).toBe(100);
    expect(pnl.tax_collected).toBe(8.25);
  });

  it("excludes entries outside the reporting window", () => {
    const now = new Date("2026-07-27T12:00:00Z");
    const pnl = buildPnl(
      [
        entry({ account: "revenue", amount: 100, order_id: "recent", occurred_at: "2026-07-25T00:00:00Z" }),
        entry({ account: "revenue", amount: 999, order_id: "ancient", occurred_at: "2024-01-01T00:00:00Z" }),
      ],
      "7d",
      now,
    );
    expect(pnl.gross_revenue).toBe(100);
    expect(pnl.orders).toBe(1);
  });

  it("reports zeros rather than dividing by zero on an empty ledger", () => {
    const pnl = buildPnl([], "30d");
    expect(pnl.net_profit).toBe(0);
    expect(pnl.aov).toBe(0);
    expect(pnl.net_margin_pct).toBe(0);
    expect(pnl.profit_per_order).toBe(0);
  });

  it("reports a loss honestly when costs exceed revenue", () => {
    const at = "2026-07-26T12:00:00Z";
    const pnl = buildPnl(
      [
        entry({ account: "revenue", amount: 100, order_id: "o1", occurred_at: at }),
        entry({ account: "cogs", amount: -60, occurred_at: at }),
        entry({ account: "ad_spend", amount: -80, occurred_at: at }),
      ],
      "30d",
      new Date("2026-07-27T12:00:00Z"),
    );
    expect(pnl.net_profit).toBe(-40);
    expect(pnl.net_margin_pct).toBe(-40);
  });
});

describe("periodBounds", () => {
  it("starts 'today' at midnight UTC, not 24 hours ago", () => {
    const now = new Date("2026-07-27T18:30:00Z");
    expect(periodBounds("today", now).from.toISOString()).toBe("2026-07-27T00:00:00.000Z");
  });

  it("reaches back to the epoch for all-time", () => {
    expect(periodBounds("all", new Date()).from.getTime()).toBe(0);
  });
});

describe("posting (persisted)", () => {
  beforeEach(resetStore);

  it("never double-counts a dedupe key, however many times it is replayed", async () => {
    const post = () =>
      postEntry("org1", { account: "revenue", amount: 100, dedupe_key: "order:1:revenue" });

    expect(await post()).not.toBeNull();
    expect(await post()).toBeNull();
    expect(await post()).toBeNull();

    const pnl = await getPnl("org1", "all");
    expect(pnl.gross_revenue).toBe(100);
    expect((await listLedger("org1")).length).toBe(1);
  });

  it("lets a signed true-up correct an over-estimated cost", async () => {
    await postEntries("org1", [
      { account: "cogs", amount: 40, dedupe_key: "order:1:cogs" },
      // The supplier actually charged $32 — give $8 back to the books.
      { account: "cogs", amount: 8, signed: true, dedupe_key: "order:1:cogs:trueup" },
    ]);
    const pnl = await getPnl("org1", "all");
    expect(pnl.cogs).toBe(32);
  });

  it("claims the dedupe key for a zero-value entry without storing a row", async () => {
    const first = await postEntry("org1", {
      account: "shipping_income",
      amount: 0,
      dedupe_key: "order:1:shipping_income",
    });
    expect(first).not.toBeNull();
    expect(await listLedger("org1")).toHaveLength(0);
    // The key is spoken for, so a retry stays a no-op.
    expect(
      await postEntry("org1", {
        account: "shipping_income",
        amount: 0,
        dedupe_key: "order:1:shipping_income",
      }),
    ).toBeNull();
  });

  it("keeps each organization's books separate", async () => {
    await postEntry("org1", { account: "revenue", amount: 100, dedupe_key: "order:1:revenue" });
    await postEntry("org2", { account: "revenue", amount: 250, dedupe_key: "order:1:revenue" });

    expect((await getPnl("org1", "all")).gross_revenue).toBe(100);
    expect((await getPnl("org2", "all")).gross_revenue).toBe(250);
  });
});
