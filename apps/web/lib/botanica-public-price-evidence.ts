export type PublicPriceBasis = "PUBLIC_RETAIL" | "WHOLESALE_LOGIN_REQUIRED";

export type PublicPriceObservation = {
  id: string;
  supplierId: string;
  supplierName: string;
  productName: string;
  countryOfOrigin?: string;
  currency: "USD" | "NGN";
  observedPrice: number | null;
  basis: PublicPriceBasis;
  observedAt: string;
  sourceUrl: string;
  notes: string[];
};

/**
 * Publicly observed supplier pricing evidence for BOTANICA OCHOSI.
 *
 * These records are evidence snapshots only. PUBLIC_RETAIL observations must never
 * be treated as wholesale quotes, MOQs, inventory commitments, or purchase authority.
 * WHOLESALE_LOGIN_REQUIRED means the supplier exposes product availability/catalog
 * publicly but requires an approved wholesale account to view the actual wholesale price.
 */
export const BOTANICA_PUBLIC_PRICE_EVIDENCE: PublicPriceObservation[] = [
  {
    id: "gabl-iroke-ifa-2026-08-09",
    supplierId: "get-a-better-life-tv-akure",
    supplierName: "Get a Better Life TV Isese Bookshop & Divination/Spiritual Items Store",
    productName: "Iroke Ifa",
    countryOfOrigin: "Nigeria",
    currency: "NGN",
    observedPrice: 30000,
    basis: "PUBLIC_RETAIL",
    observedAt: "2026-08-09T02:18:00-05:00",
    sourceUrl: "https://www.getabetterlifetv.com/products/iroke-ifa",
    notes: ["Public retail/sale price; wholesale terms not confirmed."]
  },
  {
    id: "gabl-ajere-ifa-2026-08-09",
    supplierId: "get-a-better-life-tv-akure",
    supplierName: "Get a Better Life TV Isese Bookshop & Divination/Spiritual Items Store",
    productName: "Ajere Ifa",
    countryOfOrigin: "Nigeria",
    currency: "NGN",
    observedPrice: 180000,
    basis: "PUBLIC_RETAIL",
    observedAt: "2026-08-09T02:18:00-05:00",
    sourceUrl: "https://www.getabetterlifetv.com/products/ajere-ifa",
    notes: ["Public retail/sale price; wholesale terms not confirmed."]
  },
  {
    id: "gabl-igba-aje-big-2026-08-09",
    supplierId: "get-a-better-life-tv-akure",
    supplierName: "Get a Better Life TV Isese Bookshop & Divination/Spiritual Items Store",
    productName: "Igba Aje / Aje Calabash (Big Size)",
    countryOfOrigin: "Nigeria",
    currency: "NGN",
    observedPrice: 300000,
    basis: "PUBLIC_RETAIL",
    observedAt: "2026-08-09T02:18:00-05:00",
    sourceUrl: "https://www.getabetterlifetv.com/collections/all",
    notes: ["Public retail/sale price; wholesale terms not confirmed."]
  },
  {
    id: "gabl-ilu-bata-2026-08-09",
    supplierId: "get-a-better-life-tv-akure",
    supplierName: "Get a Better Life TV Isese Bookshop & Divination/Spiritual Items Store",
    productName: "Ilu Bata Drum",
    countryOfOrigin: "Nigeria",
    currency: "NGN",
    observedPrice: 150000,
    basis: "PUBLIC_RETAIL",
    observedAt: "2026-08-09T02:18:00-05:00",
    sourceUrl: "https://www.getabetterlifetv.com/collections/all",
    notes: ["Public retail/sale price; wholesale terms not confirmed."]
  },
  {
    id: "yoruba-imports-opon-large-2026-08-09",
    supplierId: "yoruba-imports-miami-gardens",
    supplierName: "Yoruba Imports",
    productName: "Opon - Ife Design - Large",
    currency: "USD",
    observedPrice: 150,
    basis: "PUBLIC_RETAIL",
    observedAt: "2026-08-09T02:18:00-05:00",
    sourceUrl: "https://yorubaimports.com/",
    notes: ["Public website price; separate wholesale program exists but this price is not assumed wholesale."]
  },
  {
    id: "yoruba-imports-opon-assorted-2026-08-09",
    supplierId: "yoruba-imports-miami-gardens",
    supplierName: "Yoruba Imports",
    productName: "Opon - Ife Designs Assorted",
    currency: "USD",
    observedPrice: 100,
    basis: "PUBLIC_RETAIL",
    observedAt: "2026-08-09T02:18:00-05:00",
    sourceUrl: "https://yorubaimports.com/",
    notes: ["Public website price; separate wholesale program exists but this price is not assumed wholesale."]
  },
  {
    id: "yoruba-imports-iyeri-osun-2026-08-09",
    supplierId: "yoruba-imports-miami-gardens",
    supplierName: "Yoruba Imports",
    productName: "Iyeri Osun",
    currency: "USD",
    observedPrice: 25,
    basis: "PUBLIC_RETAIL",
    observedAt: "2026-08-09T02:18:00-05:00",
    sourceUrl: "https://yorubaimports.com/",
    notes: ["Public website price; separate wholesale program exists but this price is not assumed wholesale."]
  },
  {
    id: "yoruba-imports-orogbo-2026-08-09",
    supplierId: "yoruba-imports-miami-gardens",
    supplierName: "Yoruba Imports",
    productName: "Orogbo - Bitter Kola",
    currency: "USD",
    observedPrice: 10,
    basis: "PUBLIC_RETAIL",
    observedAt: "2026-08-09T02:18:00-05:00",
    sourceUrl: "https://yorubaimports.com/",
    notes: ["Public website price; separate wholesale program exists but this price is not assumed wholesale."]
  },
  {
    id: "yoruba-imports-obi-abata-2026-08-09",
    supplierId: "yoruba-imports-miami-gardens",
    supplierName: "Yoruba Imports",
    productName: "Obi Abata - Fresh Kola Nuts",
    currency: "USD",
    observedPrice: 30,
    basis: "PUBLIC_RETAIL",
    observedAt: "2026-08-09T02:18:00-05:00",
    sourceUrl: "https://yorubaimports.com/",
    notes: ["Public website price; separate wholesale program exists but this price is not assumed wholesale."]
  },
  {
    id: "religion-universe-sopera-oshun-2026-08-09",
    supplierId: "religion-universe-miami",
    supplierName: "Religion Universe Import Export Inc.",
    productName: "Sopera de Porcelana Fina Oshun",
    currency: "USD",
    observedPrice: null,
    basis: "WHOLESALE_LOGIN_REQUIRED",
    observedAt: "2026-08-09T02:18:00-05:00",
    sourceUrl: "https://religionuniverse.com/collections/new-arrivals",
    notes: ["Product is publicly listed in stock; actual wholesale price requires approved wholesaler login."]
  },
  {
    id: "religion-universe-sopera-yemaya-2026-08-09",
    supplierId: "religion-universe-miami",
    supplierName: "Religion Universe Import Export Inc.",
    productName: "Sopera de Porcelana Fina Yemaya",
    currency: "USD",
    observedPrice: null,
    basis: "WHOLESALE_LOGIN_REQUIRED",
    observedAt: "2026-08-09T02:18:00-05:00",
    sourceUrl: "https://religionuniverse.com/collections/new-arrivals",
    notes: ["Product is publicly listed in stock; actual wholesale price requires approved wholesaler login."]
  }
];

export const BOTANICA_NGN_USD_FX_SNAPSHOT = {
  observedAt: "2026-08-09T02:57:00Z",
  ngnToUsd: 0.00073,
  source: "live currency conversion snapshot",
  usage: "Research normalization only; refresh before any Council economics or purchase decision."
} as const;

export function getPublicPriceEvidenceForSupplier(supplierId: string) {
  return BOTANICA_PUBLIC_PRICE_EVIDENCE.filter((record) => record.supplierId === supplierId);
}

export function getPricedPublicEvidence() {
  return BOTANICA_PUBLIC_PRICE_EVIDENCE.filter((record) => record.observedPrice !== null);
}
