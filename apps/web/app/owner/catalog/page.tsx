"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import styles from "../owner.module.css";

type Product = { id:string; title:string; description:string; cost:number; price:number; status:string; source?:string; supplier?:string; shopify_id?:number; storefront_url?:string; sku?:string; inventory_quantity?:number; inventory_policy?:"deny"|"continue" };
type MigrationResult = { ok?:boolean; legacy_found?:number; archived_count?:number; botanica_drafts_created?:number; final_active_legacy?:number; final_botanica_products?:number; errors?:string[] };
type DiagnosticRow = { id:string; title:string; handle:string; productType:string; vendor:string; published:boolean; botanica:boolean; positivePrice:boolean; inventoryAvailable:boolean; publishable:boolean; reasons:string[] };
type CatalogDiagnostics = {
  ok:boolean;
  shop:string;
  counts:{ activeFetched:number; published:number; botanicaMatch:number; positivePrice:number; inventoryAvailable:number; publishable:number };
  exclusions:{ notPublished:number; notBotanicaMatch:number; noPositivePrice:number; noInventory:number };
  products:DiagnosticRow[];
};

const REASON_LABELS: Record<string, string> = {
  not_active: "not active",
  not_published: "not published",
  not_botanica_match: "not BOTANICA match",
  no_positive_price: "no positive price",
  no_inventory: "no inventory",
};

