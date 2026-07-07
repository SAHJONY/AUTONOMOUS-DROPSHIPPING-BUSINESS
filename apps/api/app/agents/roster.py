"""The agent roster: the CEO agent and its specialist agents.

Every agent gets a small set of tools backed by real services and the
database. High-risk tools are flagged ``requires_approval`` and are gated by
the runner (see ``app.agents.base``).
"""

import json

from sqlalchemy import func, select

from app.agents.base import AgentContext, BaseAgent, ToolDef
from app.models import AgentRun, Product, ProductAnalysis, ProductStatus, RunStatus, Store
from app.services import memory as memory_service
from app.services import scoring

_SCORE_FACTORS_SCHEMA = {
    "type": "object",
    "properties": {
        "demand": {"type": "number", "description": "Market demand, 0-100 (higher is better)"},
        "competition": {
            "type": "number",
            "description": "Competition level, 0-100 (higher means MORE competition, worse)",
        },
        "margin": {"type": "number", "description": "Margin quality, 0-100 (higher is better)"},
        "trend": {"type": "number", "description": "Trend momentum, 0-100 (higher is better)"},
        "risk": {
            "type": "number",
            "description": "Operational/legal risk, 0-100 (higher means MORE risk, worse)",
        },
    },
    "required": ["demand", "competition", "margin", "trend", "risk"],
}


def _remember_tool(agent_name: str) -> ToolDef:
    def handler(ctx: AgentContext, args: dict) -> str:
        entry = memory_service.remember(
            ctx.db, ctx.org_id, args["key"], args["content"], agent_name=agent_name
        )
        return f"Saved to business memory (id {entry.id})."

    return ToolDef(
        name="remember",
        description=(
            "Persist a learning, decision, or report to the organization's business memory "
            "so it can be recalled in future runs."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "key": {"type": "string", "description": "Short topic key, e.g. 'daily-report'"},
                "content": {"type": "string", "description": "The content to remember"},
            },
            "required": ["key", "content"],
        },
        handler=handler,
    )


def _recall_tool() -> ToolDef:
    def handler(ctx: AgentContext, args: dict) -> str:
        entries = memory_service.recall(ctx.db, ctx.org_id, args.get("query", ""))
        if not entries:
            return "No matching memory entries."
        return "\n".join(
            f"[{e.created_at:%Y-%m-%d}] ({e.agent_name or 'unknown'}) {e.key}: {e.content}"
            for e in entries
        )

    return ToolDef(
        name="recall_memory",
        description="Search the organization's business memory for past learnings and reports.",
        input_schema={
            "type": "object",
            "properties": {"query": {"type": "string", "description": "Search text (optional)"}},
        },
        handler=handler,
    )


