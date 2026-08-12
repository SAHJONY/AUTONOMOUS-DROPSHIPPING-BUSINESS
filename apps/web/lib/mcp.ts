/**
 * MCP server — the way Accio Work actually plugs into this business.
 *
 * Accio Work has no server API, so nothing here can call it. But it *is* an MCP
 * client: it connects out to tool servers from the owner's desktop. So the
 * integration runs backwards from the obvious direction — this app exposes the
 * tools, and Accio's own sourcing engine does the searching on its free tier.
 *
 * That replaces the paid search provider in `supplier-discovery.ts` for anyone
 * unwilling to point an unattended loop at an uncapped meter. Accio finds the
 * suppliers; this server hands it the worklist and takes the results back under
 * the same rules the rest of the codebase enforces.
 *
 * What is deliberately absent is the whole point: **no tool here moves money or
 * reaches a customer.** No supplier orders, no publishing, no refunds, no ad
 * budgets. Those six actions stay approval-gated inside the agent brain where
 * `tests/agent-tools.test.ts` pins them, and an external client — which is what
 * Accio is — never gets to touch them. Everything below reads state or files an
 * unverified candidate for the owner to check.
 */
import { assessAccioCandidate, type AccioCandidate } from "./accio-sourcing";
import { buildAssortmentGap } from "./intelligence";
import { recall, remember } from "./store";
import {
  CANDIDATE_MEMORY_PREFIX,
  classifySupplierTier,
  hostOf,
  scoreSupplierCandidate,
} from "./supplier-discovery";

/**
 * Whether the MCP endpoint is actually serving.
 *
 * Reports only that both variables are present — never their values — so the
 * owner console can tell you what to fix without becoming a way to read the
 * token back out.
 */
export function mcpConfigured(): { configured: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!process.env.MCP_ACCESS_TOKEN?.trim()) missing.push("MCP_ACCESS_TOKEN");
  if (!process.env.MCP_ORG_ID?.trim()) missing.push("MCP_ORG_ID");
  return { configured: missing.length === 0, missing };
}

export const MCP_PROTOCOL_VERSION = "2025-06-18";
export const MCP_SERVER_INFO = { name: "botanica-commerce-os", version: "1.0.0" } as const;

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (orgId: string, args: Record<string, unknown>) => Promise<unknown>;
}

const str = (value: unknown) => String(value ?? "").trim();

export const MCP_TOOLS: McpTool[] = [
  {
    name: "get_sourcing_gap",
    description:
      "The SKUs this Botanica still needs a supplier for, ranked P1 first, each with its next action " +
      "and the evidence still missing. Start here: it is the worklist to source against.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: async (orgId) => {
      const { listProducts } = await import("./store");
      return buildAssortmentGap(await listProducts(orgId));
    },
  },
  {
    name: "list_supplier_candidates",
    description:
      "Suppliers already on file for this business, with the supply-chain tier each was classified as. " +
      "Check before submitting so the same host is not researched twice.",
    inputSchema: {
      type: "object",
      properties: { tier: { type: "string", description: "Optional filter: MANUFACTURER, DISTRIBUTOR, WHOLESALER or RESELLER." } },
      additionalProperties: false,
    },
    handler: async (orgId, args) => {
      const wanted = str(args.tier).toUpperCase();
      const entries = (await recall(orgId, CANDIDATE_MEMORY_PREFIX, 500))
        .filter((entry) => entry.key.startsWith(CANDIDATE_MEMORY_PREFIX))
        .map((entry) => {
          try {
            return { host: entry.key.slice(CANDIDATE_MEMORY_PREFIX.length), found_at: entry.created_at, ...JSON.parse(entry.content) };
          } catch {
            return { host: entry.key.slice(CANDIDATE_MEMORY_PREFIX.length), found_at: entry.created_at };
          }
        });
      return { total: entries.length, candidates: wanted ? entries.filter((e) => String(e.tier) === wanted) : entries };
    },
  },
  {
    name: "submit_supplier_candidate",
    description:
      "File a supplier you found. The server classifies its supply-chain tier and scores it, and rejects " +
      "anything that is not a public HTTPS site, is a consumer marketplace, or cannot be shown to sell " +
      "Botanica/Lucumi/Orisha merchandise. Filing a candidate commits nothing and buys nothing — the owner " +
      "still verifies it.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The supplier's public HTTPS homepage or wholesale page." },
        title: { type: "string", description: "Company name as it appears on the site." },
        description: { type: "string", description: "What they sell and on what terms — MOQ, wholesale, factory, etc." },
      },
      required: ["url", "title"],
      additionalProperties: false,
    },
    handler: async (orgId, args) => {
      const hit = { url: str(args.url), title: str(args.title), description: str(args.description) };
      if (!hostOf(hit.url)) return { accepted: false, reason: "La URL debe ser un sitio público HTTPS." };
      const candidate = scoreSupplierCandidate(hit, "mcp:accio");
      if (!candidate) {
        return {
          accepted: false,
          reason:
            "Rechazado: es un marketplace de consumo, o no se puede demostrar que venda mercancía " +
            "Botanica/Lucumi/Orisha. El filtro de nicho es fail-closed.",
        };
      }
      await remember(orgId, `${CANDIDATE_MEMORY_PREFIX}${candidate.host}`, JSON.stringify(candidate).slice(0, 2000), "accio-mcp");
      return { accepted: true, host: candidate.host, tier: candidate.tier, score: candidate.score, signals: candidate.signals };
    },
  },
  {
    name: "classify_supplier_tier",
    description:
      "Where a supplier sits in the supply chain, from its own wording: MANUFACTURER, DISTRIBUTOR, " +
      "WHOLESALER, RESELLER or UNKNOWN. Manufacturers and distributors are worth more than resellers.",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string", description: "Company description, page copy or quote text." } },
      required: ["text"],
      additionalProperties: false,
    },
    handler: async (_orgId, args) => classifySupplierTier(str(args.text)),
  },
  {
    name: "assess_supplier_quote",
    description:
      "Whether a quote you negotiated can actually be used. Returns ORDER_FUNDED (works with charge-first, " +
      "buy-after), INVENTORY_REQUIRED (names the capital and the break-even sell-through), or REJECTED. " +
      "Alibaba MOQ quotes usually land on INVENTORY_REQUIRED — that is expected, not an error. Advisory only.",
    inputSchema: {
      type: "object",
      properties: {
        supplierName: { type: "string" },
        supplierProfileUrl: { type: "string" },
        quoteReference: { type: "string" },
        wholesalePrice: { type: "number", description: "Unit price in the quote currency." },
        currency: { type: "string" },
        usdExchangeRate: { type: "number", description: "Required unless currency is USD." },
        moq: { type: "number" },
        shippingCost: { type: "number", description: "Inbound freight. Per unit by default; the whole shipment when freightMode is PER_SHIPMENT." },
        freightMode: { type: "string", description: "PER_UNIT (air, quoted per piece) or PER_SHIPMENT (sea or consolidated, quoted for the whole batch). Ask the supplier which it is — it changes the verdict completely." },
        handlingCost: { type: "number" },
        markupPercent: { type: "number" },
        supplierProcessingDays: { type: "number" },
        importTransitDays: { type: "number" },
        handlingDays: { type: "number" },
        customerShippingDays: { type: "number" },
        sampleOrderAvailable: { type: "boolean" },
        samplePriceUsd: { type: "number" },
      },
      required: ["wholesalePrice", "currency", "moq"],
      additionalProperties: false,
    },
    handler: async (_orgId, args) => {
      // The owner-verification flags are deliberately not settable over MCP: an
      // external client cannot attest on the owner's behalf, so a quote assessed
      // here always reports the verification still outstanding.
      const assessment = assessAccioCandidate({ ...(args as AccioCandidate), ownerVerifiedQuote: false });
      return { ...assessment, note: "La verificación del propietario sigue pendiente; ningún cliente externo puede otorgarla." };
    },
  },
];

