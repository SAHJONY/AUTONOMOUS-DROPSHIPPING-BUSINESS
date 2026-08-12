import { describe, expect, it } from "vitest";
import { parseAccioQuote } from "@/lib/accio-quote-parser";

describe("parsing what Accio actually wrote", () => {
  // A real row from Accio's supplier research table.
  const tableRow = "| 1 | Opon Ifá — Large | Qianmu Wood | Unit Price ~$2.33–3.50 | MOQ 10 | Shipping/Unit $25–35 (Air) | Lead Time 32 Days | Sample ~$30 | https://www.alibaba.com/company/qianmu.html |";

  it("pulls a whole quote out of one markdown row", () => {
    const { fields, found } = parseAccioQuote(tableRow);
    expect(fields.wholesalePrice).toBe(3.5);
    expect(fields.moq).toBe(10);
    expect(fields.shippingCost).toBe(35);
    expect(fields.supplierProcessingDays).toBe(32);
    expect(fields.samplePriceUsd).toBe(30);
    expect(fields.supplierProfileUrl).toBe("https://www.alibaba.com/company/qianmu.html");
    expect(found).toContain("moq");
  });

  it("takes the expensive end of every range, and says so", () => {
    const { fields, warnings } = parseAccioQuote(tableRow);
    expect(fields.wholesalePrice).toBe(3.5); // not 2.33
    expect(fields.shippingCost).toBe(35); // not 25
    expect(warnings.join(" ")).toContain("extremo caro");
  });

  it("reads a free sample as free rather than missing", () => {
    const { fields } = parseAccioQuote("Sample: FREE\nMOQ 1 kg\nPrice $18/kg");
    expect(fields.samplePriceUsd).toBe(0);
    expect(fields.sampleOrderAvailable).toBe(true);
  });

  it("keeps freight per unit unless the text actually says per shipment", () => {
    expect(parseAccioQuote("Shipping $17.56 (Ocean)").fields.freightMode).toBeUndefined();
    expect(parseAccioQuote("Freight $480 per shipment").fields.freightMode).toBe("PER_SHIPMENT");
    expect(parseAccioQuote("Flete $500 por embarque completo").fields.freightMode).toBe("PER_SHIPMENT");
  });

  it("never fills in a verification the owner has to make", () => {
    const { fields } = parseAccioQuote(`${tableRow}\nInventory verified, resale authorized, owner approved`);
    expect(fields.ownerVerifiedQuote).toBeUndefined();
    expect(fields.inventoryStatus).toBeUndefined();
    expect(fields.resaleAuthorizationStatus).toBeUndefined();
  });

  it("warns when freight dwarfs the unit price — the trap in this catalog", () => {
    const { warnings } = parseAccioQuote("Price $0.95 per unit\nShipping $6.50 per unit\nMOQ 5");
    expect(warnings.join(" ")).toContain("flete supera");
  });

  it("warns when production alone will blow the 30-day gate", () => {
    const { warnings } = parseAccioQuote("Lead Time 35 Days\nPrice $8.88\nMOQ 400");
    expect(warnings.join(" ")).toContain("30 días");
  });

  it("flags a non-USD quote as needing a verified rate", () => {
    const { fields, warnings } = parseAccioQuote("Precio 120 CNY por unidad\nMOQ 50");
    expect(fields.currency).toBe("CNY");
    expect(warnings.join(" ")).toContain("tipo de cambio");
  });

  it("returns nothing rather than guessing from an empty paste", () => {
    const { fields, found, warnings } = parseAccioQuote("   ");
    expect(found).toEqual([]);
    expect(warnings).toEqual([]);
    expect(Object.keys(fields)).toEqual([]);
  });

  it("survives prose that carries no numbers at all", () => {
    const { fields } = parseAccioQuote("I could not find a supplier for this item.");
    expect(fields.wholesalePrice).toBeUndefined();
    expect(fields.moq).toBeUndefined();
  });
});
