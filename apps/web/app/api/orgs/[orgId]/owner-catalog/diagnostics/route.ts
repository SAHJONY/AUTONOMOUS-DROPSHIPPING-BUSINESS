import { error, json, requireOrgRole } from "@/lib/api";
import { resolveShopifyToken } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BOTANICA_PRODUCT_RE =
  /\b(botanica|ochosi|oshosi|orisha|santer[ií]a|lukum[ií]|lucum[ií]|if[aá]|cascarilla|eleke|id[eé]|collar|sopera|veladora|incienso|hierba|baño espiritual|spiritual bath|ritual bath|aceite espiritual|spiritual oil|ritual oil|religious candle|spiritual candle|ritual candle|orisha statue|orisha figure|santeria supplies|lucumi supplies|lukumi supplies|yoruba)\b/i;

type ShopifyVariant = {
  id: number;
  title: string;
  price: string;
  inventory_quantity?: number;
  inventory_policy?: string;
};

type ShopifyProduct = {
  id: number;
  title: string;
  handle: string;
  body_html?: string;
  product_type?: string;
  vendor?: string;
  status?: string;
  published_at?: string | null;
  variants?: ShopifyVariant[];
};

function stripHtml(value = "") {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function isBotanicaProduct(product: ShopifyProduct) {
  return BOTANICA_PRODUCT_RE.test(
    `${product.title} ${stripHtml(product.body_html)} ${product.product_type ?? ""} ${product.vendor ?? ""}`,
  );
}

export async function GET(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrgRole(req, orgId, ["owner"]);
  if ("response" in auth) return auth.response;

  const resolved = await resolveShopifyToken(orgId);
  if (!resolved.ok || !resolved.shop || !resolved.token) {
    return error(resolved.error ?? "Shopify is not connected.", 503);
  }

  const endpoint = new URL(`https://${resolved.shop}/admin/api/2026-07/products.json`);
  endpoint.searchParams.set("status", "active");
  endpoint.searchParams.set("limit", "100");
  endpoint.searchParams.set(
    "fields",
    "id,title,handle,body_html,product_type,vendor,status,published_at,variants",
  );

  const response = await fetch(endpoint, {
    headers: { "X-Shopify-Access-Token": resolved.token },
    cache: "no-store",
  });

  if (!response.ok) {
    return error(`Shopify catalog probe failed (${response.status}).`, 502);
  }

  const body = (await response.json()) as { products?: ShopifyProduct[] };
  const products = body.products ?? [];

  const rows = products.map((product) => {
    const published = !!product.published_at;
    const botanica = isBotanicaProduct(product);
    const variant = (product.variants ?? []).find((item) => Number(item.price) > 0);
    const positivePrice = !!variant;
    const inventoryAvailable = !!variant && (
      variant.inventory_policy === "continue" || Number(variant.inventory_quantity ?? 0) > 0
    );
    const reasons: string[] = [];
    if (product.status !== "active") reasons.push("not_active");
    if (!published) reasons.push("not_published");
    if (!botanica) reasons.push("not_botanica_match");
    if (!positivePrice) reasons.push("no_positive_price");
    if (positivePrice && !inventoryAvailable) reasons.push("no_inventory");

    return {
      id: String(product.id),
      title: product.title,
      handle: product.handle,
      productType: product.product_type ?? "",
      vendor: product.vendor ?? "",
      published,
      botanica,
      positivePrice,
      inventoryAvailable,
      publishable: reasons.length === 0,
      reasons,
    };
  });

  return json({
    ok: true,
    shop: resolved.shop,
    counts: {
      activeFetched: products.length,
      published: rows.filter((row) => row.published).length,
      botanicaMatch: rows.filter((row) => row.botanica).length,
      positivePrice: rows.filter((row) => row.positivePrice).length,
      inventoryAvailable: rows.filter((row) => row.inventoryAvailable).length,
      publishable: rows.filter((row) => row.publishable).length,
    },
    exclusions: {
      notPublished: rows.filter((row) => row.reasons.includes("not_published")).length,
      notBotanicaMatch: rows.filter((row) => row.reasons.includes("not_botanica_match")).length,
      noPositivePrice: rows.filter((row) => row.reasons.includes("no_positive_price")).length,
      noInventory: rows.filter((row) => row.reasons.includes("no_inventory")).length,
    },
    products: rows,
  });
}
