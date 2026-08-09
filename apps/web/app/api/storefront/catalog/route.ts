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

const BOTANICA_TERMS = [
  "botanica", "ochosi", "orisha", "santeria", "lukumi", "lucumi", "ifa",
  "vela", "candle", "hierba", "herb", "cascarilla", "aceite", "oil",
  "incienso", "incense", "collar", "eleke", "ide", "baño", "bath",
  "estatua", "statue", "religious", "spiritual",
];

function categoryFor(text: string): string {
  const t = text.toLowerCase();
  if (/vela|candle/.test(t)) return "Velas";
  if (/hierba|herb|planta/.test(t)) return "Hierbas";
  if (/baño|bath/.test(t)) return "Baños";
  if (/aceite|oil|perfume|colonia/.test(t)) return "Aceites & Colonias";
  if (/incienso|incense/.test(t)) return "Inciensos";
  if (/collar|eleke|idé|ide|bracelet/.test(t)) return "Collares & Idés";
  if (/estatua|statue|imagen|figure/.test(t)) return "Imágenes & Estatuas";
  if (/cascarilla/.test(t)) return "Cascarilla";
  if (/libro|book/.test(t)) return "Libros";
  return "Botánica";
}

export async function GET() {
  const orgs = await listAllOrgs();
  const candidates: Array<{ orgId: string; orgName: string; shop: string; products: PublicProduct[] }> = [];

  for (const org of orgs) {
    const creds = await getShopifyCreds(org.id);
    if (!creds?.shop) continue;

    const products = await listProducts(org.id);
    const publicProducts = products
      .filter((product) => product.status !== "killed" && !!product.storefront_url)
      .map((product) => ({
        id: product.id,
        title: product.title,
        description: product.description,
        price: Number(product.price || 0),
        image_url: product.image_url,
        storefront_url: product.storefront_url,
        category: categoryFor(`${product.title} ${product.description}`),
      }));

    if (publicProducts.length) {
      candidates.push({ orgId: org.id, orgName: org.name, shop: creds.shop, products: publicProducts });
    }
  }

  if (!candidates.length) {
    return json({
      connected: false,
      products: [],
      message: "Shopify is not exposing any published catalog products yet.",
    });
  }

  candidates.sort((a, b) => {
    const aBotanica = BOTANICA_TERMS.some((term) => `${a.orgName} ${a.products.map((p) => p.title).join(" ")}`.toLowerCase().includes(term));
    const bBotanica = BOTANICA_TERMS.some((term) => `${b.orgName} ${b.products.map((p) => p.title).join(" ")}`.toLowerCase().includes(term));
    if (aBotanica !== bBotanica) return aBotanica ? -1 : 1;
    return b.products.length - a.products.length;
  });

  const selected = candidates[0];
  return json({
    connected: true,
    shop: selected.shop,
    store_name: selected.orgName,
    products: selected.products,
  });
}
