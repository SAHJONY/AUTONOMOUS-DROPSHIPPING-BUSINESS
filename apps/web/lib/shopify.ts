/**
 * Shopify Admin API connector. Publishes products/listings to a store the
 * owner connects with a custom-app access token. (Shopify does not allow
 * creating brand-new stores via API — those are billed accounts — so the model
 * connects an existing store and publishes to it.)
 */
const API_VERSION = "2024-10";

export interface ShopifyCreds {
  shop: string; // xxxxx.myshopify.com
  token: string; // Admin API access token (secret)
  connected_at: string;
}

/** Normalize any input into a myshopify.com admin domain. */
export function normalizeShop(input: string): string {
  let s = (input || "").trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!s) return "";
  if (!s.includes(".")) s = `${s}.myshopify.com`;
  return s;
}

async function shopifyFetch(creds: ShopifyCreds, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`https://${creds.shop}/admin/api/${API_VERSION}${path}`, {
    ...init,
    headers: {
      "X-Shopify-Access-Token": creds.token,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

export async function testShopify(
  creds: ShopifyCreds,
): Promise<{ ok: boolean; name?: string; error?: string }> {
  try {
    const res = await shopifyFetch(creds, "/shop.json", { method: "GET" });
    if (!res.ok) {
      return { ok: false, error: `Shopify responded ${res.status}. Check the domain and token.` };
    }
    const data = (await res.json()) as { shop?: { name?: string } };
    return { ok: true, name: data.shop?.name };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function createShopifyProduct(
  creds: ShopifyCreds,
  p: { title: string; description?: string; price?: number },
): Promise<{ ok: boolean; url?: string; id?: number; error?: string }> {
  try {
    const body = {
      product: {
        title: p.title,
        body_html: p.description ?? "",
        status: "active",
        vendor: "SAHJONY",
        variants: [{ price: String(p.price ?? 0) }],
      },
    };
    const res = await shopifyFetch(creds, "/products.json", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      return { ok: false, error: `Shopify ${res.status}: ${t.slice(0, 200)}` };
    }
    const data = (await res.json()) as { product?: { id?: number; handle?: string } };
    const handle = data.product?.handle;
    return {
      ok: true,
      id: data.product?.id,
      url: handle ? `https://${creds.shop}/products/${handle}` : undefined,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
