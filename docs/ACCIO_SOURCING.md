# Accio Work — free-tier sourcing runbook

Accio Work is Alibaba International's desktop AI agent. It finds Alibaba.com suppliers, sends
inquiries, consolidates quotes, and follows up on negotiations around the clock. This runbook covers
using it on the **free tier** as an owner-operated research tool, and bringing the results back into
Owner OS.

> **There is now a real integration** — see [Connecting Accio Work to Owner OS](#connecting-accio-work-to-owner-os)
> below. The manual workflow in this document still works and is still the fastest way to start.

## Why it runs backwards

Three facts decide the shape of this workflow:

1. **Accio Work is a desktop app.** Electron, Windows and Mac, local-first. It reads local files,
   runs terminal commands, and drives a browser over the Chrome DevTools Protocol. Production here
   is Vercel serverless — two crons plus the GitHub Actions heartbeat, running with nobody present.
   A desktop agent cannot run inside a Vercel function.
2. **There is no public Accio server API.** Nothing for a route handler to call.
3. **Accio is an MCP client, not an MCP server.** It consumes external tool servers; it does not
   expose itself as one.

The third point is the opening. This app now publishes an MCP server at `/api/mcp` that Accio Work
connects to from your desktop — so Accio's own sourcing engine does the searching on its free tier,
and hands the results back through this codebase's existing rules. That also means you do not need a
paid web-search provider for `supplier-discovery.ts` unless you want discovery running unattended.

## Connecting Accio Work to Owner OS

Set two variables on the Vercel project:

| Variable | Value |
|---|---|
| `MCP_ACCESS_TOKEN` | A long random string — generate one with `./ops/generate-secrets.sh` |
| `MCP_ORG_ID` | The Owner OS organization ID the tools should read and write |

The endpoint is **fail-closed**: without both set it returns `503` rather than serving anonymously.
The token is checked in constant time and sent as `Authorization: Bearer <token>`.

Then add the server in Accio Work's MCP settings, pointing at
`https://<your-deployment>/api/mcp` with that bearer token.

### What Accio can and cannot do through it

| Tool | What it does |
|---|---|
| `get_sourcing_gap` | The SKUs still needing a supplier, P1 first, with next actions and missing evidence |
| `list_supplier_candidates` | Suppliers already on file, filterable by tier, so nothing is researched twice |
| `submit_supplier_candidate` | Files a supplier Accio found — classified by tier and scored |
| `classify_supplier_tier` | Manufacturer / distributor / wholesaler / reseller, from the company's own wording |
| `assess_supplier_quote` | ORDER_FUNDED, INVENTORY_REQUIRED (capital named) or REJECTED |

**Nothing on that surface moves money or reaches a customer.** No supplier orders, no publishing, no
refunds, no ad budgets, no store creation. Those six actions stay approval-gated inside the agent
brain, and an outside client never gets to touch them — `tests/mcp.test.ts` pins the exposed tool
list so adding a money-moving tool here fails CI.

Two rules survive the integration intact. `submit_supplier_candidate` runs the same fail-closed niche
filter as autonomous discovery, so a consumer marketplace or an off-niche site is rejected no matter
how Accio describes it. And `assess_supplier_quote` **always** reports owner verification as
outstanding — an external client cannot attest on your behalf, even if it claims to.

## The manual workflow

Everything below still applies, and is the fastest way to start before wiring up MCP: you drive
Accio by hand, and Owner OS assesses what you bring back.

## The MOQ problem, stated plainly

Alibaba.com is **MOQ wholesale**. CJ Dropshipping — the connected supplier — is **per-order
dropshipping**, quantity 1, no inventory. The order-funded gate in `lib/zero-capital-launch.ts`
rejects any candidate with `moq !== 1` and caps a single supplier commitment at **$100**.

That is not a bug to work around. It is the business model: cash from the customer arrives before
any money goes out. Most Alibaba quotes require capital *before* the first sale and therefore sit
outside that model. `/owner/accio-sourcing` tells you which side of that line each quote falls on,
and what the capital would be, instead of silently failing the quote.

## Free-tier setup

1. Download Accio Work from Alibaba's official site (`accio.com`) for macOS or Windows. Install
   Chrome 144+ — browser control is unreliable on older versions.
2. Sign in with an Alibaba.com account. The free tier allows a limited number of agent actions per
   day; that is enough for the workflow below.
3. **Do not grant terminal access, and do not point Accio at this repository.** It only needs the
   browser to search Alibaba and read supplier profiles. Browser control is a permission you grant
   explicitly — grant that one and nothing else.
4. **Never let the agent complete a payment.** Supplier orders are approved manually in Owner OS,
   through `place_supplier_order`, which is approval-gated by design.

> Pricing on third-party review sites is inconsistent and unreliable. Check plan limits on
> `accio.com` directly before paying for anything — the workflow below does not need a paid plan.

## What to ask the sourcing agent

Give Accio the product and the constraints that matter here, not just the product:

```
Find Alibaba suppliers for [product — e.g. 7-day glass prayer candles, unscented, white].
Requirements:
  - Ships to the United States, DDP if available
  - MOQ of 1 to 20 units — I cannot commit to a large batch
  - Sample available before any bulk order
  - Verified/Gold supplier with trade assurance
  - Total lead time under 30 days, door to door
For each supplier give me: unit price at the lowest MOQ, exact MOQ, per-unit shipping to the US,
production days, transit days, sample price, and the supplier profile URL.
```

The MOQ constraint is the important one. Ask for it up front or you will spend the session
collecting quotes that Owner OS will route to `INVENTORY_REQUIRED`.

## Verify before you enter anything

Accio's output is a **supplier claim produced by an AI agent**, not a verified fact. The intake form
will not mark a quote eligible until you confirm you checked it yourself. Before entering a quote:

- Open the supplier profile URL and confirm the company name matches the quote.
- Confirm the MOQ and unit price on the listing, not just in the agent's summary.
- Confirm stock is real and note the date you checked it.
- For religious goods, confirm resale authorization and keep the evidence reference — this is a
  hard requirement in `lib/botanica-policy.ts` and in the intake gate.

## Entering results

Open **Owner OS → Cotizaciones de Accio Work** (`/owner/accio-sourcing`), or POST to
`/api/orgs/{orgId}/accio-sourcing` with `{ "candidates": [...] }` to assess a batch. Owner-only,
advisory only — it never publishes, never spends, and never contacts a supplier.

Each quote is routed:

| Route | Meaning | What to do |
|---|---|---|
| `ORDER_FUNDED` | MOQ 1, under the $100 cap, fully verified | Can run on the order-funded model — charge first, buy after |
| `INVENTORY_REQUIRED` | Needs capital before the first sale | Weigh the named capital and break-even sell-through; sample first |
| `REJECTED` | Unverified, undocumented, or retail below landed cost | Resolve the listed points before committing money |

For `INVENTORY_REQUIRED` the assessment names the capital required, how many units of the batch must
sell just to return it, and that figure as a percentage of the batch. Above 70% you are betting
almost the whole batch on getting your money back — renegotiate the price or the MOQ.

Quotes that survive belong in the existing supplier paths: `lib/botanica-supplier-registry.ts`,
`lib/preaccount-supplier-catalogs.ts`, and the quote workflow in `lib/botanica-supplier-quotes.ts`.

## Operating rules

These are enforced in code where they can be, and are your responsibility where they cannot be:

1. Accio proposes and negotiates; it does not verify. Confirm every figure yourself.
2. Nothing enters the catalog without verified inventory and documented resale authorization.
3. MOQ above 1 means capital, and capital means the deal leaves the order-funded model.
4. Sample and check quality before committing a full batch.
5. The agent never closes a payment. Supplier orders are approved manually in Owner OS.
6. Keep the quote reference and supplier profile URL with every decision so it can be audited later.
