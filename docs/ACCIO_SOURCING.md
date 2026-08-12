# Accio Work — free-tier sourcing runbook

Accio Work is Alibaba International's desktop AI agent. It finds Alibaba.com suppliers, sends
inquiries, consolidates quotes, and follows up on negotiations around the clock. This runbook covers
using it on the **free tier** as an owner-operated research tool, and bringing the results back into
Owner OS.

## Why it is not an integration

Three facts decide the shape of this workflow:

1. **Accio Work is a desktop app.** Electron, Windows and Mac, local-first. It reads local files,
   runs terminal commands, and drives a browser over the Chrome DevTools Protocol. Production here
   is Vercel serverless — two crons plus the GitHub Actions heartbeat, running with nobody present.
   A desktop agent cannot run inside a Vercel function.
2. **There is no public Accio server API.** Nothing for a route handler to call.
3. **Accio is an MCP client, not an MCP server.** It consumes external tool servers; it does not
   expose itself as one. Any future integration would mean *this app* publishing an MCP server for
   Accio to connect to from the desktop — a separate project, and one that would have to respect the
   approval gates pinned by `tests/agent-tools.test.ts`.

So Accio is operated by you, by hand. Owner OS assesses what you bring back.

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
