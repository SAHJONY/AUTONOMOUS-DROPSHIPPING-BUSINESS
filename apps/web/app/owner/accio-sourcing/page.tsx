"use client";

import { useEffect, useMemo, useState } from "react";
import { ACCIO_OWNER_RULES, assessAccioCandidate, type AccioCandidate } from "@/lib/accio-sourcing";
import styles from "../owner.module.css";

const blank: AccioCandidate = {
  quoteReference: "", supplierName: "", supplierProfileUrl: "", ownerVerifiedQuote: false,
  wholesalePrice: 0, shippingCost: 0, handlingCost: 0, markupPercent: 100, currency: "USD", usdExchangeRate: 1, moq: 1,
  supplierProcessingDays: 0, importTransitDays: 0, handlingDays: 0, customerShippingDays: 0,
  inventoryStatus: "UNKNOWN", inventoryVerifiedAt: "", resaleAuthorizationStatus: "PENDING", authorizationReference: "",
  sampleOrderAvailable: false, samplePriceUsd: 0, freightMode: "PER_UNIT",
};

const numbers: Array<[keyof AccioCandidate, string, string]> = [
  ["wholesalePrice", "Precio unitario del proveedor", "0.01"], ["moq", "MOQ (unidades mínimas)", "1"],
  ["shippingCost", "Flete de importación", "0.01"], ["handlingCost", "Manejo por unidad", "0.01"],
  ["markupPercent", "Margen aplicado (%)", "1"], ["usdExchangeRate", "Tipo de cambio a USD", "0.0001"],
  ["supplierProcessingDays", "Días de producción", "1"], ["importTransitDays", "Días de tránsito", "1"],
  ["handlingDays", "Días de manejo", "1"], ["customerShippingDays", "Días de envío al cliente", "1"],
  ["samplePriceUsd", "Precio de la muestra (USD)", "0.01"],
];

const texts: Array<[keyof AccioCandidate, string, string]> = [
  ["quoteReference", "Referencia de cotización Accio", "ACCIO-2026-0001"],
  ["supplierName", "Proveedor", "Nombre en el perfil de Alibaba"],
  ["supplierProfileUrl", "Enlace del perfil del proveedor", "https://www.alibaba.com/company/…"],
  ["inventoryVerifiedAt", "Fecha de verificación de inventario", "2026-08-12"],
  ["authorizationReference", "Evidencia de autorización de reventa", "archivo / correo / contrato"],
];

const routeCopy: Record<string, { title: string; note: string }> = {
  ORDER_FUNDED: { title: "Financiable por pedido", note: "Cobra al cliente primero y compra después. No requiere capital propio." },
  INVENTORY_REQUIRED: { title: "Requiere capital propio", note: "Alibaba exige el lote completo por adelantado. Fuera del modelo financiado por pedido." },
  REJECTED: { title: "No apta", note: "Resuelve los puntos señalados antes de comprometer dinero." },
};