export type JsonRpcId = string | number | null;

function ok(id: JsonRpcId, result: unknown) {
  return { jsonrpc: "2.0" as const, id, result };
}
function fail(id: JsonRpcId, code: number, message: string) {
  return { jsonrpc: "2.0" as const, id, error: { code, message } };
}

/**
 * Handle one JSON-RPC request against the tool set above.
 *
 * Notifications (no `id`) get no response, per JSON-RPC — the caller returns 202.
 */
export async function handleMcpRequest(orgId: string, body: unknown): Promise<object | null> {
  const request = (body ?? {}) as { jsonrpc?: string; id?: JsonRpcId; method?: string; params?: Record<string, unknown> };
  const id = request.id ?? null;
  const method = str(request.method);
  const isNotification = request.id === undefined;

  if (request.jsonrpc !== "2.0") return isNotification ? null : fail(id, -32600, "Invalid Request: jsonrpc must be \"2.0\".");

  switch (method) {
    case "initialize":
      return ok(id, {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: MCP_SERVER_INFO,
        instructions:
          "BOTANICA OCHOSI sourcing tools. Call get_sourcing_gap for the worklist, research suppliers for those " +
          "SKUs, then submit_supplier_candidate for each one found. Only Botanica/Lucumi/Orisha religious " +
          "merchandise is in scope; generic dropshipping candidates are rejected. Nothing here buys, publishes " +
          "or contacts anyone — every result still needs the owner's verification.",
      });

    case "notifications/initialized":
      return null;

    case "ping":
      return isNotification ? null : ok(id, {});

    case "tools/list":
      return ok(id, {
        tools: MCP_TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
      });

    case "tools/call": {
      const name = str(request.params?.name);
      const tool = MCP_TOOLS.find((candidate) => candidate.name === name);
      if (!tool) return fail(id, -32602, `Unknown tool: ${name || "(none)"}`);
      try {
        const result = await tool.handler(orgId, (request.params?.arguments ?? {}) as Record<string, unknown>);
        return ok(id, { content: [{ type: "text", text: JSON.stringify(result) }], isError: false });
      } catch (error) {
        // Tool failures are reported in-band so the client can react, per MCP.
        return ok(id, { content: [{ type: "text", text: (error as Error).message }], isError: true });
      }
    }

    default:
      return isNotification ? null : fail(id, -32601, `Method not found: ${method || "(none)"}`);
  }
}
