# Profit Intelligence

The `/profit` workspace turns Shopify order data into an operational gross-profit view.

## Requirements

The connected Shopify app must be allowed to read orders. The token used by the current Shopify integration needs the `read_orders` scope (or the equivalent Orders permission in the Shopify Dev Dashboard). Older orders may also require Shopify's protected customer data / all-orders approval depending on the app type and store configuration.

## Metrics

- Gross revenue from non-cancelled Shopify orders
- Refunds
- Net revenue
- Catalog cost of goods sold (COGS)
- Gross profit and gross margin
- Average order value
- Units sold
- Top products by gross profit

The workspace supports 7, 30 and 90 day windows. The API accepts 1–365 days:

```text
GET /api/orgs/{orgId}/profit?days=30
```

## Cost matching

COGS is matched using the Shopify product ID stored when the platform publishes a product. When an order cannot be matched to a catalog product, the engine uses a conservative 35% revenue estimate and clearly reports how many orders were estimated.

## Accounting boundary

This is a gross-profit operating view, not a final accounting statement. Advertising spend, payment-processing fees, taxes, duties, chargebacks, apps, payroll and other operating expenses are not deducted yet.

## Recommended next integrations

1. Meta, TikTok and Google Ads spend ingestion.
2. Shopify Payments transaction fees and chargebacks.
3. Supplier invoice / fulfillment cost reconciliation.
4. Profit-based product kill and scale recommendations behind approval gates.
