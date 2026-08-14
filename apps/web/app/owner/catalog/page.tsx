"use client";

import { ClipboardEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { BOTANICA_STORE_CATEGORIES } from "@/lib/botanica-store-categories";
import styles from "../owner.module.css";

type Product = { id:string; title:string; description:string; category?:string; cost:number; price:number; status:string; source?:string; supplier?:string; supplier_url?:string; supplier_sku?:string; supplier_contact?:string; country_of_origin?:string; provenance_notes?:string; reorder_url?:string; reorder_moq?:number; reorder_case_pack?:number; reorder_lead_time_days?:number; provenance_verified_at?:string; shopify_id?:number; storefront_url?:string; sku?:string; inventory_quantity?:number; inventory_policy?:"deny"|"continue"; image_url?:string; images?:string[]; video_url?:string; audio_url?:string };
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
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploadStatus, setUploadStatus] = useState("");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

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
  useEffect(() => {
    const urls = selectedImages.map((file) => URL.createObjectURL(file));
    setImagePreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [selectedImages]);

  function pasteProductMedia(event: ClipboardEvent<HTMLElement>) {
    const pastedImages = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));
    if (!pastedImages.length) return;
    event.preventDefault();
    setSelectedImages((current) => [...current, ...pastedImages].slice(0, 8));
    setUploadStatus(`${pastedImages.length} imagen${pastedImages.length === 1 ? " pegada" : "es pegadas"} desde el portapapeles.`);
  }

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
    e.preventDefault(); setBusy(true); setError(""); setUploadStatus(""); const formElement=e.currentTarget; const form = new FormData(formElement);
    try {
      const oid = await resolveOrg(); if (!oid) throw new Error("Owner organization could not be resolved.");
      let images = String(form.get("images") ?? "").split(/\n|,/).map((v) => v.trim()).filter(Boolean);
      if (selectedImages.length) {
        setUploadStatus(`Subiendo ${selectedImages.length} imagen${selectedImages.length===1?"":"es"}…`);
        const uploadForm = new FormData(); selectedImages.forEach((file) => uploadForm.append("images", file));
        const uploadResponse = await fetch(`/api/orgs/${oid}/owner-catalog/images`, { method:"POST", headers:token?{Authorization:`Bearer ${token}`}:{}, body:uploadForm });
        const uploadBody = await uploadResponse.json().catch(() => ({}));
        if (!uploadResponse.ok) throw new Error(uploadBody.detail ?? `Image upload failed (${uploadResponse.status})`);
        images = [...(uploadBody.images ?? []).map((image:{url:string}) => image.url), ...images].slice(0, 8);
        setUploadStatus("Imágenes cargadas. Guardando producto…");
      }
      const res = await fetch(`/api/orgs/${oid}/owner-catalog`, { method:"POST", headers, body:JSON.stringify({
        title:form.get("title"), description:form.get("description"), supplier:form.get("supplier"), supplier_url:form.get("supplier_url"), supplier_sku:form.get("supplier_sku"), supplier_contact:form.get("supplier_contact"), country_of_origin:form.get("country_of_origin"), provenance_notes:form.get("provenance_notes"), reorder_url:form.get("reorder_url"), reorder_moq:Number(form.get("reorder_moq") ?? 1), reorder_case_pack:Number(form.get("reorder_case_pack") ?? 1), reorder_lead_time_days:Number(form.get("reorder_lead_time_days") ?? 0), provenance_verified_at:form.get("provenance_verified_at"), video_url:form.get("video_url"), audio_url:form.get("audio_url"),
        sku:form.get("sku"), product_type:form.get("product_type"), cost:Number(form.get("cost") ?? 0), price:Number(form.get("price") ?? 0),
        images, inventory_quantity:Number(form.get("inventory_quantity") ?? 0), inventory_policy:form.get("inventory_policy"), sync_shopify:form.get("sync_shopify") === "on", publish:form.get("publish") === "on",
      }) });
      const body = await res.json().catch(() => ({})); if (!res.ok) throw new Error(body.detail ?? `Request failed (${res.status})`);
      formElement.reset(); setSelectedImages([]); setUploadStatus("Producto guardado en el catálogo nativo."); await refresh(); await refreshDiagnostics();
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); } finally { setBusy(false); }
  }

  async function saveProductEdits(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!editingProduct) return;
    setBusy(true); setError(""); const form = new FormData(e.currentTarget);
    try {
      const oid = await resolveOrg(); if (!oid) throw new Error("Owner organization could not be resolved.");
      const res = await fetch(`/api/orgs/${oid}/owner-catalog`, { method:"PATCH", headers, body:JSON.stringify({
        product_id:editingProduct.id, title:form.get("title"), sku:form.get("sku"), category:form.get("category"), description:form.get("description"),
        supplier:form.get("supplier"), supplier_url:form.get("supplier_url"), supplier_sku:form.get("supplier_sku"), supplier_contact:form.get("supplier_contact"), country_of_origin:form.get("country_of_origin"), provenance_notes:form.get("provenance_notes"), reorder_url:form.get("reorder_url"), reorder_moq:Number(form.get("reorder_moq") ?? 1), reorder_case_pack:Number(form.get("reorder_case_pack") ?? 1), reorder_lead_time_days:Number(form.get("reorder_lead_time_days") ?? 0), provenance_verified_at:form.get("provenance_verified_at"), cost:Number(form.get("cost") ?? 0), price:Number(form.get("price") ?? 0),
        inventory_quantity:Number(form.get("inventory_quantity") ?? 0), inventory_policy:form.get("inventory_policy"), video_url:form.get("video_url"), audio_url:form.get("audio_url"),
        images:String(form.get("images") ?? "").split(/\n|,/).map((value) => value.trim()).filter(Boolean),
      }) });
      const body = await res.json().catch(() => ({})); if (!res.ok) throw new Error(body.detail ?? `Request failed (${res.status})`);
      setProducts((current) => current.map((item) => item.id === editingProduct.id ? body.product : item)); setEditingProduct(null);
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
      <a className={styles.brand} href="/shop"><span className={styles.mark}>O</span><span className={styles.brandText}><strong>BOTANICA</strong><small>OCHOSI</small></span></a>
      <div className={styles.navLinks}><a className={`${styles.ghost} ${styles.hideMobile}`} href="/owner">Owner OS</a><a className={styles.primary} href="/shop">Tienda nativa</a></div>
    </nav>
    <div className={styles.content}>
      <section className={styles.hero}><div className={styles.kicker}>CATÁLOGO NATIVO · SHOPIFY OPCIONAL</div><h1>Añade y administra <em>productos.</em></h1><p>Sube imágenes desde tu teléfono o computadora, escribe la información, fija precio e inventario y publica directamente en tu tienda.</p><div className={styles.heroActions}><a className={styles.primary} href="#add-product">+ Añadir producto</a><a className={styles.ghost} href="/shop" target="_blank" rel="noreferrer">Ver tienda ↗</a><button className={styles.ghost} onClick={() => void refresh()} disabled={busy || !token}>Importar Shopify</button><a className={styles.ghost} href="/owner/native-store">Configurar tienda</a></div></section>
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

      <section className={styles.section} id="add-product">
        <div className={styles.sectionHead}><div><span>NUEVO PRODUCTO</span><h2>Sube imágenes, información y precio.</h2><p>Marca “Publicar” para mostrarlo inmediatamente en la tienda.</p></div></div>
        <form onSubmit={addProduct} onPaste={pasteProductMedia} className={`${styles.card} ${styles.form}`}>
          <div className={`${styles.result} ${styles.full}`} tabIndex={0} role="region" aria-label="Zona para pegar información e imágenes">
            <strong>Copiar y pegar activado</strong><div className={styles.productMeta}>Pega texto normalmente en cualquier campo. Para añadir fotos copiadas, haz clic aquí o dentro del formulario y presiona Ctrl+V en Windows o ⌘V en Mac.</div>
          </div>
          <label>Nombre del producto *<input className={styles.input} name="title" required placeholder="Ej. Vela espiritual blanca 7 días"/></label><label>SKU<input className={styles.input} name="sku" placeholder="Ej. VELA-7D-BLANCA"/></label><label>Categoría *<select className={styles.input} name="product_type" required defaultValue=""><option value="" disabled>Seleccionar categoría</option>{BOTANICA_STORE_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
          <label>Proveedor<input className={styles.input} name="supplier" placeholder="Nombre del proveedor"/></label><label>URL del proveedor<input className={styles.input} name="supplier_url" type="url" placeholder="https://…"/></label><label>Costo para ti<input className={styles.input} name="cost" type="number" min="0" step="0.01" placeholder="0.00"/></label>
          <div className={`${styles.result} ${styles.full}`}><strong>Procedencia y recompra</strong><div className={styles.productMeta}>Información privada para identificar el origen y volver a pedir el producto rápidamente.</div></div>
          <label>SKU del proveedor<input className={styles.input} name="supplier_sku" placeholder="Código usado por el proveedor"/></label><label>País o lugar de origen<input className={styles.input} name="country_of_origin" placeholder="Ej. Estados Unidos, Nigeria, Cuba"/></label><label>Contacto del proveedor<input className={styles.input} name="supplier_contact" placeholder="Email, teléfono o representante"/></label>
          <label className={styles.full}>Enlace directo para volver a ordenar<input className={styles.input} name="reorder_url" type="url" placeholder="https://… página exacta del producto o portal mayorista"/></label>
          <label>Pedido mínimo (MOQ)<input className={styles.input} name="reorder_moq" type="number" min="1" step="1" defaultValue="1"/></label><label>Unidades por caja<input className={styles.input} name="reorder_case_pack" type="number" min="1" step="1" defaultValue="1"/></label><label>Tiempo del proveedor (días)<input className={styles.input} name="reorder_lead_time_days" type="number" min="0" step="1" defaultValue="0"/></label>
          <label>Procedencia verificada<input className={styles.input} name="provenance_verified_at" type="date"/></label><label className={styles.full}>Notas de procedencia<textarea className={styles.textarea} name="provenance_notes" placeholder="Fabricante, materiales, autorización de reventa, factura, catálogo y evidencia para futuras compras."/></label>
          <label>Precio de venta *<input className={styles.input} name="price" type="number" min="0.01" step="0.01" required placeholder="0.00"/></label><label>Inventario *<input className={styles.input} name="inventory_quantity" type="number" min="0" step="1" required defaultValue="1"/></label><label>Cuando se agote<select className={styles.input} name="inventory_policy" defaultValue="deny"><option value="deny">Detener ventas</option><option value="continue">Permitir pedidos pendientes</option></select></label>
          <label className={styles.full}>Descripción<textarea className={styles.textarea} name="description" placeholder="Escribe o pega aquí la descripción, tamaño, contenido, presentación e instrucciones del producto."/></label>
          <label className={styles.full}>Video del producto (opcional)<input className={styles.input} name="video_url" type="url" placeholder="https://… enlace directo a video MP4 o WebM"/></label>
          <label className={styles.full}>Audio del producto (opcional)<input className={styles.input} name="audio_url" type="url" placeholder="https://… archivo MP3, WAV u OGG"/></label>
          <label className={styles.full}>Imágenes del producto *<input className={styles.input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple required={selectedImages.length===0} onChange={(event) => setSelectedImages(Array.from(event.target.files ?? []).slice(0,8))}/><small>Sube archivos o copia y pega imágenes dentro de este formulario · hasta 8 imágenes · JPG, PNG, WebP o GIF · máximo 5 MB cada una.</small></label>
          {!!imagePreviews.length && <div className={styles.full} style={{display:"flex",gap:12,flexWrap:"wrap"}}>{imagePreviews.map((url,index) => <img key={url} src={url} alt={`Vista previa ${index+1}`} style={{width:96,height:96,objectFit:"cover",borderRadius:12}}/>)}</div>}
          <details className={styles.full}><summary>Opcional: usar URLs de imágenes</summary><textarea className={styles.textarea} name="images" placeholder="Una URL por línea"/></details>
          <label className={styles.full}><input type="checkbox" name="publish" defaultChecked/> Publicar inmediatamente en la tienda nativa.</label><label className={styles.full}><input type="checkbox" name="sync_shopify"/> También crear este producto en Shopify (opcional).</label>
          {uploadStatus && <div className={`${styles.result} ${styles.full}`}>{uploadStatus}</div>}
          <div className={styles.full}><button disabled={busy} className={styles.primary}>{busy ? "Subiendo y guardando…" : "Guardar producto"}</button></div>
        </form>
      </section>

      {editingProduct && <section className={styles.section} id="edit-product">
        <div className={styles.sectionHead}><div><span>EDITOR COMPLETO</span><h2>Editar {editingProduct.title}</h2><p>Actualiza toda la información nativa del producto en un solo lugar.</p></div><button className={styles.ghost} onClick={() => setEditingProduct(null)}>Cancelar</button></div>
        <form onSubmit={saveProductEdits} className={`${styles.card} ${styles.form}`}>
          <label>Nombre *<input className={styles.input} name="title" required defaultValue={editingProduct.title}/></label><label>SKU<input className={styles.input} name="sku" defaultValue={editingProduct.sku}/></label><label>Categoría *<select className={styles.input} name="category" required defaultValue={editingProduct.category}>{BOTANICA_STORE_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label>
          <label>Proveedor<input className={styles.input} name="supplier" defaultValue={editingProduct.supplier}/></label><label>URL del proveedor<input className={styles.input} name="supplier_url" type="url" defaultValue={editingProduct.supplier_url}/></label><label>Costo<input className={styles.input} name="cost" type="number" min="0" step="0.01" defaultValue={editingProduct.cost}/></label>
          <div className={`${styles.result} ${styles.full}`}><strong>Procedencia y recompra</strong><div className={styles.productMeta}>Estos datos permanecen privados en el sistema del propietario.</div></div>
          <label>SKU del proveedor<input className={styles.input} name="supplier_sku" defaultValue={editingProduct.supplier_sku}/></label><label>País o lugar de origen<input className={styles.input} name="country_of_origin" defaultValue={editingProduct.country_of_origin}/></label><label>Contacto del proveedor<input className={styles.input} name="supplier_contact" defaultValue={editingProduct.supplier_contact}/></label>
          <label className={styles.full}>Enlace directo para volver a ordenar<input className={styles.input} name="reorder_url" type="url" defaultValue={editingProduct.reorder_url}/></label><label>Pedido mínimo (MOQ)<input className={styles.input} name="reorder_moq" type="number" min="1" step="1" defaultValue={editingProduct.reorder_moq ?? 1}/></label><label>Unidades por caja<input className={styles.input} name="reorder_case_pack" type="number" min="1" step="1" defaultValue={editingProduct.reorder_case_pack ?? 1}/></label><label>Tiempo del proveedor (días)<input className={styles.input} name="reorder_lead_time_days" type="number" min="0" step="1" defaultValue={editingProduct.reorder_lead_time_days ?? 0}/></label><label>Procedencia verificada<input className={styles.input} name="provenance_verified_at" type="date" defaultValue={editingProduct.provenance_verified_at}/></label><label className={styles.full}>Notas de procedencia<textarea className={styles.textarea} name="provenance_notes" defaultValue={editingProduct.provenance_notes}/></label>
          <label>Precio *<input className={styles.input} name="price" type="number" min="0.01" step="0.01" required defaultValue={editingProduct.price}/></label><label>Inventario<input className={styles.input} name="inventory_quantity" type="number" min="0" step="1" defaultValue={editingProduct.inventory_quantity ?? 0}/></label><label>Cuando se agote<select className={styles.input} name="inventory_policy" defaultValue={editingProduct.inventory_policy ?? "deny"}><option value="deny">Detener ventas</option><option value="continue">Permitir pedidos pendientes</option></select></label>
          <label className={styles.full}>Descripción<textarea className={styles.textarea} name="description" defaultValue={editingProduct.description}/></label><label className={styles.full}>URLs de imágenes<textarea className={styles.textarea} name="images" defaultValue={(editingProduct.images ?? []).join("\n")} placeholder="Una URL por línea"/></label>
          <label className={styles.full}>Video<input className={styles.input} name="video_url" type="url" defaultValue={editingProduct.video_url} placeholder="https://…"/></label><label className={styles.full}>Audio<input className={styles.input} name="audio_url" type="url" defaultValue={editingProduct.audio_url} placeholder="https://…"/></label>
          <div className={styles.full}><button disabled={busy} className={styles.primary}>{busy ? "Guardando…" : "Guardar todos los cambios"}</button></div>
        </form>
      </section>}

      <section className={styles.section}>
        <div className={styles.sectionHead}><div><span>REORDER DESK</span><h2>Procedencia y recompra.</h2><p>Acceso privado y rápido a las fuentes guardadas para reponer inventario.</p></div></div>
        <div className={styles.productList}>{products.map((p) => <article key={`reorder-${p.id}`} className={`${styles.card} ${styles.productRow}`}><div><h2>{p.title}</h2><div className={styles.productMeta}>{p.supplier || "Proveedor no registrado"}{p.supplier_sku ? ` · SKU ${p.supplier_sku}` : ""}{p.country_of_origin ? ` · origen ${p.country_of_origin}` : ""} · MOQ {p.reorder_moq ?? 1} · caja {p.reorder_case_pack ?? 1}{p.reorder_lead_time_days ? ` · ${p.reorder_lead_time_days} días` : ""}{p.provenance_verified_at ? ` · verificado ${p.provenance_verified_at}` : " · procedencia sin verificar"}</div>{p.provenance_notes && <p>{p.provenance_notes}</p>}</div><div className={styles.rowActions}>{p.reorder_url ? <a className={styles.primary} href={p.reorder_url} target="_blank" rel="noreferrer">Volver a ordenar ↗</a> : <button className={styles.ghost} onClick={() => { setEditingProduct(p); requestAnimationFrame(() => document.getElementById("edit-product")?.scrollIntoView({behavior:"smooth"})); }}>Añadir fuente</button>}</div></article>)}</div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}><div><span>MANAGED INVENTORY</span><h2>Catalog records.</h2></div><button className={styles.ghost} onClick={() => void refresh()} disabled={busy}>Refresh</button></div>
        <div className={styles.productList}>{products.map((p) => <article key={p.id} className={`${styles.card} ${styles.productRow}`}><div><div className={styles.kicker}>{p.source === "shopify_import" ? "IMPORTED · NOW OWNED LOCALLY" : "NATIVE PRODUCT"}</div><h2>{p.title}</h2><div className={styles.productMeta}>{p.status} · ${Number(p.price || 0).toFixed(2)} retail · ${Number(p.cost || 0).toFixed(2)} cost · inventory {p.inventory_quantity ?? "untracked"} {p.shopify_id ? `· Shopify #${p.shopify_id}` : "· Shopify independent"}{p.video_url ? " · video" : ""}{p.audio_url ? " · audio" : ""}</div>{p.storefront_url && <a className={styles.footer} href={p.storefront_url} target="_blank" rel="noreferrer">Open Shopify copy ↗</a>}</div><div className={styles.rowActions}><button disabled={busy} onClick={() => { setEditingProduct(p); requestAnimationFrame(() => document.getElementById("edit-product")?.scrollIntoView({behavior:"smooth"})); }} className={styles.primary}>Edit all details</button><button disabled={busy} onClick={() => void updateNativeProduct(p,"price")} className={styles.ghost}>Price</button><button disabled={busy} onClick={() => void updateNativeProduct(p,"inventory")} className={styles.ghost}>Inventory</button><button disabled={busy || p.status === "killed"} onClick={() => void updateNativeProduct(p,"publish")} className={styles.primary}>{p.status === "launched" ? "Unpublish" : "Publish"}</button><button disabled={busy || p.status === "killed"} onClick={() => void removeProduct(p,"archive")} className={styles.ghost}>Archive</button><button disabled={busy} onClick={() => void removeProduct(p,"delete")} className={styles.danger}>Delete permanently</button></div></article>)}{!products.length && <div className={styles.empty}>No products found for this organization.</div>}</div>
      </section>
      <footer className={styles.footer}><span>BOTANICA OCHOSI Owner Catalog</span><a href="/owner">← Back to Owner OS</a></footer>
    </div>
  </main>;
}