class ProductHunterAgent(BaseAgent):
    name = "product_hunter"
    description = "Discovers and scores product opportunities; only 85+ scores are launch-ready."
    system_prompt = (
        "You are the Product Hunter agent of Claude Commerce OS, an autonomous dropshipping "
        "operator. You evaluate product opportunities rigorously. Always use the "
        "score_product_opportunity tool to score products — never invent scores. Only products "
        "scoring at or above the launch threshold may be recommended for launch. Save every "
        "evaluated product with save_product so the pipeline is auditable."
    )

    def get_tools(self, ctx: AgentContext) -> list[ToolDef]:
        def score_handler(_ctx: AgentContext, args: dict) -> str:
            result = scoring.score_product(
                demand=args["demand"],
                competition=args["competition"],
                margin=args["margin"],
                trend=args["trend"],
                risk=args["risk"],
            )
            return json.dumps(result.as_dict())

        def save_handler(ctx: AgentContext, args: dict) -> str:
            result = scoring.score_product(
                demand=args["demand"],
                competition=args["competition"],
                margin=args["margin"],
                trend=args["trend"],
                risk=args["risk"],
            )
            status = (
                ProductStatus.ready_to_launch
                if result.verdict == scoring.VERDICT_LAUNCH
                else ProductStatus.analyzed
            )
            product = Product(
                org_id=ctx.org_id,
                title=args["title"],
                description=args.get("description", ""),
                source=args.get("source", "agent"),
                supplier_url=args.get("supplier_url", ""),
                cost=args.get("cost", 0.0),
                price=args.get("price", 0.0),
                status=status,
            )
            ctx.db.add(product)
            ctx.db.flush()
            analysis = ProductAnalysis(
                product_id=product.id,
                demand=result.demand,
                competition=result.competition,
                margin=result.margin,
                trend=result.trend,
                risk=result.risk,
                total_score=result.total_score,
                verdict=result.verdict,
                rationale=args.get("rationale", result.rationale),
            )
            ctx.db.add(analysis)
            ctx.db.commit()
            return (
                f"Saved product '{product.title}' (id {product.id}) with score "
                f"{result.total_score} and verdict '{result.verdict}'."
            )

        def list_handler(ctx: AgentContext, _args: dict) -> str:
            products = list(
                ctx.db.scalars(
                    select(Product)
                    .where(Product.org_id == ctx.org_id)
                    .order_by(Product.created_at.desc())
                    .limit(25)
                )
            )
            if not products:
                return "No products in the catalog yet."
            return "\n".join(
                f"{p.title} — status={p.status.value}, cost={p.cost}, price={p.price}"
                for p in products
            )

        save_schema = {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "description": {"type": "string"},
                "source": {"type": "string", "description": "Where it was found"},
                "supplier_url": {"type": "string"},
                "cost": {"type": "number"},
                "price": {"type": "number"},
                "rationale": {"type": "string"},
                **_SCORE_FACTORS_SCHEMA["properties"],
            },
            "required": ["title", *_SCORE_FACTORS_SCHEMA["required"]],
        }

        return [
            ToolDef(
                name="score_product_opportunity",
                description=(
                    "Score a product opportunity with the platform's deterministic model "
                    "(demand 30%, competition 20%, margin 25%, trend 15%, risk 10%). "
                    "Returns the total score and a launch/watch/reject verdict."
                ),
                input_schema=_SCORE_FACTORS_SCHEMA,
                handler=score_handler,
            ),
            ToolDef(
                name="save_product",
                description="Save an evaluated product and its analysis to the catalog.",
                input_schema=save_schema,
                handler=save_handler,
            ),
            ToolDef(
                name="list_products",
                description="List the organization's current product catalog.",
                input_schema={"type": "object", "properties": {}},
                handler=list_handler,
            ),
            _remember_tool(self.name),
            _recall_tool(),
        ]


class SupplierAgent(BaseAgent):
    name = "supplier"
    description = "Finds and evaluates suppliers, tracks quotes and reliability."
    system_prompt = (
        "You are the Supplier agent of Claude Commerce OS. You evaluate sourcing options "
        "across CJ Dropshipping, AliExpress, Spocket, and Zendrop, compare landed costs and "
        "shipping times, and record supplier quotes and issues in business memory."
    )

    def get_tools(self, ctx: AgentContext) -> list[ToolDef]:
        return [_remember_tool(self.name), _recall_tool()]


class StoreBuilderAgent(BaseAgent):
    name = "store_builder"
    description = "Creates stores and writes product listings, SEO copy, and policies."
    system_prompt = (
        "You are the Store Builder agent of Claude Commerce OS. You write high-converting "
        "product listings and configure stores. Creating a new store is a high-risk action "
        "that requires human approval — request it via the create_store tool and continue."
    )

    def get_tools(self, ctx: AgentContext) -> list[ToolDef]:
        def create_store_handler(ctx: AgentContext, args: dict) -> str:
            store = Store(
                org_id=ctx.org_id,
                name=args["name"],
                platform=args.get("platform", "shopify"),
                status="active",
            )
            ctx.db.add(store)
            ctx.db.commit()
            return f"Store '{store.name}' created on {store.platform} (id {store.id})."

        def write_listing_handler(ctx: AgentContext, args: dict) -> str:
            product = ctx.db.get(Product, args["product_id"])
            if product is None or product.org_id != ctx.org_id:
                return "Error: product not found."
            product.title = args.get("title", product.title)
            product.description = args["description"]
            if "price" in args:
                product.price = args["price"]
            ctx.db.commit()
            return f"Listing updated for product {product.id}."

        return [
            ToolDef(
                name="create_store",
                description="Create a new storefront (HIGH RISK — requires human approval).",
                input_schema={
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "platform": {"type": "string", "enum": ["shopify", "woocommerce"]},
                    },
                    "required": ["name"],
                },
                handler=create_store_handler,
                requires_approval=True,
                risk_level="high",
            ),
            ToolDef(
                name="write_product_listing",
                description="Write or update a product's listing copy and price.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "product_id": {"type": "string"},
                        "title": {"type": "string"},
                        "description": {"type": "string"},
                        "price": {"type": "number"},
                    },
                    "required": ["product_id", "description"],
                },
                handler=write_listing_handler,
            ),
            _remember_tool(self.name),
            _recall_tool(),
        ]


