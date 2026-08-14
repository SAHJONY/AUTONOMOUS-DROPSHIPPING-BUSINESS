"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { FactoryRecipe, FactorySnapshot, ProductionOrder } from "@/lib/botanica-factory";
import { recipeEconomics } from "@/lib/factory-economics";
import styles from "../owner.module.css";

const EMPTY: FactorySnapshot = { materials: [], recipes: [], orders: [] };
type BomDraftLine = { id: number; materialId: string; quantity: string; wastePercent: string };

export default function FactoryPage() {
  const [token, setToken] = useState("");
  const [orgId, setOrgId] = useState("");
  const [data, setData] = useState<FactorySnapshot>(EMPTY);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [bomLines, setBomLines] = useState<BomDraftLine[]>([{ id: 1, materialId: "", quantity: "1", wastePercent: "3" }]);
  useEffect(() => { setToken(localStorage.getItem("commerce_os_token") ?? ""); setOrgId(localStorage.getItem("commerce_os_org") ?? ""); }, []);
  const headers = useMemo(() => ({ "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }), [token]);

  async function resolveOrg() {
    if (orgId) return orgId;
    const response = await fetch("/api/orgs", { headers });
    if (!response.ok) return "";
    const orgs = await response.json(); const id = orgs?.[0]?.id ?? "";
    if (id) { setOrgId(id); localStorage.setItem("commerce_os_org", id); }
    return id;
  }
  async function refresh() {
    const id = await resolveOrg(); if (!id) return;
    const response = await fetch(`/api/orgs/${id}/factory`, { headers, cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.detail ?? `Factory request failed (${response.status})`);
    setData(body);
  }
  useEffect(() => { if (token) void refresh().catch((cause) => setError(cause instanceof Error ? cause.message : String(cause))); }, [token]);

  async function submit(action: string, form: HTMLFormElement, payload: Record<string, unknown>) {
    setBusy(true); setError(""); setNotice("");
    try {
      const id = await resolveOrg(); if (!id) throw new Error("Owner organization could not be resolved.");
      const response = await fetch(`/api/orgs/${id}/factory`, { method: "POST", headers, body: JSON.stringify({ action, ...payload }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail ?? `Factory request failed (${response.status})`);
      form.reset(); setNotice(action === "add_material" ? "Materia prima registrada." : action === "add_recipe" ? "Producto fabricable y BOM registrados." : action === "create_order" ? `Orden creada: ${body.lotCode}` : `Lote ${body.lotCode} liberado por calidad.`); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); } finally { setBusy(false); }
  }

  const inventoryValue = data.materials.reduce((sum, item) => sum + item.quantityOnHand * item.unitCost, 0);
  const releasedUnits = data.orders.filter((item) => item.status === "RELEASED").reduce((sum, item) => sum + item.quantityProduced, 0);
  const lowStock = data.materials.filter((item) => item.quantityOnHand <= item.reorderPoint);

  return <main className={styles.shell}>
    <nav className={styles.nav}><a className={styles.brand} href="/owner"><span className={styles.mark}>O</span><span className={styles.brandText}><strong>BOTANICA</strong><small>FÁBRICA OCHOSI</small></span></a><div className={styles.navLinks}><a className={styles.ghost} href="/owner/catalog">Catálogo</a><a className={styles.primary} href="/owner">Owner OS</a></div></nav>
    <div className={styles.content}>
      <section className={styles.hero}><div className={styles.kicker}>MICROFÁBRICA · TRAZABILIDAD DE PRINCIPIO A FIN</div><h1>Produce con <em>control.</em></h1><p>Administra materias primas, BOM, costos reales, órdenes, lotes y liberación de calidad. Los productos de riesgo regulatorio permanecen bloqueados hasta revisión.</p><div className={styles.statusStrip}><span className={styles.statusPill}><span className={styles.dotLive}/>Producción de bajo riesgo habilitada</span><span className={styles.statusPill}><span className={styles.dotWarn}/>Cosméticos y líquidos requieren revisión</span></div></section>
      {!token && <div className={styles.error}>Inicia sesión como Owner para operar la fábrica. <a className={styles.primary} href="/owner/login">Iniciar sesión</a></div>}
      {error && <div className={styles.error}>{error}</div>}{notice && <div className={styles.result}>{notice}</div>}

      <section className={styles.metricGrid}><Metric label="Materias primas" value={String(data.materials.length)} note={`${lowStock.length} para reordenar`}/><Metric label="Productos propios" value={String(data.recipes.filter((item) => item.active).length)} note="BOM activas"/><Metric label="Órdenes" value={String(data.orders.length)} note="producción documentada"/><Metric label="Unidades liberadas" value={String(releasedUnits)} note="aprobadas por QC"/><Metric label="Valor de materiales" value={`$${inventoryValue.toFixed(2)}`} note="costo registrado"/><Metric label="Riesgo" value={data.recipes.some((item) => item.risk !== "LOW") ? "HOLD" : "LOW"} note="fail-closed"/></section>

      <section className={styles.section}><div className={styles.sectionHead}><div><span>PASO 1 · RECEPCIÓN</span><h2>Registrar materia prima.</h2><p>Guarda proveedor, procedencia, lote, costo y punto de reorden antes de producir.</p></div></div>
        <form className={`${styles.card} ${styles.form}`} onSubmit={(event) => addMaterial(event, submit)}>
          <label>Nombre *<input className={styles.input} name="name" required placeholder="Ej. Cuentas azules 8 mm"/></label><label>SKU interno *<input className={styles.input} name="sku" required placeholder="MAT-CUENTA-AZUL-8"/></label><label>Unidad<select className={styles.input} name="unit"><option value="unit">unidad</option><option value="piece">pieza</option><option value="oz">onza</option><option value="ft">pie</option><option value="yard">yarda</option></select></label>
          <label>Proveedor<input className={styles.input} name="supplier"/></label><label>SKU proveedor<input className={styles.input} name="supplierSku"/></label><label>Procedencia<input className={styles.input} name="countryOfOrigin" placeholder="País o ciudad"/></label>
          <label>Costo por unidad *<input className={styles.input} name="unitCost" type="number" min="0" step="0.0001" required/></label><label>Cantidad recibida *<input className={styles.input} name="quantityOnHand" type="number" min="0" step="0.01" required/></label><label>Punto de reorden<input className={styles.input} name="reorderPoint" type="number" min="0" step="0.01" defaultValue="0"/></label>
          <label>Lote proveedor<input className={styles.input} name="lotCode"/></label><label>Expiración, si aplica<input className={styles.input} name="expiresAt" type="date"/></label><div className={styles.rowActions}><button className={styles.primary} disabled={busy}>Guardar material</button></div>
        </form>
      </section>

      <section className={styles.section}><div className={styles.sectionHead}><div><span>PASO 2 · FÓRMULA, BOM Y MÉTODO</span><h2>Documentar cómo se fabrica.</h2><p>Añade todos los componentes y registra el método exacto, herramientas, seguridad, limpieza, rendimiento y control de calidad.</p></div></div>
        <form className={`${styles.card} ${styles.form}`} onSubmit={(event) => addRecipe(event, submit, bomLines)}>
          <label>Producto *<input className={styles.input} name="name" required placeholder="Ej. Ildé Ochosi no consagrado"/></label><label>SKU *<input className={styles.input} name="sku" required placeholder="BO-ILDE-OCH-01"/></label><label>Categoría<input className={styles.input} name="category" defaultValue="ILDE/BRACELETS"/></label>
          <label>Clasificación<select className={styles.input} name="risk" defaultValue="LOW"><option value="LOW">Bajo riesgo · autorizado</option><option value="REVIEW_REQUIRED">Revisión regulatoria</option><option value="BLOCKED_AT_HOME">Bloqueado en residencia</option></select></label><label>Precio retail *<input className={styles.input} name="retailPrice" type="number" min="0.01" step="0.01" required/></label><label>Rendimiento estándar del lote<input className={styles.input} name="batchYield" type="number" min="1" step="1" defaultValue="1"/></label>
          <div className={`${styles.result} ${styles.full}`}><strong>Fórmula de materiales por unidad</strong><div className={styles.productMeta}>Incluye materias primas, accesorios, envase, inserto y cualquier componente consumido.</div></div>
          {bomLines.map((line, index) => <div className={`${styles.card} ${styles.full}`} key={line.id}><div className={styles.form}><label>Componente {index + 1} *<select className={styles.input} required value={line.materialId} onChange={(event) => setBomLines((current) => current.map((item) => item.id === line.id ? { ...item, materialId: event.target.value } : item))}><option value="" disabled>Seleccionar material</option>{data.materials.map((item) => <option key={item.id} value={item.id}>{item.sku} · {item.name} · {item.unit}</option>)}</select></label><label>Cantidad por unidad *<input className={styles.input} type="number" min="0.0001" step="0.0001" required value={line.quantity} onChange={(event) => setBomLines((current) => current.map((item) => item.id === line.id ? { ...item, quantity: event.target.value } : item))}/></label><label>Desperdicio %<input className={styles.input} type="number" min="0" step="0.1" value={line.wastePercent} onChange={(event) => setBomLines((current) => current.map((item) => item.id === line.id ? { ...item, wastePercent: event.target.value } : item))}/></label></div>{bomLines.length > 1 && <button className={styles.danger} type="button" onClick={() => setBomLines((current) => current.filter((item) => item.id !== line.id))}>Eliminar componente</button>}</div>)}
          <div className={`${styles.full} ${styles.rowActions}`}><button className={styles.ghost} type="button" onClick={() => setBomLines((current) => [...current, { id: Math.max(0, ...current.map((item) => item.id)) + 1, materialId: "", quantity: "1", wastePercent: "3" }])}>+ Añadir componente</button></div>
          <label>Trabajo (minutos)<input className={styles.input} name="laborMinutes" type="number" min="0" step="1" defaultValue="10"/></label>
          <label>Tarifa trabajo/hora<input className={styles.input} name="laborRateHourly" type="number" min="0" step="0.01" defaultValue="15"/></label><label>Empaque<input className={styles.input} name="packagingCost" type="number" min="0" step="0.01" defaultValue="0"/></label><label>Etiqueta<input className={styles.input} name="labelCost" type="number" min="0" step="0.01" defaultValue="0"/></label>
          <label>Overhead/unidad<input className={styles.input} name="overheadCost" type="number" min="0" step="0.01" defaultValue="0"/></label><label className={styles.full}>Herramientas, una por línea<textarea className={styles.textarea} name="tools" required placeholder={"Mesa limpia\nBandeja de conteo\nTijeras"}/></label><label className={styles.full}>Fabricación paso a paso, un paso por línea<textarea className={styles.textarea} name="manufacturingSteps" required placeholder={"Verificar la orden y la versión de fórmula\nLimpiar y preparar el puesto\nContar y ensamblar los componentes\nInspeccionar, etiquetar y empacar"}/></label>
          <label className={styles.full}>Seguridad, una instrucción por línea<textarea className={styles.textarea} name="safetyInstructions" required defaultValue={"Usar solamente materiales aprobados y trazables\nMantener el puesto libre de alimentos y bebidas\nDetener la producción si un material está dañado o sin identificar"}/></label><label className={styles.full}>Limpieza antes y después, una instrucción por línea<textarea className={styles.textarea} name="cleaningInstructions" required defaultValue={"Retirar materiales de la producción anterior\nLimpiar y secar mesa y herramientas\nDesechar residuos en el recipiente identificado\nRegistrar la limpieza al cerrar el lote"}/></label><label className={styles.full}>Almacenamiento del producto terminado<textarea className={styles.textarea} name="storageInstructions" required defaultValue="Almacenar limpio, seco, cerrado, identificado por lote y separado de materiales rechazados."/></label>
          <label className={styles.full}>Declaración de etiqueta<input className={styles.input} name="labelStatement" defaultValue="No consagrado / no preparado ceremonialmente."/></label><label className={styles.full}>Control de calidad, una verificación por línea<textarea className={styles.textarea} name="qcChecklist" defaultValue={"Componentes y colores correctos\nEnsamblaje resistente\nCantidad y etiqueta verificadas\nEmpaque limpio y sin daños"}/></label>
          <div className={`${styles.full} ${styles.rowActions}`}><button className={styles.primary} disabled={busy || !data.materials.length}>Guardar BOM</button></div>
        </form>
      </section>

      <section className={styles.section}><div className={styles.sectionHead}><div><span>PASO 3 · PRODUCCIÓN</span><h2>Crear orden y lote.</h2></div></div><div className={styles.split}>
        <form className={`${styles.card} ${styles.form}`} onSubmit={(event) => createOrder(event, submit)}><label className={styles.full}>Producto *<select className={styles.input} name="recipeId" required defaultValue=""><option value="" disabled>Seleccionar BOM autorizada</option>{data.recipes.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.sku} · {item.name} · {item.risk}</option>)}</select></label><label>Cantidad *<input className={styles.input} name="quantityPlanned" type="number" min="1" step="1" required defaultValue="3"/></label><label>Operador<input className={styles.input} name="operator"/></label><label className={styles.full}>Notas<textarea className={styles.textarea} name="notes"/></label><div className={`${styles.full} ${styles.rowActions}`}><button className={styles.primary} disabled={busy}>Crear orden</button></div></form>
        <div className={styles.card}><div className={styles.kicker}>GATE DE SEGURIDAD</div><h2>Producción bloqueada por defecto.</h2><p>Solo BOM clasificadas LOW pueden generar lotes. El inventario se descuenta al liberar el lote después de control de calidad.</p>{lowStock.map((item) => <div className={styles.check} key={item.id}><strong className={styles.warning}>REORDENAR · {item.name}</strong><small>{item.quantityOnHand} {item.unit} disponibles · punto {item.reorderPoint}</small></div>)}</div>
      </div></section>

      <section className={styles.section}><div className={styles.sectionHead}><div><span>PASO 4 · CALIDAD Y LIBERACIÓN</span><h2>Lotes de producción.</h2></div></div><div className={styles.productList}>{data.orders.map((order) => <OrderRow key={order.id} order={order} recipe={data.recipes.find((item) => item.id === order.recipeId)} busy={busy} submit={submit}/>) }{!data.orders.length && <div className={styles.empty}>Todavía no hay órdenes. Registra materiales y una BOM para producir el primer lote piloto.</div>}</div></section>

      <section className={styles.section}><div className={styles.sectionHead}><div><span>FÓRMULAS MAESTRAS Y COSTOS</span><h2>Cómo se fabrica cada producto.</h2></div></div><div className={styles.productList}>{data.recipes.map((recipe) => { const economics = recipeEconomics(recipe, data.materials); return <article className={styles.card} key={recipe.id}><div className={styles.sectionHead}><div><div className={styles.kicker}>{recipe.sku} · FÓRMULA V{recipe.version} · {recipe.risk}</div><h2>{recipe.name}</h2><div className={styles.productMeta}>Rendimiento estándar {recipe.batchYield ?? 1} · materiales ${economics.materialCost.toFixed(2)} · trabajo ${economics.laborCost.toFixed(2)} · costo total <strong>${economics.unitCost.toFixed(2)}</strong> · retail ${recipe.retailPrice.toFixed(2)} · margen <strong>{economics.grossMargin.toFixed(2)}%</strong></div></div><span className={recipe.risk === "LOW" ? styles.ok : styles.warning}>{recipe.risk === "LOW" ? "FABRICABLE" : "HOLD"}</span></div><details><summary>Ver fórmula e instrucciones completas</summary><h3>Componentes por unidad</h3>{recipe.lines.map((line, index) => { const material = data.materials.find((item) => item.id === line.materialId); return <div className={styles.check} key={`${recipe.id}-${line.materialId}-${index}`}><strong>{material?.name ?? "Material no encontrado"}</strong><small>{line.quantity} {material?.unit ?? "unidad"} · desperdicio {line.wastePercent}% · lote disponible {material?.lotCode || "sin registrar"}</small></div>; })}<h3>Herramientas</h3><Numbered items={recipe.tools ?? []}/><h3>Fabricación paso a paso</h3><Numbered items={recipe.manufacturingSteps ?? []}/><h3>Seguridad</h3><Numbered items={recipe.safetyInstructions ?? []}/><h3>Limpieza</h3><Numbered items={recipe.cleaningInstructions ?? []}/><h3>Control de calidad</h3><Numbered items={recipe.qcChecklist ?? []}/><h3>Almacenamiento y etiqueta</h3><p>{recipe.storageInstructions}</p><p>{recipe.labelStatement}</p></details></article>; })}{!data.recipes.length && <div className={styles.empty}>No hay fórmulas maestras configuradas.</div>}</div></section>
      <footer className={styles.footer}><span>BOTANICA OCHOSI · Factory OS</span><a href="/owner">← Owner OS</a></footer>
    </div>
  </main>;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) { return <div className={styles.card}><div className={styles.metricLabel}>{label}</div><div className={styles.metricValue}>{value}</div><div className={styles.metricNote}>{note}</div></div>; }

function values(form: HTMLFormElement) { return Object.fromEntries(new FormData(form).entries()); }
function addMaterial(event: FormEvent<HTMLFormElement>, submit: (action: string, form: HTMLFormElement, payload: Record<string, unknown>) => Promise<void>) { event.preventDefault(); const form = event.currentTarget; void submit("add_material", form, values(form)); }
function addRecipe(event: FormEvent<HTMLFormElement>, submit: (action: string, form: HTMLFormElement, payload: Record<string, unknown>) => Promise<void>, bomLines: BomDraftLine[]) { event.preventDefault(); const form = event.currentTarget; const row = values(form); void submit("add_recipe", form, { ...row, lines: bomLines, tools: lines(row.tools), manufacturingSteps: lines(row.manufacturingSteps), safetyInstructions: lines(row.safetyInstructions), cleaningInstructions: lines(row.cleaningInstructions), qcChecklist: lines(row.qcChecklist) }); }
function createOrder(event: FormEvent<HTMLFormElement>, submit: (action: string, form: HTMLFormElement, payload: Record<string, unknown>) => Promise<void>) { event.preventDefault(); const form = event.currentTarget; void submit("create_order", form, values(form)); }

function OrderRow({ order, recipe, busy, submit }: { order: ProductionOrder; recipe?: FactoryRecipe; busy: boolean; submit: (action: string, form: HTMLFormElement, payload: Record<string, unknown>) => Promise<void> }) {
  return <article className={styles.card}><div className={styles.sectionHead}><div><div className={styles.kicker}>{order.lotCode} · {order.status}</div><h2>{recipe?.name ?? "Producto no encontrado"}</h2><div className={styles.productMeta}>Plan {order.quantityPlanned} · producidas {order.quantityProduced} · rechazadas {order.quantityRejected} · operador {order.operator || "pendiente"}</div></div></div>{order.status !== "RELEASED" ? <form className={styles.form} onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; void submit("release_order", form, { ...values(form), orderId: order.id }); }}><label>Unidades aprobadas *<input className={styles.input} name="quantityProduced" type="number" min="1" max={order.quantityPlanned} required defaultValue={order.quantityPlanned}/></label><label>Rechazadas<input className={styles.input} name="quantityRejected" type="number" min="0" max={order.quantityPlanned} defaultValue="0"/></label><label>Aprobado por QC *<input className={styles.input} name="qcApprovedBy" required/></label><label className={styles.full}>Notas QC<textarea className={styles.textarea} name="notes"/></label><div className={`${styles.full} ${styles.rowActions}`}><button className={styles.primary} disabled={busy}>Aprobar y liberar lote</button></div></form> : <div className={styles.ok}>LIBERADO · {order.qcApprovedBy} · {order.releasedAt.slice(0, 10)}</div>}</article>;
}

function lines(value: unknown) { return String(value ?? "").split("\n").map((item) => item.trim()).filter(Boolean); }
function Numbered({ items }: { items: string[] }) { return items.length ? <ol>{items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ol> : <p className={styles.warning}>Información pendiente.</p>; }
