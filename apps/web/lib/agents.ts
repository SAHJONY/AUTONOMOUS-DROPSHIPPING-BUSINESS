/**
 * The agent roster: the SAHJONY autonomous CEO and seven specialists.
 *
 * Every agent gets a small set of tools backed by real KV-persisted data.
 * High-risk tools are flagged `requires_approval` and are gated by the runner
 * (see brain.ts): they are never executed directly by the model — an
 * ApprovalRequest is created and the owner decides.
 */
import {
  listProducts,
  recall,
  remember,
  saveProduct,
  saveStore,
  updateProduct,
  listRuns,
  listApprovals,
  listStores,
  newId,
  nowISO,
} from "./store";
import {
  generateProductImage,
  getCJCreds,
  importFromSupplier,
  publishProductToShopify,
} from "./store";
import { getPnl, listLedger, postEntries, type PeriodKey } from "./ledger";
import {
  estimatedCogs,
  getOrder,
  listOrders,
  supplierExposure,
  unfulfillableLines,
} from "./orders";
import { placeSupplierOrder, runFulfillmentCycle, syncShopifyOrders } from "./fulfillment";
import { marginScoreFromPrices, scoreProduct, VERDICT_LAUNCH } from "./scoring";
import type { Product } from "./types";

export interface AgentContext {
  orgId: string;
  depth: number;
  runId: string | null;
}

export interface ToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  handler: (ctx: AgentContext, args: Record<string, unknown>) => Promise<string>;
  requires_approval?: boolean;
  risk_level?: string;
}

export interface Agent {
  name: string;
  description: string;
  system_prompt: string;
  tools(): ToolDef[];
}

/**
 * Prepended to every agent's system prompt (see brain.ts). Turns the fleet
 * fully autonomous and efficient: agents gather their own context and act
 * instead of asking the operator for details.
 */
export const OPERATING_DIRECTIVE = `You are a fully autonomous operator inside SAHJONY Commerce, an AI-run dropshipping business. Operating principles for EVERY task:

- BE AUTONOMOUS. Never ask the human for information you can obtain with your tools or infer from reasonable industry defaults. Use list_products, recall_memory, and (if available) get_business_snapshot to gather context yourself, then act. Do not end your turn with a question — end it with completed work.
- SELF-SERVE TARGETS. If a product or target isn't named, pick the most relevant one from the catalog yourself (prefer the newest 'ready_to_launch', else the highest-scored) and proceed. State the assumption in one line.
- BE EFFICIENT. Gather what you need in as few tool calls as possible. Never repeat a lookup you already did. Make well-reasoned assumptions rather than stalling. Finish in a single pass.
- HUMAN GATE ONLY FOR RISK. The ONLY time you pause for a human is an approval-gated tool: call it, note it was queued, and continue with everything else in the task.
- ALWAYS PERSIST. Save meaningful decisions, quotes, and reports with remember so the operation compounds.
- REPORT TIGHT. End with a short, skimmable summary: what you did, the key numbers, and the single most important next action.`;

const SCORE_FACTORS = {
  demand: { type: "number", description: "Market demand, 0-100 (higher is better)" },
  competition: { type: "number", description: "Competition, 0-100 (higher = worse)" },
  margin: { type: "number", description: "Margin quality, 0-100 (higher is better)" },
  trend: { type: "number", description: "Trend momentum, 0-100 (higher is better)" },
  risk: { type: "number", description: "Operational/legal risk, 0-100 (higher = worse)" },
} as const;
const SCORE_REQUIRED = ["demand", "competition", "margin", "trend", "risk"];

/* ---------- shared tools ---------- */

function rememberTool(agentName: string): ToolDef {
  return {
    name: "remember",
    description:
      "Persist a learning, decision, or report to business memory so it can be recalled later.",
    input_schema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Short topic key, e.g. 'daily-report'" },
        content: { type: "string", description: "The content to remember" },
      },
      required: ["key", "content"],
    },
    handler: async (ctx, args) => {
      const e = await remember(ctx.orgId, String(args.key), String(args.content), agentName);
      return `Saved to business memory (id ${e.id}).`;
    },
  };
}