export default function AccioSourcingPage() {
  const [input, setInput] = useState(blank), [ready, setReady] = useState(false), [authorized, setAuthorized] = useState(false);
  useEffect(() => { setAuthorized(Boolean(localStorage.getItem("commerce_os_token") && localStorage.getItem("commerce_os_org"))); setReady(true); }, []);
  const result = useMemo(() => assessAccioCandidate(input), [input]);
  const copy = routeCopy[result.route];

  if (!ready) return <main className={styles.shell}><div className={styles.content}><div className={styles.result}>Verificando acceso Owner…</div></div></main>;
  if (!authorized) return <main className={styles.shell}><div className={styles.content}><div className={styles.error}><strong>Acceso privado requerido.</strong><p>Inicia sesión como propietario.</p><a className={styles.primary} href="/owner/login">Iniciar sesión</a></div></div></main>;

  return <main className={styles.shell}><nav className={styles.nav}><a className={styles.brand} href="/owner"><span className={styles.mark}>O</span><span className={styles.brandText}><strong>BOTANICA</strong><small>OCHOSI</small></span></a><div className={styles.navLinks}><a className={styles.ghost} href="/owner/supplier-catalogs">Catálogos</a><a className={styles.primary} href="/owner">Owner OS</a></div></nav><div className={styles.content}>
    <section className={styles.hero}><div className={styles.kicker}>ABASTECIMIENTO ACCIO · OWNER</div><h1>Cotizaciones de <em>Accio Work.</em></h1><p>Accio Work es una aplicación de escritorio que tú operas: busca proveedores en Alibaba, envía consultas y consolida cotizaciones. No tiene API de servidor, así que nada aquí se conecta a Accio. Pega la cotización que traes y decide qué significa para este negocio.</p></section>

    <section className={styles.section}><div className={styles.card}><div className={styles.form}>
      {texts.map(([key, label, placeholder]) => <label key={key}>{label}<input className={styles.input} type="text" placeholder={placeholder} value={String(input[key] ?? "")} onChange={event => setInput({ ...input, [key]: event.target.value })} /></label>)}
      <label>Moneda<input className={styles.input} type="text" value={input.currency} onChange={event => setInput({ ...input, currency: event.target.value })} /></label>
      {numbers.map(([key, label, step]) => <label key={key}>{label}<input className={styles.input} type="number" min="0" step={step} value={Number(input[key]) || ""} onChange={event => setInput({ ...input, [key]: Number(event.target.value) })} /></label>)}
      <label>Cómo cotizó el flete<select className={styles.input} value={input.freightMode ?? "PER_UNIT"} onChange={event => setInput({ ...input, freightMode: event.target.value as "PER_UNIT" | "PER_SHIPMENT" })}><option value="PER_UNIT">Por unidad (aéreo)</option><option value="PER_SHIPMENT">Por embarque completo (marítimo o consolidado)</option></select></label>
      <label>Inventario<select className={styles.input} value={input.inventoryStatus} onChange={event => setInput({ ...input, inventoryStatus: event.target.value })}><option value="UNKNOWN">Sin verificar</option><option value="IN_STOCK">Verificado en existencia</option></select></label>
      <label>Autorización de reventa<select className={styles.input} value={input.resaleAuthorizationStatus} onChange={event => setInput({ ...input, resaleAuthorizationStatus: event.target.value })}><option value="PENDING">Pendiente</option><option value="VERIFIED">Verificada</option></select></label>
      <label>Muestra disponible<select className={styles.input} value={input.sampleOrderAvailable ? "yes" : "no"} onChange={event => setInput({ ...input, sampleOrderAvailable: event.target.value === "yes" })}><option value="no">No</option><option value="yes">Sí</option></select></label>
      <label>Verifiqué esta cotización en el perfil del proveedor<select className={styles.input} value={input.ownerVerifiedQuote ? "yes" : "no"} onChange={event => setInput({ ...input, ownerVerifiedQuote: event.target.value === "yes" })}><option value="no">No</option><option value="yes">Sí</option></select></label>
    </div></div></section>

    <div className={result.route === "ORDER_FUNDED" ? styles.result : styles.error}><strong>{copy.title}.</strong> {copy.note}</div>

    <section className={styles.metricGrid}>
      <Metric label="Costo puesto en almacén" value={result.landedUnitCostUsd} />
      <Metric label="Precio de venta" value={result.retailPriceUsd} />
      <Metric label="Utilidad por unidad" value={result.retailProfitPerUnitUsd} />
      <Metric label="Margen" value={result.retailMarginPercent} percent />
      <Metric label="Capital requerido" value={result.capitalRequiredUsd} />
      <Metric label="Utilidad del lote" value={result.retailProfitPerSupplierOrderUsd} />
    </section>

    {result.route === "INVENTORY_REQUIRED" && <section className={styles.metricGrid}>
      <Metric label="Unidades para recuperar capital" value={result.unitsToRecoverCapital} raw />
      <Metric label="Venta necesaria del lote" value={result.breakEvenSellThroughPercent} percent />
      <Metric label="Plazo total (días)" value={result.totalDays} raw />
    </section>}

    {result.disqualifiers.length > 0 && <section className={styles.section}><div className={styles.card}><h2>Puntos a resolver</h2><ul>{result.disqualifiers.map(item => <li key={item}>{item}</li>)}</ul></div></section>}
    {result.actions.length > 0 && <section className={styles.section}><div className={styles.card}><h2>Siguientes pasos</h2><ul>{result.actions.map(item => <li key={item}>{item}</li>)}</ul></div></section>}

    <section className={styles.section}><div className={styles.card}><h2>Reglas de operación con Accio</h2><ul>{ACCIO_OWNER_RULES.map(rule => <li key={rule}>{rule}</li>)}</ul></div></section>
  </div></main>;
}

function Metric({ label, value, percent = false, raw = false }: { label: string; value: number; percent?: boolean; raw?: boolean }) {
  return <article className={styles.card}><div className={styles.metricLabel}>{label}</div><div className={styles.metricValue}>{percent ? `${value.toFixed(1)}%` : raw ? String(value) : `$${value.toFixed(2)}`}</div><div className={styles.metricNote}>USD · cálculo interno</div></article>;
}
