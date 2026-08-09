import { NextResponse } from "next/server";
import { resolveShopifyToken } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PUBLIC_STORE_ORG_ID =
  process.env.PUBLIC_STORE_ORG_ID ?? "4c5dcff7503b4b68adbc5a7bffaf60d8";

type ShopifyVariant = {
  id: number;
  title: string;
  price: string;
  compare_at_price?: string | null;
  inventory_quantity?: number;
  inventory_policy?: string;
  sku?: string | null;
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
  image?: { src?: string } | null;
  images?: Array<{ src?: string }>;
  variants?: ShopifyVariant[];
};

function stripHtml(value = "") {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export async function GET() {
  const resolved = await resolveShopifyToken(PUBLIC_STORE_ORG_ID);
  if (!resolved.ok || !resolved.shop || !resolved.token) {
    return NextResponse.json(
      { ok: false, shop: null, products: [], detail: "Store catalog is not connected yet." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const endpoint = new URL(`https://${resolved.shop}/admin/api/2026-07/products.json`);
  endpoint.searchParams.set("status", "active");
  endpoint.searchParams.set("limit", "100");
  endpoint.searchParams.set(
    "fields",
    "id,title,handle,body_html,product_type,vendor,status,published_at,image,images,variants",
  );

  const response = await fetch(endpoint, {
    headers: { "X-Shopify-Access-Token": resolved.token },
    cache: "no-store",
  });

  if (!response.ok) {
    return NextResponse.json(
      { ok: false, shop: resolved.shop, products: [], detail: `Shopify catalog probe failed (${response.status}).` },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  const body = (await response.json()) as { products?: ShopifyProduct[] };
  const products = (body.products ?? [])
    .filter((product) => product.status === "active" && product.published_at)
    .flatMap((product) => {
      const variant = (product.variants ?? []).find((item) => Number(item.price) > 0);
      if (!variant) return [];
      const inventoryAvailable =
        variant.inventory_policy === "continue" || Number(variant.inventory_quantity ?? 0) > 0;
      if (!inventoryAvailable) return [];
      return [
        {
          id: String(product.id),
          variantId: String(variant.id),
          title: product.title,
          variantTitle: variant.title === "Default Title" ? null : variant.title,
          description: stripHtml(product.body_html).slice(0, 260),
          category: product.product_type || "Botanica",
          vendor: product.vendor || "BOTANICA OCHOSI",
          price: Number(variant.price),
          compareAtPrice: variant.compare_at_price ? Number(variant.compare_at_price) : null,
          image: product.image?.src ?? product.images?.[0]?.src ?? null,
          handle: product.handle,
          productUrl: `https://${resolved.shop}/products/${product.handle}`,
        },
      ];
    });

  return NextResponse.json(
    { ok: true, shop: resolved.shop, products, count: products.length },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