const recallTool: ToolDef = {
  name: "recall_memory",
  description: "Search business memory for past learnings and reports.",
  input_schema: {
    type: "object",
    properties: { query: { type: "string", description: "Search text (optional)" } },
  },
  handler: async (ctx, args) => {
    const entries = await recall(ctx.orgId, String(args.query ?? ""));
    if (!entries.length) return "No matching memory entries.";
    return entries
      .map((e) => `[${e.created_at.slice(0, 10)}] (${e.agent_name || "unknown"}) ${e.key}: ${e.content}`)
      .join("\n");
  },
};

/** Read-only catalog access shared by every agent, so none needs to ask the human. */
const listProductsTool: ToolDef = {
  name: "list_products",
  description:
    "List the organization's product catalog with IDs, so you can act on a product without asking the human.",
  input_schema: { type: "object", properties: {} },
  handler: async (ctx) => {
    const products = (await listProducts(ctx.orgId)).slice(0, 40);
    if (!products.length) return "No products in the catalog yet.";
    return products
      .map(
        (p) =>
          `id=${p.id} | ${p.title} — status=${p.status}, cost=${p.cost}, price=${p.price}, score=${p.score ?? "n/a"}`,
      )
      .join("\n");
  },
};

const PERIOD_KEYS: PeriodKey[] = ["today", "7d", "30d", "90d", "all"];

function asPeriod(value: unknown): PeriodKey {
  const v = String(value ?? "30d");
  return (PERIOD_KEYS as string[]).includes(v) ? (v as PeriodKey) : "30d";
}

/**
 * The books, straight from the ledger. Every agent can read them — decisions
 * about what to launch, what to spend, and what to kill should be grounded in
 * money that actually moved, not in the catalog's hopes.
 */
const pnlTool: ToolDef = {
  name: "get_profit_and_loss",
  description:
    "Read the real profit & loss statement from the accounting ledger: revenue, refunds, COGS, " +
    "supplier shipping, payment fees, ad spend, gross and net profit, margins, AOV, and order count. " +
    "These are actual settled numbers from real customer orders, not projections.",
  input_schema: {
    type: "object",
    properties: {
      period: {
        type: "string",
        enum: PERIOD_KEYS,
        description: "Reporting window (default 30d)",
      },
    },
  },
  handler: async (ctx, a) => {
    const pnl = await getPnl(ctx.orgId, asPeriod(a.period));
    if (pnl.orders === 0) {
      return `No orders in ${pnl.period.label.toLowerCase()} — the books are empty for this window. Nothing has sold yet.`;
    }
    return JSON.stringify(pnl);
  },
};

/** Read-only order access — what actually sold, and what is stuck. */
const listOrdersTool: ToolDef = {
  name: "list_orders",
  description:
    "List recent customer orders with their pipeline stage (received, awaiting_stock, shipped, " +
    "delivered, on_hold, cancelled, refunded), value, and any hold reason. Use this to see what is " +
    "actually selling and what is blocked.",
  input_schema: {
    type: "object",
    properties: {
      stage: { type: "string", description: "Filter to one stage (optional)" },
      limit: { type: "number", description: "How many to return (default 25)" },
    },
  },
  handler: async (ctx, a) => {
    const stage = a.stage ? String(a.stage) : "";
    const limit = Math.min(Math.max(Number(a.limit ?? 25), 1), 100);
    const orders = (await listOrders(ctx.orgId, 200))
      .filter((o) => !stage || o.stage === stage)
      .slice(0, limit);
    if (!orders.length) return stage ? `No orders in stage '${stage}'.` : "No orders yet.";
    return orders
      .map(
        (o) =>
          `id=${o.id} ${o.order_number} — ${o.stage}, $${o.total.toFixed(2)}, ` +
          `${o.lines.length} line(s), placed ${o.placed_at.slice(0, 10)}` +
          (o.tracking_number ? `, tracking ${o.tracking_number}` : "") +
          (o.hold_reason ? ` — HELD: ${o.hold_reason}` : ""),
      )
      .join("\n");
  },
};

