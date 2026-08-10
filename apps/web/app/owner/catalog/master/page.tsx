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

type Candidate = {
  slug: string;
  titleEs: string;
  titleEn: string;
  category: string;
  subcategory: string;
  language: string;
  gates: string[];
  status: "CANDIDATE" | "REFERENCE_ONLY";
  publish_policy: "HOLD" | "REFERENCE_ONLY";
  shopify_draft_ready: false;
  notes?: string;
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
  candidate_registry_count: number;
  candidate_category_counts: Record<string, number>;
  candidate_gate_counts: Record<string, number>;
  candidate_registry: Candidate[];
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
  const [candidateQuery, setCandidateQuery] = useState("");
  const [candidateCategory, setCandidateCategory] = useState("ALL");
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

  const candidateCategories = useMemo(() => Object.keys(catalog?.candidate_category_counts ?? {}).sort((a, b) => a.localeCompare(b, "es")), [catalog]);
  const candidates = useMemo(() => {
    const needle = candidateQuery.trim().toLocaleLowerCase("es");
    return (catalog?.candidate_registry ?? []).filter((candidate) => {
      if (candidateCategory !== "ALL" && candidate.category !== candidateCategory) return false;
      if (!needle) return true;
      return `${candidate.titleEs} ${candidate.titleEn} ${candidate.category} ${candidate.subcategory} ${candidate.gates.join(" ")}`
        .toLocaleLowerCase("es")
        .includes(needle);
    });
  }, [catalog, candidateCategory, candidateQuery]);

  return <main className={styles.shell}>
    <nav className={styles.nav}>
      <a className={styles.brand} href="/store"><span className={styles.mark}>O</span><span className={styles.brandText}><strong>BOTANICA</strong><small>OCHOSI</small></span></a>
      <div className={styles.navLinks}><a className={styles.ghost} href="/owner/catalog">Catalog Control</a><a className={styles.primary} href="/owner">Owner OS</a></div>
    </nav>
    <div className={styles.content}>
      <section className={styles.hero}><div className={styles.kicker}>SPANISH-FIRST · MASTER CATALOG</div><h1>Catálogo <em>Maestro.</em></h1><p>Familias comerciales más el registro ampliado de productos de botánica, Ifá, Dice Ifá, Diloggún, Orishas, hierbas, velas, aceites, libros y accesorios. El registro de candidatos nunca equivale a inventario ni autorización de venta.</p></section>
      {error && <div className={styles.error}>{error}</div>}
      {!token && !error && <div className={styles.error}>Owner authentication required. <a href="/owner/login">Sign in</a>.</div>}
      {catalog && <>
        <div className={styles.statusStrip}>
          <span className={styles.statusPill}>ES DEFAULT · EN FALLBACK</span>
          <span className={styles.statusPill}>{catalog.family_count} PRODUCT FAMILIES</span>
          <span className={styles.statusPill}>{catalog.candidate_registry_count} CANDIDATE PRODUCTS</span>
          <span className={styles.statusPill}>PURCHASE + AUTO-PUBLISH LOCKED</span>
        </div>
        <section className={styles.metricGrid}>
          <div className={styles.card}><div className={styles.metricLabel}>Familias</div><div className={styles.metricValue}>{catalog.family_count}</div><div className={styles.metricNote}>commerce architecture</div></div>
          <div className={styles.card}><div className={styles.metricLabel}>Candidatos</div><div className={styles.metricValue}>{catalog.candidate_registry_count}</div><div className={styles.metricNote}>all HOLD / reference-only</div></div>
          <div className={styles.card}><div className={styles.metricLabel}>Categorías candidatas</div><div className={styles.metricValue}>{candidateCategories.length}</div><div className={styles.metricNote}>expanded botanica taxonomy</div></div>
          <div className={styles.card}><div className={styles.metricLabel}>Evidence Gates</div><div className={styles.metricValue}>{catalog.governance.required_evidence.length}</div><div className={styles.metricNote}>before Shopify draft</div></div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}><div><span>REGISTRO AMPLIADO</span><h2>Productos candidatos Spanish-first.</h2></div></div>
          <div className={`${styles.card} ${styles.form}`}>
            <input className={styles.input} value={candidateQuery} onChange={(e) => setCandidateQuery(e.target.value)} placeholder="Buscar: Dice Ifá, Ochosi, eleke, romero, velón…" />
            <select className={styles.input} value={candidateCategory} onChange={(e) => setCandidateCategory(e.target.value)}><option value="ALL">Todas las categorías candidatas</option>{candidateCategories.map((item) => <option key={item} value={item}>{item} · {catalog.candidate_category_counts[item]}</option>)}</select>
          </div>
          <div className={styles.productMeta}>Gate load: {Object.entries(catalog.candidate_gate_counts).map(([gate, count]) => `${gate} ${count}`).join(" · ")}</div>
          <div className={styles.productList}>{candidates.map((candidate) => <article key={candidate.slug} className={`${styles.card} ${styles.productRow}`}><div><div className={styles.kicker}>{candidate.category} · {candidate.subcategory} · {candidate.language}</div><h2>{candidate.titleEs}</h2><div className={styles.productMeta}>EN: {candidate.titleEn}</div><div className={styles.productMeta}>Gates: {candidate.gates.join(" · ")}</div>{candidate.notes && <div className={styles.productMeta}>Nota: {candidate.notes}</div>}</div><div className={styles.rowActions}><strong>{candidate.publish_policy === "REFERENCE_ONLY" ? "REFERENCE ONLY" : "HOLD · VERIFY"}</strong></div></article>)}</div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}><div><span>COLECCIONES</span><h2>Spanish-first commerce architecture.</h2></div></div>
          <div className={styles.productMeta}>{catalog.collections.join(" · ")}</div>
        </section>
        <section className={styles.section}>
          <div className={styles.sectionHead}><div><span>FAMILIAS COMERCIALES</span><h2>Familias que pueden producir SKUs verificados.</h2></div></div>
          <div className={`${styles.card} ${styles.form}`}>
            <input className={styles.input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar familia comercial…" />
            <select className={styles.input} value={category} onChange={(e) => setCategory(e.target.value)}><option value="ALL">Todas las categorías</option>{catalog.categories.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          </div>
          <div className={styles.productList}>{families.map((family) => <article key={family.id} className={`${styles.card} ${styles.productRow}`}><div><div className={styles.kicker}>{family.category} · {family.commerce_mode}</div><h2>{family.name_es}</h2><div className={styles.productMeta}>EN: {family.name_en}</div><div className={styles.productMeta}>Gates: {family.required_gates.join(" · ") || "REFERENCE ONLY"}</div><div className={styles.productMeta}>{family.tags.join(" · ")}</div></div><div className={styles.rowActions}><strong>{family.publish_policy === "GATED" ? "HOLD · VERIFY SKU" : "REFERENCE ONLY"}</strong></div></article>)}</div>
        </section>
        <section className={styles.section}><div className={styles.card}><div className={styles.kicker}>FAIL-CLOSED GOVERNANCE</div><h2>No candidate is inventory. No family is a sellable SKU by itself.</h2><p>Required before Shopify draft: {catalog.governance.required_evidence.join(" · ")}. Autonomous purchasing: LOCKED. Automatic publishing: LOCKED. Candidate registry records always report shopify_draft_ready=false until promoted into a separately verified SKU record.</p></div></section>
      </>}
      <footer className={styles.footer}><span>BOTANICA OCHOSI · Master Catalog</span><a href="/owner/catalog">← Catalog Control</a></footer>
    </div>
  </main>;
}
