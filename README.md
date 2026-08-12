# Claude Commerce OS

An autonomous AI dropshipping operator that runs a **complete** business — not just the shopfront.

An **OpenAI Codex** CEO agent coordinates seven specialists (product hunting, suppliers,
store building, marketing, advertising, finance, customer support). They discover and score
products, publish them to a real Shopify store, and then run the half of the business that
actually earns money: **taking orders, buying the goods from the supplier, shipping them with real
tracking, and accounting for every dollar.** High-risk decisions — budget changes, refunds, store
creation, killing products, and spending above the supplier cost cap — stop for human approval.

The production app runs **entirely on Vercel** — Next.js route handlers are the backend, Upstash
Redis (with an in-memory fallback) is the datastore, and two Vercel Crons drive the operation: a
fulfillment heartbeat and a CEO cycle. Sign in and manage the whole operation from an ultra-premium
cinematic command deck.

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

Parcels are followed the rest of the way too — the cycle polls the carrier and closes orders out at
`delivered`, which is the point the sale is genuinely finished.

## Locked by default

Two master gates ship **off**, and nothing autonomous happens until they are deliberately turned on:

| Gate | While off |
|---|---|
| `ENABLE_AUTONOMY` | Nothing is auto-approved, and not a cent is spent at the supplier |
| `COMMERCE_RELEASE_ENABLED` | Publishing is locked; the publish route returns `423` |

Six agent actions are approval-gated whatever the gates say — placing a supplier order, publishing a
product, creating a store, setting an ad budget, issuing a refund, and killing a product. That set is
locked by a test, so adding a money-moving tool without a gate fails CI rather than production.

## Know before you trade

`GET /api/orgs/{org}/readiness` (and the **Go-live checklist** on the deck) reports whether this
deployment is actually fit to run a business. It exists because the most dangerous facts are the
quietest ones:

- **No Upstash credentials → in-memory storage.** On serverless that is not a degraded mode, it is
  data loss on a loop: orders, ledger entries, products and accounts reset on the next cold start
  while the books appear to work the whole time. Reported as a **blocker**.
- **Default `JWT_SECRET`.** It is public in the source, so anyone could mint a token for any account
  including the owner. Also a **blocker**.

Operational gaps (no `CRON_SECRET`, no supplier, no webhook secret) are warnings carrying their own
fix. Release-gate posture is reported as information, never as a problem — a deployment deliberately
running locked down shows zero warnings.

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
- **Money at risk is named.** When a customer cancels or refunds after the goods were already bought,
  the refund lands in the books and the matching COGS would otherwise sit there as a loss nobody
  attributed. Those orders are surfaced as **At Risk**, split by whether the supplier order can still
  be cancelled — recoverable ones ranked ahead of larger unrecoverable losses.
- **Per-product truth.** Units, revenue, cost, gross profit and margin per product, derived from the
  stored order lines using the same frozen costs the ledger was built from.

## The owner

`sahjonycapitalllc@outlook.com` is the platform **owner / super-admin**. Any account created with
that email is automatically granted unrestricted god-mode: full access to every organization,
user, product, run, and approval across the platform, surfaced in the dashboard's owner panel
(`GET /api/admin/overview`).

## Repository layout

```
apps/
  web/   Next.js 15 full-stack app — the production product. Route handlers under
         app/api/* implement auth, orgs, the Codex agent brain, product scoring,
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
| `lib/readiness.ts` | Go-live preflight — what makes this deployment unfit to trade |
| `lib/governance.ts` | Role capabilities and fail-closed cron authorization |
| `lib/brain.ts` | The approval-gated agentic loop |
| `lib/agents.ts` | The CEO and seven specialists, and the tools they hold |

## Architecture (Vercel-native)

```
                  OPENAI CODEX  ── the brain & engine (lib/brain.ts)
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
- **Graceful degradation**: with no `OPENAI_API_KEY` the brain runs in deterministic
  **simulation mode**, so the platform is fully usable out of the box; set the key to go live.
  Without webhook configuration, orders are still collected by the polling sync on each cron pass.

