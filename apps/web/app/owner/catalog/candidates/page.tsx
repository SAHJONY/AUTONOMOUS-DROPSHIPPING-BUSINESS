"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "../../owner.module.css";

type Candidate = {
  id: string;
  family_id: string;
  family_name_es: string;
  family_name_en: string;
  category: string;
  commerce_mode: string;
  supplier_id: string;
  supplier_name: string;
  supplier_priority: number;
  supplier_verification: "PENDING" | "VERIFIED" | "REJECTED";
  match_score: number;
  publish_status: string;
  draft_ready: boolean;
  failures: string[];
};

type CandidateResponse = {
  ok: boolean;
  mode: "CANDIDATE_ONLY";
  autonomous_purchase: boolean;
  auto_publish: boolean;
  supplier_count: number;
  candidate_count: number;
  draft_ready_count: number;
  candidates: Candidate[];
};

export default function CandidateWorkspacePage() {
  const [token, setToken] = useState("");
  const [orgId, setOrgId] = useState("");
  const [data, setData] = useState<CandidateResponse | null>(null);
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
        const res = await fetch(`/api/orgs/${oid}/owner-catalog/candidates`, { headers, cache: "no-store" });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.detail ?? `Request failed (${res.status})`);
        setData(body as CandidateResponse);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [token, orgId]);

  const candidates = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("es");
    if (!needle) return data?.candidates ?? [];
    return (data?.candidates ?? []).filter((candidate) =>
      `${candidate.family_name_es} ${candidate.family_name_en} ${candidate.category} ${candidate.supplier_name}`
        .toLocaleLowerCase("es")
        .includes(needle),
    );
  }, [data, query]);

  return <main className={styles.shell}>
    <nav className={styles.nav}>
      <a className={styles.brand} href="/store"><span className={styles.mark}>O</span><span className={styles.brandText}><strong>BOTANICA</strong><small>OCHOSI</small></span></a>
      <div className={styles.navLinks}><a className={styles.ghost} href="/owner/catalog/master">Master Catalog</a><a className={styles.primary} href="/owner/catalog">Catalog Control</a></div>
    </nav>
    <div className={styles.content}>
      <section className={styles.hero}><div className={styles.kicker}>SUPPLIER MATCH · CANDIDATE SKU PIPELINE</div><h1>Supplier <em>Candidates.</em></h1><p>Matching workspace between BOTANICA product families and prospective suppliers. A match is not approval. Every candidate starts on HOLD and remains blocked until commercial evidence, provenance, price, inventory, rights/cultural review and image rights pass.</p></section>
      {error && <div className={styles.error}>{error}</div>}
      {!token && !error && <div className={styles.error}>Owner authentication required. <a href="/owner/login">Sign in</a>.</div>}
      {data && <>
        <div className={styles.statusStrip}>
          <span className={styles.statusPill}>{data.supplier_count} SUPPLIER CANDIDATES</span>
          <span className={styles.statusPill}>{data.candidate_count} MATCH PROPOSALS</span>
          <span className={styles.statusPill}>{data.draft_ready_count} DRAFT READY</span>
          <span className={styles.statusPill}>PURCHASE + AUTO-PUBLISH LOCKED</span>
        </div>
        <section className={styles.metricGrid}>
          <div className={styles.card}><div className={styles.metricLabel}>Mode</div><div className={styles.metricValue}>{data.mode}</div><div className={styles.metricNote}>no procurement authority</div></div>
          <div className={styles.card}><div className={styles.metricLabel}>Candidates</div><div className={styles.metricValue}>{data.candidate_count}</div><div className={styles.metricNote}>family-to-supplier proposals</div></div>
          <div className={styles.card}><div className={styles.metricLabel}>Draft Ready</div><div className={styles.metricValue}>{data.draft_ready_count}</div><div className={styles.metricNote}>must remain zero without evidence</div></div>
          <div className={styles.card}><div className={styles.metricLabel}>Autonomy</div><div className={styles.metricValue}>LOCKED</div><div className={styles.metricNote}>owner remains final authority</div></div>
        </section>
        <section className={styles.section}>
          <div className={styles.sectionHead}><div><span>MATCH QUEUE</span><h2>Verify before Shopify.</h2></div></div>
          <div className={`${styles.card} ${styles.form}`}><input className={styles.input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar familia, categoría o proveedor…" /></div>
          <div className={styles.productList}>{candidates.map((candidate) => <article key={candidate.id} className={`${styles.card} ${styles.productRow}`}><div><div className={styles.kicker}>{candidate.category} · SCORE {candidate.match_score}</div><h2>{candidate.family_name_es}</h2><div className={styles.productMeta}>EN: {candidate.family_name_en}</div><div className={styles.productMeta}>Supplier candidate: {candidate.supplier_name} · priority #{candidate.supplier_priority} · {candidate.supplier_verification}</div><div className={styles.productMeta}>Blocked by: {candidate.failures.join(" · ") || "none"}</div></div><div className={styles.rowActions}><strong>{candidate.draft_ready ? "READY FOR OWNER DRAFT" : "HOLD · VERIFY"}</strong></div></article>)}</div>
        </section>
        <section className={styles.section}><div className={styles.card}><div className={styles.kicker}>GOVERNANCE</div><h2>Candidate is not inventory.</h2><p>Supplier matching only prioritizes research. It does not verify wholesale eligibility, pricing, inventory, authenticity, provenance or cultural fit and cannot create a live listing or purchase order.</p></div></section>
      </>}
      <footer className={styles.footer}><span>BOTANICA OCHOSI · Supplier Candidate Pipeline</span><a href="/owner/catalog/master">← Master Catalog</a></footer>
    </div>
  </main>;
}
