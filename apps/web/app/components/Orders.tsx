"use client";

import { useState } from "react";

export type OrderLine = {
  sku: string;
  title: string;
  quantity: number;
  unit_price: number;
  product_id: string | null;
  unit_cost: number;
};

export type OrderEvent = { at: string; kind: string; detail: string };

export type OrderRow = {
  id: string;
  order_number: string;
  email: string;
  customer_name: string;
  currency: string;
  total: number;
  refunded: number;
  stage: string;
  financial_status: string;
  lines: OrderLine[];
  shipping_address: { city: string; country: string };
  supplier_order_id?: string;
  tracking_number?: string;
  tracking_url?: string;
  carrier?: string;
  hold_reason?: string;
  events: OrderEvent[];
  placed_at: string;
};

/** Human labels for the pipeline. The stage names are internal; these are not. */
const STAGE_LABEL: Record<string, string> = {
  received: "Paid — to order",
  awaiting_stock: "Ordered — in transit",
  shipped: "Shipped",
  delivered: "Delivered",
  on_hold: "Needs attention",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

const STAGE_ORDER = ["on_hold", "received", "awaiting_stock", "shipped", "delivered", "refunded", "cancelled"];

const money = (n: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);

export default function Orders({
  orders,
  onAction,
  busyId,
}: {
  orders: OrderRow[];
  onAction: (orderId: string, action: "place" | "track" | "ship" | "release") => void;
  busyId: string | null;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("");

  const counts = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.stage] = (acc[o.stage] ?? 0) + 1;
    return acc;
  }, {});

  const visible = filter ? orders.filter((o) => o.stage === filter) : orders;

  if (orders.length === 0) {
    return (
      <div className="card">
        <p className="empty">
          No orders yet. Once a customer buys, the order lands here automatically — the engine buys
          the goods from the supplier, pushes the tracking number back to your store, and books
          every dollar to the ledger.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="stage-filters">
        <button className={`chip ${filter === "" ? "chip-on" : ""}`} onClick={() => setFilter("")}>
          All {orders.length}
        </button>
        {STAGE_ORDER.filter((s) => counts[s]).map((stage) => (
          <button
            key={stage}
            className={`chip ${filter === stage ? "chip-on" : ""} ${stage === "on_hold" ? "chip-alert" : ""}`}
            onClick={() => setFilter(filter === stage ? "" : stage)}
          >
            {STAGE_LABEL[stage] ?? stage} {counts[stage]}
          </button>
        ))}
      </div>

      <div className="orders">
        {visible.map((o) => {
          const open = expanded === o.id;
          const busy = busyId === o.id;
          return (
            <div className={`order ${o.stage === "on_hold" ? "order-alert" : ""}`} key={o.id}>
              <button
                className="order-head"
                onClick={() => setExpanded(open ? null : o.id)}
                aria-expanded={open}
              >
                <div className="oh-main">
                  <span className="oh-num">{o.order_number}</span>
                  <span className={`status ${o.stage}`}>{STAGE_LABEL[o.stage] ?? o.stage}</span>
                </div>
                <div className="oh-meta">
                  <span>{o.customer_name || o.email || "Guest"}</span>
                  <span className="oh-sep">·</span>
                  <span>
                    {o.lines.reduce((n, l) => n + l.quantity, 0)} item
                    {o.lines.reduce((n, l) => n + l.quantity, 0) === 1 ? "" : "s"}
                  </span>
                  <span className="oh-sep">·</span>
                  <span>{new Date(o.placed_at).toLocaleDateString()}</span>
                </div>
                <div className="oh-total">
                  {money(o.total, o.currency)}
                  {o.refunded > 0 && <span className="oh-refund">−{money(o.refunded, o.currency)}</span>}
                </div>
              </button>

              {o.hold_reason && <div className="order-hold">⚠ {o.hold_reason}</div>}

              {open && (
                <div className="order-body">
                  <div className="order-lines">
                    {o.lines.map((l, i) => (
                      <div className="order-line" key={`${o.id}-${i}`}>
                        <span className="ol-qty">{l.quantity}×</span>
                        <span className="ol-title">{l.title}</span>
                        <span className="ol-cost">
                          {money(l.unit_price, o.currency)}
                          {l.unit_cost > 0 && (
                            <span className="ol-margin">
                              {" "}
                              cost {money(l.unit_cost, o.currency)}
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="order-facts">
                    <div>
                      <span className="of-k">Ship to</span>
                      <span className="of-v">
                        {o.shipping_address.city
                          ? `${o.shipping_address.city}, ${o.shipping_address.country}`
                          : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="of-k">Supplier order</span>
                      <span className="of-v">{o.supplier_order_id ?? "not placed"}</span>
                    </div>
                    <div>
                      <span className="of-k">Tracking</span>
                      <span className="of-v">
                        {o.tracking_number ? (
                          <a href={o.tracking_url} target="_blank" rel="noreferrer">
                            {o.tracking_number}
                          </a>
                        ) : (
                          "—"
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="of-k">Payment</span>
                      <span className="of-v">{o.financial_status || "—"}</span>
                    </div>
                  </div>

                  {o.events.length > 0 && (
                    <div className="order-timeline">
                      {o.events
                        .slice()
                        .reverse()
                        .map((e, i) => (
                          <div className="ot-row" key={i}>
                            <span className="ot-when">{new Date(e.at).toLocaleString()}</span>
                            <span className="ot-kind">{e.kind.replace(/_/g, " ")}</span>
                            <span className="ot-detail">{e.detail}</span>
                          </div>
                        ))}
                    </div>
                  )}

                  <div className="order-actions">
                    {!o.supplier_order_id && !["cancelled", "refunded"].includes(o.stage) && (
                      <button
                        className="btn btn-accent btn-small"
                        onClick={() => onAction(o.id, "place")}
                        disabled={busy}
                        title="Buy the goods from the supplier now — this spends real money"
                      >
                        {busy ? <span className="spinner" /> : "Order from supplier"}
                      </button>
                    )}
                    {o.supplier_order_id && !o.tracking_number && (
                      <button
                        className="btn btn-ghost btn-small"
                        onClick={() => onAction(o.id, "track")}
                        disabled={busy}
                      >
                        {busy ? <span className="spinner" /> : "Check tracking"}
                      </button>
                    )}
                    {o.tracking_number && o.stage !== "shipped" && (
                      <button
                        className="btn btn-ghost btn-small"
                        onClick={() => onAction(o.id, "ship")}
                        disabled={busy}
                      >
                        {busy ? <span className="spinner" /> : "Mark shipped"}
                      </button>
                    )}
                    {o.stage === "on_hold" && (
                      <button
                        className="btn btn-ghost btn-small"
                        onClick={() => onAction(o.id, "release")}
                        disabled={busy}
                        title="Clear the hold and put this order back in the queue"
                      >
                        Clear hold
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
