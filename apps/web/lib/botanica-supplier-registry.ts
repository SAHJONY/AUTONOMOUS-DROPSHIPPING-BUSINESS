export type BotanicaSupplierRegion = "MIAMI" | "USA" | "NIGERIA" | "INTERNATIONAL";
export type BotanicaSupplierStatus = "VERIFIED_PUBLIC" | "REQUIRES_ACCOUNT" | "REQUIRES_CONTACT";

export type BotanicaSupplier = {
  id: string;
  name: string;
  region: BotanicaSupplierRegion;
  location: string;
  website: string;
  wholesale: boolean;
  status: BotanicaSupplierStatus;
  categories: string[];
  strengths: string[];
  sourceEvidence: string[];
  sourcingPolicy:
    | "CORE_RELIGIOUS"
    | "NIGERIA_YORUBA"
    | "CONSUMABLES"
    | "CUSTOM_MANUFACTURING"
    | "GENERAL_SUPPORT";
  researchPriority: 1 | 2 | 3;
};

/**
 * Supplier registry for BOTANICA OCHOSI.
 *
 * Rules:
 * - This registry is evidence/provenance, not a purchase authorization list.
 * - Never infer MOQ, landed cost, inventory, lead time, authenticity, or margins.
 * - Owner approval remains required before purchase orders, supplier commitments,
 *   private-label manufacturing, or irreversible imports.
 * - Nigerian/Yoruba suppliers are tracked separately from Cuban/Lucumi suppliers.
 *   A product being made or sold in Nigeria is not, by itself, proof that it is the
 *   correct object for a Lucumi/Ocha/Ifa use case; cultural qualification is required.
 * - Nigeria-direct religious goods require verification of maker/source, intended
 *   tradition (Isese/Ifa/Yoruba vs. Lucumi/Ocha), exportability, materials, and any
 *   restrictions before catalog publication or purchase commitment.
 * - US-based Nigeria importers are preferred as a low-friction bridge when they can
 *   evidence provenance and provide wholesale/bulk terms; direct Nigeria relationships
 *   remain the long-term source-development lane.
 * - China/global factory-direct sourcing must be restricted to verified components,
 *   packaging, generic vessels/accessories, and approved private-label work unless a
 *   culturally qualified supplier is separately verified.
 */
