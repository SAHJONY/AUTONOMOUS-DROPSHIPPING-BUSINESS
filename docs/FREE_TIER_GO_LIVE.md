# Free-tier go-live

How to get this deployment from "builds fine" to "fit to hold a business" without paying for
infrastructure. `GET /api/orgs/{org}/readiness` (and the go-live checklist on the deck) is the
authority on whether you are there — this document is how to make it green.

## What is genuinely free, and what is not

| Piece | Free tier | Good enough? |
|---|---|---|
| Vercel Hobby | Free | Yes, with one caveat: **daily crons only** — see the heartbeat below |
| Upstash Redis | Free tier | Yes. This clears the single most dangerous blocker |
| GitHub Actions | Free (public repos; 2,000 min/mo private) | Yes — a 30-min heartbeat is well inside the limit |
| Resend | Free tier, ~100 emails/day | Yes for supplier mail at this volume; needs a verified domain |
| CJ Dropshipping | Free account | Yes |
| Telegram bot | Free | Yes |
| Accio Work | Free tier | Yes for research — see [ACCIO_SOURCING.md](./ACCIO_SOURCING.md) |
| **Shopify** | **Trial only, then paid** | **No.** This is the one unavoidable cost |
| **Web search** (supplier discovery) | **Effectively gone** | **No.** Brave's free tier ended Feb 2026; Google CSE is closed to new signups |
| **OpenAI API** | **Paid per token** | **Optional.** Without it the app runs in deterministic simulation mode |

Three honest notes:

- **Shopify is not free after the trial.** Without a connected store nothing can be sold or
  fulfilled. Everything else here can run free indefinitely; the storefront cannot.
- **Autonomous supplier discovery can no longer be free.** Brave ended its free search tier in
  February 2026 and now bills past a $5 monthly credit with no spending cap; Google's Custom Search
  JSON API is still free to 100 queries/day but closed to new customers and retires in January 2027.
  Discovery ships **off**, and when you enable it the app enforces its own daily ceiling
  (`SUPPLIER_DISCOVERY_DAILY_BUDGET`, default 50 — worst case about $0.25/day on Brave). Leave it off
  and everything else in the sweep still runs for nothing.
- **No engine key is a warning, not a blocker.** With `OPENAI_API_KEY` unset the agents run in
  deterministic standby. The order and fulfillment loops do not use the model, so orders still get
  taken, bought and shipped. You can go live without paying for tokens.

## 1. Clear the two blockers

Nothing else matters until these are done. Both are free.

> **The loop enforces this itself.** While either blocker stands, the autonomous tick and both crons
> hold back fulfillment, autopilot approvals and publishing, and report `held_for_readiness` instead
> (the crons answer `423`). Read-only intelligence still runs. You cannot accidentally trade on a
> deployment that would lose the books — but you also will not sell anything until this step is done.

**Durable storage.** Without Upstash the app uses an in-memory fallback, and on serverless that is
not a degraded mode — it is data loss on a loop. Orders, ledger entries, products and accounts reset
on the next cold start while the books appear to keep working.

Create a free Upstash Redis database and set on the Vercel project:

```
UPSTASH_REDIS_REST_URL=…
UPSTASH_REDIS_REST_TOKEN=…
```

Vercel's Upstash marketplace integration provisions these as `KV_REST_API_URL` / `KV_REST_API_TOKEN`,
which `lib/kv.ts` also accepts — either pair works.

**Session signing key.** `JWT_SECRET` ships with a default that is public in the source, so anyone
could mint a valid token for any account, including the owner. Generate real values:

```bash
./ops/generate-secrets.sh
```

Set `JWT_SECRET` in Vercel. Keep `CRON_SECRET` from the same run for the next step.

## 2. Turn on the schedule

Set `CRON_SECRET` on the Vercel project. Both cron endpoints fail closed with `503` until it is set,
so until you do, nothing runs on a schedule and orders only move when you press **✦ Fulfill now**.

Then close the Hobby-plan gap. `vercel.json` can only fire the two passes once a day each, so an
order placed just after a run could wait twelve hours before the supplier is paid. Add two
repository secrets under **Settings → Secrets and variables → Actions**:

| Secret | Value |
|---|---|
| `APP_URL` | your deployment origin, e.g. `https://autonomous-dropshipping-business.vercel.app` |
| `CRON_SECRET` | the same value you set in Vercel |

`.github/workflows/heartbeat.yml` then calls the same endpoints every 30 minutes on any plan. Ticks
are idempotent, so overlapping with Vercel Cron is harmless. The workflow no-ops when `APP_URL` is
unset, so forks stay quiet.

## 3. Connect the storefront

Shopify → **Settings → Apps and sales channels → Develop apps**. Grant `write_products`,
`read_orders`, and `write_fulfillments`, then paste the Client ID and Secret into the dashboard.

Scopes matter: without `read_orders` the business can publish products but will never learn any of
them sold; without `write_fulfillments` it can buy the goods but never tell the customer their
package is moving.

For real-time orders also set `SHOPIFY_WEBHOOK_SECRET` and `PUBLIC_BASE_URL` — webhooks are then
registered automatically on connect. Without them orders are still collected, but only by the
polling sync on each cron pass.

## 4. Connect a supplier

Connect CJ Dropshipping from the dashboard (free account). Without a supplier, orders can be taken
but not filled, and every paid order lands on hold with a customer waiting.

## 5. Verify, then unlock

Check `GET /api/orgs/{org}/readiness`. Aim for **zero blockers**; warnings are survivable and each
carries its own fix.

Only then consider the master gates, which ship **off** deliberately:

| Gate | While off |
|---|---|
| `ENABLE_AUTONOMY` | Nothing is auto-approved, and not a cent is spent at the supplier |
| `COMMERCE_RELEASE_ENABLED` | Publishing is locked; the publish route returns `423` |
| `AUTO_FULFILL` | Supplier orders are placed only when you press the button |

Turn them on one at a time, and only after readiness is clean. Six agent actions stay
approval-gated whatever the gates say — placing a supplier order, publishing a product, creating a
store, setting an ad budget, issuing a refund, and killing a product. That set is pinned by
`tests/agent-tools.test.ts`, so adding a money-moving tool without a gate fails CI rather than
production.

`AUTOPILOT_MAX_ORDER_COST` is the ceiling on what a single order may spend without asking you.
It defaults to **100** and `lib/config.ts` hard-caps it at 100 during the lean launch, so a larger
value in the environment is clamped rather than honoured. Lower it if you want a tighter leash.

## Minimum free configuration

Everything below is free, and takes the deployment to zero blockers:

```
UPSTASH_REDIS_REST_URL=…
UPSTASH_REDIS_REST_TOKEN=…
JWT_SECRET=…                    # ./ops/generate-secrets.sh
CRON_SECRET=…                   # same value in GitHub Actions secrets
PUBLIC_BASE_URL=https://…
ENABLE_AUTONOMY=false           # leave off until readiness is clean
COMMERCE_RELEASE_ENABLED=false
AUTO_FULFILL=false
```

Add `SHOPIFY_WEBHOOK_SECRET` when the store is connected, and `OPENAI_API_KEY` only when you decide
to pay for live agent reasoning.
