import { resolveShopifyToken } from "./store";

const API_VERSION = "2024-10";

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

export type OwnerShopifyCreateInput = {
  title: string;
  description?: string;
  price?: number;
  sku?: string;
  productType?: string;
  imageUrls?: string[];
  /**
   * Legacy compatibility only. Direct live publication is forbidden by this helper.
   * Verified BOTANICA products must be created as Shopify drafts first.
   */
  publish?: boolean;
};

export function assertShopifyDraftOnly(input: OwnerShopifyCreateInput): void {
  if (input.publish === true) {
    throw new Error("BOTANICA_DIRECT_LIVE_PUBLISH_BLOCKED: create a verified Shopify draft first.");
  }
}

export async function ownerCreateShopifyProduct(orgId: string, input: OwnerShopifyCreateInput) {
  assertShopifyDraftOnly(input);
  const { res, shop } = await adminFetch(orgId, "/products.json", {
    method: "POST",
    body: JSON.stringify({
      product: {
        title: input.title,
        body_html: input.description ?? "",
        status: "draft",
        published: false,
        vendor: "BOTANICA OCHOSI",
        product_type: input.productType ?? "Botanica",
        tags: "BOTANICA OCHOSI, OWNER_MANAGED, VERIFICATION_REQUIRED_BEFORE_LIVE",
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
