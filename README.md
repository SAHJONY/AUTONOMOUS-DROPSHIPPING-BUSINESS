# Claude Commerce OS

An autonomous AI dropshipping operator that runs a **complete** business — not just the shopfront.

A **Claude Fable 5** CEO agent coordinates seven specialists (product hunting, suppliers,
store building, marketing, advertising, finance, customer support). They discover and score
products, publish them to a real Shopify store, and then run the half of the business that
actually earns money: **taking orders, buying the goods from the supplier, shipping them with real
tracking, and accounting for every dollar.** High-risk decisions — budget changes, refunds, store
creation, killing products, and spending above the supplier cost cap — stop for human approval.

The production app runs **entirely on Vercel** — Next.js route handlers are the backend, Upstash
Redis (with an in-memory fallback) is the datastore, and two Vercel Crons drive the operation: an
hourly fulfillment heartbeat and a daily CEO cycle. Sign in and manage the whole operation from an
ultra-premium cinematic command deck.

## The full loop

```
  discover → score → publish        ┃        sell → fulfill → ship → account
  ────────────────────────────      ┃      ──────────────────────────────────
  CJ supplier feed                  ┃   Shopify webhook (HMAC-verified)
  deterministic scoring (85+)       ┃   order matched to catalog, costs frozen
  studio imagery                    ┃   goods bought at CJ (cost-capped)
  live Shopify listing              ┃   tracking pushed back → customer emailed
                                    ┃   every dollar posted to the ledger
```

Both halves run unattended. What a human is actually for is the short list of things the system
deliberately refuses to decide alone: an order it can't source, an address it can't ship to, a
payment that never captured, a fraud flag, or a purchase larger than the cost cap.

## Real money, real books

Revenue is not estimated from the catalog. Every sale, discount, refund, cost of goods, supplier
shipping charge, payment fee, and advertising dollar is posted to an append-only ledger, and the
P&L is derived from that ledger and nothing else.

- **Idempotent by construction.** Each entry carries a key derived from what it represents
  (`order:1042:revenue`), so a redelivered webhook, a repeated sync, or a retried fulfillment can
  never double-count. The same guarantee covers supplier orders: an order is never bought twice.
- **Accrual with a true-up.** COGS is recognized at the moment of sale using the cost frozen onto
  the order line, then corrected to the supplier's actual invoice when the goods are bought — so
  margin is meaningful immediately and exact once shipped.
- **Tax is a liability, not income.** Sales tax collected is tracked and deliberately excluded from
  revenue and profit.
- **The forecast follows reality.** Below five settled orders it projects from catalog pricing;
  above that it refits itself to the AOV and landed cost the business actually achieves.

## The owner

`sahjonycapitalllc@outlook.com` is the platform **owner / super-admin**. Any account created with
that email is automatically granted unrestricted god-mode: full access to every organization,
user, product, run, and approval across the platform, surfaced in the dashboard's owner panel
(`GET /api/admin/overview`).

## Repository layout

```
apps/
  web/   Next.js 15 full-stack app — the production product. Route handlers under
         app/api/* implement auth, orgs, the Fable 5 agent brain, product scoring,
         orders, fulfillment, the accounting ledger, approvals, business memory,
         dashboard, owner god-mode, webhooks, and the crons.
         Business logic lives in apps/web/lib/*; tests in apps/web/tests/*.
  api/   Legacy FastAPI reference backend (SQLAlchemy + Alembic). Kept for local
         experimentation and its test suite; not used by the Vercel deployment.
vercel.json          Vercel build + cron configuration.
.github/workflows/   CI: typechecks, tests and builds the web app; lints/tests the legacy API.
```

### The modules that matter

| Module | Responsibility |
|---|---|
| `lib/ledger.ts` | Signed, idempotent postings and the P&L derived from them |
| `lib/orders.ts` | Shopify order → catalog mapping, classification, ingestion, refunds |
| `lib/fulfillment.ts` | Supplier placement, tracking sync, Shopify fulfillment, the cycle |
| `lib/suppliers/cj.ts` | CJ sourcing, variant resolution, order placement, tracking |
| `lib/shopify.ts` | Products, orders, fulfillments, webhook registration and HMAC verification |
| `lib/brain.ts` | The approval-gated agentic loop |
| `lib/agents.ts` | The CEO and seven specialists, and the tools they hold |

## Architecture (Vercel-native)

```
                 CLAUDE FABLE 5  ── the brain & engine (lib/brain.ts)
                        │  manual agentic loop, approval-gated
        ┌───────────────┴───────────────────────────────────────┐
        │        │        │        │        │        │        │
     Product  Supplier  Store   Marketing Advert.  Finance  Support   (lib/agents.ts)
     Hunter      │      Builder                       │        │
                 │ fulfillment              real P&L  │  real orders
        └────────┼──────────────────────────────────────────────┘
                 │
     Next.js route handlers (apps/web/app/api/*) ── auth, orgs, runs, approvals,
     products, orders, P&L, dashboard, admin, webhooks, crons
                 │
        ┌────────┴────────┐
    Shopify            CJ Dropshipping
    products/orders/    sourcing/orders/
    fulfillments        tracking
                 │
     KV store (lib/kv.ts) ── Upstash Redis  ▸  in-memory fallback
```

