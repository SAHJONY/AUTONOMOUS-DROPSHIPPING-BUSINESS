const API_VERSION = "2024-10";

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
    `<p>${seed.description}</p>`,
    `<p><strong>Source research:</strong> ${seed.sourceSupplier}</p>`,
    seed.countryOfOrigin ? `<p><strong>Origin under verification:</strong> ${seed.countryOfOrigin}</p>` : "",
    `<p><em>Draft listing. Price, inventory, provenance details and any tradition-specific preparation must be verified before publication.</em></p>`
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

  const afterArchive = await listShopifyCatalog(shop, token);
  const existingBotanicaTitles = new Set(
    afterArchive.filter(isBotanicaManagedProduct).map((p) => p.title.trim().toLowerCase())
  );

  const created: { id?: number; title: string }[] = [];
  for (const seed of BOTANICA_REAL_CATALOG_SEEDS) {
    if (existingBotanicaTitles.has(seed.title.toLowerCase())) continue;
    try {
      const p = await createBotanicaDraft(shop, token, seed);
      created.push({ id: p?.id, title: seed.title });
    } catch (e) {
      errors.push((e as Error).message);
    }
  }

  const finalCatalog = await listShopifyCatalog(shop, token);
  return {
    ok: errors.length === 0,
    legacy_found: legacy.length,
    archived_count: archived.length,
    archived,
    botanica_drafts_created: created.length,
    created,
    final_active_legacy: finalCatalog.filter((p) => !isBotanicaManagedProduct(p) && p.status !== "archived").length,
    final_botanica_products: finalCatalog.filter(isBotanicaManagedProduct).length,
    errors
  };
}
