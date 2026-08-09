"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Product = {
  id: string;
  title: string;
  description: string;
  cost: number;
  price: number;
  status: string;
  supplier?: string;
  shopify_id?: number;
  storefront_url?: string;
  sku?: string;
};

type MigrationResult = {
  ok?: boolean;
  legacy_found?: number;
  archived_count?: number;
  botanica_drafts_created?: number;
  final_active_legacy?: number;
  final_botanica_products?: number;
  errors?: string[];
};

export default function OwnerCatalogPage() {
  const [token, setToken] = useState("");
  const [orgId, setOrgId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [migration, setMigration] = useState<MigrationResult | null>(null);

  useEffect(() => {
    setToken(localStorage.getItem("commerce_os_token") ?? "");
    setOrgId(localStorage.getItem("commerce_os_org") ?? "");
  }, []);

  const headers = useMemo(() => ({
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token]);

  async function resolveOrg() {
    if (!token) return "";
    if (orgId) return orgId;
    const res = await fetch("/api/orgs", { headers });
    if (!res.ok) return "";
    const orgs = await res.json();
    const id = orgs?.[0]?.id ?? "";
    if (id) {
      setOrgId(id);
      localStorage.setItem("commerce_os_org", id);
    }
    return id;
  }

  async function refresh() {
    const oid = await resolveOrg();
    if (!oid) return;
    const res = await fetch(`/api/orgs/${oid}/owner-catalog`, { headers });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.detail ?? `Request failed (${res.status})`);
      return;
    }
    setProducts(await res.json());
  }

  useEffect(() => { if (token) void refresh(); }, [token]);

  async function runMigration() {
    const confirmation = window.prompt(
      "This archives non-BOTANICA Shopify products and seeds the curated BOTANICA starter catalog as drafts only. Type:\nMIGRATE BOTANICA CATALOG",
    ) ?? "";
    if (confirmation !== "MIGRATE BOTANICA CATALOG") return;

    setBusy(true); setError(""); setMigration(null);
    try {
      const oid = await resolveOrg();
      if (!oid) throw new Error("Owner organization could not be resolved.");
      const res = await fetch(`/api/orgs/${oid}/owner-catalog/migrate`, {
        method: "POST",
        headers,
        body: JSON.stringify({ confirmation }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 207) throw new Error(body.detail ?? `Request failed (${res.status})`);
      setMigration(body);
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  }

  async function addProduct(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError("");
    const form = new FormData(e.currentTarget);
    try {
      const oid = await resolveOrg();
      const images = String(form.get("images") ?? "").split(/\n|,/).map((v) => v.trim()).filter(Boolean);
      const res = await fetch(`/api/orgs/${oid}/owner-catalog`, {
        method: "POST", headers,
        body: JSON.stringify({
          title: form.get("title"), description: form.get("description"),
          supplier: form.get("supplier"), supplier_url: form.get("supplier_url"),
          sku: form.get("sku"), product_type: form.get("product_type"),
          cost: Number(form.get("cost") ?? 0), price: Number(form.get("price") ?? 0),
          images, sync_shopify: true, publish: form.get("publish") === "on",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.detail ?? `Request failed (${res.status})`);
      e.currentTarget.reset();
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  }

  async function removeProduct(product: Product, mode: "archive" | "delete") {
    let confirmation = "";
    if (mode === "delete") {
      confirmation = window.prompt(`Permanent deletion removes the internal record and Shopify product. Type:\nDELETE ${product.title}`) ?? "";
      if (confirmation !== `DELETE ${product.title}`) return;
    } else if (!window.confirm(`Archive ${product.title}? This preserves history and removes it from sale.`)) return;

    setBusy(true); setError("");
    try {
      const oid = await resolveOrg();
      const res = await fetch(`/api/orgs/${oid}/owner-catalog`, {
        method: "DELETE", headers,
        body: JSON.stringify({ product_id: product.id, mode, confirmation }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.detail ?? `Request failed (${res.status})`);
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  }

  return <main style={{maxWidth:1200,margin:"0 auto",padding:"32px 20px",fontFamily:"system-ui",color:"#f3f2e9",background:"#07130e",minHeight:"100vh"}}>
    <a href="/?command=1" style={{color:"#d7b45a",textDecoration:"none"}}>← Owner Command Center</a>
    <h1 style={{fontSize:42,marginBottom:8}}>BOTANICA OCHOSI — Owner Catalog Control</h1>
    <p style={{opacity:.75}}>Create, publish, archive, or permanently delete products across the internal catalog and connected Shopify store. Archive is the recommended default.</p>
    {error && <div style={{padding:12,background:"#481b1b",borderRadius:10,margin:"16px 0"}}>{error}</div>}

    <section style={{padding:20,background:"#10271c",border:"1px solid #4f704f",borderRadius:18,margin:"24px 0"}}>
      <h2 style={{marginTop:0}}>Replace legacy Shopify catalog</h2>
      <p style={{opacity:.78,maxWidth:820}}>Owner-only, idempotent migration. It archives non-BOTANICA products instead of deleting them, preserves historical Shopify references, and seeds the curated BOTANICA starter products as unpublished drafts with price and inventory still pending verification.</p>
      <button disabled={busy || !token} onClick={runMigration} style={primary}>{busy ? "Working…" : "Archive legacy + seed BOTANICA drafts"}</button>
      {!token && <div style={{marginTop:10,opacity:.65}}>Owner sign-in is required before migration.</div>}
      {migration && <div style={{marginTop:16,padding:14,background:"#07130e",borderRadius:12}}>
        <strong>{migration.ok ? "Migration completed" : "Migration completed with issues"}</strong>
        <div style={{marginTop:8,opacity:.8}}>Legacy found: {migration.legacy_found ?? 0} · Archived: {migration.archived_count ?? 0} · BOTANICA drafts created: {migration.botanica_drafts_created ?? 0} · Remaining active legacy: {migration.final_active_legacy ?? 0} · BOTANICA products: {migration.final_botanica_products ?? 0}</div>
        {!!migration.errors?.length && <div style={{marginTop:8,color:"#ffb5b5"}}>{migration.errors.join(" | ")}</div>}
      </div>}
    </section>

    <form onSubmit={addProduct} style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12,padding:20,background:"#0d2118",border:"1px solid #294634",borderRadius:18,margin:"24px 0"}}>
      <input name="title" required placeholder="Product title" style={input}/>
      <input name="sku" placeholder="SKU" style={input}/>
      <input name="product_type" placeholder="Category / product type" style={input}/>
      <input name="supplier" placeholder="Supplier" style={input}/>
      <input name="supplier_url" placeholder="Supplier URL" style={input}/>
      <input name="cost" type="number" min="0" step="0.01" placeholder="Cost" style={input}/>
      <input name="price" type="number" min="0" step="0.01" placeholder="Retail price" style={input}/>
      <textarea name="description" placeholder="Description" style={{...input,minHeight:90}}/>
      <textarea name="images" placeholder="Image URLs, comma or line separated" style={{...input,minHeight:90}}/>
      <label style={{display:"flex",alignItems:"center",gap:8}}><input type="checkbox" name="publish"/> Publish immediately (positive price required)</label>
      <button disabled={busy} style={primary}>{busy?"Working…":"Add to Catalog + Shopify"}</button>
    </form>

    <div style={{display:"grid",gap:12}}>
      {products.map((p) => <article key={p.id} style={{padding:18,background:"#0d2118",border:"1px solid #294634",borderRadius:16,display:"grid",gridTemplateColumns:"1fr auto",gap:18,alignItems:"center"}}>
        <div>
          <strong style={{fontSize:20}}>{p.title}</strong>
          <div style={{opacity:.7,marginTop:5}}>{p.status} · ${Number(p.price||0).toFixed(2)} · cost ${Number(p.cost||0).toFixed(2)} {p.shopify_id?` · Shopify #${p.shopify_id}`:" · internal only"}</div>
          {p.storefront_url && <a href={p.storefront_url} target="_blank" style={{color:"#d7b45a"}}>Open storefront ↗</a>}
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"flex-end"}}>
          <button disabled={busy || p.status==="killed"} onClick={()=>removeProduct(p,"archive")} style={secondary}>Archive</button>
          <button disabled={busy} onClick={()=>removeProduct(p,"delete")} style={danger}>Delete permanently</button>
        </div>
      </article>)}
      {!products.length && <div style={{opacity:.65}}>No products found for this organization.</div>}
    </div>
  </main>;
}

const input: React.CSSProperties = {background:"#07130e",border:"1px solid #395945",color:"#f3f2e9",padding:"12px 14px",borderRadius:10,width:"100%"};
const primary: React.CSSProperties = {background:"#d7b45a",color:"#0a140e",fontWeight:800,border:0,borderRadius:10,padding:"12px 16px",cursor:"pointer"};
const secondary: React.CSSProperties = {background:"transparent",color:"#e8e5d6",border:"1px solid #53735e",borderRadius:9,padding:"9px 12px",cursor:"pointer"};
const danger: React.CSSProperties = {background:"#651f1f",color:"white",border:0,borderRadius:9,padding:"9px 12px",cursor:"pointer"};
