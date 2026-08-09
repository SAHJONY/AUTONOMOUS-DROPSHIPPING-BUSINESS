"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./shop.module.css";

type Product = {
  id: string;
  variantId: string;
  title: string;
  variantTitle?: string | null;
  description: string;
  category: string;
  vendor: string;
  price: number;
  compareAtPrice?: number | null;
  image?: string | null;
  handle: string;
  productUrl: string;
};

type CartLine = Product & { quantity: number };

type CatalogResponse = {
  ok: boolean;
  shop: string | null;
  products: Product[];
  count?: number;
  detail?: string;
};

const SITE_URL = "https://www.botanicaochosi.com";
const CART_KEY = "botanica_ochosi_cart_v1";

export default function ShopPage() {
  const [catalog, setCatalog] = useState<CatalogResponse>({ ok: false, shop: null, products: [] });
  const [cart, setCart] = useState<CartLine[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");
  const [cartOpen, setCartOpen] = useState(false);
  const [shareNotice, setShareNotice] = useState("");

  useEffect(() => {
    fetch("/api/public/catalog", { cache: "no-store" })
      .then(async (res) => ({ res, body: (await res.json()) as CatalogResponse }))
      .then(({ res, body }) => {
        if (!res.ok) throw new Error(body.detail ?? "No se pudo cargar la tienda.");
        setCatalog(body);
      })
      .catch((error) => setCatalog({ ok: false, shop: null, products: [], detail: error instanceof Error ? error.message : String(error) }));

    try {
      const saved = localStorage.getItem(CART_KEY);
      if (saved) setCart(JSON.parse(saved) as CartLine[]);
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart]);

  const categories = useMemo(
    () => ["Todos", ...Array.from(new Set(catalog.products.map((product) => product.category).filter(Boolean)))],
    [catalog.products],
  );

  const products = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return catalog.products.filter((product) => {
      const matchesCategory = category === "Todos" || product.category === category;
      const matchesQuery = !needle || `${product.title} ${product.description} ${product.category}`.toLowerCase().includes(needle);
      return matchesCategory && matchesQuery;
    });
  }, [catalog.products, category, query]);

  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = cart.reduce((sum, line) => sum + line.price * line.quantity, 0);

  function add(product: Product) {
    setCart((current) => {
      const existing = current.find((line) => line.variantId === product.variantId);
      return existing
        ? current.map((line) => line.variantId === product.variantId ? { ...line, quantity: line.quantity + 1 } : line)
        : [...current, { ...product, quantity: 1 }];
    });
    setCartOpen(true);
  }

  function changeQuantity(variantId: string, next: number) {
    setCart((current) => current.flatMap((line) => {
      if (line.variantId !== variantId) return [line];
      return next <= 0 ? [] : [{ ...line, quantity: next }];
    }));
  }

  function checkout() {
    if (!catalog.shop || cart.length === 0) return;
    const items = cart.map((line) => `${encodeURIComponent(line.variantId)}:${line.quantity}`).join(",");
    window.location.href = `https://${catalog.shop}/cart/${items}`;
  }

  async function shareStore() {
    const data = {
      title: "BOTANICA OCHOSI",
      text: "Botánica cubana online · productos espirituales auténticos · compra segura en línea.",
      url: SITE_URL,
    };
    try {
      if (navigator.share) {
        await navigator.share(data);
        setShareNotice("Compartido");
      } else {
        await navigator.clipboard.writeText(SITE_URL);
        setShareNotice("Enlace copiado");
      }
    } catch {}
    window.setTimeout(() => setShareNotice(""), 1800);
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <a className={styles.brand} href="/shop" aria-label="BOTANICA OCHOSI inicio">
          <span className={styles.mark}>O</span>
          <span><strong>BOTANICA</strong><small>OCHOSI</small></span>
        </a>
        <nav className={styles.nav}>
          <a href="#catalogo">Catálogo</a>
          <a href="#confianza">Nuestra promesa</a>
          <button className={styles.ghost} onClick={shareStore}>Compartir</button>
          <button className={styles.cartButton} onClick={() => setCartOpen(true)}>Carrito <b>{cartCount}</b></button>
        </nav>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>FE · PROPÓSITO · PROSPERIDAD</span>
          <h1>Tu botánica cubana, <em>ahora online.</em></h1>
          <p>Una experiencia de comercio electrónico BOTANICA OCHOSI con productos aprobados, compra segura, envíos gestionados por Shopify y atención completamente en línea.</p>
          <div className={styles.heroActions}>
            <a className={styles.primary} href="#catalogo">Comprar ahora</a>
            <button className={styles.secondary} onClick={shareStore}>Compartir tienda</button>
          </div>
          {shareNotice && <span className={styles.notice}>{shareNotice}</span>}
        </div>
        <div className={styles.heroSeal} aria-hidden="true">
          <div className={styles.target}>➶</div>
          <strong>BOTANICA</strong>
          <span>OCHOSI</span>
          <small>www.botanicaochosi.com</small>
        </div>
      </section>

      <section className={styles.trust} id="confianza">
        <div><strong>Compra segura</strong><span>Checkout administrado por Shopify</span></div>
        <div><strong>Catálogo real</strong><span>Solo productos activos y publicados</span></div>
        <div><strong>Envíos discretos</strong><span>Información mostrada en checkout</span></div>
        <div><strong>Atención online</strong><span>Sin llamadas telefónicas</span></div>
      </section>

      <section className={styles.catalogSection} id="catalogo">
        <div className={styles.sectionHead}>
          <div><span className={styles.eyebrow}>TIENDA ONLINE</span><h2>Catálogo BOTANICA OCHOSI</h2></div>
          <div className={styles.filters}>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar productos..." aria-label="Buscar productos" />
            <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Categoría">
              {categories.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
        </div>

        {!catalog.ok && <div className={styles.stateCard}><strong>La tienda se está preparando.</strong><p>{catalog.detail ?? "Shopify todavía no ha confirmado un catálogo público."}</p></div>}
        {catalog.ok && products.length === 0 && <div className={styles.stateCard}><strong>No hay productos activos todavía.</strong><p>Los productos HOLD o draft permanecen ocultos hasta completar aprobación, inventario y publicación.</p></div>}

        <div className={styles.grid}>
          {products.map((product) => (
            <article className={styles.productCard} key={product.variantId}>
              <div className={styles.imageWrap}>
                {product.image ? <img src={product.image} alt={product.title} loading="lazy" /> : <div className={styles.placeholder}>O</div>}
                <span className={styles.category}>{product.category}</span>
              </div>
              <div className={styles.productBody}>
                <h3>{product.title}</h3>
                {product.variantTitle && <small>{product.variantTitle}</small>}
                <p>{product.description || "Producto BOTANICA OCHOSI aprobado para venta online."}</p>
                <div className={styles.priceRow}>
                  <strong>${product.price.toFixed(2)}</strong>
                  {product.compareAtPrice && product.compareAtPrice > product.price ? <del>${product.compareAtPrice.toFixed(2)}</del> : null}
                </div>
                <div className={styles.productActions}>
                  <button className={styles.primary} onClick={() => add(product)}>Añadir</button>
                  <a className={styles.secondary} href={product.productUrl}>Ver producto</a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.shareBand}>
        <div><span className={styles.eyebrow}>COMPÁRTELO</span><h2>BOTANICA OCHOSI viaja contigo.</h2><p>Comparte la tienda por mensaje, redes sociales, email o copiando el enlace. Toda comunicación permanece online.</p></div>
        <button className={styles.primary} onClick={shareStore}>Compartir www.botanicaochosi.com</button>
      </section>

      <footer className={styles.footer}>
        <div className={styles.brand}><span className={styles.mark}>O</span><span><strong>BOTANICA</strong><small>OCHOSI</small></span></div>
        <span>Tradición · espiritualidad · energía · protección · prosperidad</span>
        <a href="/owner">Owner OS</a>
      </footer>

      <aside className={`${styles.cartDrawer} ${cartOpen ? styles.cartOpen : ""}`} aria-hidden={!cartOpen}>
        <div className={styles.cartHead}><div><span className={styles.eyebrow}>TU COMPRA</span><h2>Carrito</h2></div><button onClick={() => setCartOpen(false)} aria-label="Cerrar carrito">×</button></div>
        <div className={styles.cartLines}>
          {cart.length === 0 && <div className={styles.empty}>Tu carrito está vacío.</div>}
          {cart.map((line) => (
            <div className={styles.cartLine} key={line.variantId}>
              <div><strong>{line.title}</strong><small>${line.price.toFixed(2)} c/u</small></div>
              <div className={styles.qty}><button onClick={() => changeQuantity(line.variantId, line.quantity - 1)}>−</button><span>{line.quantity}</span><button onClick={() => changeQuantity(line.variantId, line.quantity + 1)}>+</button></div>
            </div>
          ))}
        </div>
        <div className={styles.cartSummary}><span>Subtotal</span><strong>${subtotal.toFixed(2)}</strong></div>
        <p className={styles.cartNote}>Impuestos, disponibilidad final y envío se confirman en Shopify.</p>
        <button className={styles.checkout} onClick={checkout} disabled={!catalog.shop || cart.length === 0}>Continuar a checkout seguro</button>
      </aside>
      {cartOpen && <button className={styles.backdrop} onClick={() => setCartOpen(false)} aria-label="Cerrar carrito" />}
    </main>
  );
}
