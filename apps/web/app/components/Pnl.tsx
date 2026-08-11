"use client";

import { useState } from "react";

export type PnlPeriod = {
  period: { key: string; label: string };
  orders: number;
  units: number;
  gross_revenue: number;
  shipping_income: number;
  discounts: number;
  refunds: number;
  net_revenue: number;
  cogs: number;
  supplier_shipping: number;
  payment_fees: number;
  gross_profit: number;
  ad_spend: number;
  opex: number;
  net_profit: number;
  gross_margin_pct: number;
  net_margin_pct: number;
  aov: number;
  profit_per_order: number;
  tax_collected: number;
};

export type LedgerRow = {
  id: string;
  account: string;
  amount: number;
  memo: string;
  occurred_at: string;
};

export type ProductRow = {
  product_id: string | null;
  title: string;
  units: number;
  revenue: number;
  cogs: number;
  gross_profit: number;
  margin_pct: number;
};

export type PnlData = {
  periods: Record<string, PnlPeriod>;
  entries: LedgerRow[];
  top_products?: ProductRow[];
};

const PERIODS = ["today", "7d", "30d", "90d", "all"] as const;

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

/** One line of the statement. Costs render as the negatives they are. */
function Line({
  label,
  value,
  cost,
  strong,
  note,
}: {
  label: string;
  value: number;
  cost?: boolean;
  strong?: boolean;
  note?: string;
}) {
  return (
    <div className={`pnl-line ${strong ? "pnl-strong" : ""}`}>
      <span className="pl-label">
        {label}
        {note && <span className="pl-note">{note}</span>}
      </span>
      <span className={`pl-value ${cost ? "pl-cost" : ""} ${strong && value < 0 ? "pl-loss" : ""}`}>
        {cost && value > 0 ? `−${money(value)}` : money(value)}
      </span>
    </div>
  );
}

export default function Pnl({ data }: { data: PnlData }) {
  const [period, setPeriod] = useState<string>("30d");
  const p = data.periods[period];

  if (!p) return null;

  const noTrading = p.orders === 0 && p.ad_spend === 0;

  return (
    <div className="pnl">
      <div className="pnl-periods">
        {PERIODS.map((key) => (
          <button
            key={key}
            className={`chip ${period === key ? "chip-on" : ""}`}
            onClick={() => setPeriod(key)}
          >
            {data.periods[key]?.period.label ?? key}
          </button>
        ))}
      </div>

      {noTrading ? (
        <div className="card">
          <p className="empty">
            Nothing has sold in this window, so there is nothing to report. These are real settled
            numbers from the ledger — they stay at zero until a customer actually buys.
          </p>
        </div>
      ) : (
        <>
          <div className="pnl-headline">
            <div className="pnl-hero">
              <div className={`ph-value ${p.net_profit < 0 ? "ph-loss" : ""}`}>
                {money(p.net_profit)}
              </div>
              <div className="ph-label">Net profit · {p.period.label}</div>
            </div>
            <div className="pnl-hero-side">
              <div>
                <div className="phs-v">{money(p.net_revenue)}</div>
                <div className="phs-l">Net revenue</div>
              </div>
              <div>
                <div className="phs-v">{p.orders}</div>
                <div className="phs-l">Orders</div>
              </div>
              <div>
                <div className="phs-v">{money(p.aov)}</div>
                <div className="phs-l">AOV</div>
              </div>
              <div>
                <div className={`phs-v ${p.net_margin_pct < 0 ? "ph-loss" : ""}`}>
                  {p.net_margin_pct.toFixed(1)}%
                </div>
                <div className="phs-l">Net margin</div>
              </div>
            </div>
          </div>

          <div className="pnl-statement">
            <Line label="Product revenue" value={p.gross_revenue} />
            <Line label="Shipping charged" value={p.shipping_income} />
            <Line label="Discounts" value={p.discounts} cost />
            <Line label="Refunds" value={p.refunds} cost />
            <Line label="Net revenue" value={p.net_revenue} strong />

            <Line label="Cost of goods" value={p.cogs} cost />
            <Line label="Supplier shipping" value={p.supplier_shipping} cost />
            <Line label="Payment processing" value={p.payment_fees} cost />
            <Line
              label="Gross profit"
              value={p.gross_profit}
              strong
              note={`${p.gross_margin_pct.toFixed(1)}% margin`}
            />

            <Line label="Advertising" value={p.ad_spend} cost />
            <Line label="Operating costs" value={p.opex} cost />
            <Line
              label="Net profit"
              value={p.net_profit}
              strong
              note={`${money(p.profit_per_order)} per order`}
            />
          </div>

          {p.tax_collected > 0 && (
            <p className="pnl-footnote">
              {money(p.tax_collected)} of sales tax was collected in this period. It is held on
              behalf of the tax authority and is deliberately excluded from revenue and profit.
            </p>
          )}
        </>
      )}

      {!!data.top_products?.length && (
        <div className="pnl-products">
          <div className="pp-head">Per product · last 30 days</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Units</th>
                  <th>Revenue</th>
                  <th>Cost</th>
                  <th>Gross profit</th>
                  <th>Margin</th>
                </tr>
              </thead>
              <tbody>
                {data.top_products.map((p) => (
                  <tr key={p.product_id ?? p.title}>
                    <td>{p.title}</td>
                    <td>{p.units}</td>
                    <td>{money(p.revenue)}</td>
                    <td className="pl-cost">{money(p.cogs)}</td>
                    <td className={p.gross_profit < 0 ? "pl-loss" : ""}>{money(p.gross_profit)}</td>
                    <td>{p.margin_pct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data.entries.length > 0 && (
        <details className="pnl-ledger">
          <summary>Ledger — every entry behind these numbers</summary>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Account</th>
                  <th>Amount</th>
                  <th>Memo</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((e) => (
                  <tr key={e.id}>
                    <td>{e.occurred_at.slice(0, 10)}</td>
                    <td>{e.account.replace(/_/g, " ")}</td>
                    <td className={e.amount < 0 ? "pl-cost" : ""}>{money(e.amount)}</td>
                    <td>{e.memo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
