"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./owner.module.css";

type Org = { id: string; name?: string; role?: string };
type Me = { id: string; email: string; is_owner: boolean };
type Dashboard = {
  products_total?: number; pending_approvals?: number; orders_total?: number; orders_on_hold?: number;
  revenue_30d?: number; net_profit_30d?: number; autonomy_enabled?: boolean; commerce_release_enabled?: boolean;
};
type ReadinessCheck = { id: string; label: string; level: "blocker" | "warning" | "ok"; detail: string; fix?: string };
type Readiness = { ready: boolean; blockers: number; warnings: number; checks: ReadinessCheck[] };
type ShopifyStatus = {
  connected: boolean;
  status?: "verified" | "credentials_stale" | "not_configured";
  shop: string | null;
  store_name?: string | null;
  mode?: "token" | "dev_dashboard" | null;
  verified_at?: string | null;
  detail?: string;
};
type CatalogProduct = { id: string; title: string; status: string; price: number; cost: number; shopify_id?: number };
type Approval = { id: string; action: string; risk_level: string; status: string; agent_name?: string };

export default function BotanicaOwnerOS() {
  const [token, setToken] = useState("");
  const [orgId, setOrgId] = useState("");
  const [me, setMe] = useState<Me | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [shopify, setShopify] = useState<ShopifyStatus>({ connected: false, status: "not_configured", shop: null });
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setToken(localStorage.getItem("commerce_os_token") ?? "");
    setOrgId(localStorage.getItem("commerce_os_org") ?? "");
  }, []);

  const headers = useMemo(() => ({ "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }), [token]);
  const getJson = useCallback(async (path: string) => {
    const res = await fetch(path, { headers });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.detail ?? `Request failed (${res.status})`);
    return body;
  }, [headers]);

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const [meResp, orgs] = await Promise.all([getJson("/api/auth/me") as Promise<Me>, getJson("/api/orgs") as Promise<Org[]>]);
      if (!meResp.is_owner) throw new Error("Owner access is required for BOTANICA Owner OS.");
      const selected = orgs.find((o) => o.id === orgId) ?? orgs[0];
      if (!selected?.id) throw new Error("No organization is available for this owner account.");
      const oid = selected.id;
      setMe(meResp); setOrgId(oid); localStorage.setItem("commerce_os_org", oid);
      const [dash, ready, shop, catalog, pending] = await Promise.all([
        getJson(`/api/orgs/${oid}/dashboard`) as Promise<Dashboard>,
        getJson(`/api/orgs/${oid}/readiness`) as Promise<Readiness>,
        getJson(`/api/orgs/${oid}/integrations/shopify`) as Promise<ShopifyStatus>,
        getJson(`/api/orgs/${oid}/owner-catalog`) as Promise<CatalogProduct[]>,
        getJson(`/api/orgs/${oid}/approvals`) as Promise<Approval[]>,
      ]);
      setDashboard(dash); setReadiness(ready); setShopify(shop); setProducts(catalog); setApprovals(pending);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, [getJson, orgId, token]);

  useEffect(() => { void load(); }, [load]);

  const pendingApprovals = approvals.filter((a) => a.status === "pending").length;
  const managedProducts = products.filter((p) => p.status !== "killed").length;
  const shopifyLabel = shopify.connected
    ? `Shopify verified · ${shopify.shop}`
    : shopify.status === "credentials_stale"
      ? `Shopify credentials need attention · ${shopify.shop ?? "store unresolved"}`
      : "Shopify not configured";
  const shopifyMetric = shopify.connected ? "VERIFIED" : shopify.status === "credentials_stale" ? "STALE" : "OFF";
  const shopifyNote = shopify.connected
    ? `${shopify.store_name ?? shopify.shop ?? "Shopify"}${shopify.verified_at ? ` · checked ${new Date(shopify.verified_at).toLocaleTimeString()}` : ""}`
    : shopify.detail ?? shopify.shop ?? "No Shopify credentials configured";

  return <main className={styles.shell}>
    <nav className={styles.nav}>
      <a className={styles.brand} href="/store"><span className={styles.mark}>O</span><span className={styles.brandText}><strong>BOTANICA</strong><small>OCHOSI</small></span></a>
      <div className={styles.navLinks}><a className={`${styles.ghost} ${styles.hideMobile}`} href="/store">Storefront</a><a className={styles.primary} href="/owner/catalog">Catalog Control</a></div>
    </nav>

    <div className={styles.content}>
      <section className={styles.hero}>
        <div className={styles.kicker}>OWNER COMMAND · BOTANICA-FIRST OPERATIONS</div>
        <h1>Owner <em>OS.</em></h1>
        <p>One operating surface for Shopify, catalog governance, Supplier Intelligence, Council decisions, approvals, orders and production readiness. The customer experience and the owner experience now share the same BOTANICA OCHOSI visual system.</p>
        <div className={styles.heroActions}><a className={styles.primary} href="/owner/catalog">Manage catalog</a><button className={styles.ghost} onClick={() => void load()} disabled={loading}>{loading ? "Refreshing…" : "Refresh intelligence"}</button></div>
      </section>

      {!token && !loading ? <div className={styles.error}><strong>Owner authentication required.</strong><div>Sign in through the operating console, then return to this Owner OS.</div><a className={styles.primary} href="/?command=1" style={{marginTop:12}}>Owner sign in</a></div> : null}
      {error && <div className={styles.error}><strong>Owner OS requires attention</strong><div>{error}</div></div>}

      <div className={styles.statusStrip}>
        <span className={styles.statusPill}><i className={readiness?.ready ? styles.dotLive : styles.dotWarn}/>{readiness?.ready ? "Operationally ready" : `${readiness?.blockers ?? 0} readiness blocker(s)`}</span>
        <span className={styles.statusPill}><i className={shopify.connected ? styles.dotLive : styles.dotWarn}/>{shopifyLabel}</span>
        <span className={styles.statusPill}><i className={styles.dotLocked}/>Autonomous purchasing locked</span>
        <span className={styles.statusPill}><i className={styles.dotLocked}/>Pipeline auto-publish locked</span>
      </div>

      <section className={styles.metricGrid}>
        <Metric label="Readiness" value={readiness ? (readiness.ready ? "READY" : `${readiness.blockers} BLOCKER${readiness.blockers === 1 ? "" : "S"}`) : "—"} note={`${readiness?.warnings ?? 0} warning(s)`}/>
        <Metric label="Shopify" value={shopifyMetric} note={shopifyNote}/>
        <Metric label="Catalog" value={String(products.length)} note={`${managedProducts} managed records`}/>
        <Metric label="Approvals" value={String(pendingApprovals)} note="pending owner decisions"/>
        <Metric label="Orders" value={String(dashboard?.orders_total ?? 0)} note={`${dashboard?.orders_on_hold ?? 0} on hold`}/>
        <Metric label="30d Net" value={`$${Number(dashboard?.net_profit_30d ?? 0).toFixed(2)}`} note={`Revenue $${Number(dashboard?.revenue_30d ?? 0).toFixed(2)}`}/>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}><div><span>Operate</span><h2>Run the botanica from one control plane.</h2></div></div>
        <div className={styles.actionGrid}>
          <ActionCard title="Catalog + Shopify" body="Create Shopify drafts, archive legacy inventory, retire products safely, and execute the curated BOTANICA migration." href="/owner/catalog" cta="Open Catalog Control"/>
          <ActionCard title="Supplier Intelligence" body="Verified quote evidence, landed cost, provenance, cultural/export checks, margin and Council remain hard gates before a draft reaches Shopify." href="/owner/catalog" cta="Review gated products"/>
          <ActionCard title="Customer Experience" body="Inspect exactly what customers see in the live catalog. Draft and HOLD inventory stays invisible until explicitly activated." href="/store" cta="Open Storefront"/>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.split}>
          <div className={styles.card}><div className={styles.kicker}>READINESS</div><h2>Operational gates</h2>
            {!readiness?.checks?.length && <div className={styles.empty}>No readiness evidence loaded.</div>}
            {readiness?.checks?.map((check) => <div key={check.id} className={styles.check}><div className={styles.checkTop}><strong>{check.label}</strong><strong className={styles[check.level]}>{check.level.toUpperCase()}</strong></div><small>{check.detail}</small>{check.fix && <small className={styles.warning}>{check.fix}</small>}</div>)}
          </div>
          <div className={styles.card}><div className={styles.kicker}>GOVERNANCE</div><h2>Owner authority</h2>
            <Gate label="Autonomous purchasing" on={false}/><Gate label="Pipeline auto-publish" on={false}/><Gate label="Commerce release" on={dashboard?.commerce_release_enabled === true}/><Gate label="Autonomy master gate" on={dashboard?.autonomy_enabled === true}/>
            <p>Supplier scoring and Council recommendations remain advisory until deterministic hard gates pass. Catalog approval can create a Shopify draft; it never authorizes supplier spending.</p>
          </div>
        </div>
      </section>

      <footer className={styles.footer}><span>Owner: {me?.email ?? "authentication pending"}</span><span className={styles.legacy}>Legacy console: <a href="/?command=1">open only for inherited operations</a></span></footer>
    </div>
  </main>;
}

function Metric({label,value,note}:{label:string;value:string;note:string}) { return <div className={styles.card}><div className={styles.metricLabel}>{label}</div><div className={styles.metricValue}>{value}</div><div className={styles.metricNote}>{note}</div></div>; }
function ActionCard({title,body,href,cta}:{title:string;body:string;href:string;cta:string}) { return <div className={styles.card}><h2>{title}</h2><p>{body}</p><a className={styles.primary} href={href}>{cta}</a></div>; }
function Gate({label,on}:{label:string;on:boolean}) { return <div className={styles.gate}><span>{label}</span><strong className={on ? styles.ok : undefined}>{on ? "ON" : "LOCKED"}</strong></div>; }
