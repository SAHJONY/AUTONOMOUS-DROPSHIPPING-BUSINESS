import styles from "../owner.module.css";
import {
  BOTANICA_COMPETITIVE_PRICE_PLAYBOOK,
  BOTANICA_QUANTITY_TIERS,
  COMPETITIVE_PRICE_REVIEWED_AT,
  priceAtDiscount,
} from "@/lib/botanica-competitive-price-playbook";

const money = (value: number) => new Intl.NumberFormat("en-US", { style:"currency", currency:"USD" }).format(value);
const actionLabel = { LOWER:"LOWER TEST", KEEP:"KEEP", RAISE:"RAISE TEST", SEGMENT:"SEGMENT" } as const;

export default function CompetitivePricingPage() {
  const priced = BOTANICA_COMPETITIVE_PRICE_PLAYBOOK.filter(row => row.targetRetailPriceUsd !== null);
  const reductions = priced.filter(row => row.action === "LOWER").length;
  const increases = priced.filter(row => row.action === "RAISE").length;

  return <main className={styles.shell}>
    <nav className={styles.nav}>
      <a className={styles.brand} href="/owner"><span className={styles.mark}>O</span><span className={styles.brandText}><strong>BOTANICA</strong><small>OCHOSI</small></span></a>
      <div className={styles.navLinks}><a className={styles.ghost} href="/owner/supplier-catalogs">Catálogos</a><a className={styles.primary} href="/owner">Owner OS</a></div>
    </nav>
    <div className={styles.content}>
      <section className={styles.hero}>
        <div className={styles.kicker}>INTELIGENCIA COMPETITIVA · REVISIÓN OWNER</div>
        <h1>Precios con <em>ventaja justa.</em></h1>
        <p>Objetivos públicos para competir sin convertir la autenticidad en una guerra de descuentos. Ningún precio cambia Shopify automáticamente: primero debe comprobar costo puesto en almacén, inventario y el piso de margen de 35%.</p>
        <div className={styles.heroActions}><a className={styles.primary} href="/owner/supplier-catalogs">Validar costos reales</a><a className={styles.ghost} href="https://www.afrocaribebotanica.com/wholesale" target="_blank" rel="noreferrer">Abrir referencia Afro Caribe ↗</a></div>
      </section>

      <div className={styles.statusStrip}>
        <span className={styles.statusPill}>{BOTANICA_COMPETITIVE_PRICE_PLAYBOOK.length} productos revisados</span>
        <span className={styles.statusPill}>{reductions} pruebas de reducción</span>
        <span className={styles.statusPill}>{increases} oportunidades de margen</span>
        <span className={styles.statusPill}>Revisado {COMPETITIVE_PRICE_REVIEWED_AT}</span>
        <span className={styles.statusPill}>Shopify · sin cambios automáticos</span>
      </div>

      <section className={styles.section}>
        <div className={styles.sectionHead}><div><span>PRECIO OBJETIVO</span><h2>Playbook por producto.</h2><p>Los rangos son evidencia pública comparable, no cotizaciones mayoristas. Revalida antes de aprobar cualquier cambio.</p></div></div>
        <div className={styles.productList}>{BOTANICA_COMPETITIVE_PRICE_PLAYBOOK.map(row => <article className={`${styles.card} ${styles.productRow}`} key={row.id}>
          <div>
            <div className={styles.kicker}>{actionLabel[row.action]} · {row.category}</div>
            <h2>{row.product}</h2>
            <div className={styles.productMeta}>Actual <strong>{money(row.currentPriceUsd)}</strong> · Objetivo <strong>{row.targetRetailPriceUsd === null ? "separar por calidad" : money(row.targetRetailPriceUsd)}</strong>{row.marketLowUsd !== undefined ? ` · Mercado público ${money(row.marketLowUsd)}–${money(row.marketHighUsd ?? row.marketLowUsd)}` : ""}</div>
            <p>{row.rationale}</p>
          </div>
          <a className={styles.ghost} href={row.sourceUrl} target="_blank" rel="noreferrer">Ver evidencia ↗</a>
        </article>)}</div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}><div><span>MAYOREO REAL</span><h2>Descuentos por cantidad.</h2><p>Ejemplo calculado con la vela Orisha a $7.49. Los productos importados, frágiles o hechos a mano pueden requerir descuentos menores.</p></div></div>
        <div className={styles.actionGrid}>{BOTANICA_QUANTITY_TIERS.map(tier => <article className={styles.card} key={tier.label}>
          <div className={styles.kicker}>{tier.minimumQuantity}–{tier.maximumQuantity} UNIDADES</div>
          <h2>{tier.label}</h2>
          <div className={styles.metricValue}>{money(priceAtDiscount(7.49, tier.discountPercent))}</div>
          <p>Por unidad · {tier.discountPercent}% de descuento</p>
        </article>)}<article className={styles.card}><div className={styles.kicker}>48+ UNIDADES</div><h2>Distribuidor</h2><div className={styles.metricValue}>Cotizar</div><p>Precio basado en costo, caja, flete y mezcla de SKU verificados.</p></article></div>
      </section>

      <section className={`${styles.card} ${styles.migration}`}>
        <div className={styles.kicker}>CONTROL FINANCIERO</div><h2>No aprobar por intuición.</h2>
        <p>Retail debe buscar 55–60% de margen bruto; mayoreo 30–40%; frágiles y líquidos al menos 40% para absorber roturas y reclamaciones. El Consejo comercial del sistema mantiene un piso absoluto de 35%.</p>
        <a className={styles.primary} href="/owner/profit-calculator">Abrir calculadora de utilidad</a>
      </section>
      <footer className={styles.footer}><span>BOTANICA OCHOSI · Competitive Pricing</span><a href="/owner">← Volver a Owner OS</a></footer>
    </div>
  </main>;
}
