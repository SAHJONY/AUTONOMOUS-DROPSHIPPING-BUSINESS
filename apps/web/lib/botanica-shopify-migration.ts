const API_VERSION = "2026-07";

export type ShopifyCatalogProduct = {
  id: number;
  title: string;
  handle?: string;
  status?: string;
  vendor?: string;
  product_type?: string;
  tags?: string;
};

export type BotanicaCatalogSeed = {
  title: string;
  productType: string;
  tradition: "YORUBA_IFA_ISESE" | "LUCUMI_OCHA" | "YORUBA_CRAFT";
  sourceSupplier: string;
  sourceUrl: string;
  countryOfOrigin?: string;
  description: string;
};

/**
 * Curated, source-backed BOTANICA OCHOSI starter catalog.
 *
 * These are created as Shopify DRAFTS with price 0 and inventory disabled.
 * Source existence is verified, but wholesale economics/inventory are NOT assumed.
 * Council + Supplier Intelligence must approve economics before activation.
 */
export const BOTANICA_REAL_CATALOG_SEEDS: BotanicaCatalogSeed[] = [
  {
    title: "Iroke Ifá",
    productType: "Ifá Tools",
    tradition: "YORUBA_IFA_ISESE",
    sourceSupplier: "Get a Better Life TV Isese Bookshop",
    sourceUrl: "https://www.getabetterlifetv.com/products/iroke-ifa",
    countryOfOrigin: "Nigeria",
    description: "Traditional Yoruba/Ifá divination implement. Offered as a sourced cultural and religious article; preparation and ritual use depend on the buyer's tradition and qualified guidance."
  },
  {
    title: "Ajere Ifá",
    productType: "Ifá Tools",
    tradition: "YORUBA_IFA_ISESE",
    sourceSupplier: "Get a Better Life TV Isese Bookshop",
    sourceUrl: "https://www.getabetterlifetv.com/products/ajere-ifa",
    countryOfOrigin: "Nigeria",
    description: "Yoruba/Ifá ceremonial article sourced from a Nigeria-based seller. No claim is made that an item is consecrated or prepared for a specific lineage unless separately documented."
  },
  {
    title: "Igba Aje / Aje Calabash",
    productType: "Yoruba Ceremonial Articles",
    tradition: "YORUBA_IFA_ISESE",
    sourceSupplier: "Get a Better Life TV Isese Bookshop",
    sourceUrl: "https://www.getabetterlifetv.com/collections/all",
    countryOfOrigin: "Nigeria",
    description: "Nigeria-sourced Yoruba ceremonial calabash article. Exact materials, dimensions, preparation and intended use require supplier verification before sale."
  },
  {
    title: "Opon Ifá – Ife Design",
    productType: "Ifá Tools",
    tradition: "YORUBA_IFA_ISESE",
    sourceSupplier: "Yoruba Imports",
    sourceUrl: "https://yorubaimports.com/",
    description: "Yoruba divination tray in an Ife design style. Product provenance and current wholesale terms must be verified before activation."
  },
  {
    title: "Iyerosun / Iyeri Osun",
    productType: "Ifá Supplies",
    tradition: "YORUBA_IFA_ISESE",
    sourceSupplier: "Yoruba Imports",
    sourceUrl: "https://yorubaimports.com/",
    description: "Traditional Ifá divination powder product listing sourced from a Yoruba specialty importer. Current lot, origin, composition and availability must be verified before sale."
  },
  {
    title: "Orogbo – Bitter Kola",
    productType: "Yoruba Natural Articles",
    tradition: "YORUBA_IFA_ISESE",
    sourceSupplier: "Yoruba Imports",
    sourceUrl: "https://yorubaimports.com/",
    description: "Bitter kola offered as a culturally relevant Yoruba article. This listing makes no medical or guaranteed spiritual claims. Freshness and import/food rules must be verified before activation."
  },
  {
    title: "Obi Abata – Kola Nut",
    productType: "Yoruba Natural Articles",
    tradition: "YORUBA_IFA_ISESE",
    sourceSupplier: "Yoruba Imports",
    sourceUrl: "https://yorubaimports.com/",
    description: "Kola nut product sourced through a Yoruba specialty importer. Freshness, origin, availability and any applicable import/food requirements must be verified before sale."
  },
  {
    title: "Sopera de Porcelana – Oshún",
    productType: "Lucumí / Ocha Articles",
    tradition: "LUCUMI_OCHA",
    sourceSupplier: "Religion Universe Import Export Inc.",
    sourceUrl: "https://religionuniverse.com/collections/new-arrivals",
    description: "Porcelain sopera associated with Oshún in Lucumí/Ocha retail supply. Exact dimensions, design, wholesale price and availability require approved wholesaler verification."
  },
  {
    title: "Sopera de Porcelana – Yemayá",
    productType: "Lucumí / Ocha Articles",
    tradition: "LUCUMI_OCHA",
    sourceSupplier: "Religion Universe Import Export Inc.",
    sourceUrl: "https://religionuniverse.com/collections/new-arrivals",
    description: "Porcelain sopera associated with Yemayá in Lucumí/Ocha retail supply. Exact dimensions, design, wholesale price and availability require approved wholesaler verification."
  },
  {
    title: "Adire Yoruba Textile",
    productType: "Yoruba Textiles",
    tradition: "YORUBA_CRAFT",
    sourceSupplier: "Adire Oodua Textile Hub",
    sourceUrl: "https://adireoodua.org/ile-ife/",
    countryOfOrigin: "Nigeria",
    description: "Yoruba Adire textile candidate sourced from Ile-Ife artisan research. Pattern, maker, dimensions, material and export terms must be documented before activation."
  },
  {
    title: "Opon Ifá – Large Ife Design",
    productType: "Ifá Tools",
    tradition: "YORUBA_IFA_ISESE",
    sourceSupplier: "Yoruba Imports",
    sourceUrl: "https://yorubaimports.com/",
    description: "Large Ife-design divination tray candidate from a US Yoruba specialist. Exact carving, dimensions, stock, provenance and wholesale cost remain required before activation."
  },
  {
    title: "Edun Ara – Sango Stone",
    productType: "Yoruba Ceremonial Articles",
    tradition: "YORUBA_IFA_ISESE",
    sourceSupplier: "Yoruba Imports",
    sourceUrl: "https://yorubaimports.com/",
    description: "Culturally specific Yoruba article sourced through a specialist importer. This draft makes no consecration, authenticity or guaranteed spiritual-effect claim."
  },
  {
    title: "Esu Aje Figure",
    productType: "Yoruba Ceremonial Articles",
    tradition: "YORUBA_IFA_ISESE",
    sourceSupplier: "Yoruba Imports",
    sourceUrl: "https://yorubaimports.com/",
    description: "Yoruba ceremonial figure candidate. Maker, materials, intended tradition, dimensions, current inventory and commercial terms must be verified before sale."
  },
  {
    title: "Collar Yemayá Azul y Blanco",
    productType: "Lucumí Beads & Wearables",
    tradition: "LUCUMI_OCHA",
    sourceSupplier: "Yoruba Distribuidores LLC",
    sourceUrl: "https://yorubadistribuidores.com/product/collar-yemaya-azul-blanco/",
    description: "Blue-and-white Yemayá necklace candidate from a US wholesale source. Materials, preparation status, unit quantity and wholesale terms require verification before activation."
  },
  {
    title: "Ildé Oyá Elástico Grueso",
    productType: "Lucumí Beads & Wearables",
    tradition: "LUCUMI_OCHA",
    sourceSupplier: "Yoruba Distribuidores LLC",
    sourceUrl: "https://yorubadistribuidores.com/product/ilde-oya-elastico-grueso/",
    description: "Thick elastic Oyá idé candidate from a US wholesale source. Material, sizing, preparation status, inventory and landed cost must be verified before sale."
  },
  {
    title: "Veladora Religiosa de 7 Días",
    productType: "Botanica Candles",
    tradition: "LUCUMI_OCHA",
    sourceSupplier: "Distribuidora Mas Alla",
    sourceUrl: "https://www.el-masalla.com/wholesale-customers/wholesale-catalog/",
    description: "Seven-day religious candle assortment candidate from an established US botanica distributor. Exact design, case pack, safety labeling, inventory and wholesale cost are pending."
  },
  {
    title: "Aceite Espiritual – Assorted",
    productType: "Botanica Oils",
    tradition: "LUCUMI_OCHA",
    sourceSupplier: "Distribuidora Mas Alla",
    sourceUrl: "https://www.el-masalla.com/wholesale-customers/wholesale-catalog/",
    description: "Spiritual-oil assortment candidate. Formula, fragrance, labeling, case quantity and supplier terms must be verified; no health or guaranteed-outcome claims are made."
  },
  {
    title: "Incienso Botanica – Assorted",
    productType: "Incense",
    tradition: "LUCUMI_OCHA",
    sourceSupplier: "Babonsono Imports LLC",
    sourceUrl: "https://www.babonsono.com/products",
    description: "Wholesale incense assortment candidate from a US B2B importer. Exact fragrance, pack size, burn warnings, stock and landed cost remain required before activation."
  },
  {
    title: "Shekere Yoruba Handcrafted",
    productType: "Yoruba Music & Ceremony",
    tradition: "YORUBA_CRAFT",
    sourceSupplier: "INSHE Miami",
    sourceUrl: "https://www.inshemiami.com/en/pages/botanica-miami-inshe-miami-santeria-supplies-yoruba-tools-spiritual-articles",
    description: "Handcrafted shekere sourcing candidate from a South Florida specialist. Maker, dimensions, materials, sound sample, inventory and wholesale terms require confirmation."
  },
  {
    title: "Orisha Bead Components – Custom Set",
    productType: "Beads & Components",
    tradition: "YORUBA_CRAFT",
    sourceSupplier: "Handmade Factory / Dolce Natura, Inc.",
    sourceUrl: "https://botanicamayor.com/",
    description: "Custom bead-component set candidate from a business-only manufacturer. Color specification, materials, MOQ, sample approval, lead time and landed cost are pending."
  }
];

