export type QuoteRequestTarget = {
  id: string;
  productName: string;
  tradition: "LUCUMI_OCHA" | "YORUBA_IFA_ISESE" | "YORUBA_CRAFT" | "GENERIC_COMPONENT";
  primarySupplierIds: string[];
  requiredEvidence: string[];
  decisionGoal: string;
  priority: 1 | 2 | 3;
};

/**
 * Research/quote-request plan only. This file does not send outreach and does not
 * authorize orders. Every response must be captured as timestamped evidence before
 * entering SupplierQuote and Product Opportunity evaluation.
 */
export const BOTANICA_FIRST_QUOTE_REQUEST_BATCH: QuoteRequestTarget[] = [
  {
    id: "qr-opon-ifa",
    productName: "Opon Ifa / Ife design",
    tradition: "YORUBA_IFA_ISESE",
    primarySupplierIds: ["yoruba-imports-miami-gardens", "yoruba-distribuidores-houston", "get-a-better-life-tv-akure"],
    requiredEvidence: ["wholesale unit price", "MOQ/per-item minimum", "dimensions/material", "origin/maker", "inventory", "lead time", "shipping terms"],
    decisionGoal: "Compare US importer wholesale economics with Nigeria-direct sourcing.",
    priority: 1
  },
  {
    id: "qr-iroke-ifa",
    productName: "Iroke Ifa",
    tradition: "YORUBA_IFA_ISESE",
    primarySupplierIds: ["get-a-better-life-tv-akure", "yoruba-imports-miami-gardens"],
    requiredEvidence: ["wholesale unit price", "MOQ", "material", "origin/maker", "exportability", "shipping terms"],
    decisionGoal: "Establish direct-Nigeria landed cost and US-importer fallback.",
    priority: 1
  },
  {
    id: "qr-ajere-ifa",
    productName: "Ajere Ifa",
    tradition: "YORUBA_IFA_ISESE",
    primarySupplierIds: ["get-a-better-life-tv-akure", "yoruba-imports-miami-gardens"],
    requiredEvidence: ["wholesale unit price", "MOQ", "dimensions", "material", "origin/maker", "exportability", "shipping terms"],
    decisionGoal: "Determine whether direct import is economically viable for a higher-ticket sacred tool.",
    priority: 1
  },
  {
    id: "qr-obi-abata",
    productName: "Obi Abata / fresh kola nuts",
    tradition: "YORUBA_IFA_ISESE",
    primarySupplierIds: ["yoruba-imports-miami-gardens", "rush-of-ase-california"],
    requiredEvidence: ["wholesale unit/case price", "case pack", "freshness/shelf-life", "origin", "inventory cadence", "domestic shipping"],
    decisionGoal: "Establish a reliable US replenishment lane for a perishable Nigeria-origin item.",
    priority: 1
  },
  {
    id: "qr-orogbo",
    productName: "Orogbo / bitter kola",
    tradition: "YORUBA_IFA_ISESE",
    primarySupplierIds: ["yoruba-imports-miami-gardens", "rush-of-ase-california"],
    requiredEvidence: ["wholesale unit/case price", "case pack", "origin", "shelf-life", "inventory cadence", "domestic shipping"],
    decisionGoal: "Compare replenishment economics and freshness reliability.",
    priority: 1
  },
  {
    id: "qr-iyerosun",
    productName: "Iyerosun / Iyeri Osun",
    tradition: "YORUBA_IFA_ISESE",
    primarySupplierIds: ["yoruba-imports-miami-gardens", "rush-of-ase-california"],
    requiredEvidence: ["wholesale price", "package weight", "MOQ", "origin", "inventory", "domestic shipping"],
    decisionGoal: "Normalize pricing by weight and select the more reliable US supply lane.",
    priority: 1
  },
  {
    id: "qr-orisha-beads-components",
    productName: "Glass bead components for ileke/ide manufacturing",
    tradition: "GENERIC_COMPONENT",
    primarySupplierIds: ["naijas-no1-wholesale-beads-lagos", "bykessy-lagos"],
    requiredEvidence: ["wholesale price by strand/weight", "MOQ", "color consistency", "material specification", "export terms", "lead time"],
    decisionGoal: "Evaluate Nigeria component sourcing for BOTANICA OCHOSI custom bead production without implying consecration.",
    priority: 1
  },
  {
    id: "qr-adire",
    productName: "Adire / Yoruba heritage textiles",
    tradition: "YORUBA_CRAFT",
    primarySupplierIds: ["adire-oodua-ile-ife", "indigo-art-hub-osogbo"],
    requiredEvidence: ["B2B price", "MOQ", "dimensions", "maker/location", "custom/private-label capability", "export terms"],
    decisionGoal: "Assess a documented Nigeria-made heritage merchandise line.",
    priority: 2
  },
  {
    id: "qr-sopera-oshun",
    productName: "Sopera Oshun",
    tradition: "LUCUMI_OCHA",
    primarySupplierIds: ["religion-universe-miami", "yoruba-distribuidores-houston"],
    requiredEvidence: ["wholesale price", "case pack/MOQ", "dimensions/material", "inventory", "domestic shipping"],
    decisionGoal: "Establish a Cuban/Lucumi-specific US wholesale baseline separate from Nigeria Yoruba sourcing.",
    priority: 1
  },
  {
    id: "qr-sopera-yemaya",
    productName: "Sopera Yemaya",
    tradition: "LUCUMI_OCHA",
    primarySupplierIds: ["religion-universe-miami", "yoruba-distribuidores-houston"],
    requiredEvidence: ["wholesale price", "case pack/MOQ", "dimensions/material", "inventory", "domestic shipping"],
    decisionGoal: "Establish a Cuban/Lucumi-specific US wholesale baseline separate from Nigeria Yoruba sourcing.",
    priority: 1
  }
];
