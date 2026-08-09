"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Org = { id: string; name?: string; role?: string };
type Me = { id: string; email: string; is_owner: boolean };
type Dashboard = {
  products_total?: number;
  pending_approvals?: number;
  orders_total?: number;
  orders_on_hold?: number;
  revenue_30d?: number;
  net_profit_30d?: number;
  autonomy_enabled?: boolean;
  commerce_release_enabled?: boolean;
};
type ReadinessCheck = { id: string; label: string; level: "blocker" | "warning" | "ok"; detail: string; fix?: string };
type Readiness = { ready: boolean; blockers: number; warnings: number; checks: ReadinessCheck[] };
type ShopifyStatus = { connected: boolean; shop: string | null };
type CatalogProduct = { id: string; title: string; status: string; price: number; cost: number; shopify_id?: number };
type Approval = { id: string; action: string; risk_level: string; status: string; agent_name?: string };

const shell: React.CSSProperties = {
  minHeight: "100vh",
  color: "#f3f2e9",
  background: "radial-gradient(circle at 10% 0%, #173c28 0, #08140e 38%, #050b08 100%)",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
};
const card: React.CSSProperties = { background: "rgba(12,31,21,.88)", border: "1px solid #294b37", borderRadius: 18, padding: 18 };
const linkButton: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 42, padding: "0 15px", borderRadius: 10, textDecoration: "none", fontWeight: 800, background: "#d7b45a", color: "#07110b" };
const quietButton: React.CSSProperties = { ...linkButton, background: "transparent", color: "#e8e5d6", border: "1px solid #53735e" };

