import { resolveShopifyToken } from "./store";
import type { Product, ProductStatus } from "./types";

const API_VERSION = "2026-07";

async function adminFetch(orgId: string, path: string, init?: RequestInit) {
  const resolved = await resolveShopifyToken(orgId);
  if (!resolved.ok || !resolved.shop || !resolved.token) {
    throw new Error(resolved.error ?? "Shopify is not connected.");
  }
  const res = await fetch(`https://${resolved.shop}/admin/api/${API_VERSION}${path}`, {
    ...init,
    headers: {
      "X-Shopify-Access-Token": resolved.token,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  return { res, shop: resolved.shop };
}

type ShopifyCatalogVariant = {
  id?: number;
  price?: string;
  sku?: string | null;
  inventory_quantity?: number;
  inventory_policy?: "deny" | "continue";
};

export type OwnerShopifyCatalogProduct = {
  id: number;
  title: string;
  handle?: string;
  body_html?: string;
  status?: "active" | "draft" | "archived" | string;
  vendor?: string;
  product_type?: string;
  created_at?: string;
  image?: { src?: string } | null;
  images?: Array<{ src?: string }>;
  variants?: ShopifyCatalogVariant[];
};

function nextPagePath(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(",")) {
    if (!part.includes('rel="next"')) continue;
    const url = part.match(/<([^>]+)>/)?.[1];
    if (!url) return null;
    const parsed = new URL(url);
    return `${parsed.pathname.replace(/^\/admin\/api\/[^/]+/, "")}${parsed.search}`;
  }
  return null;
}

export async function listAllOwnerShopifyProducts(orgId: string) {
  const fields = "id,title,handle,body_html,status,vendor,product_type,created_at,image,images,variants";
  let path: string | null = `/products.json?limit=250&status=any&fields=${fields}`;
  const products: OwnerShopifyCatalogProduct[] = [];
  const seenPages = new Set<string>();

  while (path && products.length < 5000 && !seenPages.has(path)) {
    seenPages.add(path);
    const { res, shop } = await adminFetch(orgId, path, { method:"GET", cache:"no-store" });
    if (!res.ok) throw new Error(`Shopify catalog sync failed (${res.status}): ${(await res.text()).slice(0, 220)}`);
    const body = await res.json() as { products?: OwnerShopifyCatalogProduct[] };
    products.push(...(body.products ?? []));
    path = nextPagePath(res.headers.get("link"));
    if (!path) return { shop, products };
  }

  const resolved = await resolveShopifyToken(orgId);
  return { shop: resolved.shop ?? "", products };
}

function stripHtml(value = "") {
  return value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
}

function internalStatus(status?: string): ProductStatus {
  if (status === "active") return "launched";
  if (status === "archived") return "killed";
  return "discovered";
}

export function mergeShopifyCatalogIntoProducts(
  orgId: string,
  shop: string,
  internal: Product[],
  shopifyProducts: OwnerShopifyCatalogProduct[],
): Product[] {
  const byShopifyId = new Map(internal.filter(product => product.shopify_id).map(product => [product.shopify_id, product]));
  const imported = shopifyProducts.map(shopify => {
    const existing = byShopifyId.get(shopify.id);
    const variant = shopify.variants?.[0];
    const images = (shopify.images ?? []).map(image => image.src ?? "").filter(Boolean);
    const handle = shopify.handle ?? existing?.shopify_handle;
    return {
      ...(existing ?? {}),
      id: existing?.id ?? `shopify_${shopify.id}`,
      org_id: orgId,
      title: shopify.title,
      description: stripHtml(shopify.body_html),
      source: existing?.source ?? "shopify_import",
      supplier_url: existing?.supplier_url ?? "",
      supplier: existing?.supplier || shopify.vendor || "",
      cost: existing?.cost ?? 0,
      price: Math.max(0, Number(variant?.price ?? existing?.price ?? 0)),
      status: internalStatus(shopify.status),
      sku: variant?.sku || existing?.sku || undefined,
      inventory_quantity: variant?.inventory_quantity ?? existing?.inventory_quantity,
      inventory_policy: variant?.inventory_policy ?? existing?.inventory_policy ?? "deny",
      images: images.length ? images : existing?.images ?? [],
      image_url: shopify.image?.src || images[0] || existing?.image_url,
      shopify_id: shopify.id,
      shopify_handle: handle,
      shopify_variant_id: variant?.id ?? existing?.shopify_variant_id,
      storefront_url: shopify.status === "active" && handle ? `https://${shop}/products/${handle}` : undefined,
      created_at: existing?.created_at ?? shopify.created_at ?? new Date().toISOString(),
    } satisfies Product;
  });
  const shopifyIds = new Set(shopifyProducts.map(product => product.id));
  const internalOnly = internal.filter(product => !product.shopify_id || !shopifyIds.has(product.shopify_id));
  return [...imported, ...internalOnly].slice(0, 5000);
}

export type OwnerShopifyCreateInput = {
  title: string;
  description?: string;
  price?: number;
  sku?: string;
  productType?: string;
  imageUrls?: string[];
  publish?: boolean;
};

export async function ownerCreateShopifyProduct(orgId: string, input: OwnerShopifyCreateInput) {
  const publish = input.publish === true;
  const { res, shop } = await adminFetch(orgId, "/products.json", {
    method: "POST",
    body: JSON.stringify({
      product: {
        title: input.title,
        body_html: input.description ?? "",
        status: publish ? "active" : "draft",
        published: publish,
        vendor: "BOTANICA OCHOSI",
        product_type: input.productType ?? "Botanica",
        tags: "BOTANICA OCHOSI, OWNER_MANAGED",
        variants: [{
          price: String(Math.max(0, Number(input.price ?? 0))).replace(/^$/, "0"),
          ...(input.sku ? { sku: input.sku } : {}),
          inventory_policy: "deny",
        }],
        ...((input.imageUrls ?? []).filter(Boolean).length
          ? { images: (input.imageUrls ?? []).filter(Boolean).slice(0, 10).map((src) => ({ src })) }
          : {}),
      },
    }),
  });
  if (!res.ok) throw new Error(`Shopify create failed (${res.status}): ${(await res.text()).slice(0, 220)}`);
  const data = await res.json() as { product?: { id?: number; handle?: string; status?: string; variants?: { id?: number }[] } };
  return {
    id: data.product?.id,
    handle: data.product?.handle,
    variantId: data.product?.variants?.[0]?.id,
    status: data.product?.status,
    url: data.product?.handle ? `https://${shop}/products/${data.product.handle}` : undefined,
  };
}

export async function ownerArchiveShopifyProduct(orgId: string, productId: number) {
  const { res } = await adminFetch(orgId, `/products/${productId}.json`, {
    method: "PUT",
    body: JSON.stringify({ product: { id: productId, status: "archived", published: false } }),
  });
  if (!res.ok) throw new Error(`Shopify archive failed (${res.status}): ${(await res.text()).slice(0, 220)}`);
  return { ok: true };
}

export async function ownerDeleteShopifyProduct(orgId: string, productId: number) {
  const { res } = await adminFetch(orgId, `/products/${productId}.json`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Shopify delete failed (${res.status}): ${(await res.text()).slice(0, 220)}`);
  }
  return { ok: true };
}
