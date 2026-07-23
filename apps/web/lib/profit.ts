import type { Product } from "./types";

const API_VERSION = "2026-07";

export type ProfitProduct = {
  product_id: number | null;
  title: string;
  units: number;
  revenue: number;
  refunds: number;
  cogs: number;
  gross_profit: number;
};

export type ProfitSnapshot = {
  period_days: number;
  currency: string;
  orders: number;
  units_sold: number;
  gross_revenue: number;
  refunds: number;
  net_revenue: number;
  cogs: number;
  gross_profit: number;
  gross_margin_pct: number;
  average_order_value: number;
  estimated_cogs_orders: number;
  top_products: ProfitProduct[];
  generated_at: string;
  scope_note: string;
};

type ShopifyLineItem = {
  product_id?: number | null;
  title?: string;
  quantity?: number;
  price?: string;
};

type ShopifyRefund = {
  refund_line_items?: Array<{
    quantity?: number;
    line_item?: ShopifyLineItem;
    subtotal?: number;
  }>;
  transactions?: Array<{ amount?: string; status?: string }>;
};

type ShopifyOrder = {
  id: number;
  total_price?: string;
  currency?: string;
  financial_status?: string;
  cancelled_at?: string | null;
  line_items?: ShopifyLineItem[];
  refunds?: ShopifyRefund[];
};

function money(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function nextLink(header: string | null): string | null {
  if (!header) return null;
  for (const segment of header.split(",")) {
    const match = segment.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (match?.[2] === "next") return match[1];
  }
  return null;
}

async function fetchOrders(shop: string, token: string, days: number): Promise<ShopifyOrder[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  let url =
    `https://${shop}/admin/api/${API_VERSION}/orders.json?status=any&limit=250` +
    `&created_at_min=${encodeURIComponent(since)}` +
    "&fields=id,total_price,currency,financial_status,cancelled_at,line_items,refunds";
  const orders: ShopifyOrder[] = [];

  // Safety cap: at most 1,000 orders per on-demand dashboard request.
  for (let page = 0; page < 4 && url; page++) {
    const res = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Shopify orders ${res.status}: ${text.slice(0, 180)}`);
    }
    const data = (await res.json()) as { orders?: ShopifyOrder[] };
    orders.push(...(data.orders ?? []));
    url = nextLink(res.headers.get("link")) ?? "";
  }
  return orders;
}

export async function buildProfitSnapshot(args: {
  shop: string;
  token: string;
  products: Product[];
  days?: number;
}): Promise<ProfitSnapshot> {
  const days = Math.min(365, Math.max(1, Math.round(args.days ?? 30)));
  const orders = (await fetchOrders(args.shop, args.token, days)).filter((o) => !o.cancelled_at);
  const productCosts = new Map<number, number>();
  for (const product of args.products) {
    if (product.shopify_id) productCosts.set(product.shopify_id, Math.max(0, product.cost || 0));
  }

  let grossRevenue = 0;
  let refunds = 0;
  let cogs = 0;
  let units = 0;
  let estimatedCogsOrders = 0;
  let currency = "USD";
  const byProduct = new Map<number | string, ProfitProduct>();

  for (const order of orders) {
    currency = order.currency || currency;
    grossRevenue += money(order.total_price);
    const orderRefunds = (order.refunds ?? []).reduce((sum, refund) => {
      const successfulTransactions = (refund.transactions ?? []).filter(
        (transaction) => !transaction.status || transaction.status === "success",
      );
      if (successfulTransactions.length) {
        return sum + successfulTransactions.reduce((value, transaction) => value + money(transaction.amount), 0);
      }
      return (
        sum +
        (refund.refund_line_items ?? []).reduce(
          (value, item) => value + money(item.subtotal),
          0,
        )
      );
    }, 0);
    refunds += orderRefunds;

    let usedEstimate = false;
    for (const item of order.line_items ?? []) {
      const quantity = Math.max(0, Number(item.quantity ?? 0));
      const lineRevenue = money(item.price) * quantity;
      const productId = item.product_id ?? null;
      const knownUnitCost = productId ? productCosts.get(productId) : undefined;
      const lineCogs =
        knownUnitCost !== undefined ? knownUnitCost * quantity : lineRevenue * 0.35;
      if (knownUnitCost === undefined) usedEstimate = true;
      units += quantity;
      cogs += lineCogs;

      const key = productId ?? item.title ?? "Unknown product";
      const current = byProduct.get(key) ?? {
        product_id: productId,
        title: item.title || "Unknown product",
        units: 0,
        revenue: 0,
        refunds: 0,
        cogs: 0,
        gross_profit: 0,
      };
      current.units += quantity;
      current.revenue += lineRevenue;
      current.cogs += lineCogs;
      byProduct.set(key, current);
    }
    if (usedEstimate) estimatedCogsOrders++;
  }

  const netRevenue = Math.max(0, grossRevenue - refunds);
  const grossProfit = netRevenue - cogs;
  const topProducts = [...byProduct.values()]
    .map((product) => ({
      ...product,
      revenue: round(product.revenue),
      refunds: round(product.refunds),
      cogs: round(product.cogs),
      gross_profit: round(product.revenue - product.cogs),
    }))
    .sort((a, b) => b.gross_profit - a.gross_profit)
    .slice(0, 10);

  return {
    period_days: days,
    currency,
    orders: orders.length,
    units_sold: units,
    gross_revenue: round(grossRevenue),
    refunds: round(refunds),
    net_revenue: round(netRevenue),
    cogs: round(cogs),
    gross_profit: round(grossProfit),
    gross_margin_pct: netRevenue > 0 ? round((grossProfit / netRevenue) * 100) : 0,
    average_order_value: orders.length ? round(netRevenue / orders.length) : 0,
    estimated_cogs_orders: estimatedCogsOrders,
    top_products: topProducts,
    generated_at: new Date().toISOString(),
    scope_note:
      "Gross profit equals Shopify net revenue minus catalog COGS. Advertising, payment-processing, taxes, duties and operating expenses are not deducted yet.",
  };
}
