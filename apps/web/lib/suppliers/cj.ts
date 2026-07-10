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
      // Fetch detail for the full image set + product video.
      if (pid) {
        const detail = await cjFetch(token, `/product/query?pid=${pid}`);
        const dd = detail?.data ?? {};
        images = (dd.productImageSet ?? []).filter(Boolean);
        video = dd.productVideo || undefined;
        if (dd.description) description = String(dd.description).replace(/<[^>]+>/g, " ").slice(0, 400);
      }
      const primary = images[0] ?? row.productImage;
      products.push({
        external_id: String(pid ?? row.productSku ?? row.productNameEn),
        title: row.productNameEn ?? "Untitled",
        description,
        cost: Number(row.sellPrice ?? row.price ?? 0) || 0,
        image_url: primary,
        images: images.length ? images : primary ? [primary] : [],
        video_url: video,
        supplier_url: pid ? `https://cjdropshipping.com/product/-p-${pid}.html` : undefined,
      });
    }
    return { ok: true, products };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