/** Standard toolset every specialist gets: catalog + orders + books + memory. */
const commonTools = (agentName: string): ToolDef[] => [
  listProductsTool,
  listOrdersTool,
  pnlTool,
  rememberTool(agentName),
  recallTool,
];

/* ---------- product hunter ---------- */

const productHunter: Agent = {
  name: "product_hunter",
  description: "Discovers and scores product opportunities; only 85+ scores are launch-ready.",
  system_prompt:
    "You are the Product Hunter agent of SAHJONY Commerce, an autonomous dropshipping operator. " +
    "You evaluate product opportunities rigorously. Always use score_product_opportunity to score " +
    "products — never invent scores. Only products at/above the launch threshold may be recommended " +
    "for launch. Save every evaluated product with save_product, and ALWAYS include a compelling, " +
    "premium 2-3 sentence marketing description plus a realistic cost and a retail price (3-4x cost) " +
    "so the storefront looks polished and launch-ready.",
  tools: () => [
    {
      name: "score_product_opportunity",
      description:
        "Score a product with the deterministic model (demand 30%, competition 20%, margin 25%, " +
        "trend 15%, risk 10%). Returns total score and a launch/watch/reject verdict.",
      input_schema: { type: "object", properties: SCORE_FACTORS, required: SCORE_REQUIRED },
      handler: async (_ctx, a) =>
        JSON.stringify(
          scoreProduct({
            demand: Number(a.demand),
            competition: Number(a.competition),
            margin: Number(a.margin),
            trend: Number(a.trend),
            risk: Number(a.risk),
          }),
        ),
    },
    {
      name: "save_product",
      description: "Save an evaluated product and its analysis to the catalog.",
      input_schema: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          source: { type: "string" },
          supplier_url: { type: "string" },
          cost: { type: "number" },
          price: { type: "number" },
          rationale: { type: "string" },
          ...SCORE_FACTORS,
        },
        required: ["title", ...SCORE_REQUIRED],
      },
      handler: async (ctx, a) => {
        const result = scoreProduct({
          demand: Number(a.demand),
          competition: Number(a.competition),
          margin: Number(a.margin),
          trend: Number(a.trend),
          risk: Number(a.risk),
        });
        const product: Product = {
          id: newId(),
          org_id: ctx.orgId,
          title: String(a.title),
          description: String(a.description ?? ""),
          source: String(a.source ?? "agent"),
          supplier_url: String(a.supplier_url ?? ""),
          cost: Number(a.cost ?? 0),
          price: Number(a.price ?? 0),
          status: result.verdict === VERDICT_LAUNCH ? "ready_to_launch" : "analyzed",
          score: result.total_score,
          verdict: result.verdict,
          created_at: nowISO(),
        };
        await saveProduct(product);
        return `Saved product '${product.title}' (id ${product.id}) score ${result.total_score} verdict '${result.verdict}'.`;
      },
    },
    ...commonTools("product_hunter"),
  ],
};

/* ---------- supplier ---------- */

