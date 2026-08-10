"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "../../owner.module.css";

type Family = {
  id: string;
  category: string;
  name_es: string;
  name_en: string;
  tags: string[];
  commerce_mode: "PHYSICAL" | "BOOK" | "EDUCATIONAL" | "REFERENCE_ONLY";
  required_gates: string[];
  publish_policy: "GATED" | "REFERENCE_ONLY";
};

type MasterCatalog = {
  ok: boolean;
  brand: string;
  default_locale: "es";
  fallback_locale: "en";
  family_count: number;
  categories: string[];
  collections: string[];
  orisha_collections: string[];
  families: Family[];
  governance: {
    autonomous_purchase: boolean;
    auto_publish: boolean;
    sku_publish_requires_verification: boolean;
    required_evidence: string[];
  };
};

export default function MasterCatalogPage() {
  const [token, setToken] = useState("");
  const [orgId, setOrgId] = useState("");
  const [catalog, setCatalog] = useState<MasterCatalog | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
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
        const res = await fetch(`/api/orgs/${oid}/owner-catalog/master`, { headers, cache: "no-store" });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.detail ?? `Request failed (${res.status})`);
        setCatalog(body as MasterCatalog);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [token, orgId]);

  const families = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("es");
    return (catalog?.families ?? []).filter((family) => {
      if (category !== "ALL" && family.category !== category) return false;
      if (!needle) return true;
      return `${family.name_es} ${family.name_en} ${family.category} ${family.tags.join(" ")}`
        .toLocaleLowerCase("es")
        .includes(needle);
    });
  }, [catalog, category, query]);

  return <main className={styles.shell}>
    <nav className={styles.nav}>
      <a className={styles.brand} href="/store"><span className={styles.mark}>O</span><span className={styles.brandText}><strong>BOTANICA</strong><small>OCHOSI</small></span></a>
      <div className={styles.navLinks}><a className={styles.ghost} href="/owner/catalog">Catalog Control</a><a className={styles.primary} href="/owner">Owner OS</a></div>
    </nav>
    <div className={styles.content}>
      <section className={styles.hero}><div className={styles.kicker}>SPANISH-FIRST · MASTER CATALOG</div><h1>Catálogo <em>Maestro.</em></h1><p>Familias de producto, colecciones de Orisha, Dice Ifá, 256 Odù y categorías comerciales. Esta superficie es de gobierno: ninguna familia conceptual se convierte en SKU vendible sin proveedor, derechos, seguridad, evidencia, precio e inventario verificados.</p></section>
      {error && <div className={styles.error}>{error}</div>}
      {!token && !error && <div className={styles.error}>Owner authentication required. <a href="/owner/login">Sign in</a>.</div>}
      {catalog && <>
        <div className={styles.statusStrip}>
          <span className={styles.statusPill}>ES DEFAULT · EN FALLBACK</span>
          <span className={styles.statusPill}>{catalog.family_count} PRODUCT FAMILIES</span>
          <span className={styles.statusPill}>{catalog.collections.length} COLLECTIONS</span>
          <span className={styles.statusPill}>AUTO-PUBLISH LOCKED</span>
        </div>
        <section className={styles.metricGrid}>
          <div className={styles.card}><div className={styles.metricLabel}>Familias</div><div className={styles.metricValue}>{catalog.family_count}</div><div className={styles.metricNote}>master product families</div></div>
          <div className={styles.card}><div className={styles.metricLabel}>Categorías</div><div className={styles.metricValue}>{catalog.categories.length}</div><div className={styles.metricNote}>Spanish-first taxonomy</div></div>
          <div className={styles.card}><div className={styles.metricLabel}>Orishas</div><div className={styles.metricValue}>{catalog.orisha_collections.length}</div><div className={styles.metricNote}>collection relationships</div></div>
          <div className={styles.card}><div className={styles.metricLabel}>Gates</div><div className={styles.metricValue}>{catalog.governance.required_evidence.length}</div><div className={styles.metricNote}>required evidence checks</div></div>
        </section>
        <section className={styles.section}>
          <div className={styles.sectionHead}><div><span>COLECCIONES</span><h2>Spanish-first commerce architecture.</h2></div></div>
          <div className={styles.productMeta}>{catalog.collections.join(" · ")}</div>
        </section>
        <section className={styles.section}>
          <div className={styles.sectionHead}><div><span>FAMILIAS</span><h2>Productos de la botánica.</h2></div></div>
          <div className={`${styles.card} ${styles.form}`}>
            <input className={styles.input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar: Ifá, Ochosi, velas, hierbas…" />
            <select className={styles.input} value={category} onChange={(e) => setCategory(e.target.value)}><option value="ALL">Todas las categorías</option>{catalog.categories.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          </div>
          <div className={styles.productList}>{families.map((family) => <article key={family.id} className={`${styles.card} ${styles.productRow}`}><div><div className={styles.kicker}>{family.category} · {family.commerce_mode}</div><h2>{family.name_es}</h2><div className={styles.productMeta}>EN: {family.name_en}</div><div className={styles.productMeta}>Gates: {family.required_gates.join(" · ") || "REFERENCE ONLY"}</div><div className={styles.productMeta}>{family.tags.join(" · ")}</div></div><div className={styles.rowActions}><strong>{family.publish_policy === "GATED" ? "HOLD · VERIFY SKU" : "REFERENCE ONLY"}</strong></div></article>)}</div>
        </section>
        <section className={styles.section}><div className={styles.card}><div className={styles.kicker}>FAIL-CLOSED GOVERNANCE</div><h2>No family is a sellable SKU by itself.</h2><p>Required before Shopify draft: {catalog.governance.required_evidence.join(" · ")}. Autonomous purchasing: LOCKED. Automatic publishing: LOCKED.</p></div></section>
      </>}
      <footer className={styles.footer}><span>BOTANICA OCHOSI · Master Catalog</span><a href="/owner/catalog">← Catalog Control</a></footer>
    </div>
  </main>;
}
