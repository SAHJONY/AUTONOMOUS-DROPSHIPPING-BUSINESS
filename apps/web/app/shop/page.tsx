"use client";

import { useEffect, useMemo, useState } from "react";
import { BOTANICA_STORE_CATEGORIES } from "@/lib/botanica-store-categories";
import styles from "./shop.module.css";
import enhanced from "./shop-enhanced.module.css";

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
  videoUrl?: string | null;
  audioUrl?: string | null;
  handle: string;
  productUrl: string;
};

type CartLine = Product & { quantity: number };
type CatalogResponse = { ok: boolean; provider?: "native"; checkoutProvider?: "stripe"; shop: string | null; products: Product[]; count?: number; detail?: string };

const SITE_URL = "https://www.botanicaochosi.com";
const CART_KEY = "botanica_ochosi_cart_v1";
const FEATURED_CATEGORIES = [
  ["VELAS / CANDLES", "✦"], ["ACEITES", "◈"], ["BAÑOS / RIEGOS", "≈"],
  ["COLLARES", "∞"], ["HIERBAS", "❧"], ["INCIENSOS", "⌁"],
  ["ELEGUÁ / ESHU", "◆"], ["IFÁ", "◎"], ["IMÁGENES / SANTOS", "△"],
  ["PERFUMES & COLONIAS / PERFUMES & COLOGNES", "◇"], ["AMULETOS", "☼"], ["CARACOLES", "◌"],
  ["SOPERAS", "♢"], ["CALDEROS Y CAZUELAS", "◒"], ["CAMPANAS", "♧"], ["CASCARILLA", "○"],
] as const;

