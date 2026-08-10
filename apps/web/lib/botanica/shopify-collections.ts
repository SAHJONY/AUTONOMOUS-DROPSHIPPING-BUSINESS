import { SPANISH_FIRST_COLLECTIONS } from "./commerce-schema";

const SHOPIFY_API_VERSION = "2024-10";

export type ShopifyCollectionSyncResult = {
  ok: boolean;
  created: string[];
  existing: string[];
  errors: string[];
};

type SmartCollection = {
  id?: number;
  title?: string;
  handle?: string;
};

function adminUrl(shop: string, path: string): string {
  return `https://${shop}/admin/api/${SHOPIFY_API_VERSION}${path}`;
}

async function shopifyRequest(shop: string, token: string, path: string, init?: RequestInit): Promise<Response> {
  return fetch(adminUrl(shop, path), {
    ...init,
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

/**
 * Ensure the Spanish-first BOTANICA OCHOSI collection architecture exists in Shopify.
 *
 * Collections are smart collections driven by exact product tags. The product publisher
 * already accepts explicit tags, so a SKU only joins a collection when its verified
 * catalog record intentionally carries that collection tag. HOLD/draft products remain
 * unpublished even if they match a collection rule.
 *
 * This function is idempotent and never deletes or renames merchant-created collections.
 */
export async function syncBotanicaShopifyCollections(
  shop: string,
  token: string,
): Promise<ShopifyCollectionSyncResult> {
  const created: string[] = [];
  const existing: string[] = [];
  const errors: string[] = [];

  try {
    const currentRes = await shopifyRequest(shop, token, "/smart_collections.json?limit=250", { method: "GET" });
    if (!currentRes.ok) {
      const text = await currentRes.text();
      return {
        ok: false,
        created,
        existing,
        errors: [`Unable to list Shopify collections: ${currentRes.status} ${text.slice(0, 180)}`],
      };
    }

    const currentData = (await currentRes.json()) as { smart_collections?: SmartCollection[] };
    const existingTitles = new Set(
      (currentData.smart_collections ?? [])
        .map((collection) => (collection.title ?? "").trim().toLocaleLowerCase("es"))
        .filter(Boolean),
    );

    for (const title of SPANISH_FIRST_COLLECTIONS) {
      const normalized = title.toLocaleLowerCase("es");
      if (existingTitles.has(normalized)) {
        existing.push(title);
        continue;
      }

      try {
        const createRes = await shopifyRequest(shop, token, "/smart_collections.json", {
          method: "POST",
          body: JSON.stringify({
            smart_collection: {
              title,
              published: true,
              rules: [
                {
                  column: "tag",
                  relation: "equals",
                  condition: title,
                },
              ],
              disjunctive: false,
              sort_order: "best-selling",
            },
          }),
        });

        if (createRes.ok) {
          created.push(title);
          existingTitles.add(normalized);
          continue;
        }

        const text = await createRes.text();
        if (createRes.status === 422 && /taken|already|exists/i.test(text)) {
          existing.push(title);
          existingTitles.add(normalized);
        } else {
          errors.push(`${title}: ${createRes.status} ${text.slice(0, 160)}`);
        }
      } catch (error) {
        errors.push(`${title}: ${(error as Error).message}`);
      }
    }
  } catch (error) {
    errors.push((error as Error).message);
  }

  return { ok: errors.length === 0, created, existing, errors };
}
