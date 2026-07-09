# Claude Commerce OS

An autonomous AI dropshipping operator. A **Claude Fable 5** CEO agent coordinates seven
specialist agents (product hunting, suppliers, store building, marketing, advertising, finance,
customer support) that discover products, validate demand, create listings, and optimize profit —
with **human approval required for high-risk decisions** (budget changes, refunds, store creation,
killing products). Fable 5 is the brain and engine behind every autonomous decision.

The production app runs **entirely on Vercel** — Next.js route handlers are the backend, Upstash
Redis (with an in-memory fallback) is the datastore, and a Vercel Cron drives a 24/7 autonomous
cycle. Sign in and manage the whole operation from an ultra-premium cinematic command deck.

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
         approvals, business memory, dashboard, owner god-mode, and the 24/7 cron.
         Business logic lives in apps/web/lib/*.
  api/   Legacy FastAPI reference backend (SQLAlchemy + Alembic). Kept for local
         experimentation and its test suite; not used by the Vercel deployment.
vercel.json          Vercel build + cron configuration.
.github/workflows/   CI: builds the web app and lints/tests the legacy API.
```

## Architecture (Vercel-native)

```
                 CLAUDE FABLE 5  ── the brain & engine (lib/brain.ts)
                        │  manual agentic loop, approval-gated
        ┌───────────────┴───────────────────────────────────────┐
        │        │        │        │        │        │        │
     Product  Supplier  Store   Marketing Advert.  Finance  Support   (lib/agents.ts)
     Hunter            Builder
        └───────────────┬───────────────────────────────────────┘
                        │
     Next.js route handlers (apps/web/app/api/*)  ── auth, orgs, runs,
     approvals, products, dashboard, admin, cron
                        │
     KV store (lib/kv.ts) ── Upstash Redis  ▸  in-memory fallback
```

Key design decisions:

- **Manual agentic loop** (`lib/brain.ts`): every tool call passes a policy check. Tools flagged
  `requires_approval` are never executed by the model — an approval request is created and the
  owner decides. Approving executes the stored action.
- **Deterministic product scoring** (`lib/scoring.ts`): demand 30%, competition 20%, margin 25%,
  trend 15%, risk 10%. Only products scoring **85+** are launch-ready.
- **Business memory** (`lib/store.ts`): agents persist learnings and reports per organization and
  recall them in later runs — the operation compounds.
- **Graceful degradation**: with no `ANTHROPIC_API_KEY` the brain runs in deterministic
  **simulation mode**, so the platform is fully usable out of the box; set the key to go live.

## Deploy on Vercel

1. Import the repo (Vercel auto-detects the config in `vercel.json`).
2. Set environment variables (see `.env.example`):
   - `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL=claude-fable-5` — activate the live brain.
   - `JWT_SECRET` — a long random string.
   - `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` — durable 24/7 storage
     (Vercel's Upstash marketplace integration also provides `KV_REST_API_URL/TOKEN`).
   - `CRON_SECRET` — authorizes the autonomous cron.
3. Deploy. The daily autonomous cycle (`vercel.json` → `/api/cron/autonomous`) reviews every org
   and files a fresh report.

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
| `GET /api/orgs/{org}/dashboard` | Metrics summary |
| `GET /api/orgs/{org}/memory` | Business memory |
| `GET /api/admin/overview` | **Owner-only** platform god-mode |
| `GET/POST /api/cron/autonomous` | 24/7 autonomous cycle (cron-secured) |

## Legacy FastAPI backend

The original Python backend in `apps/api` remains for reference and local use
(`cd apps/api && pip install -e '.[dev]' && uvicorn app.main:app --reload`). The Vercel
deployment does not use it — all production logic is the Next.js app.