## Deploy on Vercel

Two guides cover setup in detail:

- **[docs/FREE_TIER_GO_LIVE.md](docs/FREE_TIER_GO_LIVE.md)** — taking the deployment to zero
  readiness blockers without paying for infrastructure, and what genuinely cannot be free.
- **[docs/ACCIO_SOURCING.md](docs/ACCIO_SOURCING.md)** — using Alibaba's Accio Work desktop agent
  as an owner-operated sourcing tool, and why it is not (and cannot be) a server integration.

1. Import the repo (Vercel auto-detects the config in `vercel.json`).
2. Set environment variables (see `.env.example`):
   - `OPENAI_API_KEY`, `OPENAI_MODEL=gpt-5.6` — activate the live brain.
   - `JWT_SECRET` — a long random string.
   - `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` — durable 24/7 storage
     (Vercel's Upstash marketplace integration also provides `KV_REST_API_URL/TOKEN`).
   - `CRON_SECRET` — authorizes both crons.
   - `SHOPIFY_WEBHOOK_SECRET` + `PUBLIC_BASE_URL` — real-time orders. Without them the app falls
     back to polling Shopify on each cron pass, which still works but is not instant.
3. Deploy. Two crons run from `vercel.json`:
   - `/api/cron/autonomous` at **08:00 UTC** — the CEO cycle: clear the pipeline, read the books, grow.
   - `/api/cron/fulfillment` at **20:00 UTC** — pulls orders, buys the goods, ships with tracking.

   The autonomous cycle runs a fulfillment pass before anything else, so orders are worked **twice a
   day, twelve hours apart**, on the default schedule.

### Fulfillment cadence and your Vercel plan

Vercel's **Hobby** plan only permits *daily* cron schedules, which is why fulfillment is pinned to a
fixed time rather than running hourly. That is a real product constraint: on Hobby, an order placed
just after a run waits up to twelve hours before the supplier is paid and the customer is told their
package is moving.

On **Pro**, change one line in `vercel.json` to close that gap:

```json
{ "path": "/api/cron/fulfillment", "schedule": "0 * * * *" }
```

Nothing else needs to change — the cycle is idempotent and safe to run as often as you like. You can
also press **✦ Fulfill now** on the Orders panel at any time, on any plan, to run a pass immediately.

### Connecting a Shopify store

Create an app in **Settings → Apps and sales channels → Develop apps**, grant `write_products`,
`read_orders`, and `write_fulfillments`, and paste the Client ID and Secret into the dashboard.
Order webhooks are registered automatically on connect when `PUBLIC_BASE_URL` and
`SHOPIFY_WEBHOOK_SECRET` are set. Without `read_orders` the business can publish products but will
never learn that any of them sold; without `write_fulfillments` it can buy the goods but never tell
the customer their package is on the way.

## 24/7 autonomy — the shift rotation

The fleet works in shifts (`apps/web/lib/autonomy.ts`). Every tick ships what is already sold, then
puts **one agent on duty** with a concrete duty brief, rotating through the whole roster — `ceo →
product_hunter → supplier → store_builder → marketing → advertising → finance → support`. On a
30-minute heartbeat the eight-agent roster completes a full rotation every four hours while token
spend stays bounded to one agent per tick rather than eight.

Deterministic work that needs no model runs on **every** tick, before any agent: fulfillment of paid
orders, supplier sourcing when stock is thin, competitor re-pricing against public listings, the
current projection filed into business memory, the standing intelligence sweep, autopilot approvals
within safe thresholds, and publishing everything launch-ready. So customers get their packages and the storefront keeps
stocking itself even if the engine is unreachable or an agent shift fails.

### The standing intelligence sweep

The registries and sourcing matrices in this repo were built as things the owner consults, which
means they are only as fresh as the last time somebody remembered to look. Every tick
(`lib/intelligence.ts`) now joins the 25-SKU sourcing basket against the live catalog and works out
what is genuinely not covered — ranked P1 first, each gap carrying its next action and its missing
evidence — then files the brief into business memory as `intelligence:assortment-gap`.

The agent on duty receives the headline numbers as task context, so a shift starts from the real
worklist instead of spending its budget rediscovering what the catalog is already missing. A healthy
catalog adds no tokens: the briefing is empty when the sweep has nothing to say.

`GET /api/orgs/{org}/intelligence` returns the same gap on demand.

The one paid lookup — NBD customs/trade data — fires only for a supplier the org has **no** trade
profile for yet, and files what it finds under `trade:{supplier}`. Research is something you finish,
so in the steady state this makes zero calls. It is skipped entirely without `NBD_RAPIDAPI_KEY`, and
`AUTONOMY_TRADE_LOOKUPS=0` disables it outright.

### Finding suppliers nobody told it about

The sweep knows what is missing; `lib/supplier-discovery.ts` goes looking for someone who can supply
it. Each unmet gap becomes a web search, the results are filtered down to plausible suppliers, and
what survives is filed under `supplier-candidate:{host}` for the shift on duty and the owner.

- **The niche gate is fail-closed.** A query is built from the gap's *lane*, which fixes the
  religious tradition, then asserted against `botanica-policy`. A query that cannot be shown to
  target Botanica/Lucumi/Orisha merchandise is never run.
- **All four supply-chain tiers are hunted and classified.** Manufacturers, distributors,
  wholesalers and resellers each get asked for in the words those businesses use about themselves,
  in English and Spanish. Where a candidate sits in the chain is what ranks it — a manufacturer
  sells at the lowest cost and can private-label, a reseller is the thinnest margin of the four —
  and when a page claims several, the strongest one wins, because a factory that also says
  "wholesale" is still a factory. Resellers are ranked last, never filtered out.
- **Consumer marketplaces are rejected, not ranked down.** Amazon, Etsy, AliExpress listings and
  social results are not suppliers to onboard, whatever tier they claim. Niche relevance is the
  price of entry.
- **Only HTTPS public hosts.** Private and loopback addresses are refused, reusing the same
  guard as the competitor scanner.
- **It converges.** A host already on file is never searched for again, so spend falls to nothing
  once the bench is built.

The tier hunted **rotates by UTC hour**, the same trick the agent shift rotation uses: the whole
supply chain is covered across a day without four times the query spend.

| Tier | Why it ranks there |
|---|---|
| `MANUFACTURER` | Lowest cost, and the only tier that can private-label |
| `DISTRIBUTOR` | Breadth of catalog, one step from the source |
| `WHOLESALER` | The MOQ-friendly middle |
| `RESELLER` | Thinnest margin, but still a real route to stock |

Every candidate is an unverified web result. Nothing discovered is a vetted supplier and none of it
authorizes a purchase — `GET /api/orgs/{org}/supplier-discovery` returns the list with that notice
attached, and runs no searches itself.

#### Search costs, and the brake

Discovery is **off** until you configure a provider, and neither available provider caps your
spending — so this module keeps its own hard ceiling.

| Provider | Reality as of August 2026 |
|---|---|
| `BRAVE_SEARCH_API_KEY` | Free tier ended February 2026. $5 per 1,000 queries past a $5 monthly credit, **billed with no spending cap** |
| `GOOGLE_CSE_API_KEY` + `GOOGLE_CSE_ID` | Still 100 queries/day free, but **closed to new customers** and retiring January 1, 2027 |

`SUPPLIER_DISCOVERY_DAILY_BUDGET` (default **50**) is a platform-wide ceiling on paid queries per UTC
day, counted in the KV store and enforced before every request. `SUPPLIER_DISCOVERY_QUERIES_PER_TICK`
(default 2) bounds one org's share. Either set to `0` disables discovery outright. On the default
budget with Brave, the worst case is roughly **$0.25/day**; on Google CSE it stays inside the free
100/day.

### The loop refuses to trade on an unfit deployment

Autonomy multiplies whatever the deployment already is. On the in-memory fallback that means buying
goods against books that silently reset; on the default `JWT_SECRET` it means doing so on a
deployment anyone can sign into as the owner. A human pressing **✦ Fulfill now** sees those warnings
on the deck — a cron at 3am does not.

So the loop checks for itself. While either blocker stands, the money-moving steps — fulfillment,
autopilot approvals and publishing — are held back and reported as `held_for_readiness`, on the tick,
on both crons (`423`), and on `GET /api/health`. Read-only intelligence still runs, because it costs
nothing. Clear the blockers and the same code starts trading with no further change.

| Control | Effect |
|---|---|
| `GET /api/cron/autonomous` | Ship, stock, then run the agent currently on duty |
| `?all=1` | Run the entire roster in one tick |
| `?agent=marketing,finance` | Run specific agents |
| `?include_idle=1` | Also advance orgs with no integrations and no catalog |
| `GET /api/health` | Live status: engine, storage durability, roster, who is on duty, whether money-moving work is enabled |

Tuning: `AUTONOMY_MAX_ORGS` (default 25) bounds orgs advanced per tick; `AUTONOMY_DEADLINE_MS`
(default 240000) stops new work before the function time limit; `AUTONOMY_COMPETITOR_SCAN_LIMIT`
(default 10) bounds competitor listings re-priced per org per tick; `AUTONOMY_TRADE_LOOKUPS`
(default 2) bounds paid trade lookups per org per tick.

### Getting a true 24/7 cadence on the Hobby plan

Vercel's Hobby plan only permits *daily* cron schedules, so `vercel.json` pins the two passes to
08:00 and 20:00 UTC. `.github/workflows/heartbeat.yml` closes that gap on **any** plan: a GitHub
Actions schedule calls the same endpoints every 30 minutes, so the fleet works around the clock and
an order never waits twelve hours to ship. Ticks are idempotent, so the Vercel and Actions
heartbeats overlapping is harmless.

Enable it with two repository secrets (**Settings → Secrets and variables → Actions**):

| Secret | Value |
|---|---|
| `APP_URL` | `https://autonomous-dropshipping-business.vercel.app` |
| `CRON_SECRET` | the same value set on the Vercel project |

The workflow no-ops when `APP_URL` is unset, so forks stay quiet.


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
| `GET /api/orgs/{org}/pnl` | Real P&L across five windows, the ledger, and per-product performance |
| `GET /api/orgs/{org}/readiness` | Go-live preflight (owner/admin) |
| `GET /api/orgs/{org}/intelligence` | Current assortment gap against the sourcing basket |
| `GET /api/orgs/{org}/supplier-discovery` | Supplier candidates found on the open web, counted by tier; `?tier=MANUFACTURER` filters (owner-only) |
| `POST /api/webhooks/shopify/{topic}` | HMAC-verified order feed (orders, cancellations, refunds) |
| `GET /api/orgs/{org}/dashboard` | Metrics summary |
| `GET /api/orgs/{org}/memory` | Business memory |
| `GET /api/admin/overview` | **Owner-only** platform god-mode |
| `GET/POST /api/cron/fulfillment` | Fulfillment heartbeat (cron-secured) |
| `GET/POST /api/cron/autonomous` | Daily CEO cycle (cron-secured) |

## Tests

```bash
npm run test --workspace apps/web        # 157 tests
npm run typecheck --workspace apps/web
```

The suite concentrates on the parts where being wrong costs real money: ledger arithmetic and
idempotency, Shopify order mapping and classification, refund handling, webhook signature
enforcement, the supplier cost caps, the fulfillment state machine, governance and role gates, the
readiness rules, and the agent tool handlers. Integrations are stubbed, so the tests never touch a
live store or spend anything.

A few are deliberately adversarial rather than confirmatory — a truncated HMAC that starts correctly
must still be rejected; `out for delivery` and `delivery attempted` must not read as delivered; a
redelivered webhook must not double the revenue; and the set of approval-gated tools is pinned, so
adding a money-moving tool without a gate fails CI.

## Legacy FastAPI backend

The original Python backend in `apps/api` remains for reference and local use
(`cd apps/api && pip install -e '.[dev]' && uvicorn app.main:app --reload`). The Vercel
deployment does not use it — all production logic is the Next.js app.