const supplier: Agent = {
  name: "supplier",
  description:
    "Sources products, and fulfills paid orders at the supplier — placement, tracking, shipping.",
  system_prompt:
    "You are the Supplier & Fulfillment agent of SAHJONY Commerce. You evaluate sourcing across CJ " +
    "Dropshipping, AliExpress, Spocket, and Zendrop, compare landed costs and shipping times, and " +
    "record supplier quotes and issues in business memory. When a real supplier (CJ Dropshipping) is " +
    "connected, use import_supplier_products to pull real products with real images and video into " +
    "the catalog.\n\n" +
    "You also own the back half of the business: getting paid orders shipped. Run " +
    "fulfill_pending_orders to sweep the queue — it buys the goods for every order within the " +
    "autonomous cost cap and pushes tracking numbers to the customer. Orders above the cap need " +
    "place_supplier_order, which is approval-gated because it spends the owner's money. Always " +
    "inspect on_hold orders and say plainly what is blocking each one — a held order is a customer " +
    "waiting on a package they already paid for, and it is the most urgent thing in the business.",
  tools: () => [
    {
      name: "fulfill_pending_orders",
      description:
        "Run one full fulfillment sweep: pull new orders from Shopify, place every paid order that " +
        "is within the autonomous cost cap with the supplier, and push tracking numbers for anything " +
        "that has shipped. Returns a summary of what moved.",
      input_schema: { type: "object", properties: {} },
      handler: async (ctx) => {
        const cycle = await runFulfillmentCycle(ctx.orgId);
        return JSON.stringify(cycle);
      },
    },
    {
      name: "place_supplier_order",
      description:
        "Buy the goods for one specific order from the supplier. HIGH RISK — this spends real money " +
        "and requires human approval when the cost exceeds the autonomous cap.",
      input_schema: {
        type: "object",
        properties: {
          order_id: { type: "string" },
          estimated_cost: {
            type: "number",
            description: "Supplier cost of the order — determines whether approval is needed",
          },
          reason: { type: "string" },
        },
        required: ["order_id"],
      },
      requires_approval: true,
      risk_level: "high",
      handler: async (ctx, a) => {
        // Reaching this handler means the cost cap was cleared or the owner
        // approved, so the cap check inside is intentionally bypassed.
        const res = await placeSupplierOrder(ctx.orgId, String(a.order_id), { bypassCostCap: true });
        return res.detail;
      },
    },
    {
      name: "sync_orders",
      description: "Pull the latest orders from the connected Shopify store into the system.",
      input_schema: {
        type: "object",
        properties: { days: { type: "number", description: "How far back to look (default 7)" } },
      },
      handler: async (ctx, a) => {
        const res = await syncShopifyOrders(ctx.orgId, { sinceDays: Number(a.days ?? 7) });
        return res.ok
          ? `Synced orders: ${res.imported} new, ${res.updated} updated.`
          : `Order sync failed: ${res.error}`;
      },
    },
    {
      name: "import_supplier_products",
      description:
        "Import real products (with real images and product video) from the connected CJ Dropshipping " +
        "account into the catalog. Provide a search query and optional count (default 6).",
      input_schema: {
        type: "object",
        properties: {
          query: { type: "string", description: "What to source, e.g. 'led desk lamp'" },
          count: { type: "number", description: "How many to import (1-12, default 6)" },
        },
        required: ["query"],
      },
      handler: async (ctx, a) => {
        if (!(await getCJCreds(ctx.orgId))) {
          return "No supplier connected — ask the owner to connect CJ Dropshipping in the dashboard.";
        }
        const res = await importFromSupplier(
          ctx.orgId,
          String(a.query),
          Math.min(Math.max(Number(a.count ?? 6), 1), 12),
        );
        return res.ok
          ? `Imported ${res.imported} real product(s) from CJ Dropshipping with real media.`
          : `Import failed: ${res.error}`;
      },
    },
    ...commonTools("supplier"),
  ],
};

/* ---------- store builder ---------- */

