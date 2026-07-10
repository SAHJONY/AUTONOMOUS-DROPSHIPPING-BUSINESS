"use client";

import { useState } from "react";

interface ForecastMonth {
  month: number;
  ad_spend: number;
  orders: number;
  revenue: number;
  net: number;
  cumulative: number;
}
interface Scenario {
  key: string;
  label: string;
  roas: number;
  cpa: number;
  net_per_order: number;
  months: ForecastMonth[];
  annual: { ad_spend: number; orders: number; revenue: number; net: number; net_margin: number };
  breakeven_month: number | null;
  exit_run_rate_revenue: number;
  exit_run_rate_net: number;
}
export interface ForecastData {
  assumptions: {
    aov: number;
    cogs: number;
    fee_rate: number;
    refund_rate: number;
    contribution_before_ad: number;
    derived_from_catalog: boolean;
  };
  catalog: { products_total: number; ready_to_launch: number; launched: number };
  scenarios: Scenario[];
}

const money = (n: number) => "$" + Math.round(n).toLocaleString();

export default function Forecast({ data, onBack }: { data: ForecastData; onBack: () => void }) {
  const [active, setActive] = useState("base");
  const s = data.scenarios.find((x) => x.key === active) ?? data.scenarios[0];
  const a = data.assumptions;

  return (
    <main className="doc">
      <div className="doc-hero">
        <div className="eyebrow">Financial Forecast</div>
        <h1>12-month projection.</h1>
        <p>
          A live model built from your actual catalog economics. Unit economics are{" "}
          {a.derived_from_catalog ? (
            <b>derived from your {data.catalog.products_total} product(s)</b>
          ) : (
            <b>using platform defaults</b>
          )}
          . Three scenarios bracket the range; growth comes from reinvesting profit into ad spend while ROAS holds.
        </p>
        <div className="doc-cta" style={{ marginTop: 24 }}>
          <button className="btn btn-accent" onClick={onBack}>Back to Command Deck</button>
        </div>
      </div>

      {/* Assumptions */}
      <section className="doc-section" style={{ paddingTop: 8 }}>
        <h2>Unit economics {a.derived_from_catalog ? "(from your catalog)" : "(defaults)"}</h2>
        <div className="metrics">
          <div className="metric"><div className="value">{money(a.aov)}</div><div className="label">Avg Order Value</div></div>
          <div className="metric"><div className="value">{money(a.cogs)}</div><div className="label">Landed COGS</div></div>
          <div className="metric"><div className="value">{(a.fee_rate * 100).toFixed(0)}%</div><div className="label">Payment Fees</div></div>
          <div className="metric"><div className="value">{(a.refund_rate * 100).toFixed(0)}%</div><div className="label">Refund Reserve</div></div>
          <div className="metric"><div className="value accent">{money(a.contribution_before_ad)}</div><div className="label">Contribution / order</div></div>
        </div>
      </section>

      {/* Scenario comparison */}
      <section className="doc-section">
        <h2>Scenario comparison — Year 1</h2>
        <div className="card">
          <table>
            <thead>
              <tr><th>Scenario</th><th>ROAS</th><th>CPA</th><th>Net / order</th><th>Revenue</th><th>Net profit</th><th>Margin</th><th>Breakeven</th></tr>
            </thead>
            <tbody>
              {data.scenarios.map((sc) => (
                <tr key={sc.key} style={sc.key === active ? { background: "rgba(91,140,255,0.08)" } : undefined}>
                  <td>{sc.label}</td>
                  <td>{sc.roas.toFixed(1)}×</td>
                  <td>{money(sc.cpa)}</td>
                  <td>{money(sc.net_per_order)}</td>
                  <td>{money(sc.annual.revenue)}</td>
                  <td>{money(sc.annual.net)}</td>
                  <td>{sc.annual.net_margin}%</td>
                  <td>{sc.breakeven_month ? `Mo ${sc.breakeven_month}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Selected scenario detail */}
      <section className="doc-section">
        <h2>Monthly projection</h2>
        <div className="quick-tasks" style={{ marginBottom: 18 }}>
          {data.scenarios.map((sc) => (
            <button
              key={sc.key}
              className="chip"
              onClick={() => setActive(sc.key)}
              style={sc.key === active ? { color: "#fff", borderColor: "var(--accent)", background: "rgba(91,140,255,0.12)" } : undefined}
            >
              {sc.label}
            </button>
          ))}
        </div>

        <div className="metrics" style={{ marginBottom: 18 }}>
          <div className="metric"><div className="value accent">{money(s.annual.revenue)}</div><div className="label">Yr 1 Revenue</div></div>
          <div className="metric"><div className="value">{money(s.annual.net)}</div><div className="label">Yr 1 Net Profit</div></div>
          <div className="metric"><div className="value">{s.annual.net_margin}%</div><div className="label">Net Margin</div></div>
          <div className="metric"><div className="value">{money(s.exit_run_rate_revenue)}</div><div className="label">Exit Rev Run-Rate</div></div>
          <div className="metric"><div className="value">{money(s.exit_run_rate_net)}</div><div className="label">Exit Net Run-Rate</div></div>
        </div>

        <div className="card">
          <table>
            <thead>
              <tr><th>Mo</th><th>Ad Spend</th><th>Orders</th><th>Revenue</th><th>Net Profit</th><th>Cumulative</th></tr>
            </thead>
            <tbody>
              {s.months.map((m) => (
                <tr key={m.month}>
                  <td>{m.month}</td>
                  <td>{money(m.ad_spend)}</td>
                  <td>{m.orders.toLocaleString()}</td>
                  <td>{money(m.revenue)}</td>
                  <td style={{ color: m.net >= 0 ? "var(--green)" : "var(--red)" }}>{money(m.net)}</td>
                  <td>{money(m.cumulative)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="doc-note">
          <b>Model, not a guarantee.</b> Results hinge on ad efficiency (CPA / ROAS) and AOV — exactly what the
          Marketing, Advertising, and Finance agents optimize. Ask the Finance agent to regenerate this from live data anytime.
        </div>
      </section>

      <div className="doc-cta">
        <button className="btn btn-accent" onClick={onBack}>Open the Command Deck</button>
      </div>
    </main>
  );
}