async function adminFetch(shop: string, token: string, path: string, init?: RequestInit) {
  return fetch(`https://${shop}/admin/api/${API_VERSION}${path}`, {
    ...init,
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });
}

export async function listShopifyCatalog(shop: string, token: string): Promise<ShopifyCatalogProduct[]> {
  const res = await adminFetch(
    shop,
    token,
    "/products.json?limit=250&status=any&fields=id,title,handle,status,vendor,product_type,tags"
  );
  if (!res.ok) throw new Error(`Shopify list products failed: ${res.status} ${(await res.text()).slice(0, 180)}`);
  const data = (await res.json()) as { products?: ShopifyCatalogProduct[] };
  return data.products ?? [];
}

export async function archiveShopifyProduct(shop: string, token: string, id: number) {
  const res = await adminFetch(shop, token, `/products/${id}.json`, {
    method: "PUT",
    body: JSON.stringify({ product: { id, status: "archived", published: false } })
  });
  if (!res.ok) throw new Error(`Shopify archive ${id} failed: ${res.status} ${(await res.text()).slice(0, 180)}`);
}

function safeBody(seed: BotanicaCatalogSeed) {
  const provenance = [
    `<p>Artículo de ${seed.productType.toLocaleLowerCase("es")} seleccionado para el catálogo de BOTANICA OCHOSI.</p>`,
    `<p><strong>Fuente comercial investigada:</strong> ${seed.sourceSupplier}</p>`,
    seed.countryOfOrigin ? `<p><strong>Origen por verificar:</strong> ${seed.countryOfOrigin}</p>` : "",
    `<p><strong>Estado:</strong> borrador comercial. Precio, inventario, costo mayorista, procedencia y cualquier preparación específica de la tradición deben verificarse antes de publicar.</p>`,
    `<details><summary>Notas de abastecimiento en inglés</summary><p>${seed.description}</p></details>`,
    `<p><em>BOTANICA OCHOSI no afirma que este artículo esté consagrado ni garantiza resultados espirituales.</em></p>`
  ];
  return provenance.join("");
}

