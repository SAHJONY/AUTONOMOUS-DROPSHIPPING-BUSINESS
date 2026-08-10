"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "../../owner.module.css";

type WholesaleProduct = {
  id: string;
  supplier_id: string;
  supplier_name: string;
  title_es: string;
  title_en: string;
  category: string;
  source_url: string;
  wholesale_only: boolean;
  wholesale_price_usd?: number;
  pack_qty?: number;
  public_price_note?: string;
  inventory_evidence: string;
  evidence_status: string;
  verified_at: string;
  shopify_draft_ready: false;
  required_next_checks: string[];
};

type WholesaleResponse = {
  ok: boolean;
  mode: "WHOLESALE_EVIDENCE_ONLY";
  supplier_count: number;
  product_count: number;
  publicly_priced_count: number;
  autonomous_purchase: false;
  auto_publish: false;
  products: WholesaleProduct[];
};

export default function WholesaleProductsPage() {
  const [token, setToken] = useState("");
  const [orgId, setOrgId] = useState("");
  const [data, setData] = useState<WholesaleResponse | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setToken(localStorage.getItem("commerce_os_token") ?? "");
    setOrgId(localStorage.getItem("commerce_os_org") ?? "");
  }, []);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        let oid = orgId;
        const headers = { Authorization: `Bearer ${token}` };
        if (!oid) {
          const orgRes = await fetch("/api/orgs", { headers });
          if (!orgRes.ok) throw new Error("Owner organization could not be resolved.");
          const orgs = await orgRes.json();
          oid = orgs?.[0]?.id ?? "";
          if (oid) {
            setOrgId(oid);
            localStorage.setItem("commerce_os_org", oid);
          }
        }
        if (!oid) throw new Error("No owner organization is available.");
        const res = await fetch(`/api/orgs/${oid}/owner-catalog/wholesale`, { headers, cache: "no-store" });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.detail ?? `Request failed (${res.status})`);
        setData(body as WholesaleResponse);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [token, orgId]);

  const products = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("es");
    if (!needle) return data?.products ?? [];
    return (data?.products ?? []).filter((item) =>
      `${item.title_es} ${item.title_en} ${item.category} ${item.supplier_name}`.toLocaleLowerCase("es").includes(needle),
    );
  }, [data, query]);

  return <main className={styles.shell}>
    <nav className={styles.nav}>
      <a className={styles.brand} href="/store"><span className={styles.mark}>O</span><span className={styles.brandText}><strong>BOTANICA</strong><small>OCHOSI</small></span></a>
      <div className={styles.navLinks}><a className={styles.ghost} href="/owner/catalog/candidates">Supplier Candidates</a><a className={styles.primary} href="/owner/catalog">Catalog Control</a></div>
    </nav>
    <div className={styles.content}>
      <section className={styles.hero}><div className={styles.kicker}>WHOLESALE SOURCING · VERIFIED PUBLIC EVIDENCE</div><h1>Wholesale <em>Products.</em></h1><p>Productos encontrados directamente en mayoristas de botánica. Los precios mostrados son evidencia pública cuando existe; ningún artículo está autorizado para compra o Shopify hasta completar stock, landed cost, derechos de imagen, compliance y revisión del dueño.</p></section>
      {error && <div className={styles.error}>{error}</div>}
      {!token && !error && <div className={styles.error}>Owner authentication required. <a href="/owner/login">Sign in</a>.</div>}
      {data && <>
        <div className={styles.statusStrip}>
          <span className={styles.statusPill}>{data.supplier_count} WHOLESALERS</span>
          <span className={styles.statusPill}>{data.product_count} PRODUCTS</span>
          <span className={styles.statusPill}>{data.publicly_priced_count} PUBLIC PRICES</span>
          <span className={styles.statusPill}>PURCHASE + AUTO-PUBLISH LOCKED</span>
        </div>
        <section className={styles.section}>
          <div className={`${styles.card} ${styles.form}`}><input className={styles.input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar producto, categoría o mayorista…" /></div>
          <div className={styles.productList}>{products.map((item) => <article key={item.id} className={`${styles.card} ${styles.productRow}`}><div><div className={styles.kicker}>{item.category} · {item.evidence_status}</div><h2>{item.title_es}</h2><div className={styles.productMeta}>EN: {item.title_en}</div><div className={styles.productMeta}>Mayorista: {item.supplier_name} · {item.wholesale_only ? "WHOLESALE" : "WHOLESALE PORTAL"}</div><div className={styles.productMeta}>Precio: {typeof item.wholesale_price_usd === "number" ? `$${item.wholesale_price_usd.toFixed(2)}${item.pack_qty ? ` / pack ${item.pack_qty}` : ""}` : "QUOTE / LOGIN REQUIRED"}</div><div className={styles.productMeta}>{item.public_price_note ?? "Current commercial terms require verification."}</div><div className={styles.productMeta}>Next gates: {item.required_next_checks.join(" · ")}</div><a className={styles.ghost} href={item.source_url} target="_blank" rel="noreferrer">Open supplier evidence</a></div><div className={styles.rowActions}><strong>HOLD · VERIFY</strong></div></article>)}</div>
        </section>
        <section className={styles.section}><div className={styles.card}><div className={styles.kicker}>FAIL-CLOSED</div><h2>Wholesale evidence is not purchase authority.</h2><p>All products remain blocked from Shopify drafts until stock, reseller eligibility, landed cost, image rights, cultural/compliance requirements and owner review are complete.</p></div></section>
      </>}
      <footer className={styles.footer}><span>BOTANICA OCHOSI · Wholesale Products</span><a href="/owner/catalog">← Catalog Control</a></footer>
    </div>
  </main>;
}
