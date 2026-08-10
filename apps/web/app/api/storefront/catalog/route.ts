import { json } from "@/lib/api";
import { getShopifyCreds, listAllOrgs, listProducts } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PublicProduct = {
  id: string;
  title: string;
  description: string;
  price: number;
  image_url?: string;
  storefront_url?: string;
  category: string;
};

/**
 * Public Botanica catalog policy.
 *
 * The commerce OS may contain products from previous stores, QA runs, or generic
 * dropshipping experiments. The public BOTANICA OCHOSI storefront must fail
 * closed: a product is eligible only when its own title/description explicitly
 * identifies it as Botanica / Lucumi / Orisha / spiritual-religious inventory.
 * Generic words such as "oil", "bath", "bracelet", or "candle" are intentionally
 * NOT sufficient on their own because they create false positives.
 */
const BOTANICA_PRODUCT_RE =
  /\b(botanica|ochosi|oshosi|orisha|santer[ií]a|lukum[ií]|lucum[ií]|if[aá]|cascarilla|eleke|ide de santo|id[eé] de santo|religious candle|spiritual candle|ritual candle|spiritual bath|ritual bath|spiritual oil|ritual oil|orisha statue|orisha figure|santeria supplies|lucumi supplies|lukumi supplies)\b/i;

function isBotanicaProduct(title: string, description: string): boolean {
  return BOTANICA_PRODUCT_RE.test(`${title} ${description}`);
}

function categoryFor(text: string): string {
  const t = text.toLowerCase();
  if (/vela|candle/.test(t)) return "Velas";
  if (/hierba|herb|planta/.test(t)) return "Hierbas";
  if (/baño|bath/.test(t)) return "Baños";
  if (/aceite|oil|perfume|colonia/.test(t)) return "Aceites & Colonias";
  if (/incienso|incense/.test(t)) return "Inciensos";
  if (/collar|eleke|id[eé]|bracelet/.test(t)) return "Collares & Idés";
  if (/estatua|statue|imagen|figure/.test(t)) return "Imágenes & Estatuas";
  if (/cascarilla/.test(t)) return "Cascarilla";
  if (/libro|book/.test(t)) return "Libros";
  return "Botánica";
}

export async function GET() {
  const orgs = await listAllOrgs();
  const connectedStores: Array<{ orgId: string; orgName: string; shop: string; products: PublicProduct[] }> = [];

  for (const org of orgs) {
    const creds = await getShopifyCreds(org.id);
    if (!creds?.shop) continue;

    const products = await listProducts(org.id);
    const publicProducts = products
      .filter(
        (product) =>
          product.status !== "killed" &&
          !!product.storefront_url &&
          Number(product.price || 0) > 0 &&
          isBotanicaProduct(product.title, product.description),
      )
      .map((product) => ({
        id: product.id,
        title: product.title,
        description: product.description,
        price: Number(product.price),
        image_url: product.image_url,
        storefront_url: product.storefront_url,
        category: categoryFor(`${product.title} ${product.description}`),
      }));

    connectedStores.push({ orgId: org.id, orgName: org.name, shop: creds.shop, products: publicProducts });
  }

  if (!connectedStores.length) {
    return json({
      connected: false,
      products: [],
      message: "No Shopify store is connected to the commerce OS yet.",
    });
  }

  connectedStores.sort((a, b) => b.products.length - a.products.length);
  const selected = connectedStores[0];

  if (!selected.products.length) {
    return json({
      connected: true,
      shop: selected.shop,
      store_name: selected.orgName,
      products: [],
      message:
        "Shopify is connected, but no products are explicitly approved for the BOTANICA OCHOSI public catalog yet.",
    });
  }

  return json({
    connected: true,
    shop: selected.shop,
    store_name: selected.orgName,
    products: selected.products,
  });
}
