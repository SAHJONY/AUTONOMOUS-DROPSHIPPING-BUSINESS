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

/** Ultra-premium storefront copy — the design skill applied to the listing. */
function premiumBody(title: string, description?: string, videoUrl?: string): string {
  const d =
    (description && description.trim()) ||
    `Meet the ${title} — engineered for those who expect more. A refined essential, curated by SAHJONY.`;
  return (
    `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.75;color:#1a1a1a">` +
    videoEmbed(videoUrl) +
    `<p style="font-size:1.06em;margin:0 0 1em">${d}</p>` +
    `<ul style="list-style:none;padding:0;margin:0">` +
    `<li style="margin:.4em 0">✦ &nbsp;Premium quality, hand-curated by SAHJONY</li>` +
    `<li style="margin:.4em 0">✦ &nbsp;Fast, fully tracked worldwide shipping</li>` +
    `<li style="margin:.4em 0">✦ &nbsp;30-day satisfaction guarantee</li>` +
    `<li style="margin:.4em 0">✦ &nbsp;Secure checkout</li>` +
    `</ul></div>`
  );
}

export async function createShopifyProduct(
  shop: string,
  token: string,
  p: {
    title: string;
    description?: string;
    price?: number;
    image_url?: string;
    images?: string[];
    video_url?: string;
  },
): Promise<{ ok: boolean; url?: string; id?: number; error?: string }> {
  try {
    const price = p.price ?? 0;
    // "Was" price for a premium, high-value perception (~1.6x, rounded to .99).
    const compareAt = price > 0 ? (Math.ceil(price * 1.6) - 0.01).toFixed(2) : undefined;
    // Full image gallery (dedupe, cap at 10).
    const gallery = [...new Set([...(p.image_url ? [p.image_url] : []), ...(p.images ?? [])])].slice(0, 10);
    const body = {
      product: {
        title: p.title,
        body_html: premiumBody(p.title, p.description, p.video_url),
        status: "active",
        published: true,
        published_scope: "global", // publish to all sales channels incl. Online Store
        vendor: "SAHJONY",
        product_type: "Featured",
        tags: "SAHJONY, Trending, Featured, Autonomous",
        variants: [
          {
            price: String(price),
            ...(compareAt ? { compare_at_price: compareAt } : {}),
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
    const data = (await res.json()) as { product?: { id?: number; handle?: string } };
    const handle = data.product?.handle;
    return {
      ok: true,
      id: data.product?.id,
      url: handle ? `https://${shop}/products/${handle}` : undefined,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
