# Profit intelligence

Profit reporting is derived from the **accounting ledger** (`apps/web/lib/ledger.ts`)
and nothing else. There is one set of numbers in this business, and this is it.

## Where to read it

| Surface | What it shows |
|---|---|
| **The Books** on the command deck | Full P&L across five windows, plus every ledger entry |
| `/profit` | The same statement on its own page |
| `GET /api/orgs/{org}/pnl` | `periods`, `entries`, and `top_products` as JSON |
| Finance agent → `get_profit_and_loss` | The same statement, for the agents to reason over |

## What the statement contains

```
  product revenue + shipping charged − discounts − refunds   = net revenue
  net revenue − cost of goods − supplier shipping − fees     = gross profit
  gross profit − advertising − operating costs               = net profit
```

Sales tax collected is tracked separately and deliberately excluded: it is money
held on behalf of the tax authority, not income.

## Why it replaced the Shopify snapshot

An earlier implementation (`lib/profit.ts`, removed) computed its own snapshot by
querying the Shopify Admin API on every request. It was replaced because:

- **It could not see the real costs.** Shopify knows what the customer paid. It
  does not know what the supplier charged for goods or shipping, what the payment
  processor took, or what was spent on ads — so its "profit" was always gross and
  always flattering.
- **It recomputed totals independently**, so it could disagree with the ledger.
  Two different answers to "did we make money" is how books drift apart.
- **It could not report on history it never stored.** The ledger is append-only
  and idempotent, so a redelivered webhook or a retried fulfillment can never
  double-count, and past periods stay fixed once settled.

The per-product breakdown it offered is preserved: `productPerformance()` in
`lib/orders.ts` derives units, revenue, cost, gross profit and margin per product
from the stored order lines — the same frozen costs the ledger was built from,
so the two agree by construction.
