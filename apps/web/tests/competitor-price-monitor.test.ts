import { describe, expect, it } from "vitest";
import { competitiveRecommendationUsd, extractPublicProductPrice, isBlockedCompetitorHostname } from "../lib/competitor-price-monitor";

describe("competitor price monitor", () => {
it("extracts an USD offer from public JSON-LD", () => {
  const html = `<script type="application/ld+json">{"@type":"Product","offers":{"price":"12.50","priceCurrency":"USD"}}</script>`;
  expect(extractPublicProductPrice(html)).toEqual({ price: 12.5, currency: "USD" });
});

it("never crosses the protected cost floor", () => {
  const product = { id: "1", name: "Vela", currency: "USD", wholesalePrice: 10, shippingCost: 2, handlingCost: 1 };
  expect(competitiveRecommendationUsd(product, 12)).toBe(16.5);
  expect(competitiveRecommendationUsd(product, 20)).toBe(19.99);
});

it("blocks local and private competitor targets", () => {
  for (const host of ["localhost", "127.0.0.1", "10.1.2.3", "192.168.1.2", "::1", "fd00::1"]) expect(isBlockedCompetitorHostname(host)).toBe(true);
  expect(isBlockedCompetitorHostname("example.com")).toBe(false);
});
});
