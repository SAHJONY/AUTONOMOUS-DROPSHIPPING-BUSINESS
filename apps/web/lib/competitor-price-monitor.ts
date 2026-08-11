import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { listGet, listReplace } from "./kv";

export type CompetitorCatalogProduct = Record<string, unknown> & {
  id: string;
  name: string;
  wholesalePrice?: number;
  shippingCost?: number;
  handlingCost?: number;
  usdExchangeRate?: number;
  currency?: string;
  competitorUrl?: string;
  competitorPriceUsd?: number;
  competitorCurrency?: string;
  competitorScannedAt?: string;
  competitorScanStatus?: string;
  competitivePriceRecommendationUsd?: number;
};

const catalogKey = (orgId: string) => `owner:supplier-catalogs:${orgId}`;
const MAX_HTML_BYTES = 1_000_000;

function privateIpv4(address: string): boolean {
  const [a, b] = address.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function privateIpv6(address: string): boolean {
  const value = address.toLowerCase();
  return value === "::1" || value === "::" || value.startsWith("fc") ||
    value.startsWith("fd") || value.startsWith("fe8") || value.startsWith("fe9") ||
    value.startsWith("fea") || value.startsWith("feb");
}

export function isBlockedCompetitorHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  const family = isIP(host);
  return family === 4 ? privateIpv4(host) : family === 6 ? privateIpv6(host) : false;
}

async function assertPublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password || isBlockedCompetitorHostname(url.hostname)) {
    throw new Error("URL competitiva no permitida; use una página pública HTTPS.");
  }
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isBlockedCompetitorHostname(address))) {
    throw new Error("La URL competitiva no resuelve a una dirección pública.");
  }
  return url;
}

export function extractPublicProductPrice(html: string): { price: number; currency: string } | null {
  const jsonBlocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const block of jsonBlocks) {
    try {
      const root = JSON.parse(block[1]);
      const queue: unknown[] = Array.isArray(root) ? [...root] : [root];
      while (queue.length) {
        const item = queue.shift();
        if (!item || typeof item !== "object") continue;
        const object = item as Record<string, unknown>;
        if (object["@graph"] && Array.isArray(object["@graph"])) queue.push(...object["@graph"]);
        const offers = Array.isArray(object.offers) ? object.offers[0] : object.offers;
        if (offers && typeof offers === "object") {
          const offer = offers as Record<string, unknown>;
          const price = Number(offer.price ?? offer.lowPrice);
          if (Number.isFinite(price) && price > 0) return { price, currency: String(offer.priceCurrency ?? "USD").toUpperCase() };
        }
      }
    } catch { /* malformed public metadata */ }
  }
  const amount = html.match(/(?:property|itemprop)=["'](?:product:price:amount|price)["'][^>]+content=["']([0-9.,]+)["']/i)?.[1];
  if (!amount) return null;
  const price = Number(amount.replace(/,/g, ""));
  const currency = html.match(/(?:property|itemprop)=["'](?:product:price:currency|priceCurrency)["'][^>]+content=["']([A-Za-z]{3})["']/i)?.[1] ?? "USD";
  return Number.isFinite(price) && price > 0 ? { price, currency: currency.toUpperCase() } : null;
}

export function competitiveRecommendationUsd(product: CompetitorCatalogProduct, competitorPriceUsd: number): number {
  const rate = String(product.currency ?? "USD").toUpperCase() === "USD" ? 1 : Number(product.usdExchangeRate) || 0;
  const floor = ((Number(product.wholesalePrice) || 0) * 1.35 + (Number(product.shippingCost) || 0) + (Number(product.handlingCost) || 0)) * rate;
  if (!floor) return 0;
  return Math.round(Math.max(floor, competitorPriceUsd - 0.01) * 100) / 100;
}

async function scanUrl(raw: string): Promise<{ price: number; currency: string }> {
  let url = await assertPublicUrl(raw);
  for (let redirects = 0; redirects <= 3; redirects++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(url, { redirect: "manual", signal: controller.signal, headers: { "User-Agent": "BOTANICA-OCHOSI-PriceMonitor/1.0" } });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new Error("Redirección competitiva inválida.");
        url = await assertPublicUrl(new URL(location, url).toString());
        continue;
      }
      if (!response.ok) throw new Error(`La página respondió HTTP ${response.status}.`);
      const declared = Number(response.headers.get("content-length") ?? 0);
      if (declared > MAX_HTML_BYTES) throw new Error("La página excede el tamaño permitido.");
      const html = (await response.text()).slice(0, MAX_HTML_BYTES + 1);
      if (html.length > MAX_HTML_BYTES) throw new Error("La página excede el tamaño permitido.");
      const result = extractPublicProductPrice(html);
      if (!result) throw new Error("No se encontró un precio público estructurado.");
      return result;
    } finally { clearTimeout(timeout); }
  }
  throw new Error("Demasiadas redirecciones.");
}

export async function scanCompetitorPricesForOrg(orgId: string, limit = 20) {
  const products = await listGet<CompetitorCatalogProduct>(catalogKey(orgId));
  let scanned = 0, updated = 0, failed = 0;
  for (const product of products) {
    if (!product.competitorUrl || scanned >= limit) continue;
    scanned++;
    try {
      const result = await scanUrl(product.competitorUrl);
      product.competitorScannedAt = new Date().toISOString();
      product.competitorCurrency = result.currency;
      if (result.currency !== "USD") {
        product.competitorScanStatus = `Precio detectado en ${result.currency}; conversión verificada pendiente.`;
        failed++;
        continue;
      }
      product.competitorPriceUsd = result.price;
      product.competitivePriceRecommendationUsd = competitiveRecommendationUsd(product, result.price);
      product.competitorScanStatus = "Precio público verificado; recomendación pendiente de aprobación Owner.";
      updated++;
    } catch (error) {
      product.competitorScannedAt = new Date().toISOString();
      product.competitorScanStatus = error instanceof Error ? error.message : "No se pudo escanear.";
      failed++;
    }
  }
  if (scanned) await listReplace(catalogKey(orgId), products);
  return { scanned, updated, failed };
}
