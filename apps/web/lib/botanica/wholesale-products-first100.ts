import { WHOLESALE_PRODUCT_EVIDENCE, type WholesaleProductEvidence } from "./wholesale-products";

const VERIFIED_AT = "2026-08-10";
const OWNER_GATES = ["CURRENT_STOCK", "ACCOUNT_ELIGIBILITY", "SHIPPING_COST", "IMAGE_RIGHTS", "LANDED_COST", "OWNER_REVIEW"];

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function masAllaLot(
  kind: "bath" | "oil" | "powder" | "perfume",
  name: string,
  price: number,
  sourceUrl: string,
): WholesaleProductEvidence {
  const config = {
    bath: { category: "Baños y Limpias", pack: 6, es: `Limpia y Despojo ${name} · lote de 6`, en: `${name} Spiritual Cleansing Bath · lot of 6` },
    oil: { category: "Aceites y Esencias", pack: 6, es: `Aceite ${name} · lote de 6`, en: `${name} Spiritual Oil · lot of 6` },
    powder: { category: "Polvos y Preparados", pack: 6, es: `Polvo ${name} · lote de 6`, en: `${name} Spiritual Powder · lot of 6` },
    perfume: { category: "Colonias y Aguas", pack: 6, es: `Perfume ${name} · lote de 6`, en: `${name} Esoteric Perfume · lot of 6` },
  }[kind];

  return {
    id: `masalla-${kind}-${slugify(name)}`,
    supplier_id: "distribuidora-mas-alla",
    supplier_name: "Distribuidora Mas Alla",
    title_es: config.es,
    title_en: config.en,
    category: config.category,
    source_url: sourceUrl,
    wholesale_only: true,
    wholesale_price_usd: price,
    pack_qty: config.pack,
    public_price_note: `Public wholesale category lists this ${config.pack}-unit lot at $${price.toFixed(2)}; promotional threshold discounts are not treated as base cost.`,
    inventory_evidence: "CATALOG_SIGNAL",
    evidence_status: "PUBLIC_VERIFIED",
    verified_at: VERIFIED_AT,
    shopify_draft_ready: false,
    required_next_checks: [...OWNER_GATES, kind === "bath" || kind === "oil" || kind === "powder" || kind === "perfume" ? "INGREDIENT/CLAIMS_REVIEW" : "COMMERCE_REVIEW"],
  };
}

const baths = [
  "21 División", "7 Espadas de San Miguel", "7 Gotas de Amor", "7 Gotas de Suerte", "7 Machos", "7 Potencias", "7x7 Contra Todo", "Abre Caminos", "Abre Puerta", "Abundancia", "Albahaca", "Altamiza", "Amansa Guapo", "Amarra Dinero", "Amarra Hombre", "Amor", "Anamú", "Ángel de la Guarda", "Apazote", "Arrasa Con Todo", "Atracción", "Atrae Dinero", "Atrapa Clientes", "Atrayente", "Brazo Fuerte", "Buena Suerte", "Búscame", "Calienta Negocio", "Cambia Rumbo", "Caridad del Cobre",
];

const oils = [
  "Abundancia", "Atracción", "Atrae Dinero", "Combatiente", "Confusión", "Contra La Ley", "Contra Maldad", "Controlling", "Corderito Manso", "Corre Diablo Corre", "Corta Fluido", "Dame Pronto", "Descruzar", "Desenvolvimiento", "Desespero", "Divino Niño", "Doble Double Fast Luck", "Doblegado a Mis Pies", "Dominante", "Dominio", "Don Dinero", "Embrujo de Sevilla", "Espanta Diablo", "Espanta Espíritu", "Espanta Muertos",
];

const powders = [
  "7 Espadas de San Miguel", "7 Gotas de Amor", "7 Gotas de Suerte", "7 Machos", "7 Pensamientos", "7 Potencias", "7x7 Contra Todo", "Abre Caminos", "Abre Puertas", "Abundancia", "Adán y Eva", "Aguántalo Aquí", "Aleja Maldad", "Almizcle", "Altar Mayor", "Amansa Guapo", "Amarra Dinero", "Amarra Hombres", "Amarra Mujer", "Amor Eterno", "Amor Fuerte", "Ángel Guardian", "Aquí Te Tengo", "Arrasa Con Todo", "Atrayente",
];

const perfumes = [
  "1 Gota de Amor", "1 Gota de Suerte", "21 División", "4 Ventas", "5 Sentidos", "7 Espadas de San Miguel",
];

const expandedMasAllaProducts: WholesaleProductEvidence[] = [
  ...baths.map((name) => masAllaLot("bath", name, 17.95, "https://www.botanicamasalla.com/spiritual-baths-wholesale/")),
  ...oils.map((name) => masAllaLot("oil", name, 16.65, "https://www.botanicamasalla.com/spiritual-oils-wholesale/")),
  ...powders.map((name) => masAllaLot("powder", name, 15.99, "https://www.botanicamasalla.com/spiritual-powders-wholesale/")),
  ...perfumes.map((name) => masAllaLot("perfume", name, 17.95, "https://www.botanicamasalla.com/spiritual-perfumes-wholesale/")),
];

/**
 * First 100 wholesale sourcing records for BOTANICA OCHOSI.
 * Exactly 100 records: 14 previously verified candidates + 86 public wholesale catalog records.
 * All remain HOLD evidence and are explicitly not Shopify-draft authority.
 */
export const FIRST_100_WHOLESALE_PRODUCTS: WholesaleProductEvidence[] = [
  ...WHOLESALE_PRODUCT_EVIDENCE,
  ...expandedMasAllaProducts,
];

export const first100WholesaleSupplierIds = [...new Set(FIRST_100_WHOLESALE_PRODUCTS.map((item) => item.supplier_id))];
export const first100PubliclyPricedProducts = FIRST_100_WHOLESALE_PRODUCTS.filter((item) => typeof item.wholesale_price_usd === "number");
