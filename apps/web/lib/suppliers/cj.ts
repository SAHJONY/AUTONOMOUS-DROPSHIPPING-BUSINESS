/**
 * CJ Dropshipping supplier connector. Sources real products — with real
 * images and product videos — via CJ's Admin API.
 *
 *   Auth:   POST /authentication/getAccessToken  { email, password: API_KEY }
 *           → accessToken (valid ~15 days; heavily rate-limited, so cache it).
 *   Header: CJ-Access-Token: <token> on all subsequent calls.
 */
const CJ_BASE = process.env.CJ_API_URL ?? "https://developers.cjdropshipping.com/api2.0/v1";

export interface CJCreds {
  email: string;
  api_key: string;
  connected_at: string;
}

export interface SupplierProduct {
  external_id: string;
  title: string;
  description: string;
  cost: number;
  image_url?: string;
  images: string[];
  video_url?: string;
  supplier_url?: string;
  /** CJ's product id — needed to look variants up later. */
  pid?: string;
  /** CJ's variant id — the thing an order actually references. */
  vid?: string;
  sku?: string;
}

export async function cjGetAccessToken(
  creds: CJCreds,
): Promise<{ ok: boolean; token?: string; expires_at?: number; error?: string }> {
  try {
    const res = await fetch(`${CJ_BASE}/authentication/getAccessToken`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: creds.email, password: creds.api_key }),
    });
    const d = await res.json().catch(() => ({}));
    const token = d?.data?.accessToken;
    if (!res.ok || !token) {
      return { ok: false, error: d?.message ?? `CJ auth failed (${res.status}).` };
    }
    // Token lifetime ~15 days; cache for 12 to be safe.
    return { ok: true, token, expires_at: Date.now() + 12 * 24 * 60 * 60 * 1000 };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function cjFetch(token: string, path: string): Promise<any> {
  const res = await fetch(`${CJ_BASE}${path}`, {
    headers: { "CJ-Access-Token": token, "Content-Type": "application/json" },
  });
  return res.json().catch(() => ({}));
}

