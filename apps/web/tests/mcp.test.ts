import { describe, expect, it } from "vitest";
import { MCP_PROTOCOL_VERSION, MCP_TOOLS, handleMcpRequest, mcpConfigured, resolveMcpOrgId } from "@/lib/mcp";

const ORG = "org-test";
const call = (method: string, params?: Record<string, unknown>, id: string | number | null = 1) =>
  handleMcpRequest(ORG, { jsonrpc: "2.0", id, method, params });

const payload = async (name: string, args: Record<string, unknown> = {}) => {
  const response = (await call("tools/call", { name, arguments: args })) as { result: { content: Array<{ text: string }>; isError: boolean } };
  return { isError: response.result.isError, data: JSON.parse(response.result.content[0].text) };
};

describe("the MCP handshake", () => {
  it("reports the protocol version and advertises tools", async () => {
    const response = (await call("initialize")) as { result: { protocolVersion: string; capabilities: { tools: unknown } } };
    expect(response.result.protocolVersion).toBe(MCP_PROTOCOL_VERSION);
    expect(response.result.capabilities.tools).toBeTruthy();
  });

  it("answers tools/list with a schema for every tool", async () => {
    const response = (await call("tools/list")) as { result: { tools: Array<{ name: string; description: string; inputSchema: { type: string } }> } };
    expect(response.result.tools).toHaveLength(MCP_TOOLS.length);
    for (const tool of response.result.tools) {
      expect(tool.description.length).toBeGreaterThan(20);
      expect(tool.inputSchema.type).toBe("object");
    }
  });

  it("stays silent for notifications and answers everything else", async () => {
    expect(await handleMcpRequest(ORG, { jsonrpc: "2.0", method: "notifications/initialized" })).toBeNull();
    expect(await call("ping")).toEqual({ jsonrpc: "2.0", id: 1, result: {} });
  });

  it("rejects a non-2.0 envelope and an unknown method", async () => {
    const bad = (await handleMcpRequest(ORG, { jsonrpc: "1.0", id: 1, method: "ping" })) as { error: { code: number } };
    expect(bad.error.code).toBe(-32600);
    const unknown = (await call("does/not/exist")) as { error: { code: number } };
    expect(unknown.error.code).toBe(-32601);
  });

  it("reports an unknown tool as a protocol error, not a tool result", async () => {
    const response = (await call("tools/call", { name: "delete_everything" })) as { error: { code: number; message: string } };
    expect(response.error.code).toBe(-32602);
    expect(response.error.message).toContain("delete_everything");
  });
});

describe("the exposed tool surface", () => {
  /**
   * The lock that matters. Accio is an outside client on the owner's desktop;
   * it must never reach the six approval-gated actions. Adding a tool here that
   * moves money should fail this test rather than production.
   */
  it("exposes only read and candidate-intake tools — nothing that moves money", () => {
    expect(MCP_TOOLS.map((tool) => tool.name).sort()).toEqual([
      "assess_supplier_quote",
      "classify_supplier_tier",
      "get_sourcing_gap",
      "list_supplier_candidates",
      "submit_supplier_candidate",
    ]);
  });

  it("names no money-moving action anywhere in the surface", () => {
    const forbidden = ["place_supplier_order", "publish_product_to_shopify", "create_store", "set_ad_budget", "issue_refund", "kill_product"];
    const names = new Set(MCP_TOOLS.map((tool) => tool.name));
    for (const action of forbidden) expect(names.has(action)).toBe(false);
  });
});

describe("supplier intake over MCP", () => {
  it("accepts a niche wholesaler and reports the tier it was classified as", async () => {
    const { data } = await payload("submit_supplier_candidate", {
      url: "https://mayorista-santeria-ejemplo.com",
      title: "Mayorista de santeria",
      description: "Wholesale religious supplies, MOQ 12.",
    });
    expect(data.accepted).toBe(true);
    expect(data.tier).toBe("WHOLESALER");
    expect(data.host).toBe("mayorista-santeria-ejemplo.com");
  });

  it("refuses a consumer marketplace and an off-niche site", async () => {
    const marketplace = await payload("submit_supplier_candidate", { url: "https://www.amazon.com/dp/B01", title: "Santeria candles wholesale" });
    expect(marketplace.data.accepted).toBe(false);
    const offNiche = await payload("submit_supplier_candidate", { url: "https://gadgets-ejemplo.com", title: "Wholesale phone cases", description: "bulk MOQ 100" });
    expect(offNiche.data.accepted).toBe(false);
  });

  it("refuses anything that is not a public https site", async () => {
    const insecure = await payload("submit_supplier_candidate", { url: "http://mayorista-ejemplo.com", title: "Mayorista santeria" });
    expect(insecure.data.accepted).toBe(false);
    const internal = await payload("submit_supplier_candidate", { url: "https://127.0.0.1/admin", title: "Mayorista santeria" });
    expect(internal.data.accepted).toBe(false);
  });
});

describe("quote assessment over MCP", () => {
  const quote = {
    supplierName: "Fabrica Ejemplo", supplierProfileUrl: "https://fabrica-ejemplo.com",
    wholesalePrice: 20, currency: "USD", usdExchangeRate: 1, moq: 50,
    shippingCost: 3, handlingCost: 2, markupPercent: 100,
    supplierProcessingDays: 2, importTransitDays: 0, handlingDays: 1, customerShippingDays: 4,
  };

  it("routes an MOQ quote to INVENTORY_REQUIRED with the capital named", async () => {
    const { data } = await payload("assess_supplier_quote", quote);
    expect(data.capitalRequiredUsd).toBe(1250);
    expect(data.unitsToRecoverCapital).toBe(28);
  });

  it("never lets an external client attest the owner's verification", async () => {
    // Even when the client claims the owner verified it, the answer is no.
    const { data } = await payload("assess_supplier_quote", { ...quote, moq: 1, ownerVerifiedQuote: true });
    expect(data.eligibleForOrderFunding).toBe(false);
    expect(data.disqualifiers.join(" ")).toContain("no ha sido verificada");
  });
});

describe("which organization the session acts on", () => {
  /**
   * Setting MCP_ORG_ID was pure friction on a one-org deployment: copying a
   * UUID into Vercel to name the only thing it could possibly mean.
   */
  it("requires only the token, not the org id", () => {
    const before = process.env.MCP_ACCESS_TOKEN;
    process.env.MCP_ACCESS_TOKEN = "t";
    delete process.env.MCP_ORG_ID;
    const status = mcpConfigured();
    expect(status.configured).toBe(true);
    expect(status.missing).toEqual([]);
    expect(status.orgBinding).toBe("auto");
    if (before === undefined) delete process.env.MCP_ACCESS_TOKEN; else process.env.MCP_ACCESS_TOKEN = before;
  });

  it("still reports the token as missing when it is", () => {
    const before = process.env.MCP_ACCESS_TOKEN;
    delete process.env.MCP_ACCESS_TOKEN;
    expect(mcpConfigured().missing).toEqual(["MCP_ACCESS_TOKEN"]);
    if (before !== undefined) process.env.MCP_ACCESS_TOKEN = before;
  });

  it("uses an explicit org id when one is set", async () => {
    process.env.MCP_ORG_ID = "org-explicit";
    await expect(resolveMcpOrgId()).resolves.toEqual({ orgId: "org-explicit" });
    delete process.env.MCP_ORG_ID;
  });

  it("refuses rather than guessing when no organization exists", async () => {
    delete process.env.MCP_ORG_ID;
    const resolved = await resolveMcpOrgId();
    expect("error" in resolved).toBe(true);
  });
});
