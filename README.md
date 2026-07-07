# Claude Commerce OS

An autonomous AI dropshipping operator built as a multi-agent SaaS platform. A Claude-powered
CEO agent coordinates specialist agents (product hunting, suppliers, store building, marketing,
advertising, finance, customer support) that discover products, validate demand, create listings,
and optimize profit — with **human approval required for high-risk decisions** (budget changes,
refunds, store creation, killing products).

## Repository layout

```
apps/
  api/   FastAPI backend: auth, organizations, product intelligence, agent orchestrator,
         approval workflow, business memory. SQLAlchemy + Alembic migrations.
  web/   Next.js dashboard (App Router).
docker-compose.yml   Postgres + API + Web for local development.
.github/workflows/   CI: lint + tests for the API, build for the web app.
```

## Architecture

```
                    CLAUDE CEO AGENT
                          |
        ------------------------------------------------
        |         |          |         |        |      |
   Product    Marketing   Supplier   Store   Finance  Support
   Hunter     + Ads       Agent      Builder Agent    Agent
        |         |          |         |        |      |
        ------------------------------------------------
                          |
                 Agent Runner (Anthropic API, manual agentic
                 loop with approval gates on high-risk tools)
                          |
              FastAPI + SQLAlchemy (orgs, products,
              runs, approvals, memory)
```

Key design decisions:

- **Manual agentic loop** (`apps/api/app/agents/base.py`) instead of the SDK tool runner, so
  every tool call passes through a policy check. Tools flagged `requires_approval` are not
  executed — an `ApprovalRequest` is created and the agent is told the action is queued.
  A human approves or rejects via the API, and approval executes the stored action.
- **Deterministic product scoring** (`apps/api/app/services/scoring.py`): demand 30%,
  competition 20%, margin 25%, trend 15%, risk 10%. Only products scoring **85+** are
  marked ready to launch; agents call this as a tool rather than inventing scores.
- **Business memory** (`apps/api/app/services/memory.py`): agents persist learnings, reports,
  and quotes per organization and recall them in later runs.

## Quick start (API)

```bash
cd apps/api
python3 -m venv .venv && source .venv/bin/activate
pip install -e '.[dev]'
cp ../../.env.example .env        # set ANTHROPIC_API_KEY to enable live agent runs
uvicorn app.main:app --reload
```

- API docs: http://localhost:8000/docs
- Run tests: `pytest`
- Lint: `ruff check .`
- Migrations: `alembic upgrade head` (dev mode also auto-creates tables)

Agent runs require `ANTHROPIC_API_KEY`. Everything else (auth, orgs, products, scoring,
approvals) works without it, and the test suite mocks the Anthropic client.

## Quick start (full stack)

```bash
docker compose up --build
```

- Web dashboard: http://localhost:3000
- API: http://localhost:8000

## API tour

| Endpoint | Purpose |
|---|---|
| `POST /auth/register` / `POST /auth/login` | Create account + organization, get a JWT |
| `GET /agents` | List available agents and their tools |
| `POST /orgs/{org_id}/agents/{agent}/run` | Run an agent on a task |
| `GET /orgs/{org_id}/runs` | Agent run history (status, output, token usage) |
| `GET /orgs/{org_id}/approvals` | Pending high-risk actions awaiting a human |
| `POST /orgs/{org_id}/approvals/{id}/decide` | Approve (executes the action) or reject |
| `POST /orgs/{org_id}/products/score` | Deterministic product opportunity scoring |
| `GET /orgs/{org_id}/dashboard` | Revenue/product/run metrics summary |

## Status

MVP foundation: authentication, organizations, agent SDK + orchestrator, product
intelligence, approvals, memory, dashboard metrics, migrations, Docker, CI.
Next milestones: ecommerce connectors (Shopify), marketing engine integrations
(Meta/TikTok ads), billing, and notifications.