export default function ShopPage() {
  const [catalog, setCatalog] = useState<CatalogResponse>({ ok: false, shop: null, products: [] });
  const [cart, setCart] = useState<CartLine[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [shareNotice, setShareNotice] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);

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
    } catch {
      localStorage.removeItem(CART_KEY);
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("cart") === "1") setCartOpen(true);
    if (params.get("checkout") === "success") {
      localStorage.removeItem(CART_KEY);
      setCart([]);
      setShareNotice("Pago recibido. Gracias por tu compra.");
    }
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    if (!menuOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  const categories = useMemo(() => ["Todos", ...BOTANICA_STORE_CATEGORIES], []);

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

  async function checkout() {
    if (cart.length === 0 || checkingOut) return;
    setCheckingOut(true);
    setCheckoutError("");
    try {
      const response = await fetch("/api/public/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lines: cart.map((line) => ({ productId: line.id, quantity: line.quantity })) }) });
      const body = (await response.json()) as { ok?: boolean; url?: string; detail?: string };
      if (!response.ok || !body.url) throw new Error(body.detail ?? "No se pudo iniciar el checkout.");
      window.location.href = body.url;
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "No se pudo iniciar el checkout.");
      setCheckingOut(false);
    }
  }

  async function share(title: string, text: string, url: string) {
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        setShareNotice("Compartido");
      } else {
        await navigator.clipboard.writeText(url);
        setShareNotice("Enlace copiado");
      }
    } catch {
      return;
    }
    window.setTimeout(() => setShareNotice(""), 1800);
  }

  function shareStore() {
    return share(
      "BOTANICA OCHOSI",
      "Botánica cubana online · productos espirituales auténticos · compra segura en línea.",
      SITE_URL,
    );
  }

  function chooseCategory(nextCategory: string) {
    setCategory(nextCategory);
    setMenuOpen(false);
    document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" });
  }

  function shareProduct(product: Product) {
    const url = `${SITE_URL}/shop?product=${encodeURIComponent(product.handle)}`;
    return share(`${product.title} · BOTANICA OCHOSI`, `Mira ${product.title} en BOTANICA OCHOSI.`, url);
  }

  return (
    <main className={styles.shell}>
      <div className={enhanced.announcement}><span>ENVÍO CLARO EN CHECKOUT</span><span>·</span><span>PAGO PROTEGIDO</span><span>·</span><span>CATÁLOGO PROPIO</span></div>
      <header className={styles.header}>
        <a className={styles.brand} href="/shop" aria-label="BOTANICA OCHOSI inicio">
          <span className={styles.mark}>O</span>
          <span><strong>BOTANICA</strong><small>OCHOSI</small></span>
        </a>
        <nav className={styles.nav} aria-label="Acciones de la tienda">
          <button className={styles.cartButton} onClick={() => setCartOpen(true)}>Carrito <b>{cartCount}</b></button>
          <button className={`${styles.menuButton} ${menuOpen ? styles.menuButtonOpen : ""}`} type="button" aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"} aria-expanded={menuOpen} aria-controls="store-navigation" onClick={() => setMenuOpen((current) => !current)}>
            <span aria-hidden="true"/><span aria-hidden="true"/><span aria-hidden="true"/>
            <strong>Menú</strong>
          </button>
        </nav>
      </header>
      <div id="store-navigation" className={`${styles.menuPanel} ${menuOpen ? styles.menuPanelOpen : ""}`} aria-hidden={!menuOpen}>
        <div className={styles.menuTopline}><span>EXPLORA BOTANICA OCHOSI</span><button type="button" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú">×</button></div>
        <label className={styles.menuSearch}><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar productos" aria-label="Buscar productos"/></label>
        <div className={styles.menuLayout}>
          <nav className={styles.menuPrimary} aria-label="Navegación principal">
            <a href="#catalogo" onClick={() => setMenuOpen(false)}><span>01</span>Catálogo</a>
            <a href="#categorias" onClick={() => setMenuOpen(false)}><span>02</span>Categorías</a>
            <a href="#confianza" onClick={() => setMenuOpen(false)}><span>03</span>Nuestra promesa</a>
            <a href="/policies" onClick={() => setMenuOpen(false)}><span>04</span>Envíos, devoluciones y privacidad</a>
            <button type="button" onClick={() => { setMenuOpen(false); void shareStore(); }}><span>05</span>Compartir tienda</button>
          </nav>
          <div className={styles.menuCategories} aria-label="Categorías de productos">
            <span className={styles.menuLabel}>COMPRAR POR CATEGORÍA</span>
            <button type="button" onClick={() => chooseCategory("Todos")}>Ver todo</button>
            {FEATURED_CATEGORIES.map(([name, icon]) => <button type="button" key={name} onClick={() => chooseCategory(name)}><span aria-hidden="true">{icon}</span>{name}</button>)}
          </div>
        </div>
      </div>
      {menuOpen && <button className={styles.menuBackdrop} type="button" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú" />}

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>BOTÁNICA CUBANA · TRADICIÓN Y COMERCIO DIGITAL</span>
          <h1>Raíces que acompañan. <em>Una tienda hecha para ti.</em></h1>
          <p>Explora una selección organizada de artículos de botánica, cuidado espiritual y tradición. Precios claros, pago protegido y una experiencia respetuosa de principio a fin.</p>
          <div className={styles.heroActions}>
            <a className={styles.primary} href="#categorias">Explorar categorías</a>
            <a className={styles.secondary} href="#catalogo">Ver catálogo</a>
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
        <div><strong>Pago protegido</strong><span>Checkout seguro procesado por Stripe</span></div>
        <div><strong>Disponibilidad real</strong><span>Solo mostramos artículos publicados y disponibles</span></div>
        <div><strong>Envío claro</strong><span>Costos y destino confirmados antes de pagar</span></div>
        <div><strong>Compra con respeto</strong><span>Información comercial sin promesas espirituales</span></div>
      </section>

      <section className={enhanced.categoryShowcase} id="categorias">
        <div className={enhanced.categoryIntro}><span className={styles.eyebrow}>ENCUENTRA LO QUE BUSCAS</span><h2>Explora nuestra botánica por categoría.</h2><p>Desde velas y aceites hasta collares, hierbas, herramientas e imágenes. Elige una categoría para ir directamente al catálogo.</p></div>
        <div className={enhanced.categoryGrid}>{FEATURED_CATEGORIES.map(([name, icon]) => <button key={name} onClick={() => { setCategory(name); document.getElementById("catalogo")?.scrollIntoView({ behavior:"smooth" }); }}><span>{icon}</span><strong>{name}</strong><small>{catalog.products.filter((product) => product.category === name).length} disponibles</small></button>)}</div>
      </section>

      <section className={styles.catalogSection} id="catalogo">
        <div className={styles.sectionHead}>
          <div><span className={styles.eyebrow}>TIENDA ONLINE</span><h2>Encuentra tu próximo artículo.</h2><p className={enhanced.sectionCopy}>Busca por nombre o explora las {BOTANICA_STORE_CATEGORIES.length} categorías de BOTANICA OCHOSI.</p></div>
          <div className={styles.filters}>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar productos..." aria-label="Buscar productos" />
            <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Categoría">
              {categories.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
        </div>

        {!catalog.ok && <div className={styles.stateCard}><strong>La tienda se está preparando.</strong><p>{catalog.detail ?? "El catálogo todavía no está disponible."}</p></div>}
        {catalog.ok && products.length === 0 && <div className={enhanced.emptyExperience}><div className={enhanced.emptyMonogram}>O</div><div><span className={styles.eyebrow}>{category === "Todos" ? "NUEVA COLECCIÓN EN PREPARACIÓN" : category}</span><h3>{category === "Todos" ? "Estamos preparando el primer surtido." : "Todavía no hay artículos publicados aquí."}</h3><p>{category === "Todos" ? "Muy pronto encontrarás productos seleccionados con información, precio e inventario verificados. Guarda esta tienda y vuelve a visitarnos." : "Explora otra categoría o vuelve pronto. Solo publicamos productos cuando su información y disponibilidad están listas."}</p><div className={styles.heroActions}><button className={styles.primary} onClick={() => setCategory("Todos")}>Ver todas las categorías</button><button className={styles.secondary} onClick={shareStore}>Compartir tienda</button></div></div></div>}

        <div className={styles.grid}>
          {products.map((product) => (
            <article className={styles.productCard} key={product.variantId} id={`product-${product.handle}`}>
              <div className={styles.imageWrap}>
                {product.image ? <img src={product.image} alt={product.title} loading="lazy" /> : <div className={styles.placeholder}>O</div>}
                <span className={styles.category}>{product.category}</span>
              </div>
              <div className={styles.productBody}>
                <h3>{product.title}</h3>
                {product.variantTitle && <small>{product.variantTitle}</small>}
                <p>{product.description || "Producto BOTANICA OCHOSI aprobado para venta online."}</p>
                {product.videoUrl && <video className={enhanced.productMedia} controls playsInline preload="metadata" src={product.videoUrl}>Tu navegador no puede reproducir este video.</video>}
                {product.audioUrl && <audio className={enhanced.productAudio} controls preload="none" src={product.audioUrl}>Tu navegador no puede reproducir este audio.</audio>}
                <div className={styles.priceRow}>
                  <strong>${product.price.toFixed(2)}</strong>
                  {product.compareAtPrice && product.compareAtPrice > product.price ? <del>${product.compareAtPrice.toFixed(2)}</del> : null}
                </div>
                <div className={styles.productActions}>
                  <button className={styles.primary} onClick={() => add(product)}>Añadir</button>
                  <a className={styles.secondary} href={product.productUrl}>Ver producto</a>
                  <button className={styles.productShare} onClick={() => shareProduct(product)}>Compartir</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {!!catalog.products.length && <section className={enhanced.merchandising}>
        <div className={enhanced.merchHead}><div><span className={styles.eyebrow}>SELECCIÓN DESTACADA</span><h2>Favoritos de la tienda</h2></div><button onClick={() => { setCategory("Todos"); document.getElementById("catalogo")?.scrollIntoView({behavior:"smooth"}); }}>Ver todo el catálogo →</button></div>
        <div className={enhanced.miniGrid}>{catalog.products.slice(0,4).map((product) => <article key={`featured-${product.id}`}><div>{product.image ? <img src={product.image} alt={product.title} loading="lazy"/> : <span>O</span>}</div><small>{product.category}</small><h3>{product.title}</h3><strong>${product.price.toFixed(2)}</strong><button onClick={() => add(product)}>Añadir al carrito</button></article>)}</div>
      </section>}

      <section className={enhanced.promiseSection}>
        <div><span className={styles.eyebrow}>NUESTRA PROMESA</span><h2>Comercio claro. Tradición tratada con respeto.</h2></div>
        <div className={enhanced.promiseGrid}><article><b>01</b><h3>Información honesta</h3><p>Mostramos lo que sabemos del producto y señalamos lo que requiere orientación especializada.</p></article><article><b>02</b><h3>Precios visibles</h3><p>El precio del artículo aparece antes de añadirlo al carrito; envío e impuestos se confirman en checkout.</p></article><article><b>03</b><h3>Privacidad primero</h3><p>La compra se procesa en línea mediante proveedores seguros y con comunicaciones discretas.</p></article></div>
      </section>

      <section className={styles.shareBand}>
        <div><span className={styles.eyebrow}>COMPÁRTELO</span><h2>BOTANICA OCHOSI viaja contigo.</h2><p>Comparte la tienda o cualquier producto por mensaje, redes sociales, email o copiando el enlace. Toda comunicación permanece online.</p></div>
        <button className={styles.primary} onClick={shareStore}>Compartir www.botanicaochosi.com</button>
      </section>

      <section className={enhanced.wholesaleBand}><div><span className={styles.eyebrow}>BOTÁNICAS · PRACTICANTES · COMUNIDAD</span><h2>¿Buscas cantidades mayores?</h2><p>Preparamos opciones por volumen únicamente cuando precio, disponibilidad y condiciones están confirmados. Consulta desde nuestros canales digitales.</p></div><a href="mailto:suppliers@botanicaochosi.com?subject=Consulta%20de%20compra%20por%20volumen">Consultar por volumen</a></section>

      <footer className={styles.footer}>
        <div className={styles.brand}><span className={styles.mark}>O</span><span><strong>BOTANICA</strong><small>OCHOSI</small></span></div>
        <span>Tradición · cultura · comunidad · comercio responsable</span>
        <button className={enhanced.footerShare} onClick={shareStore}>Compartir tienda</button>
      </footer>
      <div className={enhanced.legalFooter}><span>© {new Date().getFullYear()} BOTANICA OCHOSI</span><span>La información comercial no sustituye orientación religiosa, médica o legal.</span><a href="/policies">Envíos · devoluciones · privacidad</a><a href="mailto:suppliers@botanicaochosi.com">Contacto</a></div>

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
        <p className={styles.cartNote}>Impuestos, disponibilidad final y envío se confirman durante el pago seguro.</p>
        {checkoutError && <p className={styles.cartNote}>{checkoutError}</p>}
        <button className={styles.checkout} onClick={checkout} disabled={cart.length === 0 || checkingOut}>{checkingOut ? "Preparando checkout…" : "Continuar a checkout seguro"}</button>
      </aside>
      {cartOpen && <button className={styles.backdrop} onClick={() => setCartOpen(false)} aria-label="Cerrar carrito" />}
    </main>
  );
}
