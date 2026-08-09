"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import styles from "../owner.module.css";

type Product = { id:string; title:string; description:string; cost:number; price:number; status:string; supplier?:string; shopify_id?:number; storefront_url?:string; sku?:string };
type MigrationResult = { ok?:boolean; legacy_found?:number; archived_count?:number; botanica_drafts_created?:number; final_active_legacy?:number; final_botanica_products?:number; errors?:string[] };

export default function OwnerCatalogPage() {
  const [token, setToken] = useState("");
  const [orgId, setOrgId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [migration, setMigration] = useState<MigrationResult | null>(null);

  useEffect(() => { setToken(localStorage.getItem("commerce_os_token") ?? ""); setOrgId(localStorage.getItem("commerce_os_org") ?? ""); }, []);
  const headers = useMemo(() => ({ "Content-Type":"application/json", ...(token ? { Authorization:`Bearer ${token}` } : {}) }), [token]);

  async function resolveOrg() {
    if (!token) return ""; if (orgId) return orgId;
    const res = await fetch("/api/orgs", { headers }); if (!res.ok) return "";
    const orgs = await res.json(); const id = orgs?.[0]?.id ?? "";
    if (id) { setOrgId(id); localStorage.setItem("commerce_os_org", id); }
    return id;
  }
  async function refresh() {
    const oid = await resolveOrg(); if (!oid) return;
    const res = await fetch(`/api/orgs/${oid}/owner-catalog`, { headers });
    if (!res.ok) { const body = await res.json().catch(() => ({})); setError(body.detail ?? `Request failed (${res.status})`); return; }
    setProducts(await res.json());
  }
  useEffect(() => { if (token) void refresh(); }, [token]);

  async function runMigration() {
    const confirmation = window.prompt("This archives non-BOTANICA Shopify products and seeds curated BOTANICA drafts. Type:\nMIGRATE BOTANICA CATALOG") ?? "";
    if (confirmation !== "MIGRATE BOTANICA CATALOG") return;
    setBusy(true); setError(""); setMigration(null);
    try {
      const oid = await resolveOrg(); if (!oid) throw new Error("Owner organization could not be resolved.");
      const res = await fetch(`/api/orgs/${oid}/owner-catalog/migrate`, { method:"POST", headers, body:JSON.stringify({ confirmation }) });
      const body = await res.json().catch(() => ({})); if (!res.ok && res.status !== 207) throw new Error(body.detail ?? `Request failed (${res.status})`);
      setMigration(body); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); } finally { setBusy(false); }
  }

  async function addProduct(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(""); const form = new FormData(e.currentTarget);
    try {
      const oid = await resolveOrg(); if (!oid) throw new Error("Owner organization could not be resolved.");
      const images = String(form.get("images") ?? "").split(/\n|,/).map((v) => v.trim()).filter(Boolean);
      const res = await fetch(`/api/orgs/${oid}/owner-catalog`, { method:"POST", headers, body:JSON.stringify({
        title:form.get("title"), description:form.get("description"), supplier:form.get("supplier"), supplier_url:form.get("supplier_url"),
        sku:form.get("sku"), product_type:form.get("product_type"), cost:Number(form.get("cost") ?? 0), price:Number(form.get("price") ?? 0),
        images, sync_shopify:true, publish:form.get("publish") === "on",
      }) });
      const body = await res.json().catch(() => ({})); if (!res.ok) throw new Error(body.detail ?? `Request failed (${res.status})`);
      e.currentTarget.reset(); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); } finally { setBusy(false); }
  }

  async function removeProduct(product: Product, mode:"archive"|"delete") {
    let confirmation = "";
    if (mode === "delete") { confirmation = window.prompt(`Permanent deletion removes the internal record and Shopify product. Type:\nDELETE ${product.title}`) ?? ""; if (confirmation !== `DELETE ${product.title}`) return; }
    else if (!window.confirm(`Archive ${product.title}? This preserves history and removes it from sale.`)) return;
    setBusy(true); setError("");
    try {
      const oid = await resolveOrg(); const res = await fetch(`/api/orgs/${oid}/owner-catalog`, { method:"DELETE", headers, body:JSON.stringify({ product_id:product.id, mode, confirmation }) });
      const body = await res.json().catch(() => ({})); if (!res.ok) throw new Error(body.detail ?? `Request failed (${res.status})`); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); } finally { setBusy(false); }
  }

  return <main className={styles.shell}>
    <nav className={styles.nav}>
      <a className={styles.brand} href="/store"><span className={styles.mark}>O</span><span className={styles.brandText}><strong>BOTANICA</strong><small>OCHOSI</small></span></a>
      <div className={styles.navLinks}><a className={`${styles.ghost} ${styles.hideMobile}`} href="/owner">Owner OS</a><a className={styles.primary} href="/store">Storefront</a></div>
    </nav>
    <div className={styles.content}>
      <section className={styles.hero}><div className={styles.kicker}>OWNER CATALOG · SHOPIFY CONTROL</div><h1>Catalog <em>Control.</em></h1><p>Create, archive and retire owner-managed products across the internal catalog and connected Shopify store. Archive remains the recommended default because it preserves history.</p></section>
      {error && <div className={styles.error}>{error}</div>}

      <section className={`${styles.card} ${styles.migration}`}>
        <div className={styles.kicker}>ONE-TIME SAFE MIGRATION</div><h2>Replace legacy Shopify catalog</h2>
        <p>Archives non-BOTANICA products, preserves Shopify historical references, and seeds the curated BOTANICA starter catalog as unpublished drafts. No price, inventory, wholesale cost or margin is fabricated.</p>
        <button disabled={busy || !token} onClick={runMigration} className={styles.primary}>{busy ? "Working…" : "Archive legacy + seed BOTANICA drafts"}</button>
        {!token && <p>Owner sign-in is required before migration.</p>}
        {migration && <div className={styles.result}><strong>{migration.ok ? "Migration completed" : "Migration completed with issues"}</strong><div className={styles.productMeta}>Legacy found {migration.legacy_found ?? 0} · Archived {migration.archived_count ?? 0} · Drafts created {migration.botanica_drafts_created ?? 0} · Remaining legacy {migration.final_active_legacy ?? 0} · BOTANICA products {migration.final_botanica_products ?? 0}</div>{!!migration.errors?.length && <div className={styles.blocker}>{migration.errors.join(" | ")}</div>}</div>}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}><div><span>DIRECT OWNER ENTRY</span><h2>Add a catalog product.</h2></div></div>
        <form onSubmit={addProduct} className={`${styles.card} ${styles.form}`}>
          <input className={styles.input} name="title" required placeholder="Product title"/><input className={styles.input} name="sku" placeholder="SKU"/><input className={styles.input} name="product_type" placeholder="Category / product type"/>
          <input className={styles.input} name="supplier" placeholder="Supplier"/><input className={styles.input} name="supplier_url" placeholder="Supplier URL"/><input className={styles.input} name="cost" type="number" min="0" step="0.01" placeholder="Cost"/>
          <input className={styles.input} name="price" type="number" min="0" step="0.01" placeholder="Retail price"/><textarea className={styles.textarea} name="description" placeholder="Description"/><textarea className={styles.textarea} name="images" placeholder="Image URLs, comma or line separated"/>
          <label className={styles.full}><input type="checkbox" name="publish"/> Direct owner publish to Shopify (positive price required). Supplier/Council pipeline products remain draft-first.</label>
          <div className={styles.full}><button disabled={busy} className={styles.primary}>{busy ? "Working…" : "Add to Catalog + Shopify"}</button></div>
        </form>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}><div><span>MANAGED INVENTORY</span><h2>Catalog records.</h2></div><button className={styles.ghost} onClick={() => void refresh()} disabled={busy}>Refresh</button></div>
        <div className={styles.productList}>{products.map((p) => <article key={p.id} className={`${styles.card} ${styles.productRow}`}><div><h2>{p.title}</h2><div className={styles.productMeta}>{p.status} · ${Number(p.price || 0).toFixed(2)} retail · ${Number(p.cost || 0).toFixed(2)} cost {p.shopify_id ? `· Shopify #${p.shopify_id}` : "· internal only"}</div>{p.storefront_url && <a className={styles.footer} href={p.storefront_url} target="_blank" rel="noreferrer">Open storefront ↗</a>}</div><div className={styles.rowActions}><button disabled={busy || p.status === "killed"} onClick={() => void removeProduct(p,"archive")} className={styles.ghost}>Archive</button><button disabled={busy} onClick={() => void removeProduct(p,"delete")} className={styles.danger}>Delete permanently</button></div></article>)}{!products.length && <div className={styles.empty}>No products found for this organization.</div>}</div>
      </section>
      <footer className={styles.footer}><span>BOTANICA OCHOSI Owner Catalog</span><a href="/owner">← Back to Owner OS</a></footer>
    </div>
  </main>;
}