export async function createBotanicaDraft(shop: string, token: string, seed: BotanicaCatalogSeed) {
  const res = await adminFetch(shop, token, "/products.json", {
    method: "POST",
    body: JSON.stringify({
      product: {
        title: seed.title,
        body_html: safeBody(seed),
        status: "draft",
        published: false,
        vendor: "BOTANICA OCHOSI",
        product_type: seed.productType,
        tags: [
          "BOTANICA OCHOSI",
          "CURATED_REAL_CATALOG",
          "IDIOMA_PRINCIPAL_ES",
          seed.tradition,
          "COUNCIL_REVIEW_REQUIRED",
          "PRICE_PENDING",
          "INVENTORY_PENDING"
        ].join(", "),
        variants: [{
          price: "0.00",
          inventory_policy: "deny",
          sku: `BO-${seed.title.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48)}`
        }]
      }
    })
  });
  if (!res.ok) throw new Error(`Shopify create draft failed for ${seed.title}: ${res.status} ${(await res.text()).slice(0, 180)}`);
  const data = (await res.json()) as { product?: ShopifyCatalogProduct };
  return data.product;
}

export function isBotanicaManagedProduct(product: ShopifyCatalogProduct) {
  const tags = String(product.tags ?? "").toUpperCase();
  return product.vendor === "BOTANICA OCHOSI" || tags.includes("BOTANICA OCHOSI");
}

