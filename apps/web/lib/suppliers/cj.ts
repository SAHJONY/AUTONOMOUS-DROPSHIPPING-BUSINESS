/**
 * CJ Dropshipping supplier connector. Sources real products — with real
 * images and product videos — via CJ's Admin API.
 */
import { assertBotanicaSourcingQuery, botanicaRelevantText } from "../botanica-policy";

const CJ_BASE = process.env.CJ_API_URL ?? "https://developers.cjdropshipping.com/api2.0/v1";

export interface CJCreds { email: string; api_key: string; connected_at: string; }
export interface SupplierProduct {
  external_id: string; title: string; description: string; cost: number;
  image_url?: string; images: string[]; video_url?: string; supplier_url?: string;
  pid?: string; vid?: string; sku?: string;
}

export async function cjGetAccessToken(creds: CJCreds): Promise<{ ok: boolean; token?: string; expires_at?: number; error?: string }> {
  try {
    const res = await fetch(`${CJ_BASE}/authentication/getAccessToken`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: creds.email, password: creds.api_key }),
    });
    const d = await res.json().catch(() => ({}));
    const token = d?.data?.accessToken;
    if (!res.ok || !token) return { ok: false, error: d?.message ?? `CJ auth failed (${res.status}).` };
    return { ok: true, token, expires_at: Date.now() + 12 * 24 * 60 * 60 * 1000 };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

