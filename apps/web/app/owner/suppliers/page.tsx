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
  wholesaleEvidence: string;
  pricing: "EXPLICIT WHOLESALE" | "WHOLESALE VERIFIED · PRICE GATED" | "PUBLIC LIST PRICE · WHOLESALE BY QUOTE" | "FALLBACK";
  minimum?: string;
  priceExamples?: string[];
};

const suppliers: Supplier[] = [
  {
    name:"Monzon Brothers II / Monzon Botanica", market:"Miami / Hialeah", region:"Florida, USA",
    focus:"Afro-Cuban · Yoruba · Lucumi · botanica distributor", channel:"Wholesale / distributor", status:"PENDING REVIEW", priority:1,
    url:"https://monzonbotanica.com", pricing:"PUBLIC LIST PRICE · WHOLESALE BY QUOTE",
    wholesaleEvidence:"Site states wholesale purchases are available, but instructs buyers to call for wholesale pricing. Public web prices are treated as list/retail evidence only.",
    priceExamples:["Cascarilla · public list $23.99","Plato esmaltado 8in · public list $3.99","Caracol de Cobo large · public list $19.99"]
  },
  {
    name:"Herramientas de Santeria", market:"Miami", region:"Florida, USA",
    focus:"Stainless-steel Santeria / Orisha tools", channel:"Manufacturer / wholesale", status:"PENDING REVIEW", priority:2,
    url:"https://herramientasdesanteria.com", pricing:"EXPLICIT WHOLESALE", minimum:"$400 minimum order",
    wholesaleEvidence:"Product pages publish both retail and wholesale prices and state a $400 minimum purchase.",
    priceExamples:["Oba stainless-steel tool · retail $110 · wholesale $66"]
  },
  {
    name:"Pedro Yoruba Jewelry", market:"Miami", region:"Florida, USA",
    focus:"Handmade Orisha tools · stainless steel · silver · gold", channel:"Miami manufacturer / wholesale", status:"PENDING REVIEW", priority:3,
    url:"https://pedrojewelryyoruba.com/mayoreo", pricing:"WHOLESALE VERIFIED · PRICE GATED",
    wholesaleEvidence:"Dedicated mayoreo page says the Miami workshop supplies botanicas at wholesale pricing; exact wholesale catalog and minimums are provided on request.",
    priceExamples:["Stainless-steel tools shown from $60 on wholesale page","Oshun stainless-steel oars shown $70","San Lazaro crutches shown $160"]
  },
  {
    name:"Yoruba Distribuidores LLC", market:"Houston", region:"Texas, USA",
    focus:"Yoruba · Santeria · Espiritismo", channel:"B2B wholesale only", status:"PENDING REVIEW", priority:4,
    url:"https://yorubadistribuidores.com", pricing:"WHOLESALE VERIFIED · PRICE GATED",
    wholesaleEvidence:"Site explicitly states WHOLESALE ONLY for registered botanicas and resellers, with 300+ products and US shipping. Product pages commonly use quote/gated pricing rather than usable public unit cost.",
  },
  {
    name:"Babonsono Imports LLC", market:"United States", region:"USA",
    focus:"Botanica · Santeria · incense · soaps · iron pots · charms", channel:"Wholesale only B2B", status:"PENDING REVIEW", priority:5,
    url:"https://www.babonsono.com", pricing:"EXPLICIT WHOLESALE", minimum:"$100 minimum order",
    wholesaleEvidence:"Supplier states wholesale-only B2B and requires a resale certificate or business license; wholesale storefront exposes unit/case pricing.",
    priceExamples:["IHC Incense Sticks Sandalwood 12-pack · $10.95","IHC Incense Sticks Jasmine 12-pack · $10.95"]
  },
  {
    name:"Bulk Santeria", market:"United States", region:"USA",
    focus:"Traditional herbs · incense · oils · Santeria botanica goods", channel:"Wholesale only", status:"PENDING REVIEW", priority:6,
    url:"https://bulksanteria.com", pricing:"EXPLICIT WHOLESALE", minimum:"$250 order minimum",
    wholesaleEvidence:"Website is marked Wholesale Only and publishes product pricing; herbs, incense and oils are made to order with stated processing lead time.",
    priceExamples:["Pinon de Botija / Jatropha Curcas · 16 oz · $75"]
  },
  {
    name:"Tsuen May Trading", market:"United States", region:"USA",
    focus:"Botanica · religious-use cascarilla and general spiritual merchandise", channel:"Wholesale only B2B", status:"PENDING REVIEW", priority:7,
    url:"https://www.tsuenmay.com", pricing:"WHOLESALE VERIFIED · PRICE GATED", minimum:"$100 minimum order",
    wholesaleEvidence:"Site explicitly states wholesale orders only, no retail/personal orders, requires business registration, and labels catalog pricing as wholesale.",
    priceExamples:["Cascarilla · 100 pieces/box · wholesale-only product listing"]
  },
  {
    name:"Unilite Candles", market:"Houston", region:"Texas, USA",
    focus:"Religious · esoteric · prepared and plain candles", channel:"Wholesale only", status:"PENDING REVIEW", priority:8,
    url:"https://www.unilitecc.com", pricing:"WHOLESALE VERIFIED · PRICE GATED", minimum:"24 boxes of candles",
    wholesaleEvidence:"Houston manufacturer/distributor identifies itself as wholesale only and publishes a 24-box minimum; prices require wholesale ordering flow.",
  },
  {
    name:"El Viejo Lazaro", market:"Miami", region:"Florida, USA",
    focus:"Lucumi · Yoruba · Ocha tools and botanica goods", channel:"Wholesale / retail", status:"PENDING REVIEW", priority:9,
    url:"https://www.viejolazaro.com", pricing:"WHOLESALE VERIFIED · PRICE GATED",
    wholesaleEvidence:"Site explicitly states wholesale and retail service for the Lucumi religious community and a 4,000+ product catalog; wholesale unit pricing is not reliably public.",
  },
  {
    name:"INSHE Miami", market:"Miami / Hialeah / Miami Gardens", region:"Florida, USA",
    focus:"Yoruba · Afro-Cuban · African spiritual goods", channel:"Wholesale / retail", status:"PENDING REVIEW", priority:10,
    url:"https://www.inshemiami.com", pricing:"PUBLIC LIST PRICE · WHOLESALE BY QUOTE",
    wholesaleEvidence:"Supplier operates South Florida botanica locations and sells to businesses; visible web prices are treated as public list prices until B2B terms are obtained.",
    priceExamples:["Peregun Criollo fresh top · public list $5.99","Mariwo natural · public list $9.99","Seso Vegetal · public list $3.99"]
  },
  {
    name:"Yoruba Imports", market:"Miami Gardens", region:"Florida, USA",
    focus:"West African religious · cultural goods · plants", channel:"Wholesale / importer", status:"PENDING REVIEW", priority:11,
    url:"https://yorubaimports.com", pricing:"PUBLIC LIST PRICE · WHOLESALE BY QUOTE",
    wholesaleEvidence:"Site advertises a wholesale program and direct sourcing. Public prices are retained as market-reference prices, not assumed wholesale costs.",
    priceExamples:["Opon Ife large · public list $150","Edun Ara / Sango thunder stone · public list $7","Orogbo bitter kola · public list $10","Obi Abata fresh kola nuts · public list $30"]
  },
  { name:"CJdropshipping", market:"International", region:"Fallback", focus:"Generic complementary products only", channel:"Dropshipping", status:"FALLBACK", priority:90, url:"https://www.cjdropshipping.com", pricing:"FALLBACK", wholesaleEvidence:"Not approved for core Cuban BOTANICA sourcing." },
  { name:"Zendrop", market:"USA / International", region:"Fallback", focus:"Generic complementary products only", channel:"Dropshipping", status:"FALLBACK", priority:91, url:"https://www.zendrop.com", pricing:"FALLBACK", wholesaleEvidence:"Not approved for core Cuban BOTANICA sourcing." },
  { name:"Spocket", market:"USA / International", region:"Fallback", focus:"Generic complementary products only", channel:"Dropshipping", status:"FALLBACK", priority:92, url:"https://www.spocket.co", pricing:"FALLBACK", wholesaleEvidence:"Not approved for core Cuban BOTANICA sourcing." },
  { name:"AliExpress", market:"International", region:"Fallback", focus:"Generic complementary products only", channel:"Marketplace", status:"FALLBACK", priority:99, url:"https://www.aliexpress.com", pricing:"FALLBACK", wholesaleEvidence:"Not approved for core Cuban BOTANICA sourcing." },
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
        <p>Cuban BOTANICA sourcing prioritizes Miami, Hialeah and Houston before national or international fallback channels. Pricing evidence is classified conservatively: public list prices are never treated as wholesale costs unless the supplier explicitly identifies them as wholesale.</p>
      </section>
      <div className={styles.statusStrip}>
        <span className={styles.statusPill}>Miami / Hialeah · PRIORITY</span>
        <span className={styles.statusPill}>Houston · PRIORITY</span>
        <span className={styles.statusPill}>USA · BEFORE IMPORT</span>
        <span className={styles.statusPill}>Autonomous purchasing · LOCKED</span>
      </div>
      <section className={styles.section}>
        <div className={styles.sectionHead}><div><span>Verified sourcing evidence</span><h2>Cuban botanica wholesale candidates.</h2></div></div>
        <div className={styles.actionGrid}>
          {suppliers.map((s) => <div className={styles.card} key={s.name}>
            <div className={styles.kicker}>PRIORITY {s.priority} · {s.status}</div>
            <h2>{s.name}</h2>
            <p><strong>{s.market}</strong> · {s.region}</p>
            <p>{s.focus}</p>
            <p>{s.channel}</p>
            <p><strong>Pricing evidence:</strong> {s.pricing}</p>
            {s.minimum && <p><strong>Minimum:</strong> {s.minimum}</p>}
            <p>{s.wholesaleEvidence}</p>
            {!!s.priceExamples?.length && <div className={styles.productMeta}>{s.priceExamples.map((item) => <div key={item}>• {item}</div>)}</div>}
            <a className={styles.ghost} href={s.url} target="_blank" rel="noreferrer">Review verified website</a>
          </div>)}
        </div>
      </section>
      <section className={styles.section}>
        <div className={styles.card}><div className={styles.kicker}>APPROVAL GATE</div><h2>Website verification is not purchasing approval.</h2><p>Required evidence before APPROVED: wholesale account eligibility, current quote, MOQ, unit/case cost, shipping and lead time, inventory, returns, provenance and expected landed margin. Public list prices remain reference-only. Supplier Agent recommendations cannot authorize spending.</p></div>
      </section>
    </div>
  </main>;
}
