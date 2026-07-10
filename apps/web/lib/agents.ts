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
import { generateProductImage, getHiggsfieldCreds, resolveShopifyToken } from "./store";
import { createShopifyProduct } from "./shopify";
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

/** Standard toolset every specialist gets: catalog + memory. */
const commonTools = (agentName: string): ToolDef[] => [
  listProductsTool,
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
    "for launch. Save every evaluated product with save_product so the pipeline is auditable.",
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
  description: "Finds and evaluates suppliers, tracks quotes and reliability.",
  system_prompt:
    "You are the Supplier agent of SAHJONY Commerce. You evaluate sourcing across CJ Dropshipping, " +
    "AliExpress, Spocket, and Zendrop, compare landed costs and shipping times, and record supplier " +
    "quotes and issues in business memory.",
  tools: () => commonTools("supplier"),
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
        "Publish a product to the connected Shopify store (creates it live). Only works if a " +
        "Shopify store is connected; otherwise reports that no store is connected.",
      input_schema: {
        type: "object",
        properties: { product_id: { type: "string" } },
        required: ["product_id"],
      },
      handler: async (ctx, a) => {
        const resolved = await resolveShopifyToken(ctx.orgId);
        if (!resolved.ok || !resolved.token || !resolved.shop) {
          return "No Shopify store is connected — ask the owner to connect one in the dashboard.";
        }
        const product = (await listProducts(ctx.orgId)).find((p) => p.id === String(a.product_id));
        if (!product) return "Error: product not found.";
        let imageUrl = product.image_url;
        if (!imageUrl && (await getHiggsfieldCreds(ctx.orgId))) {
          const img = await generateProductImage(ctx.orgId, product.id);
          if (img.ok) imageUrl = img.url;
        }
        const res = await createShopifyProduct(resolved.shop, resolved.token, {
          title: product.title,
          description: product.description,
          price: product.price,
          image_url: imageUrl,
        });
        if (!res.ok) return `Publish failed: ${res.error}`;
        await updateProduct(ctx.orgId, product.id, { status: "launched", storefront_url: res.url ?? "" });
        return `Published '${product.title}' to Shopify${res.url ? ` — ${res.url}` : ""}.`;
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
    "You are the Finance agent of SAHJONY Commerce. You compute unit economics, monitor " +
    "profitability, and record P&L snapshots. Use compute_unit_economics for all margin math — " +
    "never estimate.",
  tools: () => [
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
  description: "Drafts customer replies; refunds require human approval.",
  system_prompt:
    "You are the Customer Support agent of SAHJONY Commerce. You draft empathetic, on-brand replies. " +
    "Issuing a refund is high-risk and requires human approval — request it via issue_refund and continue.",
  tools: () => [
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
    "You are the CEO agent of SAHJONY Commerce, an autonomous dropshipping operator. You review the business snapshot, coordinate specialist agents via dispatch_agent, " +
    "and record a structured daily report (revenue, profit, top products, failed products, next actions) " +
    "in business memory. Killing a product is high-risk and requires human approval. Be decisive, " +
    "data-driven, and protective of the owner's capital.",
  tools: () => [
    {
      name: "get_business_snapshot",
      description: "Get current counts of products, stores, runs, and pending approvals.",
      input_schema: { type: "object", properties: {} },
      handler: async (ctx) => {
        const [products, runs, stores, approvals] = await Promise.all([
          listProducts(ctx.orgId),
          listRuns(ctx.orgId, 500),
          listStores(ctx.orgId),
          listApprovals(ctx.orgId),
        ]);
        const byStatus = (arr: { status: string }[]) =>
          arr.reduce<Record<string, number>>((m, x) => ((m[x.status] = (m[x.status] ?? 0) + 1), m), {});
        return JSON.stringify({
          products_by_status: byStatus(products),
          agent_runs_by_status: byStatus(runs),
          store_count: stores.length,
          pending_approvals: approvals.filter((a) => a.status === "pending").length,
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
