export type CompetitivePriceAction = "LOWER" | "KEEP" | "RAISE" | "SEGMENT";

export type CompetitivePriceRow = {
  id: string;
  product: string;
  category: string;
  currentPriceUsd: number;
  targetRetailPriceUsd: number | null;
  action: CompetitivePriceAction;
  marketLowUsd?: number;
  marketHighUsd?: number;
  sourceUrl: string;
  rationale: string;
};

export const COMPETITIVE_PRICE_REVIEWED_AT = "2026-08-13";

/**
 * Public-price recommendations for Owner review only.
 * They are not supplier costs, purchase authority, or permission to update Shopify.
 * Every target must still clear the catalog's landed-cost and margin controls.
 */
export const BOTANICA_COMPETITIVE_PRICE_PLAYBOOK: CompetitivePriceRow[] = [
  { id:"orisha-candle", product:"Orisha 7-day candle", category:"Candles", currentPriceUsd:8, targetRetailPriceUsd:7.49, action:"LOWER", marketLowUsd:6.95, marketHighUsd:8.95, sourceUrl:"https://originalbotanica.com/7-day-orisha-candles/", rationale:"Visible advantage without positioning the devotional line as bargain merchandise." },
  { id:"saint-candle", product:"Saint 7-day candle", category:"Candles", currentPriceUsd:7, targetRetailPriceUsd:6.49, action:"LOWER", marketLowUsd:6.95, marketHighUsd:7.99, sourceUrl:"https://yeyesbotanica.com/product-category/candles/page/5/", rationale:"Use one consistent price and make the core candle assortment easy to compare." },
  { id:"scented-candle", product:"Premium or scented candle", category:"Candles", currentPriceUsd:10, targetRetailPriceUsd:9.49, action:"LOWER", sourceUrl:"https://www.afrocaribebotanica.com/wholesale", rationale:"Preserve the premium tier while improving price perception." },
  { id:"orisha-figurine", product:"Orisha figurine, approximately 5 in.", category:"Statues", currentPriceUsd:10, targetRetailPriceUsd:11.99, action:"RAISE", marketLowUsd:12, marketHighUsd:44.99, sourceUrl:"https://ninekeysbotanica.com/products/obatala", rationale:"The current price is already unusually strong; capture margin while remaining competitive." },
  { id:"catholic-figurine", product:"Catholic or Archangel figurine", category:"Statues", currentPriceUsd:9, targetRetailPriceUsd:9.99, action:"RAISE", sourceUrl:"https://www.afrocaribebotanica.com/wholesale", rationale:"Maintain an accessible entry price with a standard retail ending." },
  { id:"elegua-head", product:"Elegua traditional head", category:"Statues", currentPriceUsd:12, targetRetailPriceUsd:14.99, action:"RAISE", marketLowUsd:24, marketHighUsd:24, sourceUrl:"https://www.botanicaolokunibuagana.com/Eshu-Elegua-Aye-en-Caracol-Cobo-y-Cemento_p_3063.html", rationale:"Still materially below a comparable 5-inch public listing." },
  { id:"hand-bell", product:"Hand bell", category:"Attributes", currentPriceUsd:7, targetRetailPriceUsd:7.99, action:"RAISE", sourceUrl:"https://www.afrocaribebotanica.com/wholesale", rationale:"Small increase; keep eligible for multi-item bundles." },
  { id:"clay-pot", product:"Ceramic clay pot, small", category:"Vessels", currentPriceUsd:15, targetRetailPriceUsd:14.99, action:"KEEP", sourceUrl:"https://www.afrocaribebotanica.com/product-page/ceramic-clay-pot", rationale:"Preserve the attractive advertised starting price; price larger variants separately." },
  { id:"palangana", product:"Palangana, small / medium / large", category:"Vessels", currentPriceUsd:40, targetRetailPriceUsd:34.99, action:"LOWER", sourceUrl:"https://www.afrocaribebotanica.com/wholesale", rationale:"The target applies to the large size; retain $14.99 and $22.99 targets for small and medium." },
  { id:"jicara", product:"Jicara / Igba, small", category:"Vessels", currentPriceUsd:7, targetRetailPriceUsd:6.99, action:"KEEP", sourceUrl:"https://www.afrocaribebotanica.com/wholesale", rationale:"Traffic-driving add-on with a clear entry price." },
  { id:"sopera", product:"Orisha tureen / Sopera", category:"Vessels", currentPriceUsd:95, targetRetailPriceUsd:89.99, action:"LOWER", sourceUrl:"https://www.afrocaribebotanica.com/", rationale:"Test a sub-$90 headline price only after size, freight and breakage costs are verified." },
  { id:"opele", product:"Opele / Ekuele Ifa", category:"Attributes", currentPriceUsd:45, targetRetailPriceUsd:39.99, action:"LOWER", sourceUrl:"https://www.afrocaribebotanica.com/", rationale:"Improves conversion on a specialty item while retaining premium positioning." },
  { id:"ileke", product:"Orisha necklaces / Ileke", category:"Jewelry", currentPriceUsd:45, targetRetailPriceUsd:null, action:"SEGMENT", marketLowUsd:3.3, marketHighUsd:65, sourceUrl:"https://botanicaonline.net/collections/ileke", rationale:"Separate basic ($7.99-$12.99), Nigerian premium ($34.99-$44.99), and handcrafted pieces instead of one price." },
  { id:"loa-bottle", product:"Vodou Loa bottle", category:"Vessels", currentPriceUsd:65, targetRetailPriceUsd:59.99, action:"LOWER", sourceUrl:"https://www.afrocaribebotanica.com/", rationale:"Keep as differentiated specialty merchandise." },
  { id:"cascarilla", product:"Cascarilla / Efun, box of 100", category:"Ingredients", currentPriceUsd:40, targetRetailPriceUsd:39.99, action:"KEEP", sourceUrl:"https://www.afrocaribebotanica.com/product-page/powdered-eggshell-box-cascarilla-efun", rationale:"Strong $0.40 per-piece economics before shipping." },
  { id:"smoked-fish", product:"Smoked fish, pack of 18", category:"Food", currentPriceUsd:35, targetRetailPriceUsd:34.99, action:"KEEP", sourceUrl:"https://www.afrocaribebotanica.com/wholesale", rationale:"Strong specialty bulk price at approximately $1.94 per piece." },
  { id:"palm-juice", product:"Palm juice / Emu, case of 12", category:"Food", currentPriceUsd:130, targetRetailPriceUsd:119.99, action:"LOWER", sourceUrl:"https://www.afrocaribebotanica.com/wholesale", rationale:"Creates a clean $10 per-unit case offer before freight; verify bottle size and expiration." },
  { id:"kpanlogo", product:"Kpanlogo drum", category:"Music", currentPriceUsd:350, targetRetailPriceUsd:329.99, action:"LOWER", sourceUrl:"https://www.afrocaribebotanica.com/", rationale:"Premium specialty test price; do not use unless landed cost supports it." },
  { id:"orunmila-batea", product:"Orunmila vessel / Batea de Orula", category:"Vessels", currentPriceUsd:500, targetRetailPriceUsd:449.99, action:"LOWER", sourceUrl:"https://www.afrocaribebotanica.com/", rationale:"Owner-review target for a high-ticket item; freight and provenance must be documented." },
];

export const BOTANICA_QUANTITY_TIERS = [
  { minimumQuantity:1, maximumQuantity:5, discountPercent:0, label:"Retail" },
  { minimumQuantity:6, maximumQuantity:11, discountPercent:10, label:"Practitioner" },
  { minimumQuantity:12, maximumQuantity:23, discountPercent:20, label:"Small retailer" },
  { minimumQuantity:24, maximumQuantity:47, discountPercent:30, label:"Established botanica" },
] as const;

export function priceAtDiscount(retailPriceUsd: number, discountPercent: number) {
  return Math.round(retailPriceUsd * (1 - discountPercent / 100) * 100) / 100;
}

export function grossMarginPercent(priceUsd: number, landedCostUsd: number) {
  if (priceUsd <= 0 || landedCostUsd < 0) return null;
  return Math.round(((priceUsd - landedCostUsd) / priceUsd) * 1000) / 10;
}

export function priceClearsMarginFloor(priceUsd: number, landedCostUsd: number, marginFloorPercent = 35) {
  const margin = grossMarginPercent(priceUsd, landedCostUsd);
  return margin !== null && margin >= marginFloorPercent;
}
