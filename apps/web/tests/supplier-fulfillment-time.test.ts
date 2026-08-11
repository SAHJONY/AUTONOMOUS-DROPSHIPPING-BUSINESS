import { describe, expect, it } from "vitest";
import { calculateEstimatedDeliveryDate, calculateSupplierFulfillmentDays } from "../lib/supplier-fulfillment-time";

describe("supplier fulfillment time", () => {
  it("adds supplier, import, handling and customer shipping time", () => {
    expect(calculateSupplierFulfillmentDays({ supplierProcessingDays: 3, importTransitDays: 14, handlingDays: 2, customerShippingDays: 5 })).toBe(24);
  });

  it("returns a calendar delivery estimate and clamps invalid negative days", () => {
    const estimate = calculateEstimatedDeliveryDate({ supplierProcessingDays: -2, importTransitDays: 10, handlingDays: 1, customerShippingDays: 4 }, new Date("2026-08-10T12:00:00Z"));
    expect(estimate.toISOString()).toBe("2026-08-25T12:00:00.000Z");
  });
});
