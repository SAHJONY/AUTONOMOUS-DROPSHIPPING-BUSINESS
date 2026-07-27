import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { normalizeShop, verifyWebhookSignature } from "@/lib/shopify";

const SECRET = "shpss_test_secret_value";

function sign(body: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("base64");
}

describe("verifyWebhookSignature", () => {
  const body = JSON.stringify({ id: 6001, total_price: "64.52" });

  it("accepts a genuine Shopify signature", async () => {
    expect(await verifyWebhookSignature(body, sign(body), SECRET)).toBe(true);
  });

  it("tolerates the whitespace a proxy may add to the header", async () => {
    expect(await verifyWebhookSignature(body, ` ${sign(body)} `, SECRET)).toBe(true);
  });

  it("rejects a body that was altered after signing", async () => {
    const signature = sign(body);
    const tampered = JSON.stringify({ id: 6001, total_price: "6400.00" });
    expect(await verifyWebhookSignature(tampered, signature, SECRET)).toBe(false);
  });

  it("rejects a signature made with the wrong secret", async () => {
    expect(await verifyWebhookSignature(body, sign(body, "attacker-secret"), SECRET)).toBe(false);
  });

  it("rejects a missing signature, and refuses to verify without a secret", async () => {
    expect(await verifyWebhookSignature(body, "", SECRET)).toBe(false);
    // No secret configured must fail closed — never wave the request through.
    expect(await verifyWebhookSignature(body, sign(body), "")).toBe(false);
  });

  it("rejects garbage without throwing", async () => {
    expect(await verifyWebhookSignature(body, "not-base64-!!", SECRET)).toBe(false);
    expect(await verifyWebhookSignature("", sign(body), SECRET)).toBe(false);
  });

  it("is not fooled by a signature that merely starts correctly", async () => {
    const truncated = sign(body).slice(0, 20);
    expect(await verifyWebhookSignature(body, truncated, SECRET)).toBe(false);
  });
});

describe("normalizeShop", () => {
  it("reduces any way a store is written to its admin domain", () => {
    expect(normalizeShop("https://acme.myshopify.com/admin")).toBe("acme.myshopify.com");
    expect(normalizeShop("ACME.myshopify.com")).toBe("acme.myshopify.com");
    expect(normalizeShop("acme")).toBe("acme.myshopify.com");
    expect(normalizeShop("  ")).toBe("");
  });
});
