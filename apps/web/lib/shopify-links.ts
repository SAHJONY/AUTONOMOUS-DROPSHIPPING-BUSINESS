export type ShopifyOwnerLinks = { storefront: string; admin: string };

/** Build owner-facing links only for canonical Shopify shop domains. */
export function getShopifyOwnerLinks(shop: string | null | undefined): ShopifyOwnerLinks | null {
  const domain = String(shop ?? "").trim().toLowerCase();
  const match = domain.match(/^([a-z0-9][a-z0-9-]{0,62})\.myshopify\.com$/);
  if (!match) return null;
  return {
    storefront: `https://${domain}`,
    admin: `https://admin.shopify.com/store/${match[1]}`
  };
}