export const BOTANICA_SUPPLIERS: BotanicaSupplier[] = [
  {
    id: "religion-universe-miami",
    name: "Religion Universe Import Export Inc.",
    region: "MIAMI",
    location: "Miami, Florida",
    website: "https://religionuniverse.com/",
    wholesale: true,
    status: "REQUIRES_ACCOUNT",
    categories: ["Orisha tools", "soperas", "statues", "candles", "colognes", "oils", "caracoles", "wood items"],
    strengths: ["Miami importer/distributor", "wholesale account flow", "domestic and international shipping"],
    sourceEvidence: ["https://religionuniverse.com/", "https://religionuniverse.com/pages/wholesale-signup-form"],
    sourcingPolicy: "CORE_RELIGIOUS",
    researchPriority: 1
  },
  {
    id: "inshe-miami",
    name: "INSHE Miami",
    region: "MIAMI",
    location: "Hialeah / Miami / Miami Gardens, Florida",
    website: "https://www.inshemiami.com/",
    wholesale: true,
    status: "REQUIRES_CONTACT",
    categories: ["Santeria supplies", "Yoruba tools", "traditional spiritual items", "Nigeria-sourced traditional items"],
    strengths: ["Afro-Cuban/Yoruba specialization", "three South Florida locations", "wholesale and retail"],
    sourceEvidence: ["https://www.inshemiami.com/en/pages/about-inshe-miami", "https://www.inshemiami.com/en/pages/botanica-miami-inshe-miami-santeria-supplies-yoruba-tools-spiritual-articles"],
    sourcingPolicy: "CORE_RELIGIOUS",
    researchPriority: 1
  },
  {
    id: "viejo-lazaro-miami",
    name: "El Viejo Lazaro",
    region: "MIAMI",
    location: "Miami, Florida",
    website: "https://www.viejolazaro.com/",
    wholesale: true,
    status: "REQUIRES_CONTACT",
    categories: ["Lucumi supplies", "Yoruba supplies", "Ocha tools", "crowns", "religious articles"],
    strengths: ["Lucumi/Yoruba focus", "4,000+ products claimed", "custom Ocha tools and crowns", "wholesale and retail"],
    sourceEvidence: ["https://www.viejolazaro.com/"],
    sourcingPolicy: "CORE_RELIGIOUS",
    researchPriority: 1
  },
  {
    id: "handmade-factory-miami",
    name: "Handmade Factory / Dolce Natura, Inc.",
    region: "MIAMI",
    location: "Miami, Florida / factory in Venezuela",
    website: "https://botanicamayor.com/",
    wholesale: true,
    status: "REQUIRES_CONTACT",
    categories: ["ildes", "azabaches", "Orisha necklaces", "handmade religious goods", "custom orders"],
    strengths: ["manufacturer", "business-only wholesale", "international shipping", "custom manufacturing"],
    sourceEvidence: ["https://botanicamayor.com/"],
    sourcingPolicy: "CUSTOM_MANUFACTURING",
    researchPriority: 1
  },
  {
    id: "yoruba-imports-miami-gardens",
    name: "Yoruba Imports",
    region: "MIAMI",
    location: "Miami Gardens, Florida",
    website: "https://yorubaimports.com/",
    wholesale: true,
    status: "VERIFIED_PUBLIC",
    categories: ["Opon Ifa", "Obi", "Orogbo", "Ewe", "Yoruba cultural goods", "West African plant products"],
    strengths: ["direct-from-source West African inventory", "wholesale program", "international shipping", "special orders"],
    sourceEvidence: ["https://yorubaimports.com/"],
    sourcingPolicy: "NIGERIA_YORUBA",
    researchPriority: 1
  },
  {
    id: "yoruba-distribuidores-houston",
    name: "Yoruba Distribuidores LLC",
    region: "USA",
    location: "Houston, Texas",
    website: "https://yorubadistribuidores.com/",
    wholesale: true,
    status: "VERIFIED_PUBLIC",
    categories: ["Yoruba products", "Santeria products", "Espiritismo products", "Orisha tools", "necklaces", "ritual goods"],
    strengths: ["wholesale only", "300+ products claimed", "nationwide US shipping"],
    sourceEvidence: ["https://yorubadistribuidores.com/"],
    sourcingPolicy: "CORE_RELIGIOUS",
    researchPriority: 1
  },
  {
    id: "rush-of-ase-california",
    name: "Rush of Ase",
    region: "USA",
    location: "Los Angeles County, California",
    website: "https://rushofase.com/",
    wholesale: true,
    status: "REQUIRES_CONTACT",
    categories: ["Iyerosun", "Obi", "plants", "herbs", "incense", "traditional African items imported from Oyo State"],
    strengths: ["bulk orders accepted", "traditional African items imported from Oyo State", "US replenishment option"],
    sourceEvidence: ["https://rushofase.com/"],
    sourcingPolicy: "NIGERIA_YORUBA",
    researchPriority: 1
  },
  {
    id: "mas-alla-usa",
    name: "Distribuidora Mas Alla",
    region: "USA",
    location: "United States",
    website: "https://www.el-masalla.com/",
    wholesale: true,
    status: "VERIFIED_PUBLIC",
    categories: ["7-day candles", "spiritual baths", "oils", "perfumes", "soaps", "incense", "statues", "herbs"],
    strengths: ["5,000+ products claimed", "30+ years claimed", "US-wide shipping", "broad botanica consumables coverage"],
    sourceEvidence: ["https://www.el-masalla.com/", "https://www.el-masalla.com/wholesale-customers/wholesale-catalog/"],
    sourcingPolicy: "CONSUMABLES",
    researchPriority: 1
  },
  {
    id: "babonsono-new-jersey",
    name: "Babonsono Imports LLC",
    region: "USA",
    location: "Lodi, New Jersey",
    website: "https://www.babonsono.com/",
    wholesale: true,
    status: "REQUIRES_CONTACT",
    categories: ["Santeria tools", "incense", "charcoal", "sage", "Palo Santo", "amulets", "cast iron", "gemstones"],
    strengths: ["B2B wholesale only", "$100 minimum publicly stated", "broad botanica/metaphysical inventory"],
    sourceEvidence: ["https://www.babonsono.com/", "https://www.babonsono.com/products", "https://www.babonsono.com/about-us"],
    sourcingPolicy: "GENERAL_SUPPORT",
    researchPriority: 2
  },
  {
    id: "vd-importers-miami",
    name: "VD Importers Inc.",
    region: "MIAMI",
    location: "Miami, Florida",
    website: "https://www.vdimporters.com/",
    wholesale: true,
    status: "REQUIRES_CONTACT",
    categories: ["incense", "candles", "spiritual accessories", "wellness products"],
    strengths: ["B2B import/export", "Miami-based", "North/South America and Caribbean distribution"],
    sourceEvidence: ["https://www.vdimporters.com/about-us/"],
    sourcingPolicy: "CONSUMABLES",
    researchPriority: 2
  },
  {
    id: "get-a-better-life-tv-akure",
    name: "Get a Better Life TV Isese Bookshop & Divination/Spiritual Items Store",
    region: "NIGERIA",
    location: "Akure, Ondo State, Nigeria",
    website: "https://www.getabetterlifetv.com/",
    wholesale: false,
    status: "REQUIRES_CONTACT",
    categories: ["Iroke Ifa", "Ajere Ifa", "Igba Aje", "Bata drums", "Yoruba/Ifa books", "divination and spiritual items"],
    strengths: ["Nigeria-based Yoruba/Ifa inventory", "public NGN pricing", "physical Akure pickup location documented", "broad Isese/Ifa catalog"],
    sourceEvidence: ["https://www.getabetterlifetv.com/", "https://www.getabetterlifetv.com/collections/all", "https://www.getabetterlifetv.com/products/iroke-ifa", "https://www.getabetterlifetv.com/products/ajere-ifa"],
    sourcingPolicy: "NIGERIA_YORUBA",
    researchPriority: 1
  },
  {
    id: "okin-ifa-temple-oyo",
    name: "Okin Ifa Temple",
    region: "NIGERIA",
    location: "Eruwa, Oyo State, Nigeria",
    website: "https://okinifatemple.com.ng/",
    wholesale: false,
    status: "REQUIRES_CONTACT",
    categories: ["Ifa beads", "divination tools", "sacred Ifa products", "Yoruba spiritual items"],
    strengths: ["Oyo-based Ifa source", "sacred-product catalog", "direct contact for culturally specific sourcing"],
    sourceEvidence: ["https://okinifatemple.com.ng/"],
    sourcingPolicy: "NIGERIA_YORUBA",
    researchPriority: 1
  },
  {
    id: "naijas-no1-wholesale-beads-lagos",
    name: "Naijas No1 Wholesale Bead Store",
    region: "NIGERIA",
    location: "Amuwo Odofin, Lagos, Nigeria",
    website: "https://ng.worldorgs.com/catalog/lagos/bead-store/naijasno1wholesalebeadstore",
    wholesale: true,
    status: "REQUIRES_CONTACT",
    categories: ["glass beads", "bead components", "necklace and bracelet components", "craft supplies"],
    strengths: ["explicit wholesale bead-store listing", "Lagos trade-market location", "useful for locally sourced bead components"],
    sourceEvidence: ["https://ng.worldorgs.com/catalog/lagos/bead-store/naijasno1wholesalebeadstore"],
    sourcingPolicy: "CUSTOM_MANUFACTURING",
    researchPriority: 2
  },
  {
    id: "bykessy-lagos",
    name: "ByKessy",
    region: "NIGERIA",
    location: "Lagos, Nigeria",
    website: "https://bykessy.com/",
    wholesale: true,
    status: "VERIFIED_PUBLIC",
    categories: ["handcrafted beads", "African-print accessories", "custom beaded goods", "waist beads"],
    strengths: ["retail and wholesale worldwide", "handcrafted in Nigeria", "Lagos-based custom bead capability"],
    sourceEvidence: ["https://bykessy.com/pages/about-us"],
    sourcingPolicy: "CUSTOM_MANUFACTURING",
    researchPriority: 2
  }
];

export function getBotanicaSuppliersByPriority(priority: 1 | 2 | 3) {
  return BOTANICA_SUPPLIERS.filter((supplier) => supplier.researchPriority === priority);
}

export function getBotanicaSuppliersByPolicy(policy: BotanicaSupplier["sourcingPolicy"]) {
  return BOTANICA_SUPPLIERS.filter((supplier) => supplier.sourcingPolicy === policy);
}

export function getBotanicaSuppliersByRegion(region: BotanicaSupplierRegion) {
  return BOTANICA_SUPPLIERS.filter((supplier) => supplier.region === region);
}