const storeBuilder: Agent = {
  name: "store_builder",
  description: "Creates stores and writes product listings, SEO copy, and policies.",
  system_prompt:
    "You are the Store Builder agent of SAHJONY Commerce. You write high-converting listings and " +
    "configure stores. Creating a new store is high-risk and requires human approval — request it via " +
    "create_store and continue.",
  tools: () => [
    {
      name: "create_store",
      description: "Create a new storefront (HIGH RISK — requires human approval).",
      input_schema: {
        type: "object",
        properties: {
          name: { type: "string" },
          platform: { type: "string", enum: ["shopify", "woocommerce"] },
        },
        required: ["name"],
      },
      requires_approval: true,
      risk_level: "high",
      handler: async (ctx, a) => {
        await saveStore({
          id: newId(),
          org_id: ctx.orgId,
          name: String(a.name),
          platform: String(a.platform ?? "shopify"),
          url: "",
          status: "active",
          created_at: nowISO(),
        });
        return `Store '${a.name}' created on ${a.platform ?? "shopify"}.`;
      },
    },
    {
      name: "write_product_listing",
      description: "Write or update a product's listing copy and price.",
      input_schema: {
        type: "object",
        properties: {
          product_id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          price: { type: "number" },
        },
        required: ["product_id", "description"],
      },
      handler: async (ctx, a) => {
        const patch: Partial<Product> = { description: String(a.description) };
        if (a.title) patch.title = String(a.title);
        if (a.price !== undefined) patch.price = Number(a.price);
        const updated = await updateProduct(ctx.orgId, String(a.product_id), patch);
        return updated ? `Listing updated for product ${a.product_id}.` : "Error: product not found.";
      },
    },
    {
      name: "publish_product_to_shopify",
      description:
        "Publish a product to the connected Shopify store (HIGH RISK — requires approval). Only works if a " +
        "Shopify store is connected; otherwise reports that no store is connected.",
      input_schema: {
        type: "object",
        properties: { product_id: { type: "string" } },
        required: ["product_id"],
      },
      requires_approval: true,
      risk_level: "high",
      handler: async (ctx, a) => {
        const res = await publishProductToShopify(ctx.orgId, String(a.product_id));
        if (!res.ok) return `Publish failed: ${res.error}`;
        return `Published '${res.product?.title}' to Shopify${res.url ? ` — ${res.url}` : ""}.`;
      },
    },
    {
      name: "generate_product_image",
      description:
        "Generate a cinematic, premium product image via Higgsfield and attach it to a product. " +
        "Only works if Higgsfield is connected.",
      input_schema: {
        type: "object",
        properties: { product_id: { type: "string" } },
        required: ["product_id"],
      },
      handler: async (ctx, a) => {
        const res = await generateProductImage(ctx.orgId, String(a.product_id));
        return res.ok ? `Generated cinematic image: ${res.url}` : `Image generation unavailable: ${res.error}`;
      },
    },
    ...commonTools("store_builder"),
  ],
};

/* ---------- marketing ---------- */

const marketing: Agent = {
  name: "marketing",
  description: "Plans campaigns and creative briefs for TikTok, Meta, and email.",
  system_prompt:
    "You are the Creative Marketing agent of SAHJONY Commerce. You design ad angles, hooks, and " +
    "creative briefs for TikTok, Meta, and email. Record every campaign plan and brief in business " +
    "memory so results can be compared.",
  tools: () => commonTools("marketing"),
};

/* ---------- advertising ---------- */

const advertising: Agent = {
  name: "advertising",
  description: "Manages ad budgets and performance; budget changes need approval.",
  system_prompt:
    "You are the Advertising agent of SAHJONY Commerce. You analyze ROAS, CPA, and CTR and propose " +
    "budget changes. Setting or changing an ad budget is high-risk and requires human approval — " +
    "request it via set_ad_budget and continue.",
  tools: () => [
    {
      name: "set_ad_budget",
      description: "Set the daily ad budget for a channel (HIGH RISK — requires human approval).",
      input_schema: {
        type: "object",
        properties: {
          channel: { type: "string", enum: ["meta", "tiktok", "google"] },
          daily_budget: { type: "number" },
          reason: { type: "string" },
        },
        required: ["channel", "daily_budget"],
      },
      requires_approval: true,
      risk_level: "high",
      handler: async (ctx, a) => {
        await remember(
          ctx.orgId,
          `ad-budget:${a.channel}`,
          `Daily budget for ${a.channel} set to $${Number(a.daily_budget).toFixed(2)}. Reason: ${a.reason ?? "n/a"}`,
          "advertising",
        );
        return `Ad budget for ${a.channel} set to $${Number(a.daily_budget).toFixed(2)}/day and recorded.`;
      },
    },
    ...commonTools("advertising"),
  ],
};

/* ---------- finance ---------- */

