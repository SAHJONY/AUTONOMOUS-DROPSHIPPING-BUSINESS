/**
 * Shopify Admin API connector. Publishes products to a store the owner
 * connects. Supports both:
 *   - New Dev Dashboard apps: Client ID + Client Secret exchanged for a
 *     short-lived (24h) token via the client-credentials grant.
 *   - Legacy custom apps: a static Admin API access token (shpat_…).
 * (Shopify does not allow creating brand-new stores via API.)
 */
const API_VERSION = "2024-10";

export interface ShopifyCreds {
  shop: string; // xxxxx.myshopify.com
  token?: string; // legacy static Admin API token
  client_id?: string; // Dev Dashboard app client id
  client_secret?: string; // Dev Dashboard app client secret (used to mint tokens)
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

/** Exchange Client ID + Secret for a short-lived Admin API token (client-credentials grant). */
export async function mintAccessToken(
  shop: string,
  clientId: string,
  clientSecret: string,
): Promise<{ ok: boolean; token?: string; expires_in?: number; error?: string }> {
  try {
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    });
    const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      const t = await res.text();
      return { ok: false, error: `Token request ${res.status}: ${t.slice(0, 180)}` };
    }
    const d = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!d.access_token) return { ok: false, error: "No access_token in response." };
    return { ok: true, token: d.access_token, expires_in: d.expires_in ?? 86399 };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function shopifyFetch(
  shop: string,
  token: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`https://${shop}/admin/api/${API_VERSION}${path}`, {
    ...init,
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

export async function testShopifyToken(
  shop: string,
  token: string,
): Promise<{ ok: boolean; name?: string; error?: string }> {
  try {
    const res = await shopifyFetch(shop, token, "/shop.json", { method: "GET" });
    if (!res.ok) return { ok: false, error: `Shopify responded ${res.status}.` };
    const data = (await res.json()) as { shop?: { name?: string } };
    return { ok: true, name: data.shop?.name };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Embed a product video (mp4 → HTML5 player; YouTube/Vimeo → iframe). */
function videoEmbed(url?: string): string {
  if (!url) return "";
  const u = url.trim();
  const yt = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]+)/i);
  if (yt) {
    return `<div style="margin:1em 0"><iframe width="100%" height="360" src="https://www.youtube.com/embed/${yt[1]}" frameborder="0" allowfullscreen></iframe></div>`;
  }
  if (/vimeo\.com\/(\d+)/i.test(u)) {
    const id = u.match(/vimeo\.com\/(\d+)/i)![1];
    return `<div style="margin:1em 0"><iframe src="https://player.vimeo.com/video/${id}" width="100%" height="360" frameborder="0" allowfullscreen></iframe></div>`;
  }
  return `<div style="margin:1em 0"><video controls playsinline preload="metadata" style="width:100%;border-radius:12px" src="${u}"></video></div>`;
}

/**
 * Spanish-first product copy for BOTANICA OCHOSI.
 *
 * Keep this factual: product pages must not invent guarantees, shipping reach,
 * spiritual outcomes, scarcity, or historical prices. Commercial promises are
 * controlled by the actual Shopify policies and product data instead.
 */
function premiumBody(title: string, description?: string, videoUrl?: string): string {
  const d =
    (description && description.trim()) ||
    `${title}, seleccionado para el catálogo de BOTANICA OCHOSI. Consulta la ficha, variantes y disponibilidad antes de comprar.`;
  return (
    `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.75;color:#1a1a1a">` +
    videoEmbed(videoUrl) +
    `<p style="font-size:1.06em;margin:0 0 1em">${d}</p>` +
    `<ul style="list-style:none;padding:0;margin:0">` +
    `<li style="margin:.4em 0">✦ &nbsp;Seleccionado por BOTANICA OCHOSI</li>` +
    `<li style="margin:.4em 0">✦ &nbsp;Información comercial en español</li>` +
    `<li style="margin:.4em 0">✦ &nbsp;Pago procesado mediante checkout seguro</li>` +
    `<li style="margin:.4em 0">✦ &nbsp;Envío y devoluciones según las políticas mostradas al comprar</li>` +
    `</ul>` +
    `<p style="font-size:.88em;margin:1em 0 0;color:#666">Los artículos religiosos y espirituales se ofrecen como productos culturales, devocionales o tradicionales. No se garantizan resultados espirituales específicos.</p>` +
    `</div>`
  );
}

/** Look up a live product's numeric id from its storefront handle. */
export async function findProductIdByHandle(
  shop: string,
  token: string,
  handle: string,
): Promise<number | undefined> {
  try {
    const res = await shopifyFetch(
      shop,
      token,
      `/products.json?handle=${encodeURIComponent(handle)}&fields=id,handle`,
      { method: "GET" },
    );
    if (!res.ok) return undefined;
    const data = (await res.json()) as { products?: { id?: number; handle?: string }[] };
    return data.products?.find((p) => p.handle === handle)?.id ?? data.products?.[0]?.id;
  } catch {
    return undefined;
  }
}

/**
 * Replace the image gallery on an already-published product. Sending the full
 * `images` array to the product update endpoint replaces the existing gallery,
 * so this is how we refresh live products with new premium imagery.
 */
export async function replaceProductImages(
  shop: string,
  token: string,
  productId: number,
  images: string[],
): Promise<{ ok: boolean; error?: string }> {
  try {
    const gallery = [...new Set(images.filter(Boolean))].slice(0, 10);
    if (!gallery.length) return { ok: false, error: "No images to set." };
    const res = await shopifyFetch(shop, token, `/products/${productId}.json`, {
      method: "PUT",
      body: JSON.stringify({
        product: { id: productId, images: gallery.map((src) => ({ src })) },
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      return { ok: false, error: `Shopify ${res.status}: ${t.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function createShopifyProduct(
  shop: string,
  token: string,
  p: {
    title: string;
    description?: string;
    price?: number;
    compare_at_price?: number;
    image_url?: string;
    images?: string[];
    video_url?: string;
    category?: string;
    tags?: string[];
    /** Set false for HOLD/draft products that have not passed catalog verification. */
    publish?: boolean;
    /** Stamped onto the variant so incoming orders map straight back to the catalog. */
    sku?: string;
  },
): Promise<{
  ok: boolean;
  url?: string;
  id?: number;
  handle?: string;
  variant_id?: number;
  error?: string;
}> {
  try {
    const price = p.price ?? 0;
    const compareAt =
      typeof p.compare_at_price === "number" && p.compare_at_price > price
        ? p.compare_at_price.toFixed(2)
        : undefined;
    const publish = p.publish !== false;
    const category = (p.category || "Botánica y artículos religiosos").trim();
    const tags = [
      "BOTANICA OCHOSI",
      "Español",
      category,
      ...(p.tags ?? []),
    ]
      .map((tag) => tag.trim())
      .filter(Boolean)
      .filter((tag, index, all) => all.indexOf(tag) === index)
      .join(", ");
    // Full image gallery (dedupe, cap at 10).
    const gallery = [...new Set([...(p.image_url ? [p.image_url] : []), ...(p.images ?? [])])].slice(0, 10);
    const body = {
      product: {
        title: p.title,
        body_html: premiumBody(p.title, p.description, p.video_url),
        status: publish ? "active" : "draft",
        published: publish,
        published_scope: "global",
        vendor: "BOTANICA OCHOSI",
        product_type: category,
        tags,
        variants: [
          {
            price: String(price),
            ...(compareAt ? { compare_at_price: compareAt } : {}),
            ...(p.sku ? { sku: p.sku } : {}),
            inventory_policy: "continue",
          },
        ],
        ...(gallery.length ? { images: gallery.map((src) => ({ src })) } : {}),
      },
    };
    const res = await shopifyFetch(shop, token, "/products.json", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      return { ok: false, error: `Shopify ${res.status}: ${t.slice(0, 200)}` };
    }
    const data = (await res.json()) as {
      product?: { id?: number; handle?: string; variants?: { id?: number; sku?: string }[] };
    };
    const handle = data.product?.handle;
    return {
      ok: true,
      id: data.product?.id,
      handle,
      variant_id: data.product?.variants?.[0]?.id,
      url: handle ? `https://${shop}/products/${handle}` : undefined,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/* ==========================================================================
 * Orders, fulfillment, and webhooks — everything after the sale.
 * ========================================================================== */

export interface ShopifyOrderPage {
  ok: boolean;
  orders?: Record<string, unknown>[];
  error?: string;
}

/**
 * Pull orders from the store. `since` narrows to orders updated after a
 * timestamp, which is what the polling sync uses to stay cheap; `status=any`
 * includes closed and cancelled orders so the books stay complete.
 */
export async function listShopifyOrders(
  shop: string,
  token: string,
  opts: { since?: string; limit?: number; status?: string } = {},
): Promise<ShopifyOrderPage> {
  try {
    const params = new URLSearchParams({
      status: opts.status ?? "any",
      limit: String(Math.min(Math.max(opts.limit ?? 50, 1), 250)),
    });
    if (opts.since) params.set("updated_at_min", opts.since);
    const res = await shopifyFetch(shop, token, `/orders.json?${params.toString()}`, { method: "GET" });
    if (!res.ok) {
      const t = await res.text();
      return { ok: false, error: `Shopify ${res.status}: ${t.slice(0, 200)}` };
    }
    const data = (await res.json()) as { orders?: Record<string, unknown>[] };
    return { ok: true, orders: data.orders ?? [] };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function getShopifyOrder(
  shop: string,
  token: string,
  orderId: string,
): Promise<{ ok: boolean; order?: Record<string, unknown>; error?: string }> {
  try {
    const res = await shopifyFetch(shop, token, `/orders/${orderId}.json`, { method: "GET" });
    if (!res.ok) return { ok: false, error: `Shopify ${res.status}` };
    const data = (await res.json()) as { order?: Record<string, unknown> };
    return { ok: true, order: data.order };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Shopify's fraud assessment for an order. Returns the strongest recommendation
 * across all assessments ("cancel" > "investigate" > "accept"), which is what
 * decides whether we spend money at the supplier or hold for a human.
 */
export async function getOrderRiskRecommendation(
  shop: string,
  token: string,
  orderId: string,
): Promise<string> {
  try {
    const res = await shopifyFetch(shop, token, `/orders/${orderId}/risks.json`, { method: "GET" });
    if (!res.ok) return "accept";
    const data = (await res.json()) as { risks?: { recommendation?: string }[] };
    const recs = (data.risks ?? []).map((r) => (r.recommendation ?? "").toLowerCase());
    if (recs.includes("cancel")) return "cancel";
    if (recs.includes("investigate")) return "investigate";
    return "accept";
  } catch {
    return "accept";
  }
}

/**
 * Mark an order shipped with a real tracking number.
 *
 * The 2024-10 Admin API only creates fulfillments through fulfillment orders, so
 * this resolves the order's open fulfillment orders first and fulfills them in
 * one call. `notify_customer` is on: the shopper gets the shipping email that
 * makes the whole thing feel like a real store.
 */
export async function fulfillShopifyOrder(
  shop: string,
  token: string,
  orderId: string,
  tracking: { number: string; url?: string; company?: string },
): Promise<{ ok: boolean; fulfillment_id?: number; error?: string }> {
  try {
    const foRes = await shopifyFetch(shop, token, `/orders/${orderId}/fulfillment_orders.json`, {
      method: "GET",
    });
    if (!foRes.ok) {
      const t = await foRes.text();
      return { ok: false, error: `Fulfillment orders ${foRes.status}: ${t.slice(0, 160)}` };
    }
    const foData = (await foRes.json()) as {
      fulfillment_orders?: { id?: number; status?: string }[];
    };
    const open = (foData.fulfillment_orders ?? []).filter((fo) =>
      ["open", "in_progress", "scheduled"].includes((fo.status ?? "").toLowerCase()),
    );
    if (!open.length) return { ok: false, error: "No open fulfillment orders — already fulfilled?" };

    const res = await shopifyFetch(shop, token, "/fulfillments.json", {
      method: "POST",
      body: JSON.stringify({
        fulfillment: {
          line_items_by_fulfillment_order: open.map((fo) => ({ fulfillment_order_id: fo.id })),
          tracking_info: {
            number: tracking.number,
            url: tracking.url,
            company: tracking.company,
          },
          notify_customer: true,
        },
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      return { ok: false, error: `Shopify ${res.status}: ${t.slice(0, 200)}` };
    }
    const data = (await res.json()) as { fulfillment?: { id?: number } };
    return { ok: true, fulfillment_id: data.fulfillment?.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Topics we subscribe to. Everything that changes the books or the pipeline. */
export const WEBHOOK_TOPICS = [
  "orders/create",
  "orders/updated",
  "orders/cancelled",
  "refunds/create",
] as const;

export async function listShopifyWebhooks(
  shop: string,
  token: string,
): Promise<{ ok: boolean; webhooks?: { id?: number; topic?: string; address?: string }[]; error?: string }> {
  try {
    const res = await shopifyFetch(shop, token, "/webhooks.json", { method: "GET" });
    if (!res.ok) return { ok: false, error: `Shopify ${res.status}` };
    const data = (await res.json()) as { webhooks?: { id?: number; topic?: string; address?: string }[] };
    return { ok: true, webhooks: data.webhooks ?? [] };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Subscribe the store to our order feed. Idempotent: existing subscriptions
 * pointing at the same address are left alone, so this is safe to call on every
 * connect and from the daily cron.
 */
export async function registerShopifyWebhooks(
  shop: string,
  token: string,
  callbackUrl: string,
): Promise<{ ok: boolean; created: string[]; existing: string[]; errors: string[] }> {
  const created: string[] = [];
  const existing: string[] = [];
  const errors: string[] = [];

  const current = await listShopifyWebhooks(shop, token);
  const already = new Set(
    (current.webhooks ?? [])
      .filter((w) => (w.address ?? "").startsWith(callbackUrl))
      .map((w) => w.topic ?? ""),
  );

  for (const topic of WEBHOOK_TOPICS) {
    if (already.has(topic)) {
      existing.push(topic);
      continue;
    }
    try {
      const res = await shopifyFetch(shop, token, "/webhooks.json", {
        method: "POST",
        body: JSON.stringify({
          webhook: { topic, address: `${callbackUrl}/${topic.replace("/", ".")}`, format: "json" },
        }),
      });
      if (res.ok) created.push(topic);
      else {
        const t = await res.text();
        // 422 with "already been taken" means another address owns this topic.
        if (res.status === 422 && /taken/i.test(t)) existing.push(topic);
        else errors.push(`${topic}: ${res.status} ${t.slice(0, 120)}`);
      }
    } catch (e) {
      errors.push(`${topic}: ${(e as Error).message}`);
    }
  }
  return { ok: errors.length === 0, created, existing, errors };
}

/**
 * Verify a webhook actually came from Shopify.
 *
 * Shopify signs the raw request body with the app secret and sends base64
 * HMAC-SHA256 in `X-Shopify-Hmac-Sha256`. The comparison is constant-time —
 * a byte-by-byte early exit would leak the expected signature to anyone willing
 * to time their requests, and an order feed anyone can forge is a ledger anyone
 * can forge.
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  if (!secret || !signature) return false;
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const mac = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
    const expected = Buffer.from(new Uint8Array(mac)).toString("base64");
    return timingSafeEqual(expected, signature.trim());
  } catch {
    return false;
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = Buffer.from(a, "utf8");
  const bBytes = Buffer.from(b, "utf8");
  // Compare a fixed-length digest of both sides so mismatched lengths don't
  // short-circuit and reveal the expected length.
  const length = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < length; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}