export default function OwnerCatalogPage() {
  const [token, setToken] = useState("");
  const [orgId, setOrgId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [diagnostics, setDiagnostics] = useState<CatalogDiagnostics | null>(null);
  const [diagnosticError, setDiagnosticError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [migration, setMigration] = useState<MigrationResult | null>(null);
  const [shopifySync, setShopifySync] = useState("");

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
    const sync = res.headers.get("x-shopify-sync");
    const count = res.headers.get("x-shopify-products");
    setShopifySync(sync === "complete" ? `Shopify sincronizado · ${count ?? "0"} productos importados` : "Shopify no respondió · mostrando el último catálogo guardado");
  }
  async function refreshDiagnostics() {
    const oid = await resolveOrg(); if (!oid) return;
    setDiagnosticError("");
    const res = await fetch(`/api/orgs/${oid}/owner-catalog/diagnostics`, { headers, cache:"no-store" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { setDiagnostics(null); setDiagnosticError(body.detail ?? `Diagnostic failed (${res.status})`); return; }
    setDiagnostics(body as CatalogDiagnostics);
  }
  useEffect(() => { if (token) { void refresh(); void refreshDiagnostics(); } }, [token]);

  async function runMigration() {
    const confirmation = window.prompt("Esto añade de forma segura los productos BOTANICA faltantes como borradores no publicados en Shopify. Los productos existentes se conservan. Escribe:\nSEED BOTANICA DRAFTS") ?? "";
    if (confirmation !== "SEED BOTANICA DRAFTS") return;
    setBusy(true); setError(""); setMigration(null);
    try {
      const oid = await resolveOrg(); if (!oid) throw new Error("Owner organization could not be resolved.");
      const res = await fetch(`/api/orgs/${oid}/owner-catalog/migrate`, { method:"POST", headers, body:JSON.stringify({ confirmation }) });
      const body = await res.json().catch(() => ({})); if (!res.ok && res.status !== 207) throw new Error(body.detail ?? `Request failed (${res.status})`);
      setMigration(body); await refresh(); await refreshDiagnostics();
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
        images, inventory_quantity:Number(form.get("inventory_quantity") ?? 0), inventory_policy:form.get("inventory_policy"), sync_shopify:form.get("sync_shopify") === "on", publish:form.get("publish") === "on",
      }) });
      const body = await res.json().catch(() => ({})); if (!res.ok) throw new Error(body.detail ?? `Request failed (${res.status})`);
      e.currentTarget.reset(); await refresh(); await refreshDiagnostics();
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); } finally { setBusy(false); }
  }

  async function updateNativeProduct(product: Product, action:"price"|"inventory"|"publish") {
    const patch: Record<string, unknown> = { product_id:product.id };
    if (action === "price") { const value = window.prompt("Native retail price", String(product.price)); if (value === null) return; patch.price = Number(value); }
    if (action === "inventory") { const value = window.prompt("Native inventory quantity", String(product.inventory_quantity ?? 0)); if (value === null) return; patch.inventory_quantity = Number(value); patch.inventory_policy = "deny"; }
    if (action === "publish") patch.status = product.status === "launched" ? "discovered" : "launched";
    setBusy(true); setError("");
    try { const oid = await resolveOrg(); const res = await fetch(`/api/orgs/${oid}/owner-catalog`, { method:"PATCH", headers, body:JSON.stringify(patch) }); const body = await res.json().catch(() => ({})); if (!res.ok) throw new Error(body.detail ?? `Request failed (${res.status})`); setProducts((current) => current.map((item) => item.id === product.id ? body.product : item)); }
    catch (err) { setError(err instanceof Error ? err.message : String(err)); } finally { setBusy(false); }
  }

  async function removeProduct(product: Product, mode:"archive"|"delete") {
    let confirmation = "";
    if (mode === "delete") { confirmation = window.prompt(`Permanent deletion removes the internal record and Shopify product. Type:\nDELETE ${product.title}`) ?? ""; if (confirmation !== `DELETE ${product.title}`) return; }
    else if (!window.confirm(`Archive ${product.title}? This preserves history and removes it from sale.`)) return;
    setBusy(true); setError("");
    try {
      const oid = await resolveOrg(); const res = await fetch(`/api/orgs/${oid}/owner-catalog`, { method:"DELETE", headers, body:JSON.stringify({ product_id:product.id, mode, confirmation }) });
      const body = await res.json().catch(() => ({})); if (!res.ok) throw new Error(body.detail ?? `Request failed (${res.status})`); await refresh(); await refreshDiagnostics();
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); } finally { setBusy(false); }
  }

  return <main className={styles.shell}>
    <nav className={styles.nav}>
      <a className={styles.brand} href="/store"><span className={styles.mark}>O</span><span className={styles.brandText}><strong>BOTANICA</strong><small>OCHOSI</small></span></a>
      <div className={styles.navLinks}><a className={`${styles.ghost} ${styles.hideMobile}`} href="/owner">Owner OS</a><a className={styles.primary} href="/store">Storefront</a></div>
    </nav>
    <div className={styles.content}>
      <section className={styles.hero}><div className={styles.kicker}>CATÁLOGO NATIVO · SHOPIFY OPCIONAL</div><h1>Control del <em>catálogo.</em></h1><p>La aplicación es la fuente principal del catálogo, precio, publicación e inventario. Shopify puede importar o recibir productos cuando tú lo decidas.</p><div className={styles.heroActions}><button className={styles.primary} onClick={() => void refresh()} disabled={busy || !token}>Actualizar catálogo + importar Shopify</button><a className={styles.ghost} href="/owner/native-store">Configurar tienda nativa</a></div></section>
      {error && <div className={styles.error}>{error}</div>}
      {shopifySync && <div className={styles.result}>{shopifySync}</div>}

      <section className={`${styles.card} ${styles.migration}`}>
        <div className={styles.sectionHead}><div><span>PUBLIC CATALOG AUDIT</span><h2>Shopify publishability.</h2></div><button className={styles.ghost} onClick={() => void refreshDiagnostics()} disabled={!token || busy}>Refresh audit</button></div>
        {diagnosticError && <div className={styles.error}>{diagnosticError}</div>}
        {!diagnostics && !diagnosticError && <p>Sign in as owner to audit why Shopify products are or are not eligible for the public BOTANICA catalog.</p>}
        {diagnostics && <>
          <p>Store: <strong>{diagnostics.shop}</strong>. Public catalog remains fail-closed: every product must be active, published, BOTANICA-matched, positively priced and inventory-available.</p>
          <div className={styles.productMeta}>Active fetched {diagnostics.counts.activeFetched} · Published {diagnostics.counts.published} · BOTANICA match {diagnostics.counts.botanicaMatch} · Positive price {diagnostics.counts.positivePrice} · Inventory ready {diagnostics.counts.inventoryAvailable} · <strong>Publicable {diagnostics.counts.publishable}</strong></div>
          <div className={styles.productMeta}>Excluded: unpublished {diagnostics.exclusions.notPublished} · non-BOTANICA {diagnostics.exclusions.notBotanicaMatch} · no price {diagnostics.exclusions.noPositivePrice} · no inventory {diagnostics.exclusions.noInventory}</div>
          {!!diagnostics.products.length && <div className={styles.productList}>{diagnostics.products.map((row) => <article key={row.id} className={`${styles.card} ${styles.productRow}`}><div><h2>{row.title}</h2><div className={styles.productMeta}>{row.productType || "No category"} · {row.vendor || "No vendor"} · {row.publishable ? "PUBLICABLE" : row.reasons.map((reason) => REASON_LABELS[reason] ?? reason).join(" · ")}</div></div></article>)}</div>}
        </>}
      </section>

      <section className={`${styles.card} ${styles.migration}`}>
        <div className={styles.kicker}>CARGA SEGURA DEL SURTIDO SHOPIFY</div><h2>Añadir el catálogo BOTANICA seleccionado</h2>
        <p>Añade 20 productos con fuentes comprobables como borradores no publicados sin modificar el inventario existente. No se inventan precios, existencias, costos mayoristas ni márgenes.</p>
        <button disabled={busy || !token} onClick={runMigration} className={styles.primary}>{busy ? "Procesando…" : "Crear 20 borradores BOTANICA"}</button>
        {!token && <p>Owner sign-in is required before migration.</p>}
        {migration && <div className={styles.result}><strong>{migration.ok ? "Migration completed" : "Migration completed with issues"}</strong><div className={styles.productMeta}>Legacy found {migration.legacy_found ?? 0} · Archived {migration.archived_count ?? 0} · Drafts created {migration.botanica_drafts_created ?? 0} · Remaining legacy {migration.final_active_legacy ?? 0} · BOTANICA products {migration.final_botanica_products ?? 0}</div>{!!migration.errors?.length && <div className={styles.blocker}>{migration.errors.join(" | ")}</div>}</div>}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}><div><span>DIRECT OWNER ENTRY</span><h2>Add a catalog product.</h2></div></div>
        <form onSubmit={addProduct} className={`${styles.card} ${styles.form}`}>
          <input className={styles.input} name="title" required placeholder="Product title"/><input className={styles.input} name="sku" placeholder="SKU"/><input className={styles.input} name="product_type" placeholder="Category / product type"/>
          <input className={styles.input} name="supplier" placeholder="Supplier"/><input className={styles.input} name="supplier_url" placeholder="Supplier URL"/><input className={styles.input} name="cost" type="number" min="0" step="0.01" placeholder="Cost"/>
          <input className={styles.input} name="price" type="number" min="0" step="0.01" placeholder="Retail price"/><input className={styles.input} name="inventory_quantity" type="number" min="0" step="1" placeholder="Inventory quantity"/><select className={styles.input} name="inventory_policy" defaultValue="deny"><option value="deny">Stop when sold out</option><option value="continue">Allow backorders</option></select><textarea className={styles.textarea} name="description" placeholder="Description"/><textarea className={styles.textarea} name="images" placeholder="Image URLs, comma or line separated"/>
          <label className={styles.full}><input type="checkbox" name="publish"/> Publish immediately in the native store (positive price required).</label><label className={styles.full}><input type="checkbox" name="sync_shopify"/> Also create this product in Shopify.</label>
          <div className={styles.full}><button disabled={busy} className={styles.primary}>{busy ? "Working…" : "Add to native catalog"}</button></div>
        </form>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}><div><span>MANAGED INVENTORY</span><h2>Catalog records.</h2></div><button className={styles.ghost} onClick={() => void refresh()} disabled={busy}>Refresh</button></div>
        <div className={styles.productList}>{products.map((p) => <article key={p.id} className={`${styles.card} ${styles.productRow}`}><div><div className={styles.kicker}>{p.source === "shopify_import" ? "IMPORTED · NOW OWNED LOCALLY" : "NATIVE PRODUCT"}</div><h2>{p.title}</h2><div className={styles.productMeta}>{p.status} · ${Number(p.price || 0).toFixed(2)} retail · ${Number(p.cost || 0).toFixed(2)} cost · inventory {p.inventory_quantity ?? "untracked"} {p.shopify_id ? `· Shopify #${p.shopify_id}` : "· Shopify independent"}</div>{p.storefront_url && <a className={styles.footer} href={p.storefront_url} target="_blank" rel="noreferrer">Open Shopify copy ↗</a>}</div><div className={styles.rowActions}><button disabled={busy} onClick={() => void updateNativeProduct(p,"price")} className={styles.ghost}>Price</button><button disabled={busy} onClick={() => void updateNativeProduct(p,"inventory")} className={styles.ghost}>Inventory</button><button disabled={busy || p.status === "killed"} onClick={() => void updateNativeProduct(p,"publish")} className={styles.primary}>{p.status === "launched" ? "Unpublish" : "Publish"}</button><button disabled={busy || p.status === "killed"} onClick={() => void removeProduct(p,"archive")} className={styles.ghost}>Archive</button><button disabled={busy} onClick={() => void removeProduct(p,"delete")} className={styles.danger}>Delete permanently</button></div></article>)}{!products.length && <div className={styles.empty}>No products found for this organization.</div>}</div>
      </section>
      <footer className={styles.footer}><span>BOTANICA OCHOSI Owner Catalog</span><a href="/owner">← Back to Owner OS</a></footer>
    </div>
  </main>;
}