async function cjFetch(token: string, path: string): Promise<any> {
  const res = await fetch(`${CJ_BASE}${path}`, { headers: { "CJ-Access-Token": token, "Content-Type": "application/json" } });
  return res.json().catch(() => ({}));
}
async function cjPost(token: string, path: string, body: unknown): Promise<any> {
  const res = await fetch(`${CJ_BASE}${path}`, { method: "POST", headers: { "CJ-Access-Token": token, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res.json().catch(() => ({}));
}
function cjOk(payload: any): boolean { return payload?.code === 200 || payload?.result === true || payload?.success === true; }
function cjError(payload: any, fallback: string): string { return payload?.message ?? payload?.msg ?? fallback; }

export function pickVariant(variants: any[]): { vid?: string; sku?: string; cost: number } | null {
  const usable = (variants ?? []).map((v) => ({
    vid: v.vid ?? v.variantId ?? v.variantID,
    sku: v.variantSku ?? v.sku,
    cost: Number(v.variantSellPrice ?? v.sellPrice ?? v.price ?? 0) || 0,
  })).filter((v) => v.vid);
  if (!usable.length) return null;
  const priced = usable.filter((v) => v.cost > 0);
  const pool = priced.length ? priced : usable;
  return pool.reduce((best, v) => (v.cost < best.cost ? v : best), pool[0]);
}

export async function cjGetVariant(token: string, pid: string): Promise<{ ok: boolean; vid?: string; sku?: string; cost?: number; error?: string }> {
  try {
    const res = await cjFetch(token, `/product/variant/query?pid=${encodeURIComponent(pid)}`);
    const rows: any[] = res?.data?.list ?? res?.data ?? [];
    const picked = pickVariant(Array.isArray(rows) ? rows : []);
    if (!picked) return { ok: false, error: cjError(res, "No variants returned for this product.") };
    return { ok: true, vid: picked.vid, sku: picked.sku, cost: picked.cost };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

export interface CJOrderRequest {
  order_number: string; email: string; name: string; phone: string; address1: string; address2?: string;
  city: string; province: string; zip: string; country: string; country_code: string;
  items: { vid: string; quantity: number }[]; logistic_name?: string;
}
export interface CJOrderResult { ok: boolean; order_id?: string; order_number?: string; product_amount?: number; postage_amount?: number; error?: string; }

export async function cjCreateOrder(token: string, req: CJOrderRequest): Promise<CJOrderResult> {
  try {
    const payload = {
      orderNumber: req.order_number, shippingCustomerName: req.name, shippingPhone: req.phone,
      shippingAddress: [req.address1, req.address2].filter(Boolean).join(", "), shippingCity: req.city,
      shippingProvince: req.province, shippingZip: req.zip, shippingCountry: req.country,
      shippingCountryCode: req.country_code, email: req.email, fromCountryCode: "CN",
      logisticName: req.logistic_name ?? "CJPacket Ordinary", payType: 2,
      products: req.items.map((i) => ({ vid: i.vid, quantity: i.quantity })),
    };
    const res = await cjPost(token, "/shopping/order/createOrderV2", payload);
    if (!cjOk(res)) return { ok: false, error: cjError(res, "CJ rejected the order.") };
    const d = res?.data ?? {};
    return { ok: true, order_id: String(d.orderId ?? d.orderID ?? d.id ?? ""), order_number: String(d.orderNum ?? d.orderNumber ?? req.order_number), product_amount: Number(d.productAmount ?? 0) || 0, postage_amount: Number(d.postageAmount ?? d.postage ?? 0) || 0 };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

export interface CJOrderStatus { ok: boolean; status?: string; tracking_number?: string; carrier?: string; product_amount?: number; postage_amount?: number; error?: string; }
export async function cjGetOrderStatus(token: string, orderId: string): Promise<CJOrderStatus> {
  try {
    const res = await cjFetch(token, `/shopping/order/getOrderDetail?orderId=${encodeURIComponent(orderId)}`);
    if (!cjOk(res)) return { ok: false, error: cjError(res, "Could not read the supplier order.") };
    const d = res?.data ?? {}; const tracking = String(d.trackNumber ?? d.trackingNumber ?? "").trim();
    return { ok: true, status: String(d.orderStatus ?? d.status ?? ""), tracking_number: tracking || undefined, carrier: String(d.logisticName ?? d.shippingName ?? "").trim() || undefined, product_amount: Number(d.productAmount ?? 0) || 0, postage_amount: Number(d.postageAmount ?? d.postage ?? 0) || 0 };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}
export function trackingUrl(trackingNumber: string): string { return `https://www.17track.net/en/track?nums=${encodeURIComponent(trackingNumber)}`; }

const DELIVERED_PATTERNS = [/\bdelivered\b/i,/\bsigned[ _-]?(for|by)?\b/i,/\bcollected by (the )?customer\b/i,/\bparcel (has been )?received\b/i];
const NOT_DELIVERED_PATTERNS = [/\battempted\b/i,/\bfailed\b/i,/\bout for delivery\b/i,/\bready for (pick ?up|collection)\b/i,/\bawaiting\b/i,/\bnot delivered\b/i];
export function isDeliveredStatus(status: string | undefined | null): boolean {
  const s = (status ?? "").trim(); if (!s) return false;
  if (NOT_DELIVERED_PATTERNS.some((re) => re.test(s))) return false;
  return DELIVERED_PATTERNS.some((re) => re.test(s));
}
export interface CJTracking { ok: boolean; delivered?: boolean; status?: string; error?: string; }
export async function cjGetTracking(token: string, trackingNumber: string): Promise<CJTracking> {
  try {
    const res = await cjFetch(token, `/logistic/trackInfo?trackNumber=${encodeURIComponent(trackingNumber)}`);
    if (!cjOk(res)) return { ok: false, error: cjError(res, "Could not read tracking.") };
    const data = res?.data; const record = Array.isArray(data) ? data[0] : data;
    const events: any[] = record?.trackDetailList ?? record?.trackDetails ?? []; const latest = events.length ? events[events.length - 1] : null;
    const status = String(record?.trackStatus ?? latest?.trackDescription ?? latest?.status ?? "").trim();
    return { ok: true, status: status || undefined, delivered: isDeliveredStatus(status) };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

/** Search CJ only for explicitly Botanica/Lucumi/Orisha/Santeria merchandise. */
export async function cjSearchProducts(token: string, query: string, limit = 6): Promise<{ ok: boolean; products?: SupplierProduct[]; error?: string }> {
  const gate = assertBotanicaSourcingQuery(query);
  if (!gate.ok) return { ok: false, error: gate.error };
  try {
    const q = encodeURIComponent(query);
    const list = await cjFetch(token, `/product/list?pageNum=1&pageSize=${limit}&productNameEn=${q}`);
    const rows: any[] = list?.data?.list ?? [];
    if (!rows.length) return { ok: true, products: [] };
    const products: SupplierProduct[] = [];
    for (const row of rows.slice(0, limit)) {
      const pid = row.pid ?? row.productId; let images: string[] = []; let video: string | undefined;
      let description = row.productNameEn ?? ""; let variant: { vid?: string; sku?: string; cost: number } | null = null;
      if (pid) {
        const detail = await cjFetch(token, `/product/query?pid=${pid}`); const dd = detail?.data ?? {};
        images = (dd.productImageSet ?? []).filter(Boolean); video = dd.productVideo || undefined;
        if (dd.description) description = String(dd.description).replace(/<[^>]+>/g, " ").slice(0, 400);
        variant = pickVariant(dd.variants ?? dd.variantList ?? []);
        if (!variant) { const looked = await cjGetVariant(token, String(pid)); if (looked.ok) variant = { vid: looked.vid, sku: looked.sku, cost: looked.cost ?? 0 }; }
      }
      const title = row.productNameEn ?? "Untitled";
      if (!botanicaRelevantText(`${title} ${description}`)) continue;
      const primary = images[0] ?? row.productImage;
      products.push({ external_id: String(pid ?? row.productSku ?? title), title, description, cost: Number(variant?.cost || row.sellPrice || row.price || 0) || 0, image_url: primary, images: images.length ? images : primary ? [primary] : [], video_url: video, supplier_url: pid ? `https://cjdropshipping.com/product/-p-${pid}.html` : undefined, pid: pid ? String(pid) : undefined, vid: variant?.vid, sku: variant?.sku ?? row.productSku });
    }
    return { ok: true, products };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}