export default function BotanicaOwnerOS() {
  const [token, setToken] = useState("");
  const [orgId, setOrgId] = useState("");
  const [me, setMe] = useState<Me | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [shopify, setShopify] = useState<ShopifyStatus>({ connected: false, shop: null });
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setToken(localStorage.getItem("commerce_os_token") ?? "");
    setOrgId(localStorage.getItem("commerce_os_org") ?? "");
  }, []);

  const headers = useMemo(() => ({
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token]);

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
      const [meResp, orgs] = await Promise.all([
        getJson("/api/auth/me") as Promise<Me>,
        getJson("/api/orgs") as Promise<Org[]>,
      ]);
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
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [getJson, orgId, token]);

  useEffect(() => { void load(); }, [load]);

  if (!token && !loading) return <main style={shell}><div style={{maxWidth:900,margin:"0 auto",padding:"72px 22px"}}>
    <div style={card}><h1 style={{fontSize:42,marginTop:0}}>BOTANICA OCHOSI — Owner OS</h1>
      <p style={{opacity:.78}}>Owner authentication is required. Sign in through the operating console, then return here.</p>
      <a href="/?command=1" style={linkButton}>Owner sign in</a>
    </div></div></main>;

  const pendingApprovals = approvals.filter((a) => a.status === "pending").length;
  const botanicaManaged = products.filter((p) => p.shopify_id || p.status !== "killed").length;

  return <main style={shell}>
    <div style={{maxWidth:1240,margin:"0 auto",padding:"28px 20px 60px"}}>
      <header style={{display:"flex",justifyContent:"space-between",gap:20,alignItems:"flex-start",flexWrap:"wrap",marginBottom:24}}>
        <div><div style={{color:"#d7b45a",fontWeight:900,letterSpacing:1.4}}>BOTANICA OCHOSI</div>
          <h1 style={{fontSize:"clamp(34px,5vw,58px)",lineHeight:1,margin:"8px 0 10px"}}>Owner OS</h1>
          <p style={{maxWidth:780,opacity:.75,margin:0}}>Botanica-first command center for catalog, Shopify, Supplier Intelligence, Council gates, approvals and operational readiness. Generic dropshipping sourcing is not part of this workspace.</p>
        </div>
        <div style={{display:"flex",gap:9,flexWrap:"wrap"}}><a href="/" style={quietButton}>Storefront</a><button onClick={()=>void load()} style={{...quietButton,cursor:"pointer"}} disabled={loading}>{loading?"Refreshing…":"Refresh"}</button></div>
      </header>

      {error && <div style={{...card,borderColor:"#7e3535",background:"#321616",marginBottom:18}}><strong>Owner OS requires attention</strong><div style={{marginTop:6}}>{error}</div></div>}

      <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginBottom:18}}>
        <Metric label="Readiness" value={readiness ? (readiness.ready ? "READY" : `${readiness.blockers} BLOCKER${readiness.blockers===1?"":"S"}`) : "—"} note={readiness ? `${readiness.warnings} warning(s)` : "loading"}/>
        <Metric label="Shopify" value={shopify.connected ? "CONNECTED" : "NOT CONNECTED"} note={shopify.shop ?? "No shop resolved"}/>
        <Metric label="Catalog" value={String(products.length)} note={`${botanicaManaged} managed records`}/>
        <Metric label="Approvals" value={String(pendingApprovals)} note="pending owner decisions"/>
        <Metric label="Orders" value={String(dashboard?.orders_total ?? 0)} note={`${dashboard?.orders_on_hold ?? 0} on hold`}/>
        <Metric label="30d Net" value={`$${Number(dashboard?.net_profit_30d ?? 0).toFixed(2)}`} note={`Revenue $${Number(dashboard?.revenue_30d ?? 0).toFixed(2)}`}/>
      </section>

      <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(290px,1fr))",gap:14,marginBottom:18}}>
        <ActionCard title="Catalog + Shopify" body="Create drafts, archive legacy inventory, delete owner-managed products, and run the safe BOTANICA catalog migration." href="/owner/catalog" cta="Open Catalog Control"/>
        <ActionCard title="Supplier Intelligence" body="Commercial products remain gated by verified quote evidence, landed cost, provenance, export/cultural checks, ≥35% margin, Council, then owner approval." href="/owner/catalog" cta="Review product pipeline"/>
        <ActionCard title="Public Storefront" body="Inspect what customers can actually see. Draft and HOLD products remain outside the live catalog until explicitly activated." href="/" cta="Open storefront"/>
      </section>

      <section style={{display:"grid",gridTemplateColumns:"1.2fr .8fr",gap:14,alignItems:"start"}}>
        <div style={card}><h2 style={{marginTop:0}}>Operational gates</h2>
          {!readiness?.checks?.length && <div style={{opacity:.65}}>No readiness evidence loaded.</div>}
          <div style={{display:"grid",gap:9}}>{readiness?.checks?.map((check)=><div key={check.id} style={{padding:12,borderRadius:12,background:check.level==="blocker"?"#351818":check.level==="warning"?"#302713":"#0a2619",border:"1px solid #2e4b39"}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:12}}><strong>{check.label}</strong><span style={{textTransform:"uppercase",fontSize:12,opacity:.8}}>{check.level}</span></div>
            <div style={{opacity:.75,marginTop:4}}>{check.detail}</div>{check.fix && <div style={{color:"#d7b45a",marginTop:5,fontSize:13}}>{check.fix}</div>}
          </div>)}</div>
        </div>
        <div style={card}><h2 style={{marginTop:0}}>Governance posture</h2>
          <Gate label="Autonomous purchasing" on={false}/><Gate label="Pipeline auto-publish" on={false}/><Gate label="Commerce release" on={dashboard?.commerce_release_enabled === true}/><Gate label="Autonomy master gate" on={dashboard?.autonomy_enabled === true}/>
          <p style={{opacity:.67,fontSize:13,lineHeight:1.5}}>Supplier quote scoring and Council recommendations are advisory until deterministic hard gates pass. Owner catalog approval may create a Shopify draft; it does not authorize supplier spending.</p>
        </div>
      </section>

      <footer style={{marginTop:20,display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",opacity:.65,fontSize:13}}>
        <span>Owner: {me?.email ?? "authenticated"}</span><a href="/?command=1" style={{color:"#b9c9be"}}>Legacy operations console ↗</a>
      </footer>
    </div>
  </main>;
}

function Metric({label,value,note}:{label:string;value:string;note:string}) { return <div style={card}><div style={{fontSize:12,textTransform:"uppercase",letterSpacing:1.1,opacity:.62}}>{label}</div><div style={{fontSize:24,fontWeight:900,margin:"6px 0 3px"}}>{value}</div><div style={{fontSize:13,opacity:.62}}>{note}</div></div>; }
function ActionCard({title,body,href,cta}:{title:string;body:string;href:string;cta:string}) { return <div style={card}><h2 style={{marginTop:0}}>{title}</h2><p style={{opacity:.72,lineHeight:1.55,minHeight:72}}>{body}</p><a href={href} style={linkButton}>{cta}</a></div>; }
function Gate({label,on}:{label:string;on:boolean}) { return <div style={{display:"flex",justifyContent:"space-between",gap:12,padding:"10px 0",borderBottom:"1px solid #243a2c"}}><span>{label}</span><strong style={{color:on?"#8fd7a5":"#d7b45a"}}>{on?"ON":"LOCKED"}</strong></div>; }
