/**
 * Test helpers.
 *
 * With no Upstash credentials set, `lib/kv` uses its process-global in-memory
 * driver — which is exactly the substrate we want under tests, provided each
 * test starts from an empty one.
 */
import type { Order, Product } from "@/lib/types";

type MemGlobal = {
  __commerceKV?: Map<string, string>;
  __commerceSets?: Map<string, Set<string>>;
  __commerceExpiry?: Map<string, number>;
};

/** Wipe the in-memory KV store so tests can't leak state into one another. */
export function resetStore(): void {
  const g = globalThis as unknown as MemGlobal;
  g.__commerceKV?.clear();
  g.__commerceSets?.clear();
  g.__commerceExpiry?.clear();
}

export function makeProduct(over: Partial<Product> = {}): Product {
  return {
    id: "prod_1",
    org_id: "org1",
    title: "Aurora Desk Lamp",
    description: "A warm, dimmable desk lamp.",
    source: "CJ Dropshipping",
    supplier_url: "",
    cost: 9,
    price: 29.99,
    status: "launched",
    shopify_variant_id: 555001,
    supplier_pid: "pid-1",
    supplier_vid: "vid-1",
    sku: "prod_1",
    created_at: "2026-07-01T00:00:00.000Z",
    ...over,
  };
}

/** A realistic Shopify order payload, shaped like the real webhook body. */
export function shopifyOrderPayload(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 6001,
    name: "#1001",
    order_number: 1001,
    email: "buyer@example.com",
    currency: "USD",
    financial_status: "paid",
    fulfillment_status: null,
    created_at: "2026-07-20T10:00:00.000Z",
    total_line_items_price: "59.98",
    total_discounts: "5.00",
    subtotal_price: "54.98",
    total_tax: "4.54",
    total_price: "64.52",
    total_shipping_price_set: { shop_money: { amount: "5.00", currency_code: "USD" } },
    customer: { first_name: "Dana", last_name: "Reyes", email: "buyer@example.com" },
    shipping_address: {
      first_name: "Dana",
      last_name: "Reyes",
      address1: "410 Mission St",
      address2: "Apt 7",
      city: "San Francisco",
      province: "California",
      province_code: "CA",
      zip: "94105",
      country: "United States",
      country_code: "US",
      phone: "+14155550123",
    },
    line_items: [
      {
        id: 900,
        variant_id: 555001,
        product_id: 700,
        sku: "prod_1",
        title: "Aurora Desk Lamp",
        quantity: 2,
        price: "29.99",
      },
    ],
    ...over,
  };
}

export function makeOrder(over: Partial<Order> = {}): Order {
  return {
    id: "order_1",
    org_id: "org1",
    channel: "shopify",
    external_id: "6001",
    order_number: "#1001",
    email: "buyer@example.com",
    customer_name: "Dana Reyes",
    currency: "USD",
    subtotal: 54.98,
    shipping: 5,
    tax: 4.54,
    discount: 5,
    total: 64.52,
    financial_status: "paid",
    fulfillment_status: "",
    stage: "received",
    lines: [
      {
        sku: "prod_1",
        title: "Aurora Desk Lamp",
        quantity: 2,
        unit_price: 29.99,
        product_id: "prod_1",
        shopify_variant_id: 555001,
        supplier_pid: "pid-1",
        supplier_vid: "vid-1",
        unit_cost: 9,
      },
    ],
    shipping_address: {
      name: "Dana Reyes",
      phone: "+14155550123",
      line1: "410 Mission St",
      line2: "Apt 7",
      city: "San Francisco",
      province: "California",
      province_code: "CA",
      zip: "94105",
      country: "United States",
      country_code: "US",
    },
    supplier: "",
    cogs: 0,
    supplier_shipping: 0,
    refunded: 0,
    events: [],
    placed_at: "2026-07-20T10:00:00.000Z",
    created_at: "2026-07-20T10:00:00.000Z",
    updated_at: "2026-07-20T10:00:00.000Z",
    ...over,
  };
}