const finance: Agent = {
  name: "finance",
  description: "Computes unit economics and tracks profitability.",
  system_prompt:
    "You are the Finance agent of SAHJONY Commerce. You own the books. Start every task with " +
    "get_profit_and_loss — it returns real settled numbers from the accounting ledger, and you must " +
    "reason from those, never from guesses about how the business is doing. Use compute_unit_economics " +
    "for forward-looking margin math on individual products. Record actual advertising spend with " +
    "record_ad_spend so net profit stays truthful. If the books show a loss, say so directly and name " +
    "the line item causing it.",
  tools: () => [
    {
      name: "record_ad_spend",
      description:
        "Record advertising money actually spent, so it lands in the P&L. Bookkeeping only — this " +
        "does not authorize or change any budget.",
      input_schema: {
        type: "object",
        properties: {
          channel: { type: "string", description: "e.g. meta, tiktok, google" },
          amount: { type: "number", description: "Amount spent in USD" },
          period: { type: "string", description: "What the spend covers, e.g. '2026-07-26'" },
        },
        required: ["channel", "amount"],
      },
      handler: async (ctx, a) => {
        const amount = Number(a.amount);
        if (!Number.isFinite(amount) || amount <= 0) return "Error: amount must be a positive number.";
        const period = String(a.period ?? new Date().toISOString().slice(0, 10));
        const channel = String(a.channel);
        const posted = await postEntries(ctx.orgId, [
          {
            account: "ad_spend",
            amount,
            dedupe_key: `ad_spend:${channel}:${period}`,
            memo: `${channel} advertising spend for ${period}`,
          },
        ]);
        return posted
          ? `Recorded $${amount.toFixed(2)} of ${channel} ad spend for ${period}.`
          : `Ad spend for ${channel} on ${period} was already recorded — not double-counted.`;
      },
    },
    {
      name: "read_ledger",
      description: "Read raw ledger entries — every individual money movement, newest first.",
      input_schema: {
        type: "object",
        properties: { limit: { type: "number", description: "How many entries (default 40)" } },
      },
      handler: async (ctx, a) => {
        const entries = await listLedger(ctx.orgId, Math.min(Math.max(Number(a.limit ?? 40), 1), 200));
        if (!entries.length) return "The ledger is empty — no money has moved yet.";
        return entries
          .map(
            (e) =>
              `${e.occurred_at.slice(0, 10)} ${e.account.padEnd(18)} ${e.amount >= 0 ? "+" : ""}${e.amount.toFixed(2)} ${e.memo}`,
          )
          .join("\n");
      },
    },
    {
      name: "compute_unit_economics",
      description: "Compute per-order profit and margin from price, COGS, and ad cost.",
      input_schema: {
        type: "object",
        properties: {
          price: { type: "number" },
          cost: { type: "number" },
          ad_cost_per_order: { type: "number" },
          fee_rate: { type: "number", description: "Payment fee rate, default 0.03" },
        },
        required: ["price", "cost"],
      },
      handler: async (_ctx, a) => {
        const price = Number(a.price);
        const cost = Number(a.cost);
        const adCost = Number(a.ad_cost_per_order ?? 0);
        const fees = price * Number(a.fee_rate ?? 0.03);
        const profit = price - cost - adCost - fees;
        const marginPct = price > 0 ? (profit / price) * 100 : 0;
        return JSON.stringify({
          price,
          cogs: cost,
          ad_cost_per_order: adCost,
          payment_fees: Math.round(fees * 100) / 100,
          profit_per_order: Math.round(profit * 100) / 100,
          net_margin_pct: Math.round(marginPct * 100) / 100,
          margin_score: Math.round(marginScoreFromPrices(cost, price) * 100) / 100,
        });
      },
    },
    ...commonTools("finance"),
  ],
};

/* ---------- support ---------- */