/** Additive, idempotent seed for production stores. Never archives or publishes. */
export async function seedBotanicaDraftCatalog(shop: string, token: string) {
  const catalog = await listShopifyCatalog(shop, token);
  const existingTitles = new Set(
    catalog.filter(isBotanicaManagedProduct).map((product) => product.title.trim().toLowerCase()),
  );
  const created: { id?: number; title: string }[] = [];
  const errors: string[] = [];

  for (const seed of BOTANICA_REAL_CATALOG_SEEDS) {
    if (existingTitles.has(seed.title.toLowerCase())) continue;
    try {
      const product = await createBotanicaDraft(shop, token, seed);
      created.push({ id: product?.id, title: seed.title });
      existingTitles.add(seed.title.toLowerCase());
    } catch (error) {
      errors.push((error as Error).message);
    }
  }

  const finalCatalog = await listShopifyCatalog(shop, token);
  return {
    ok: errors.length === 0,
    botanica_drafts_created: created.length,
    created,
    final_botanica_products: finalCatalog.filter(isBotanicaManagedProduct).length,
    errors,
  };
}

export async function migrateShopifyToBotanicaCatalog(shop: string, token: string) {
  const before = await listShopifyCatalog(shop, token);
  const legacy = before.filter((p) => !isBotanicaManagedProduct(p) && p.status !== "archived");

  const archived: { id: number; title: string }[] = [];
  const errors: string[] = [];
  for (const product of legacy) {
    try {
      await archiveShopifyProduct(shop, token, product.id);
      archived.push({ id: product.id, title: product.title });
    } catch (e) {
      errors.push((e as Error).message);
    }
  }

  const seeded = await seedBotanicaDraftCatalog(shop, token);
  errors.push(...seeded.errors);

  const finalCatalog = await listShopifyCatalog(shop, token);
  return {
    ok: errors.length === 0,
    legacy_found: legacy.length,
    archived_count: archived.length,
    archived,
    botanica_drafts_created: seeded.botanica_drafts_created,
    created: seeded.created,
    final_active_legacy: finalCatalog.filter((p) => !isBotanicaManagedProduct(p) && p.status !== "archived").length,
    final_botanica_products: finalCatalog.filter(isBotanicaManagedProduct).length,
    errors
  };
}