class MarketingAgent(BaseAgent):
    name = "marketing"
    description = "Plans campaigns and creative briefs for TikTok, Meta, and email."
    system_prompt = (
        "You are the Creative Marketing agent of Claude Commerce OS. You design ad angles, "
        "hooks, and creative briefs for TikTok, Meta, and email campaigns. Record every "
        "campaign plan and creative brief in business memory so results can be compared."
    )

    def get_tools(self, ctx: AgentContext) -> list[ToolDef]:
        return [_remember_tool(self.name), _recall_tool()]


class AdvertisingAgent(BaseAgent):
    name = "advertising"
    description = "Manages ad budgets and performance; budget changes need approval."
    system_prompt = (
        "You are the Advertising agent of Claude Commerce OS. You analyze campaign performance "
        "(ROAS, CPA, CTR) and propose budget changes. Setting or changing an ad budget is a "
        "high-risk action requiring human approval — request it via set_ad_budget and continue."
    )

    def get_tools(self, ctx: AgentContext) -> list[ToolDef]:
        def budget_handler(ctx: AgentContext, args: dict) -> str:
            memory_service.remember(
                ctx.db,
                ctx.org_id,
                key=f"ad-budget:{args['channel']}",
                content=(
                    f"Daily budget for {args['channel']} set to ${args['daily_budget']:.2f}. "
                    f"Reason: {args.get('reason', 'n/a')}"
                ),
                agent_name=self.name,
            )
            return (
                f"Ad budget for {args['channel']} set to ${args['daily_budget']:.2f}/day "
                "and recorded."
            )

        return [
            ToolDef(
                name="set_ad_budget",
                description=(
                    "Set the daily ad budget for a channel (HIGH RISK — requires human approval)."
                ),
                input_schema={
                    "type": "object",
                    "properties": {
                        "channel": {"type": "string", "enum": ["meta", "tiktok", "google"]},
                        "daily_budget": {"type": "number"},
                        "reason": {"type": "string"},
                    },
                    "required": ["channel", "daily_budget"],
                },
                handler=budget_handler,
                requires_approval=True,
                risk_level="high",
            ),
            _remember_tool(self.name),
            _recall_tool(),
        ]


class FinanceAgent(BaseAgent):
    name = "finance"
    description = "Computes unit economics and tracks profitability."
    system_prompt = (
        "You are the Finance agent of Claude Commerce OS. You compute unit economics, monitor "
        "profitability, and record P&L snapshots. Use compute_unit_economics for all margin "
        "math — never estimate."
    )

    def get_tools(self, ctx: AgentContext) -> list[ToolDef]:
        def unit_economics_handler(_ctx: AgentContext, args: dict) -> str:
            price = float(args["price"])
            cost = float(args["cost"])
            ad_cost = float(args.get("ad_cost_per_order", 0.0))
            fees = price * float(args.get("fee_rate", 0.03))
            profit = price - cost - ad_cost - fees
            margin_pct = (profit / price * 100) if price > 0 else 0.0
            return json.dumps(
                {
                    "price": price,
                    "cogs": cost,
                    "ad_cost_per_order": ad_cost,
                    "payment_fees": round(fees, 2),
                    "profit_per_order": round(profit, 2),
                    "net_margin_pct": round(margin_pct, 2),
                    "margin_score": round(scoring.margin_score_from_prices(cost, price), 2),
                }
            )

        return [
            ToolDef(
                name="compute_unit_economics",
                description="Compute per-order profit and margin from price, COGS, and ad cost.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "price": {"type": "number"},
                        "cost": {"type": "number"},
                        "ad_cost_per_order": {"type": "number"},
                        "fee_rate": {
                            "type": "number",
                            "description": "Payment fee rate, default 0.03",
                        },
                    },
                    "required": ["price", "cost"],
                },
                handler=unit_economics_handler,
            ),
            _remember_tool(self.name),
            _recall_tool(),
        ]


class SupportAgent(BaseAgent):
    name = "support"
    description = "Drafts customer replies; refunds require human approval."
    system_prompt = (
        "You are the Customer Support agent of Claude Commerce OS. You draft empathetic, "
        "on-brand replies to customer messages. Issuing a refund is a high-risk action that "
        "requires human approval — request it via issue_refund and continue."
    )

    def get_tools(self, ctx: AgentContext) -> list[ToolDef]:
        def refund_handler(ctx: AgentContext, args: dict) -> str:
            memory_service.remember(
                ctx.db,
                ctx.org_id,
                key=f"refund:{args['order_id']}",
                content=(
                    f"Refund of ${args['amount']:.2f} issued for order {args['order_id']}. "
                    f"Reason: {args.get('reason', 'n/a')}"
                ),
                agent_name=self.name,
            )
            return f"Refund of ${args['amount']:.2f} recorded for order {args['order_id']}."

        return [
            ToolDef(
                name="issue_refund",
                description="Issue a refund for an order (HIGH RISK — requires human approval).",
                input_schema={
                    "type": "object",
                    "properties": {
                        "order_id": {"type": "string"},
                        "amount": {"type": "number"},
                        "reason": {"type": "string"},
                    },
                    "required": ["order_id", "amount"],
                },
                handler=refund_handler,
                requires_approval=True,
                risk_level="high",
            ),
            _remember_tool(self.name),
            _recall_tool(),
        ]


