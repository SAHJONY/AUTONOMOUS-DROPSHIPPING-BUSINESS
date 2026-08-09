"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./store.module.css";

type Product = {
  id: string;
  title: string;
  description: string;
  price: number;
  image_url?: string;
  storefront_url?: string;
  category: string;
};

type Catalog = {
  connected: boolean;
  shop?: string;
  store_name?: string;
  message?: string;
  products: Product[];
};

const CATEGORIES = [
  { name: "Velas", icon: "✦", copy: "Velas, luces y artículos de devoción del catálogo activo." },
  { name: "Hierbas", icon: "❧", copy: "Hierbas, plantas y preparados disponibles en tienda." },
  { name: "Baños", icon: "≈", copy: "Baños, limpiezas y productos relacionados." },
  { name: "Cascarilla", icon: "◌", copy: "Cascarilla y accesorios del catálogo publicado." },
  { name: "Aceites & Colonias", icon: "◇", copy: "Aceites, perfumes y colonias seleccionadas." },
  { name: "Collares & Idés", icon: "∞", copy: "Collares, idés y accesorios disponibles." },
  { name: "Inciensos", icon: "⌁", copy: "Inciensos, aromas y artículos complementarios." },
  { name: "Imágenes & Estatuas", icon: "△", copy: "Imágenes, estatuas y artículos decorativos." },
];

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export default function BotanicaStore() {
  const [catalog, setCatalog] = useState<Catalog>({ connected: false, products: [] });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");
  const [conciergeOpen, setConciergeOpen] = useState(false);
  const [conciergeText, setConciergeText] = useState("");
  const [conciergeReply, setConciergeReply] = useState("Dime qué estás buscando y te ayudo a encontrarlo en el catálogo real de la tienda.");

  useEffect(() => {
    fetch("/api/storefront/catalog", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setCatalog(data))
      .catch(() => setCatalog({ connected: false, products: [], message: "No pudimos sincronizar el catálogo en este momento." }))
      .finally(() => setLoading(false));
  }, []);

  const products = useMemo(() => {
    const q = normalize(query.trim());
    return catalog.products.filter((product) => {
      const matchesCategory = category === "Todos" || product.category === category;
      const haystack = normalize(`${product.title} ${product.description} ${product.category}`);
      return matchesCategory && (!q || haystack.includes(q));
    });
  }, [catalog.products, query, category]);

  function askConcierge() {
    const request = conciergeText.trim();
    if (!request) return;
    const words = normalize(request).split(/\s+/).filter((word) => word.length > 2);
    const ranked = catalog.products
      .map((product) => {
        const text = normalize(`${product.title} ${product.description} ${product.category}`);
        return { product, score: words.reduce((sum, word) => sum + (text.includes(word) ? 1 : 0), 0) };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    if (!catalog.connected) {
      setConciergeReply("El concierge está listo, pero el catálogo Shopify aún no está publicando productos hacia esta experiencia. Entra al Command Center para completar la sincronización.");
    } else if (!ranked.length) {
      setConciergeReply("No encontré una coincidencia exacta en el inventario publicado. Prueba con el nombre del producto, color, categoría o rango de precio.");
    } else {
      setConciergeReply(`Encontré ${ranked.length} opción${ranked.length > 1 ? "es" : ""}: ${ranked.map(({ product }) => `${product.title} (${money(product.price)})`).join(" · ")}.`);
      setQuery(request);
      setCategory("Todos");
    }
    setConciergeText("");
  }

  return (
    <main className={styles.shell}>
      <nav className={styles.nav}>
        <a className={styles.brand} href="#top" aria-label="Botanica Ochosi home">
          <span className={styles.mark}>O</span>
          <span><strong>BOTANICA</strong><small>OCHOSI</small></span>
        </a>
        <div className={styles.navLinks}>
          <a href="#shop">Tienda</a>
          <a href="#experience">Experiencia</a>
          <a href="/?command=1">Owner OS</a>
        </div>
        <button className={styles.conciergeButton} onClick={() => setConciergeOpen(true)}>Ochosi AI</button>
      </nav>

      <section className={styles.hero} id="top">
        <div className={styles.heroGlow} />
        <div className={styles.kicker}>BOTÁNICA CUBANA · COMERCIO INTELIGENTE</div>
        <h1>Tradición, catálogo real<br /><em>y una nueva experiencia digital.</em></h1>
        <p>
          Descubre productos de BOTANICA OCHOSI con una experiencia bilingüe, búsqueda inteligente y conexión directa al catálogo publicado en Shopify.
        </p>
        <div className={styles.heroActions}>
          <a className={styles.primary} href="#shop">Explorar productos</a>
          <button className={styles.secondary} onClick={() => setConciergeOpen(true)}>Hablar con Ochosi AI</button>
        </div>
        <div className={styles.statusRow}>
          <span className={catalog.connected ? styles.liveDot : styles.syncDot} />
          <span>{loading ? "Sincronizando catálogo…" : catalog.connected ? `Shopify conectado · ${catalog.products.length} productos publicados` : "Catálogo pendiente de sincronización"}</span>
        </div>
      </section>

      <section className={styles.categorySection} id="experience">
        <div className={styles.sectionHead}>
          <span>Explora por intención</span>
          <h2>Una botánica organizada para encontrar rápido lo que buscas.</h2>
        </div>
        <div className={styles.categoryGrid}>
          {CATEGORIES.map((item) => (
            <button key={item.name} className={styles.categoryCard} onClick={() => { setCategory(item.name); document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" }); }}>
              <span className={styles.categoryIcon}>{item.icon}</span>
              <strong>{item.name}</strong>
              <small>{item.copy}</small>
            </button>
          ))}
        </div>
      </section>

      <section className={styles.shop} id="shop">
        <div className={styles.sectionHeadRow}>
          <div className={styles.sectionHead}>
            <span>Catálogo vivo</span>
            <h2>Productos publicados en tu Shopify.</h2>
          </div>
          <div className={styles.searchWrap}>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar velas, hierbas, cascarilla…" />
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option>Todos</option>
              {CATEGORIES.map((item) => <option key={item.name}>{item.name}</option>)}
            </select>
          </div>
        </div>

        {!loading && !catalog.connected && (
          <div className={styles.syncPanel}>
            <span>SHOPIFY SYNC</span>
            <h3>La experiencia pública ya está lista. Falta exponer productos publicados.</h3>
            <p>{catalog.message ?? "Conecta o publica productos desde el Command Center y aparecerán aquí automáticamente."}</p>
            <a href="/?command=1">Abrir Owner Command Center →</a>
          </div>
        )}

        <div className={styles.productGrid}>
          {products.map((product) => (
            <article key={product.id} className={styles.productCard}>
              <div className={styles.imageWrap}>
                {product.image_url ? <img src={product.image_url} alt={product.title} /> : <div className={styles.placeholder}>OCHOSI</div>}
                <span>{product.category}</span>
              </div>
              <div className={styles.productBody}>
                <h3>{product.title}</h3>
                <p>{product.description}</p>
                <div className={styles.productFooter}>
                  <strong>{money(product.price)}</strong>
                  {product.storefront_url ? <a href={product.storefront_url} target="_blank" rel="noreferrer">Comprar →</a> : <span>No disponible</span>}
                </div>
              </div>
            </article>
          ))}
        </div>

        {catalog.connected && !loading && products.length === 0 && (
          <div className={styles.empty}>No encontramos productos con estos filtros.</div>
        )}
      </section>

      <section className={styles.intelligence}>
        <div>
          <span className={styles.miniLabel}>AI COMMERCE OS</span>
          <h2>La tienda es solo la superficie.</h2>
          <p>Detrás operan agentes para producto, proveedores, tienda, marketing, finanzas, soporte, fulfillment y gobierno. Las acciones de riesgo permanecen bajo aprobación del propietario.</p>
        </div>
        <div className={styles.agentGrid}>
          {["CEO", "Product", "Supplier", "Store", "Marketing", "Finance", "Support", "Fulfillment"].map((agent, index) => (
            <div key={agent}><span>{String(index + 1).padStart(2, "0")}</span><strong>{agent}</strong><small>Agent</small></div>
          ))}
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.brand}><span className={styles.mark}>O</span><span><strong>BOTANICA</strong><small>OCHOSI</small></span></div>
        <p>Productos y contenido sujetos a disponibilidad. La información cultural se presenta con respeto y no sustituye orientación religiosa de una casa o practicante cualificado.</p>
        <a href="/?command=1">Owner Command Center</a>
      </footer>

      {conciergeOpen && (
        <div className={styles.overlay} onClick={() => setConciergeOpen(false)}>
          <aside className={styles.concierge} onClick={(event) => event.stopPropagation()}>
            <div className={styles.conciergeHead}>
              <div><span>OCHOSI AI</span><strong>Concierge</strong></div>
              <button onClick={() => setConciergeOpen(false)}>×</button>
            </div>
            <div className={styles.reply}>{conciergeReply}</div>
            <div className={styles.promptBox}>
              <textarea value={conciergeText} onChange={(event) => setConciergeText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); askConcierge(); } }} placeholder="Ej.: busco velas blancas por menos de $20" />
              <button onClick={askConcierge}>Buscar</button>
            </div>
            <small className={styles.disclaimer}>El concierge busca únicamente en el catálogo publicado; no inventa disponibilidad ni precio.</small>
          </aside>
        </div>
      )}
    </main>
  );
}