async function cjPost(token: string, path: string, body: unknown): Promise<any> {
  const res = await fetch(`${CJ_BASE}${path}`, {
    method: "POST",
    headers: { "CJ-Access-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json().catch(() => ({}));
}

/** CJ signals success as `code: 200` (and/or `result: true`) inside a 200 response. */
function cjOk(payload: any): boolean {
  return payload?.code === 200 || payload?.result === true || payload?.success === true;
}

function cjError(payload: any, fallback: string): string {
  return payload?.message ?? payload?.msg ?? fallback;
}

/**
 * Pick the variant to order. Most dropshipped products have a single variant; when
 * there are several we take the cheapest in-stock one, which is what a human
 * sourcing agent does when the storefront only sells one configuration.
 */
export function pickVariant(
  variants: any[],
): { vid?: string; sku?: string; cost: number } | null {
  const usable = (variants ?? [])
    .map((v) => ({
      vid: v.vid ?? v.variantId ?? v.variantID,
      sku: v.variantSku ?? v.sku,
      cost: Number(v.variantSellPrice ?? v.sellPrice ?? v.price ?? 0) || 0,
    }))
    .filter((v) => v.vid);
  if (!usable.length) return null;
  const priced = usable.filter((v) => v.cost > 0);
  const pool = priced.length ? priced : usable;
  return pool.reduce((best, v) => (v.cost < best.cost ? v : best), pool[0]);
}

/** Look up a product's variants so we know what id to place an order against. */
export async function cjGetVariant(
  token: string,
  pid: string,
): Promise<{ ok: boolean; vid?: string; sku?: string; cost?: number; error?: string }> {
  try {
    const res = await cjFetch(token, `/product/variant/query?pid=${encodeURIComponent(pid)}`);
    const rows: any[] = res?.data?.list ?? res?.data ?? [];
    const picked = pickVariant(Array.isArray(rows) ? rows : []);
    if (!picked) return { ok: false, error: cjError(res, "No variants returned for this product.") };
    return { ok: true, vid: picked.vid, sku: picked.sku, cost: picked.cost };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export interface CJOrderRequest {
  /** Our order number — CJ echoes it back, which is how we reconcile. */
  order_number: string;
  email: string;
  name: string;
  phone: string;
  address1: string;
  address2?: string;
  city: string;
  province: string;
  zip: string;
  country: string;
  country_code: string;
  items: { vid: string; quantity: number }[];
  /** Shipping service. CJPacket Ordinary is the default economy tracked service. */
  logistic_name?: string;
}

export interface CJOrderResult {
  ok: boolean;
  order_id?: string;
  order_number?: string;
  product_amount?: number;
  postage_amount?: number;
  error?: string;
}

/**
 * Place a real order with the supplier. This spends money — every caller must
 * have passed the cost cap or an explicit owner approval before getting here.
 */
export async function cjCreateOrder(token: string, req: CJOrderRequest): Promise<CJOrderResult> {
  try {
    const payload = {
      orderNumber: req.order_number,
      shippingCustomerName: req.name,
      shippingPhone: req.phone,
      shippingAddress: [req.address1, req.address2].filter(Boolean).join(", "),
      shippingCity: req.city,
      shippingProvince: req.province,
      shippingZip: req.zip,
      shippingCountry: req.country,
      shippingCountryCode: req.country_code,
      email: req.email,
      fromCountryCode: "CN",
      logisticName: req.logistic_name ?? "CJPacket Ordinary",
      payType: 2, // settle from the CJ account balance
      products: req.items.map((i) => ({ vid: i.vid, quantity: i.quantity })),
    };
    const res = await cjPost(token, "/shopping/order/createOrderV2", payload);
    if (!cjOk(res)) return { ok: false, error: cjError(res, "CJ rejected the order.") };
    const d = res?.data ?? {};
    return {
      ok: true,
      order_id: String(d.orderId ?? d.orderID ?? d.id ?? ""),
      order_number: String(d.orderNum ?? d.orderNumber ?? req.order_number),
      product_amount: Number(d.productAmount ?? 0) || 0,
      postage_amount: Number(d.postageAmount ?? d.postage ?? 0) || 0,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export interface CJOrderStatus {
  ok: boolean;
  status?: string;
  tracking_number?: string;
  carrier?: string;
  product_amount?: number;
  postage_amount?: number;
  error?: string;
}

/** Poll a placed order for its status and, once shipped, its tracking number. */
export async function cjGetOrderStatus(token: string, orderId: string): Promise<CJOrderStatus> {
  try {
    const res = await cjFetch(token, `/shopping/order/getOrderDetail?orderId=${encodeURIComponent(orderId)}`);
    if (!cjOk(res)) return { ok: false, error: cjError(res, "Could not read the supplier order.") };
    const d = res?.data ?? {};
    const tracking = String(d.trackNumber ?? d.trackingNumber ?? "").trim();
    return {
      ok: true,
      status: String(d.orderStatus ?? d.status ?? ""),
      tracking_number: tracking || undefined,
      carrier: String(d.logisticName ?? d.shippingName ?? "").trim() || undefined,
      product_amount: Number(d.productAmount ?? 0) || 0,
      postage_amount: Number(d.postageAmount ?? d.postage ?? 0) || 0,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Public tracking URL for a shipment — what the customer clicks in the email. */
export function trackingUrl(trackingNumber: string): string {
  return `https://www.17track.net/en/track?nums=${encodeURIComponent(trackingNumber)}`;
}

/** Search CJ's catalog and return mapped products with real media. */
export async function cjSearchProducts(
  token: string,
  query: string,
  limit = 6,
): Promise<{ ok: boolean; products?: SupplierProduct[]; error?: string }> {
  try {
    const q = encodeURIComponent(query);
    const list = await cjFetch(token, `/product/list?pageNum=1&pageSize=${limit}&productNameEn=${q}`);
    const rows: any[] = list?.data?.list ?? [];
    if (!rows.length) return { ok: true, products: [] };

    const products: SupplierProduct[] = [];
    for (const row of rows.slice(0, limit)) {
      const pid = row.pid ?? row.productId;
      let images: string[] = [];
      let video: string | undefined;
      let description = row.productNameEn ?? "";
      let variant: { vid?: string; sku?: string; cost: number } | null = null;
      // Fetch detail for the full image set, product video, and orderable variant.
      if (pid) {
        const detail = await cjFetch(token, `/product/query?pid=${pid}`);
        const dd = detail?.data ?? {};
        images = (dd.productImageSet ?? []).filter(Boolean);
        video = dd.productVideo || undefined;
        if (dd.description) description = String(dd.description).replace(/<[^>]+>/g, " ").slice(0, 400);
        // The detail payload usually carries variants; fall back to the dedicated
        // endpoint so we always land a vid — without one the product can be
        // listed but never actually shipped.
        variant = pickVariant(dd.variants ?? dd.variantList ?? []);
        if (!variant) {
          const looked = await cjGetVariant(token, String(pid));
          if (looked.ok) variant = { vid: looked.vid, sku: looked.sku, cost: looked.cost ?? 0 };
        }
      }
      const primary = images[0] ?? row.productImage;
      products.push({
        external_id: String(pid ?? row.productSku ?? row.productNameEn),
        title: row.productNameEn ?? "Untitled",
        description,
        cost: Number(variant?.cost || row.sellPrice || row.price || 0) || 0,
        image_url: primary,
        images: images.length ? images : primary ? [primary] : [],
        video_url: video,
        supplier_url: pid ? `https://cjdropshipping.com/product/-p-${pid}.html` : undefined,
        pid: pid ? String(pid) : undefined,
        vid: variant?.vid,
        sku: variant?.sku ?? row.productSku,
      });
    }
    return { ok: true, products };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