Key design decisions:

- **Manual agentic loop** (`lib/brain.ts`): every tool call passes a policy check. Tools flagged
  `requires_approval` are never executed by the model — an approval request is created and the
  owner decides. Approving executes the stored action.
- **Money is gated twice** (`lib/fulfillment.ts`): buying goods is the only autonomous action that
  sends cash to an outside company, so it requires both `auto_fulfill` to be on and the individual
  order to sit under `AUTOPILOT_MAX_ORDER_COST`. Everything above it becomes an approval.
- **Webhooks are verified, not trusted** (`lib/shopify.ts`): deliveries are HMAC-checked with a
  constant-time comparison before any number reaches the ledger, and the handler fails closed when
  no signing secret is configured.
- **Deterministic product scoring** (`lib/scoring.ts`): demand 30%, competition 20%, margin 25%,
  trend 15%, risk 10%. Only products scoring **85+** are launch-ready.
- **Business memory** (`lib/store.ts`): agents persist learnings and reports per organization and
  recall them in later runs — the operation compounds.
- **Graceful degradation**: with no `ANTHROPIC_API_KEY` the brain runs in deterministic
  **simulation mode**, so the platform is fully usable out of the box; set the key to go live.
  Without webhook configuration, orders are still collected by the hourly polling sync.

## Deploy on Vercel

1. Import the repo (Vercel auto-detects the config in `vercel.json`).
2. Set environment variables (see `.env.example`):
   - `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL=claude-fable-5` — activate the live brain.
   - `JWT_SECRET` — a long random string.
   - `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` — durable 24/7 storage
     (Vercel's Upstash marketplace integration also provides `KV_REST_API_URL/TOKEN`).
   - `CRON_SECRET` — authorizes both crons.
   - `SHOPIFY_WEBHOOK_SECRET` + `PUBLIC_BASE_URL` — real-time orders. Without them the app falls
     back to polling Shopify hourly, which still works but is not instant.
3. Deploy. Two crons run from `vercel.json`:
   - `/api/cron/fulfillment` **hourly** — pulls orders, buys the goods, ships with tracking.
   - `/api/cron/autonomous` **daily** — the CEO cycle: clear the pipeline, read the books, grow.

### Connecting a Shopify store

Create an app in **Settings → Apps and sales channels → Develop apps**, grant `write_products`,
`read_orders`, and `write_fulfillments`, and paste the Client ID and Secret into the dashboard.
Order webhooks are registered automatically on connect when `PUBLIC_BASE_URL` and
`SHOPIFY_WEBHOOK_SECRET` are set. Without `read_orders` the business can publish products but will
never learn that any of them sold; without `write_fulfillments` it can buy the goods but never tell
the customer their package is on the way.

## Local development (web)

```bash
npm install
npm run dev --workspace apps/web    # http://localhost:3000
```

Without any env vars the app boots in simulation + in-memory mode. Add `.env.local` in
`apps/web/` with the variables above to run live.

## API tour (Next.js)

| Endpoint | Purpose |
|---|---|
| `POST /api/auth/register` / `POST /api/auth/login` | Create account + org, get a JWT |
| `GET /api/auth/me` | Current user (incl. `is_owner`) |
| `GET /api/agents` | List agents and their tools |
| `POST /api/orgs/{org}/agents/{agent}/run` | Run an agent on a task |
| `GET /api/orgs/{org}/runs` | Agent run history |
| `GET /api/orgs/{org}/approvals` · `POST .../{id}/decide` | High-risk approval queue |
| `POST /api/orgs/{org}/products/score` | Deterministic scoring |
| `GET /api/orgs/{org}/orders` | The order book, optionally filtered by stage |
| `GET/POST /api/orgs/{org}/orders/{id}` | Order detail; `place` · `track` · `ship` · `release` |
| `POST /api/orgs/{org}/orders/sync` | Pull orders from Shopify, or run a full fulfillment cycle |
| `GET /api/orgs/{org}/pnl` | Real P&L across five windows + the ledger behind it |
| `POST /api/webhooks/shopify/{topic}` | HMAC-verified order feed (orders, cancellations, refunds) |
| `GET /api/orgs/{org}/dashboard` | Metrics summary |
| `GET /api/orgs/{org}/memory` | Business memory |
| `GET /api/admin/overview` | **Owner-only** platform god-mode |
| `GET/POST /api/cron/fulfillment` | Hourly fulfillment heartbeat (cron-secured) |
| `GET/POST /api/cron/autonomous` | Daily CEO cycle (cron-secured) |

## Tests

```bash
npm run test --workspace apps/web        # 100 tests
npm run typecheck --workspace apps/web
```

The suite concentrates on the parts where being wrong costs real money: ledger arithmetic and
idempotency, Shopify order mapping and classification, refund handling, webhook signature
enforcement, the supplier cost caps, and the fulfillment state machine. Integrations are stubbed,
so the tests never touch a live store or spend anything.

## Legacy FastAPI backend

The original Python backend in `apps/api` remains for reference and local use
(`cd apps/api && pip install -e '.[dev]' && uvicorn app.main:app --reload`). The Vercel
deployment does not use it — all production logic is the Next.js app.
