"use client";

import { useEffect, useState } from "react";
import Pnl, { type PnlData } from "../components/Pnl";

/**
 * Profit intelligence.
 *
 * This page used to compute its own snapshot by querying Shopify on every
 * request. It now reads the accounting ledger — the same source the command
 * deck's Books section uses — so the business only ever reports one set of
 * numbers, and those numbers include the costs a Shopify-only view cannot see:
 * supplier shipping, payment processing, and advertising.
 */
export default function ProfitPage() {
  const [data, setData] = useState<PnlData | null>(null);
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
      const headers = { Authorization: `Bearer ${token}` };
      try {
        const orgResponse = await fetch("/api/orgs", { headers, cache: "no-store" });
        if (!orgResponse.ok) throw new Error("Your session expired. Sign in again.");
        const orgs = (await orgResponse.json()) as Array<{ id: string }>;
        const orgId = orgs[0]?.id;
        if (!orgId) throw new Error("No business workspace was found.");

        const response = await fetch(`/api/orgs/${orgId}/pnl`, { headers, cache: "no-store" });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.detail ?? `Request failed (${response.status})`);
        if (!cancelled) setData(body as PnlData);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main
      className="app"
      style={{ padding: "118px clamp(20px, 4vw, 40px) 100px", maxWidth: 1180, margin: "0 auto" }}
    >
      <div className="welcome">
        <div className="eyebrow">Profit Intelligence</div>
        <h1>The books.</h1>
        <p>
          Real settled money from real orders — revenue, refunds, cost of goods, supplier shipping,
          payment processing and advertising, straight from the ledger.
        </p>
      </div>

      {error && <div className="error">{error}</div>}
      {loading && !error && (
        <div className="card">
          <p className="empty">Loading the ledger…</p>
        </div>
      )}
      {data && <Pnl data={data} />}

      <p style={{ marginTop: 32 }}>
        <a className="btn btn-ghost btn-small" href="/">
          ← Back to Command Deck
        </a>
      </p>
    </main>
  );
}
