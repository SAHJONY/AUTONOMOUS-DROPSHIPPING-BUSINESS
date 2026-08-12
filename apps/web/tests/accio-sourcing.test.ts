import { describe, expect, it } from "vitest";
import { assessAccioCandidate, assessAccioSourcingBatch } from "../lib/accio-sourcing";

/** A quote the owner has already verified, priced so a single unit clears the gate. */
const verified = {
  quoteReference: "ACCIO-2026-0001", supplierName: "Fujian Ritual Candle Co.", supplierProfileUrl: "https://www.alibaba.com/company/example.html",
  ownerVerifiedQuote: true, wholesalePrice: 20, shippingCost: 3, handlingCost: 2, markupPercent: 100, currency: "USD", usdExchangeRate: 1, moq: 1,
  supplierProcessingDays: 2, importTransitDays: 0, handlingDays: 1, customerShippingDays: 4,
  inventoryStatus: "IN_STOCK", inventoryVerifiedAt: "2026-08-11T00:00:00Z", resaleAuthorizationStatus: "VERIFIED", authorizationReference: "owner-file-1",
};

describe("Accio sourcing intake", () => {
  it("routes a verified single-unit quote to order funding", () => {
    const result = assessAccioCandidate(verified);
    expect(result.route).toBe("ORDER_FUNDED");
    expect(result.eligibleForOrderFunding).toBe(true);
    expect(result.disqualifiers).toEqual([]);
  });

  it("refuses an unverified quote no matter how good the numbers look", () => {
    const result = assessAccioCandidate({ ...verified, ownerVerifiedQuote: false });
    expect(result.route).toBe("REJECTED");
    expect(result.disqualifiers).toContain("La cotización de Accio no ha sido verificada por el propietario contra el perfil del proveedor.");
  });

  it("names the capital instead of failing a MOQ quote", () => {
    const result = assessAccioCandidate({ ...verified, moq: 50 });
    expect(result.route).toBe("INVENTORY_REQUIRED");
    expect(result.capitalRequiredUsd).toBe(1250); // 50 × $25 landed
    // $1250 back at $45 retail = 28 units of the 50-unit batch.
    expect(result.unitsToRecoverCapital).toBe(28);
    expect(result.breakEvenSellThroughPercent).toBe(56);
    expect(result.eligibleForOrderFunding).toBe(false);
  });

  it("rejects a quote whose retail price never covers the landed cost", () => {
    const result = assessAccioCandidate({ ...verified, moq: 100, markupPercent: 0 });
    expect(result.route).toBe("REJECTED");
    expect(result.disqualifiers).toContain("El precio de venta no cubre el costo puesto en almacén.");
  });

  it("warns when nearly the whole batch must sell just to break even", () => {
    // $20 landed, $24 retail, 20-unit batch: 17 of 20 units just to break even.
    const result = assessAccioCandidate({ ...verified, moq: 20, markupPercent: 20, shippingCost: 0, handlingCost: 0 });
    expect(result.route).toBe("INVENTORY_REQUIRED");
    expect(result.breakEvenSellThroughPercent).toBeGreaterThan(70);
    expect(result.actions.some((a) => a.includes("Margen de seguridad estrecho"))).toBe(true);
  });

  it("keeps a supplier profile mandatory for auditability", () => {
    const result = assessAccioCandidate({ ...verified, supplierProfileUrl: "  " });
    expect(result.route).toBe("REJECTED");
    expect(result.disqualifiers).toContain("Falta el nombre o el enlace del perfil del proveedor de Alibaba.");
  });

  it("ranks order-funded first, then the cheapest capital, and totals the capital at risk", () => {
    const batch = assessAccioSourcingBatch([
      { ...verified, quoteReference: "big", moq: 80 },
      { ...verified, quoteReference: "broken", ownerVerifiedQuote: false },
      { ...verified, quoteReference: "small", moq: 10 },
      { ...verified, quoteReference: "free" },
    ]);
    expect(batch.results.map((r) => r.quoteReference)).toEqual(["free", "small", "big", "broken"]);
    expect(batch.orderFunded).toBe(1);
    expect(batch.inventoryRequired).toBe(2);
    expect(batch.rejected).toBe(1);
    expect(batch.capitalToTakeEveryInventoryDealUsd).toBe(2250); // (10 + 80) × $25
  });
});