const support: Agent = {
  name: "support",
  description: "Answers customers from real order data; refunds require human approval.",
  system_prompt:
    "You are the Customer Support agent of SAHJONY Commerce. You draft empathetic, on-brand replies. " +
    "ALWAYS look the order up with lookup_order before answering a question about one — quote the " +
    "real stage, tracking number, and dates rather than speaking in generalities. If an order is " +
    "on hold, say what is being done about it. Issuing a refund is high-risk and requires human " +
    "approval — request it via issue_refund and continue.",
  tools: () => [
    {
      name: "lookup_order",
      description:
        "Look up one customer order in full: line items, totals, pipeline stage, supplier order, " +
        "tracking number, and the complete event timeline. Accepts our order id, the store's order " +
        "number (e.g. #1004), or the customer's email.",
      input_schema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Order id, order number, or customer email" },
        },
        required: ["query"],
      },
      handler: async (ctx, a) => {
        const q = String(a.query).trim().toLowerCase();
        const orders = await listOrders(ctx.orgId, 200);
        const hit =
          orders.find((o) => o.id === q) ??
          orders.find((o) => o.order_number.toLowerCase() === q) ??
          orders.find((o) => o.order_number.toLowerCase() === `#${q.replace(/^#/, "")}`) ??
          orders.find((o) => o.external_id === q) ??
          orders.find((o) => o.email.toLowerCase() === q);
        if (!hit) return `No order matching '${a.query}'.`;
        return JSON.stringify({
          order_number: hit.order_number,
          stage: hit.stage,
          placed_at: hit.placed_at,
          customer: hit.customer_name,
          email: hit.email,
          total: hit.total,
          currency: hit.currency,
          refunded: hit.refunded,
          items: hit.lines.map((l) => ({ title: l.title, quantity: l.quantity, price: l.unit_price })),
          shipping_to: `${hit.shipping_address.city}, ${hit.shipping_address.country}`,
          tracking_number: hit.tracking_number ?? null,
          tracking_url: hit.tracking_url ?? null,
          carrier: hit.carrier ?? null,
          hold_reason: hit.hold_reason ?? null,
          timeline: hit.events,
        });
      },
    },
    {
      name: "issue_refund",
      description: "Issue a refund for an order (HIGH RISK — requires human approval).",
      input_schema: {
        type: "object",
        properties: {
          order_id: { type: "string" },
          amount: { type: "number" },
          reason: { type: "string" },
        },
        required: ["order_id", "amount"],
      },
      requires_approval: true,
      risk_level: "high",
      handler: async (ctx, a) => {
        await remember(
          ctx.orgId,
          `refund:${a.order_id}`,
          `Refund of $${Number(a.amount).toFixed(2)} issued for order ${a.order_id}. Reason: ${a.reason ?? "n/a"}`,
          "support",
        );
        return `Refund of $${Number(a.amount).toFixed(2)} recorded for order ${a.order_id}.`;
      },
    },
    ...commonTools("support"),
  ],
};

/* ---------- CEO ---------- */

export const SPECIALISTS: Agent[] = [
  productHunter,
  supplier,
  storeBuilder,
  marketing,
  advertising,
  finance,
  support,
];

