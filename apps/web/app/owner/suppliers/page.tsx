"use client";

import styles from "../owner.module.css";

type Supplier = {
  name: string;
  market: string;
  region: string;
  focus: string;
  channel: string;
  status: "PENDING REVIEW" | "FALLBACK";
  priority: number;
  url: string;
};

const suppliers: Supplier[] = [
  { name:"Monzon Botanica", market:"Miami / Hialeah", region:"Florida, USA", focus:"Afro-Cuban · Yoruba · Lucumi · botanica wholesale", channel:"Wholesale / distributor", status:"PENDING REVIEW", priority:1, url:"https://monzonbotanica.com" },
  { name:"Yoruba Distribuidores LLC", market:"Houston", region:"Texas, USA", focus:"Yoruba · Santeria · Espiritismo", channel:"B2B wholesale", status:"PENDING REVIEW", priority:2, url:"https://yorubadistribuidores.com" },
  { name:"El Viejo Lazaro", market:"Miami", region:"Florida, USA", focus:"Lucumi · Yoruba · Ocha tools and botanica goods", channel:"Wholesale / retail", status:"PENDING REVIEW", priority:3, url:"https://www.viejolazaro.com" },
  { name:"INSHE Miami", market:"Miami / Hialeah / Miami Gardens", region:"Florida, USA", focus:"Yoruba · Afro-Cuban · African spiritual goods", channel:"Wholesale / retail", status:"PENDING REVIEW", priority:4, url:"https://www.inshemiami.com" },
  { name:"Yoruba Imports", market:"Miami", region:"Florida, USA", focus:"West African sourced religious and cultural goods", channel:"Wholesale / importer", status:"PENDING REVIEW", priority:5, url:"https://yorubaimports.com" },
  { name:"Botanica Nena", market:"Miami", region:"Florida, USA", focus:"Santeria · Yoruba · Lucumi · Ifa · Ocha", channel:"Retail / wholesale candidate", status:"PENDING REVIEW", priority:6, url:"https://botanicanena.com" },
  { name:"CJdropshipping", market:"International", region:"Fallback", focus:"Generic complementary products only", channel:"Dropshipping", status:"FALLBACK", priority:90, url:"https://www.cjdropshipping.com" },
  { name:"Zendrop", market:"USA / International", region:"Fallback", focus:"Generic complementary products only", channel:"Dropshipping", status:"FALLBACK", priority:91, url:"https://www.zendrop.com" },
  { name:"Spocket", market:"USA / International", region:"Fallback", focus:"Generic complementary products only", channel:"Dropshipping", status:"FALLBACK", priority:92, url:"https://www.spocket.co" },
  { name:"AliExpress", market:"International", region:"Fallback", focus:"Generic complementary products only", channel:"Marketplace", status:"FALLBACK", priority:99, url:"https://www.aliexpress.com" },
];

export default function OwnerSuppliersPage() {
  return <main className={styles.shell}>
    <nav className={styles.nav}>
      <a className={styles.brand} href="/owner"><span className={styles.mark}>O</span><span className={styles.brandText}><strong>BOTANICA</strong><small>OCHOSI</small></span></a>
      <div className={styles.navLinks}><a className={styles.ghost} href="/owner">Owner OS</a><a className={styles.primary} href="/owner/catalog">Catalog Control</a></div>
    </nav>
    <div className={styles.content}>
      <section className={styles.hero}>
        <div className={styles.kicker}>SUPPLIER INTELLIGENCE · USA FIRST</div>
        <h1>Supplier <em>Registry.</em></h1>
        <p>Cuban BOTANICA sourcing prioritizes Miami, Hialeah and Houston before national or international fallback channels. A listing here is not purchasing approval: wholesale terms, landed cost, inventory, provenance and fulfillment must be verified before status can become APPROVED.</p>
      </section>
      <div className={styles.statusStrip}>
        <span className={styles.statusPill}>Miami / Hialeah · PRIORITY</span>
        <span className={styles.statusPill}>Houston · PRIORITY</span>
        <span className={styles.statusPill}>USA · BEFORE IMPORT</span>
        <span className={styles.statusPill}>Autonomous purchasing · LOCKED</span>
      </div>
      <section className={styles.section}>
        <div className={styles.sectionHead}><div><span>Source locally first</span><h2>Cuban botanica wholesale candidates.</h2></div></div>
        <div className={styles.actionGrid}>
          {suppliers.map((s) => <div className={styles.card} key={s.name}>
            <div className={styles.kicker}>PRIORITY {s.priority} · {s.status}</div>
            <h2>{s.name}</h2>
            <p><strong>{s.market}</strong> · {s.region}</p>
            <p>{s.focus}</p>
            <p>{s.channel}</p>
            <a className={styles.ghost} href={s.url} target="_blank" rel="noreferrer">Review supplier</a>
          </div>)}
        </div>
      </section>
      <section className={styles.section}>
        <div className={styles.card}><div className={styles.kicker}>APPROVAL GATE</div><h2>No supplier is approved by listing alone.</h2><p>Required evidence: wholesale account eligibility, MOQ, unit cost, shipping and lead time, inventory, returns, product provenance and expected landed margin. Supplier Agent recommendations remain advisory and cannot authorize spending.</p></div>
      </section>
    </div>
  </main>;
}
