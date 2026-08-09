export type NigeriaSourcingRecord = {
  id: string;
  name: string;
  location: string;
  country: "Nigeria" | "United States";
  website: string;
  relationToNigeria: "DIRECT_NIGERIA" | "NIGERIA_DIRECT_IMPORTER";
  wholesaleStatus: "CONFIRMED_WHOLESALE" | "BULK_ORDERS" | "REQUIRES_CONTACT";
  tradition: "YORUBA_IFA_ISESE" | "YORUBA_CRAFT" | "COMPONENTS";
  categories: string[];
  evidence: string[];
  allowedUse: string[];
  blockedAssumptions: string[];
  researchPriority: 1 | 2 | 3;
};

/**
 * Nigeria/Yoruba sourcing lane for BOTANICA OCHOSI.
 *
 * This registry intentionally separates Nigerian Yoruba/Ifa/Isese provenance from
 * Cuban Lucumi/Ocha usage. A Nigerian-origin item may be culturally related but is
 * never automatically interchangeable with a Lucumi-specific item or preparation.
 *
 * No record authorizes a purchase. Cost, MOQ, export terms, duties, authenticity,
 * ritual preparation, inventory, and lead time must be evidenced before Council review.
 */
export const BOTANICA_NIGERIA_SOURCING: NigeriaSourcingRecord[] = [
  {
    id: "get-a-better-life-akure",
    name: "Get a Better Life TV Isese Bookshop & Divination/Spiritual Items Store",
    location: "Akure, Ondo State",
    country: "Nigeria",
    website: "https://www.getabetterlifetv.com/",
    relationToNigeria: "DIRECT_NIGERIA",
    wholesaleStatus: "REQUIRES_CONTACT",
    tradition: "YORUBA_IFA_ISESE",
    categories: ["Iroke Ifa", "Ajere Ifa", "Yoruba books", "divination tools", "spiritual items"],
    evidence: [
      "https://www.getabetterlifetv.com/",
      "https://www.getabetterlifetv.com/products/iroke-ifa",
      "https://www.getabetterlifetv.com/products/ajere-ifa"
    ],
    allowedUse: ["direct-origin product research", "quote request", "maker/material verification", "export-term research"],
    blockedAssumptions: ["wholesale pricing", "bulk availability", "Lucumi equivalence", "ritual preparation", "exportability"],
    researchPriority: 1
  },
  {
    id: "okin-ifa-temple-oyo",
    name: "Okin Ifa Temple",
    location: "Eruwa, Oyo State",
    country: "Nigeria",
    website: "https://okinifatemple.com.ng/",
    relationToNigeria: "DIRECT_NIGERIA",
    wholesaleStatus: "REQUIRES_CONTACT",
    tradition: "YORUBA_IFA_ISESE",
    categories: ["Ifa beads", "divination tools", "sacred Ifa products"],
    evidence: ["https://okinifatemple.com.ng/", "https://okinifatemple.com.ng/about/"],
    allowedUse: ["culturally specific product research", "source/maker verification", "B2B inquiry"],
    blockedAssumptions: ["wholesale program", "MOQ", "export terms", "Lucumi equivalence", "ritual readiness"],
    researchPriority: 1
  },
  {
    id: "naijas-no1-wholesale-beads-lagos",
    name: "Naijas No1 Wholesale Bead Store",
    location: "Amuwo Odofin, Lagos",
    country: "Nigeria",
    website: "https://ng.worldorgs.com/catalog/lagos/bead-store/naijasno1wholesalebeadstore",
    relationToNigeria: "DIRECT_NIGERIA",
    wholesaleStatus: "CONFIRMED_WHOLESALE",
    tradition: "COMPONENTS",
    categories: ["beads", "glass beads", "jewelry components"],
    evidence: ["https://ng.worldorgs.com/catalog/lagos/bead-store/naijasno1wholesalebeadstore"],
    allowedUse: ["ileke component sourcing", "ide component sourcing", "custom jewelry component research"],
    blockedAssumptions: ["religious consecration", "Orisha assignment", "material grade", "exportability", "Lucumi-specific preparation"],
    researchPriority: 1
  },
  {
    id: "indigo-art-hub-osogbo",
    name: "Indigo Art Hub",
    location: "Osogbo, Osun State",
    country: "Nigeria",
    website: "https://indigoarthub.com/",
    relationToNigeria: "DIRECT_NIGERIA",
    wholesaleStatus: "REQUIRES_CONTACT",
    tradition: "YORUBA_CRAFT",
    categories: ["Yoruba carving", "stone sculpture", "Adire", "indigo textiles", "artisan work"],
    evidence: ["https://indigoarthub.com/"],
    allowedUse: ["artisan sourcing", "custom carving inquiry", "Yoruba decor/textile research"],
    blockedAssumptions: ["religious function", "wholesale terms", "exportability", "ritual authenticity"],
    researchPriority: 2
  },
  {
    id: "adire-oodua-ile-ife",
    name: "Adire Oodua Textile Hub",
    location: "Ile-Ife, Osun State",
    country: "Nigeria",
    website: "https://adireoodua.org/",
    relationToNigeria: "DIRECT_NIGERIA",
    wholesaleStatus: "REQUIRES_CONTACT",
    tradition: "YORUBA_CRAFT",
    categories: ["Adire", "Yoruba textiles", "heritage textiles"],
    evidence: ["https://adireoodua.org/ile-ife/"],
    allowedUse: ["textile sourcing", "private-label textile inquiry", "heritage merchandise research"],
    blockedAssumptions: ["wholesale terms", "ritual use", "exportability", "religious preparation"],
    researchPriority: 2
  },
  {
    id: "yoruba-imports-miami-gardens",
    name: "Yoruba Imports",
    location: "Miami Gardens, Florida",
    country: "United States",
    website: "https://yorubaimports.com/",
    relationToNigeria: "NIGERIA_DIRECT_IMPORTER",
    wholesaleStatus: "CONFIRMED_WHOLESALE",
    tradition: "YORUBA_IFA_ISESE",
    categories: ["Opon Ifa", "Obi", "Orogbo", "Ewe", "Yoruba cultural goods", "West African plant products"],
    evidence: ["https://yorubaimports.com/"],
    allowedUse: ["US-based wholesale sourcing", "Nigeria-origin product research", "special-order inquiry", "international shipping research"],
    blockedAssumptions: ["Lucumi equivalence", "ritual preparation", "current inventory", "landed margin without quote"],
    researchPriority: 1
  },
  {
    id: "rush-of-ase-california",
    name: "Rush of Ase",
    location: "Los Angeles County, California",
    country: "United States",
    website: "https://rushofase.com/",
    relationToNigeria: "NIGERIA_DIRECT_IMPORTER",
    wholesaleStatus: "BULK_ORDERS",
    tradition: "YORUBA_IFA_ISESE",
    categories: ["Iyerosun", "Obi", "plants", "herbs", "incense", "traditional African items imported from Oyo State"],
    evidence: ["https://rushofase.com/"],
    allowedUse: ["bulk-order inquiry", "Oyo-origin sourcing fallback", "US replenishment sourcing"],
    blockedAssumptions: ["full wholesale catalog", "MOQ", "Lucumi equivalence", "ritual preparation"],
    researchPriority: 1
  }
];

export function getNigeriaDirectSources() {
  return BOTANICA_NIGERIA_SOURCING.filter((supplier) => supplier.relationToNigeria === "DIRECT_NIGERIA");
}

export function getNigeriaLinkedWholesaleSources() {
  return BOTANICA_NIGERIA_SOURCING.filter((supplier) => supplier.wholesaleStatus !== "REQUIRES_CONTACT");
}
