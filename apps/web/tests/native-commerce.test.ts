import { describe, expect, it } from "vitest";
import { toNativeCatalog } from "../lib/native-commerce";
import type { Product } from "../lib/types";

const product = (patch: Partial<Product> = {}): Product => ({
  id: "p1", org_id: "o1", title: "Aceite Espiritual", description: "<p>Protección y prosperidad</p>",
  source: "native", supplier_url: "", cost: 3, price: 9.99, status: "launched",
  image_url: "https://example.com/oil.jpg", created_at: "2026-01-01T00:00:00Z", ...patch,
});

describe("native commerce catalog", () => {
  it("uses internal product IDs and local product URLs", () => {
    const [item] = toNativeCatalog([product({ video_url:"https://example.com/demo.mp4", audio_url:"https://example.com/demo.mp3" })]);
    expect(item).toMatchObject({ id: "p1", variantId: "p1", price: 9.99, handle: "aceite-espiritual" });
    expect(item.productUrl).toBe("/shop?product=aceite-espiritual");
    expect(item.description).toBe("Protección y prosperidad");
    expect(item.videoUrl).toBe("https://example.com/demo.mp4");
    expect(item.audioUrl).toBe("https://example.com/demo.mp3");
  });

  it("publishes only launched, priced, available products", () => {
    const result = toNativeCatalog([
      product({ id: "draft", status: "discovered" }),
      product({ id: "free", price: 0 }),
      product({ id: "sold", inventory_quantity: 0, inventory_policy: "deny" }),
      product({ id: "backorder", inventory_quantity: 0, inventory_policy: "continue" }),
    ]);
    expect(result.map((item) => item.id)).toEqual(["backorder"]);
  });
});
