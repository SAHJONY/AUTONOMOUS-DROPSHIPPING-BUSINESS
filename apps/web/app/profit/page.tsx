"use client";

import { useEffect, useState } from "react";

type ProfitProduct = {
  product_id: number | null;
  title: string;
  units: number;
  revenue: number;
  cogs: number;
  gross_profit: number;
};

type ProfitSnapshot = {
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

const money = (value: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);

export default function ProfitPage() {
  const [days, setDays] = useState(30);
  const [snapshot, setSnapshot] = useState<ProfitSnapshot | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("commerce_os_token");
    if (!token) {
      setError("Sign in from the main command deck before opening Profit Intelligence.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const orgResponse = await fetch("/api/orgs", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!orgResponse.ok) throw new Error("Your session expired. Sign in again.");
        const orgs = (await orgResponse.json()) as Array<{ id: string }>;
        const orgId = orgs[0]?.id;
        if (!orgId) throw new Error("No business workspace was found.");

        const response = await fetch(`/api/orgs/${orgId}/profit?days=${days}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.detail ?? `Request failed (${response.status})`);
        if (!cancelled) setSnapshot(body);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [days]);

  const currency = snapshot?.currency || "USD";

  return (
    <main style={{ minHeight: "100vh", background: "#070708", color: "#f7f5ef", padding: "32px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "center", marginBottom: 30 }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: ".18em", textTransform: "uppercase", color: "#b2ff59" }}>
              SAHJONY Commerce
            </div>
            <h1 style={{ fontSize: "clamp(32px, 5vw, 58px)", margin: "8px 0" }}>Profit Intelligence</h1>
            <p style={{ color: "#aaa", maxWidth: 720, margin: 0 }}>
              Real Shopify sales, refunds, catalog cost of goods and gross-profit performance.
            </p>
          </div>
          <a href="/" style={{ color: "#fff", textDecoration: "none", border: "1px solid #333", padding: "11px 16px", borderRadius: 999 }}>
            Command Deck
          </a>
        </header>

        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {[7, 30, 90].map((value) => (
            <button
              key={value}
              onClick={() => setDays(value)}
              style={{
                border: value === days ? "1px solid #b2ff59" : "1px solid #333",
                background: value === days ? "#18210e" : "#111",
                color: "#fff",
                padding: "9px 14px",
                borderRadius: 999,
                cursor: "pointer",
              }}
            >
              {value} days
            </button>
          ))}
        </div>

        {loading && <p style={{ color: "#aaa" }}>Loading Shopify performance…</p>}
        {error && (
          <div style={{ border: "1px solid #642d2d", background: "#211010", padding: 18, borderRadius: 16, marginBottom: 24 }}>
            <b>Profit data unavailable</b>
            <p style={{ marginBottom: 0, color: "#e7b8b8" }}>{error}</p>
          </div>
        )}

        {snapshot && !loading && (
          <>
            <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 26 }}>
              {[
                ["Gross profit", money(snapshot.gross_profit, currency)],
                ["Net revenue", money(snapshot.net_revenue, currency)],
                ["Gross margin", `${snapshot.gross_margin_pct.toFixed(1)}%`],
                ["Orders", snapshot.orders.toLocaleString()],
                ["Average order", money(snapshot.average_order_value, currency)],
                ["Refunds", money(snapshot.refunds, currency)],
              ].map(([label, value]) => (
                <div key={label} style={{ background: "#111", border: "1px solid #242424", padding: 20, borderRadius: 18 }}>
                  <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
                  <div style={{ color: "#929292", marginTop: 6 }}>{label}</div>
                </div>
              ))}
            </section>

            <section style={{ background: "#111", border: "1px solid #242424", borderRadius: 20, overflow: "hidden", marginBottom: 22 }}>
              <div style={{ padding: "20px 22px", borderBottom: "1px solid #242424" }}>
                <h2 style={{ margin: 0 }}>Top products by gross profit</h2>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                  <thead>
                    <tr style={{ color: "#929292", textAlign: "left" }}>
                      {['Product', 'Units', 'Revenue', 'COGS', 'Gross profit'].map((heading) => (
                        <th key={heading} style={{ padding: "14px 18px", borderBottom: "1px solid #242424", fontWeight: 500 }}>{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.top_products.length ? snapshot.top_products.map((product) => (
                      <tr key={`${product.product_id ?? product.title}`}>
                        <td style={{ padding: "15px 18px", borderBottom: "1px solid #1d1d1d" }}>{product.title}</td>
                        <td style={{ padding: "15px 18px", borderBottom: "1px solid #1d1d1d" }}>{product.units}</td>
                        <td style={{ padding: "15px 18px", borderBottom: "1px solid #1d1d1d" }}>{money(product.revenue, currency)}</td>
                        <td style={{ padding: "15px 18px", borderBottom: "1px solid #1d1d1d" }}>{money(product.cogs, currency)}</td>
                        <td style={{ padding: "15px 18px", borderBottom: "1px solid #1d1d1d", color: product.gross_profit >= 0 ? "#b2ff59" : "#ff8080" }}>
                          {money(product.gross_profit, currency)}
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={5} style={{ padding: 24, color: "#929292" }}>No paid Shopify orders in this period.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <aside style={{ background: "#111", border: "1px solid #242424", borderRadius: 18, padding: 20, color: "#aaa" }}>
              <b style={{ color: "#fff" }}>Accounting scope</b>
              <p style={{ marginBottom: 6 }}>{snapshot.scope_note}</p>
              {snapshot.estimated_cogs_orders > 0 && (
                <p style={{ marginBottom: 6, color: "#f2c879" }}>
                  {snapshot.estimated_cogs_orders} order(s) used a conservative 35% COGS estimate because the Shopify product was not matched to the catalog.
                </p>
              )}
              <small>Generated {new Date(snapshot.generated_at).toLocaleString()} · {snapshot.units_sold} units sold</small>
            </aside>
          </>
        )}
      </div>
    </main>
  );
}
