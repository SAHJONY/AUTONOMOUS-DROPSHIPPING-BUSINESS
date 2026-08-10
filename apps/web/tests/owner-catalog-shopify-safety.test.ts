import { describe, expect, it } from "vitest";
import { assertShopifyDraftOnly } from "../lib/owner-catalog-shopify";

describe("BOTANICA Shopify mutation safety", () => {
  it("allows draft creation requests", () => {
    expect(() => assertShopifyDraftOnly({ title: "Velón blanco", publish: false })).not.toThrow();
    expect(() => assertShopifyDraftOnly({ title: "Velón blanco" })).not.toThrow();
  });

  it("blocks direct live publication globally", () => {
    expect(() => assertShopifyDraftOnly({ title: "Velón blanco", publish: true }))
      .toThrow(/BOTANICA_DIRECT_LIVE_PUBLISH_BLOCKED/);
  });
});