const ceo: Agent = {
  name: "ceo",
  description: "Coordinates all agents, reviews the business, and writes daily reports.",
  system_prompt:
    "You are the CEO agent of SAHJONY Commerce, an autonomous dropshipping operator. Open every " +
    "cycle with get_business_snapshot, then coordinate specialist agents via dispatch_agent and " +
    "record a structured report (real revenue and profit, order pipeline, top products, failures, " +
    "next actions) in business memory.\n\n" +
    "Order your priorities the way an owner would:\n" +
    "1. Orders already paid for but not shipped. A customer waiting on a package outranks everything.\n" +
    "2. Anything on hold — unmapped products, failed placements, fraud flags. Dispatch the supplier " +
    "agent to clear the queue and name what is still stuck.\n" +
    "3. The books. If the 30-day P&L shows a loss, find the line item causing it and act on that " +
    "before spending on anything new.\n" +
    "4. Only then: growth — new products, listings, campaigns.\n\n" +
    "Killing a product is high-risk and requires human approval. Be decisive, data-driven, and " +
    "protective of the owner's capital.",
  tools: () => [
    {
      name: "get_business_snapshot",
      description:
        "The state of the whole business in one call: catalog, order pipeline, real 30-day P&L, " +
        "fulfillment backlog, and anything blocked or awaiting approval.",
      input_schema: { type: "object", properties: {} },
      handler: async (ctx) => {
        const [products, runs, stores, approvals, orders, pnl] = await Promise.all([
          listProducts(ctx.orgId),
          listRuns(ctx.orgId, 500),
          listStores(ctx.orgId),
          listApprovals(ctx.orgId),
          listOrders(ctx.orgId, 200),
          getPnl(ctx.orgId, "30d"),
        ]);
        const byKey = <T,>(arr: T[], pick: (x: T) => string) =>
          arr.reduce<Record<string, number>>((m, x) => ((m[pick(x)] = (m[pick(x)] ?? 0) + 1), m), {});

        const held = orders.filter((o) => o.stage === "on_hold");
        return JSON.stringify({
          products_by_status: byKey(products, (p) => p.status),
          agent_runs_by_status: byKey(runs, (r) => r.status),
          store_count: stores.length,
          pending_approvals: approvals.filter((a) => a.status === "pending").length,
          orders_by_stage: byKey(orders, (o) => o.stage),
          orders_total: orders.length,
          awaiting_fulfillment: orders.filter((o) =>
            ["received", "awaiting_stock"].includes(o.stage),
          ).length,
          // Cash already paid to the supplier for orders the customer cancelled.
          supplier_exposure: supplierExposure(orders).slice(0, 10),
          blocked_orders: held.slice(0, 10).map((o) => ({
            id: o.id,
            order_number: o.order_number,
            value: o.total,
            reason: o.hold_reason ?? "unknown",
          })),
          pnl_30d: {
            orders: pnl.orders,
            net_revenue: pnl.net_revenue,
            gross_profit: pnl.gross_profit,
            net_profit: pnl.net_profit,
            net_margin_pct: pnl.net_margin_pct,
            aov: pnl.aov,
            ad_spend: pnl.ad_spend,
          },
        });
      },
    },
    {
      name: "dispatch_agent",
      description: `Run a specialist agent on a task. Available: ${SPECIALISTS.map((a) => a.name).join(", ")}.`,
      input_schema: {
        type: "object",
        properties: { agent: { type: "string" }, task: { type: "string" } },
        required: ["agent", "task"],
      },
      handler: async (ctx, a) => {
        if (ctx.depth >= 1) return "Error: sub-agents cannot dispatch further agents.";
        const { runAgent } = await import("./brain");
        const run = await runAgent({
          orgId: ctx.orgId,
          agentName: String(a.agent),
          task: String(a.task),
          depth: ctx.depth + 1,
        });
        return `Dispatched '${a.agent}' (run ${run.id}, status ${run.status}). Output: ${run.output.slice(0, 2000)}`;
      },
    },
    {
      name: "kill_product",
      description: "Retire an underperforming product (HIGH RISK — requires human approval).",
      input_schema: {
        type: "object",
        properties: { product_id: { type: "string" }, reason: { type: "string" } },
        required: ["product_id"],
      },
      requires_approval: true,
      risk_level: "high",
      handler: async (ctx, a) => {
        const updated = await updateProduct(ctx.orgId, String(a.product_id), { status: "killed" });
        return updated ? `Product '${updated.title}' has been killed.` : "Error: product not found.";
      },
    },
    ...commonTools("ceo"),
  ],
};

export const ALL_AGENTS: Agent[] = [ceo, ...SPECIALISTS];
export const REGISTRY: Record<string, Agent> = Object.fromEntries(
  ALL_AGENTS.map((a) => [a.name, a]),
);

export function getAgent(name: string): Agent | null {
  return REGISTRY[name] ?? null;
}

export function findTool(agent: Agent, toolName: string): ToolDef | null {
  return agent.tools().find((t) => t.name === toolName) ?? null;
}