class CEOAgent(BaseAgent):
    name = "ceo"
    description = "Coordinates all agents, reviews the business, and writes daily reports."
    system_prompt = (
        "You are the CEO agent of Claude Commerce OS, an autonomous dropshipping operator. "
        "You review the business snapshot, coordinate specialist agents via dispatch_agent, "
        "and record a structured daily report (revenue, profit, top products, failed products, "
        "next actions) in business memory. Killing a product is a high-risk action requiring "
        "human approval."
    )

    def get_tools(self, ctx: AgentContext) -> list[ToolDef]:
        def snapshot_handler(ctx: AgentContext, _args: dict) -> str:
            db = ctx.db
            product_counts = dict(
                db.execute(
                    select(Product.status, func.count())
                    .where(Product.org_id == ctx.org_id)
                    .group_by(Product.status)
                ).all()
            )
            run_counts = dict(
                db.execute(
                    select(AgentRun.status, func.count())
                    .where(AgentRun.org_id == ctx.org_id)
                    .group_by(AgentRun.status)
                ).all()
            )
            stores = db.scalar(
                select(func.count()).select_from(Store).where(Store.org_id == ctx.org_id)
            )
            return json.dumps(
                {
                    "products_by_status": {k.value: v for k, v in product_counts.items()},
                    "agent_runs_by_status": {k.value: v for k, v in run_counts.items()},
                    "store_count": stores,
                }
            )

        def dispatch_handler(ctx: AgentContext, args: dict) -> str:
            if ctx.depth >= 1:
                return "Error: sub-agents cannot dispatch further agents."
            from app.agents.orchestrator import run_agent  # avoid circular import

            run = run_agent(
                ctx.db,
                org_id=ctx.org_id,
                agent_name=args["agent"],
                task=args["task"],
                depth=ctx.depth + 1,
            )
            return (
                f"Dispatched '{args['agent']}' (run {run.id}, status {run.status.value}). "
                f"Output: {run.output[:2000]}"
            )

        def kill_product_handler(ctx: AgentContext, args: dict) -> str:
            product = ctx.db.get(Product, args["product_id"])
            if product is None or product.org_id != ctx.org_id:
                return "Error: product not found."
            product.status = ProductStatus.killed
            ctx.db.commit()
            return f"Product '{product.title}' ({product.id}) has been killed."

        dispatchable = ", ".join(
            a.name for a in SPECIALIST_AGENTS
        )
        return [
            ToolDef(
                name="get_business_snapshot",
                description="Get current counts of products, stores, and agent runs.",
                input_schema={"type": "object", "properties": {}},
                handler=snapshot_handler,
            ),
            ToolDef(
                name="dispatch_agent",
                description=f"Run a specialist agent on a task. Available agents: {dispatchable}.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "agent": {"type": "string"},
                        "task": {"type": "string"},
                    },
                    "required": ["agent", "task"],
                },
                handler=dispatch_handler,
            ),
            ToolDef(
                name="kill_product",
                description=(
                    "Retire an underperforming product (HIGH RISK — requires human approval)."
                ),
                input_schema={
                    "type": "object",
                    "properties": {
                        "product_id": {"type": "string"},
                        "reason": {"type": "string"},
                    },
                    "required": ["product_id"],
                },
                handler=kill_product_handler,
                requires_approval=True,
                risk_level="high",
            ),
            _remember_tool(self.name),
            _recall_tool(),
        ]


SPECIALIST_AGENTS: list[BaseAgent] = [
    ProductHunterAgent(),
    SupplierAgent(),
    StoreBuilderAgent(),
    MarketingAgent(),
    AdvertisingAgent(),
    FinanceAgent(),
    SupportAgent(),
]

ALL_AGENTS: list[BaseAgent] = [CEOAgent(), *SPECIALIST_AGENTS]

# RunStatus is imported for type checkers used by dispatch handlers.
__all__ = ["ALL_AGENTS", "SPECIALIST_AGENTS", "CEOAgent", "RunStatus"]
