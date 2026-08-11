"use client";

import { useEffect, useMemo, useState } from "react";
import { calculateDealProfit, type DealProfitInput } from "@/lib/deal-profit";
import styles from "../owner.module.css";

const blank: DealProfitInput = { quantity: 1, unitPrice: 0, unitCost: 0, supplierShipping: 0, customerShipping: 0, handling: 0, paymentFeePercent: 3, advertising: 0, taxesAndDuties: 0, otherCosts: 0 };
const fields: Array<[keyof DealProfitInput, string, string]> = [
  ["quantity", "Cantidad", "1"], ["unitPrice", "Precio de venta por unidad", "0.01"], ["unitCost", "Costo de mercancía por unidad", "0.01"],
  ["supplierShipping", "Envío del proveedor (total)", "0.01"], ["customerShipping", "Envío al cliente (total)", "0.01"], ["handling", "Manejo y empaque (total)", "0.01"],
  ["paymentFeePercent", "Comisión de pago (%)", "0.01"], ["advertising", "Publicidad atribuida", "0.01"], ["taxesAndDuties", "Aranceles e impuestos", "0.01"], ["otherCosts", "Otros costos", "0.01"],
];

export default function ProfitCalculatorPage() {
  const [input, setInput] = useState(blank), [ready, setReady] = useState(false), [authorized, setAuthorized] = useState(false);
  useEffect(() => {
    setAuthorized(Boolean(localStorage.getItem("commerce_os_token") && localStorage.getItem("commerce_os_org")));
    const params = new URLSearchParams(window.location.search);
    setInput(current => ({ ...current, unitPrice: Number(params.get("price")) || 0, unitCost: Number(params.get("cost")) || 0, supplierShipping: Number(params.get("shipping")) || 0, handling: Number(params.get("handling")) || 0 }));
    setReady(true);
  }, []);
  const result = useMemo(() => calculateDealProfit(input), [input]);
  if (!ready) return <main className={styles.shell}><div className={styles.content}><div className={styles.result}>Verificando acceso Owner…</div></div></main>;
  if (!authorized) return <main className={styles.shell}><div className={styles.content}><div className={styles.error}><strong>Acceso privado requerido.</strong><p>Inicia sesión como propietario.</p><a className={styles.primary} href="/owner/login">Iniciar sesión</a></div></div></main>;
  return <main className={styles.shell}><nav className={styles.nav}><a className={styles.brand} href="/owner"><span className={styles.mark}>O</span><span className={styles.brandText}><strong>BOTANICA</strong><small>OCHOSI</small></span></a><div className={styles.navLinks}><a className={styles.ghost} href="/owner/supplier-catalogs">Catálogos</a><a className={styles.primary} href="/owner">Owner OS</a></div></nav><div className={styles.content}>
    <section className={styles.hero}><div className={styles.kicker}>FINANZAS PRIVADAS · OWNER</div><h1>Calculadora de <em>utilidad.</em></h1><p>Evalúa productos, pedidos mayoristas y negociaciones antes de aprobarlos. Todos los importes se calculan en USD.</p></section>
    <section className={styles.section}><div className={styles.card}><div className={styles.form}>{fields.map(([key,label,step])=><label key={key}>{label}<input className={styles.input} type="number" min="0" step={step} value={input[key]||""} onChange={event=>setInput({...input,[key]:Number(event.target.value)})}/></label>)}</div></div></section>
    <section className={styles.metricGrid}><Metric label="Ingresos" value={result.revenue}/><Metric label="Costos totales" value={result.totalCosts}/><Metric label="Utilidad neta" value={result.netProfit}/><Metric label="Margen" value={result.marginPercent} percent/><Metric label="Utilidad por unidad" value={result.profitPerUnit}/><Metric label="Punto de equilibrio/unidad" value={result.breakEvenUnitPrice}/></section>
    <div className={result.netProfit>=0?styles.result:styles.error}><strong>{result.netProfit>=0?"Negocio rentable según estos datos.":"Esta operación produce pérdida."}</strong> Verifica costos, aranceles y comisiones reales antes de aprobar.</div>
  </div></main>;
}

function Metric({label,value,percent=false}:{label:string;value:number;percent?:boolean}) { return <article className={styles.card}><div className={styles.metricLabel}>{label}</div><div className={styles.metricValue}>{percent?`${value.toFixed(2)}%`:`$${value.toFixed(2)}`}</div><div className={styles.metricNote}>USD · cálculo interno</div></article>; }
