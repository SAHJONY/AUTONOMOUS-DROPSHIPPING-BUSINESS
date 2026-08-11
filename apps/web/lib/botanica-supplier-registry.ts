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
  contacts?: { label: string; value: string; href: string }[];
  sourcingPolicy:
    | "CORE_RELIGIOUS"
    | "NIGERIA_YORUBA"
    | "PALO"
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
    contacts: [
      { label: "Telefono", value: "+1 (305) 436-8781", href: "tel:+13054368781" },
      { label: "Correo", value: "religionuniverseinc@gmail.com", href: "mailto:religionuniverseinc@gmail.com" },
      { label: "Cuenta mayorista", value: "Solicitud en linea", href: "https://religionuniverse.com/pages/wholesale-signup-form" }
    ],
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
    contacts: [
      { label: "Hialeah", value: "(786) 955-3724 / (305) 982-8343", href: "tel:+17869553724" },
      { label: "Calle 8", value: "(786) 850-6602", href: "tel:+17868506602" },
      { label: "Miami Gardens", value: "(786) 939-9213", href: "tel:+17869399213" }
    ],
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
    id: "monzon-brothers-hialeah",
    name: "Monzon Brothers II Inc.",
    region: "MIAMI",
    location: "Hialeah, Florida",
    website: "https://monzonbotanica.com/",
    wholesale: true,
    status: "REQUIRES_CONTACT",
    categories: ["articulos Afro-Cubanos", "Yoruba y Lucumi", "herramientas de santo", "soperas", "cuentas", "madera y metal"],
    strengths: ["distribuidor especializado", "compras al por mayor por telefono", "3,000+ productos declarados", "envios USA e internacionales"],
    sourceEvidence: ["https://monzonbotanica.com/"],
    contacts: [{ label: "Mayoreo", value: "+1 (305) 885-6363", href: "tel:+13058856363" }],
    sourcingPolicy: "CORE_RELIGIOUS",
    researchPriority: 1
  },
  {
    id: "botanica-las-americas-miami",
    name: "Botanica Las Americas",
    region: "MIAMI",
    location: "Miami, Florida",
    website: "https://botanicalasamerica.com/es/pages/about-us",
    wholesale: true,
    status: "REQUIRES_CONTACT",
    categories: ["Santeria y Lucumi", "productos Ifa", "herramientas y coronas Ocha", "cuentas", "hierbas", "soperas"],
    strengths: ["venta mayorista y minorista", "fabricacion personalizada", "dirigida por practicantes", "envios internacionales declarados"],
    sourceEvidence: ["https://botanicalasamerica.com/es/pages/about-us"],
    contacts: [
      { label: "Telefono", value: "+1 (786) 558-8031", href: "tel:+17865588031" },
      { label: "Correo", value: "botanicalasamericas@gmail.com", href: "mailto:botanicalasamericas@gmail.com" }
    ],
    sourcingPolicy: "CORE_RELIGIOUS",
    researchPriority: 1
  },
  {
    id: "herramientas-santeria-miami",
    name: "Herramientas de Santeria",
    region: "MIAMI",
    location: "Miami, Florida",
    website: "https://herramientasdesanteria.com/content/7-aboutus",
    wholesale: true,
    status: "REQUIRES_ACCOUNT",
    categories: ["herramientas de santo", "atributos Orisha", "acero inoxidable", "fabricacion religiosa"],
    strengths: ["fabricante directo en Miami", "mayoreo exclusivo", "minimo y descuentos publicados", "garantia declarada"],
    sourceEvidence: ["https://herramientasdesanteria.com/content/7-aboutus"],
    contacts: [{ label: "Cuenta mayorista", value: "Registro en linea", href: "https://herramientasdesanteria.com/login?create_account=1" }],
    sourcingPolicy: "CUSTOM_MANUFACTURING",
    researchPriority: 1
  },
  {
    id: "pedro-yoruba-jewelry-miami",
    name: "Pedro Yoruba Jewelry",
    region: "MIAMI",
    location: "Miami, Florida",
    website: "https://pedrojewelryyoruba.com/mayoreo",
    wholesale: true,
    status: "REQUIRES_CONTACT",
    categories: ["herramientas de santo", "atributos de Oricha", "piezas de acero inoxidable", "fabricacion personalizada"],
    strengths: ["taller fabricante en Miami", "venta directa a botanicas", "catalogo mayorista por contacto"],
    sourceEvidence: ["https://pedrojewelryyoruba.com/mayoreo"],
    contacts: [{ label: "Catalogo mayorista", value: "+1 (305) 522-8490", href: "tel:+13055228490" }],
    sourcingPolicy: "CUSTOM_MANUFACTURING",
    researchPriority: 1
  },
  {
    id: "olofinire-hialeah",
    name: "Botanica & Pet Shop Olofinire",
    region: "MIAMI",
    location: "Hialeah, Florida",
    website: "https://botanicaolofinire.com/nosotros",
    wholesale: true,
    status: "REQUIRES_CONTACT",
    categories: ["velas artesanales", "jabones", "esencias", "productos espirituales de marca propia"],
    strengths: ["fabricante directo local", "produccion artesanal propia", "declara abastecer otras botanicas de Miami"],
    sourceEvidence: ["https://botanicaolofinire.com/nosotros"],
    contacts: [{ label: "Telefono", value: "+1 (305) 833-4292", href: "tel:+13058334292" }],
    sourcingPolicy: "CUSTOM_MANUFACTURING",
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
    contacts: [
      { label: "Telefono / WhatsApp", value: "+1 (786) 610-9745", href: "tel:+17866109745" },
      { label: "Correo", value: "dolcenaturainc@gmail.com", href: "mailto:dolcenaturainc@gmail.com" }
    ],
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
    id: "ritual-scent-online",
    name: "Ritual Scent",
    region: "USA",
    location: "Tienda en linea de Estados Unidos",
    website: "https://www.ritualscent.com/",
    wholesale: false,
    status: "REQUIRES_CONTACT",
    categories: ["Palo Monte y Mayombe", "Lucumi y Santeria", "Yoruba Isese", "herramientas Orisha", "ingredientes y suministros"],
    strengths: ["creado por practicantes iniciados", "productos hechos o abastecidos por la tienda", "coleccion Palo Monte explicita"],
    sourceEvidence: ["https://www.ritualscent.com/"],
    sourcingPolicy: "PALO",
    researchPriority: 1
  },
  {
    id: "botanica-nena-miami",
    name: "Botanica Nena",
    region: "MIAMI",
    location: "Miami, Florida",
    website: "https://botanicanena.com/",
    wholesale: false,
    status: "REQUIRES_CONTACT",
    categories: ["productos Ifa", "herramientas Orisha", "palos, hierbas y raices", "soperas", "cuentas", "productos de iniciacion"],
    strengths: ["catalogo religioso amplio", "inventario con precios publicos", "candidato para negociar cuenta comercial"],
    sourceEvidence: ["https://botanicanena.com/"],
    sourcingPolicy: "PALO",
    researchPriority: 2
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
    contacts: [
      { label: "Telefono / WhatsApp", value: "+234 815 779 7017", href: "https://wa.me/2348157797017" },
      { label: "Tienda y pedidos", value: "Contacto en linea", href: "https://www.getabetterlifetv.com/" }
    ],
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
    contacts: [
      { label: "WhatsApp", value: "+234 916 503 5248", href: "https://wa.me/2349165035248" },
      { label: "Formulario", value: "Contacto directo", href: "https://okinifatemple.com.ng/#contact" }
    ],
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
    contacts: [{ label: "Directorio comercial", value: "Contacto por validar", href: "https://ng.worldorgs.com/catalog/lagos/bead-store/naijasno1wholesalebeadstore" }],
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
    contacts: [
      { label: "WhatsApp mayorista", value: "+234 813 506 2094", href: "https://wa.me/2348135062094" },
      { label: "Correo mayorista", value: "bykessy1@gmail.com", href: "mailto:bykessy1@gmail.com" },
      { label: "Formulario", value: "Pedidos personalizados", href: "https://bykessy.com/pages/contact" }
    ],
    sourcingPolicy: "CUSTOM_MANUFACTURING",
    researchPriority: 2
  },
  {
    id: "sacred-traditions-miami",
    name: "Sacred Traditions, Inc.",
    region: "MIAMI",
    location: "Miami, Florida",
    website: "https://www.sacredtraditions.com/",
    wholesale: true,
    status: "REQUIRES_CONTACT",
    categories: ["candles", "oils", "baths", "colognes", "incense", "herbs", "soaps", "statues"],
    strengths: ["manufacturer and wholesale distributor", "Miami warehouse", "broad botanica consumables assortment"],
    sourceEvidence: ["https://www.sacredtraditions.com/"],
    sourcingPolicy: "CONSUMABLES",
    researchPriority: 1
  },
  {
    id: "botanica-mistica-miami",
    name: "Botanica Mistica / M&N Variedades Corp.",
    region: "MIAMI",
    location: "Miami, Florida",
    website: "https://www.botanica8.com/nosotros",
    wholesale: true,
    status: "REQUIRES_CONTACT",
    categories: ["Santeria products", "spiritual products", "esoteric supplies", "special-order items"],
    strengths: ["South Florida storefront", "public wholesale offer", "Spanish-language sales"],
    sourceEvidence: ["https://www.botanica8.com/nosotros"],
    sourcingPolicy: "GENERAL_SUPPORT",
    researchPriority: 2
  },
  {
    id: "indio-products-nationwide",
    name: "Indio Products, Inc.",
    region: "USA",
    location: "Whittier, California / nationwide distribution",
    website: "https://indioproducts.com/overview/",
    wholesale: true,
    status: "REQUIRES_ACCOUNT",
    categories: ["religious candles", "spiritual products", "mystical products", "decorative goods", "Orishas line", "colognes"],
    strengths: ["manufacturer and wholesale distributor", "10,000+ products claimed", "200,000 sq ft manufacturing and logistics center"],
    sourceEvidence: ["https://indioproducts.com/overview/", "https://indioproducts.com/about-us/"],
    sourcingPolicy: "CONSUMABLES",
    researchPriority: 1
  },
  {
    id: "scentsational-florida",
    name: "Scentsational Soaps & Candles",
    region: "USA",
    location: "Venice, Florida",
    website: "https://scentsational-products.com/wholesale/",
    wholesale: true,
    status: "REQUIRES_ACCOUNT",
    categories: ["soy candles", "room sprays", "private-label candles", "private-label fragrance products"],
    strengths: ["Florida manufacturer", "94,000 sq ft production facility", "wholesale and private-label programs"],
    sourceEvidence: ["https://scentsational-products.com/wholesale/"],
    sourcingPolicy: "CUSTOM_MANUFACTURING",
    researchPriority: 2
  },
  {
    id: "botanica-co-nationwide",
    name: "Botanica",
    region: "USA",
    location: "United States / nationwide wholesale",
    website: "https://www.botanica.co/pages/wholesale",
    wholesale: true,
    status: "REQUIRES_CONTACT",
    categories: ["candles", "incense", "perfume", "apothecary", "home fragrance", "private-label candles"],
    strengths: ["US and international wholesale", "online-reseller program", "private-label candles from 500 units"],
    sourceEvidence: ["https://www.botanica.co/pages/wholesale", "https://www.botanica.co/pages/our-story"],
    sourcingPolicy: "CUSTOM_MANUFACTURING",
    researchPriority: 3
  },
  {
    id: "ritual-botanico-austin",
    name: "Ritual Botanico",
    region: "USA",
    location: "Austin, Texas",
    website: "https://www.ritual-botanico.com/",
    wholesale: true,
    status: "REQUIRES_ACCOUNT",
    categories: ["botanical hair care", "professional beauty products", "authorized wholesale resale"],
    strengths: ["Texas wholesale office", "brand authorization documents", "Amazon and Walmart reseller support"],
    sourceEvidence: ["https://www.ritual-botanico.com/"],
    sourcingPolicy: "GENERAL_SUPPORT",
    researchPriority: 3
  },
  {
    id: "unilite-candles-houston",
    name: "Uni-Lite Candles Inc.",
    region: "USA",
    location: "Houston, Texas",
    website: "https://www.unilitecc.com/",
    wholesale: true,
    status: "REQUIRES_ACCOUNT",
    categories: ["7-day candles", "religious candles", "prepared candles", "esoteric candles", "sprays"],
    strengths: ["wholesale only", "Houston manufacturer/distributor", "religious and esoteric candle specialization"],
    sourceEvidence: ["https://www.unilitecc.com/"],
    sourcingPolicy: "CONSUMABLES",
    researchPriority: 1
  },
  {
    id: "velavida-texas",
    name: "Velavida Private Label",
    region: "USA",
    location: "Texas / nationwide manufacturing",
    website: "https://www.velavidaprivatelabel.com/",
    wholesale: true,
    status: "REQUIRES_CONTACT",
    categories: ["private-label candles", "contract candle manufacturing", "custom fragrance", "retail programs"],
    strengths: ["Texas manufacturing facility", "50,000+ unit program capacity claimed", "NDA-ready private-label partnerships"],
    sourceEvidence: ["https://www.velavidaprivatelabel.com/"],
    sourcingPolicy: "CUSTOM_MANUFACTURING",
    researchPriority: 2
  },
  {
    id: "united-candle-ohio",
    name: "United Candle LLC",
    region: "USA",
    location: "Norwich, Ohio / nationwide",
    website: "https://unitedcandlellc.com/",
    wholesale: true,
    status: "REQUIRES_CONTACT",
    categories: ["glass religious candles", "votives", "pillars", "tapers", "private-label candles", "contract manufacturing"],
    strengths: ["65+ years claimed", "80,000 sq ft US facility", "wholesale, private label and contract manufacturing"],
    sourceEvidence: ["https://unitedcandlellc.com/"],
    sourcingPolicy: "CUSTOM_MANUFACTURING",
    researchPriority: 2
  },
  {
    id: "a-candle-co-nationwide",
    name: "A Candle Co.",
    region: "USA",
    location: "United States / nationwide",
    website: "https://www.acandleco.com/",
    wholesale: true,
    status: "REQUIRES_ACCOUNT",
    categories: ["private-label candles", "soy-coconut candles", "reed diffusers", "perfumes", "body sprays"],
    strengths: ["US private-label manufacturer", "low published opening MOQ", "300+ wholesale candles and accessories claimed"],
    sourceEvidence: ["https://www.acandleco.com/"],
    sourcingPolicy: "CUSTOM_MANUFACTURING",
    researchPriority: 3
  },
  {
    id: "eap-innovations-nationwide",
    name: "EAP Innovations / EA Candle",
    region: "USA",
    location: "United States / nationwide",
    website: "https://www.eacandle.com/private-label-manufacturing",
    wholesale: true,
    status: "REQUIRES_CONTACT",
    categories: ["private-label candles", "liquid-filled products", "candle supplies", "glass vessels"],
    strengths: ["American manufacturer", "official Libbey glass distributor", "custom scents and low-MOQ programs claimed"],
    sourceEvidence: ["https://www.eacandle.com/private-label-manufacturing"],
    sourcingPolicy: "CUSTOM_MANUFACTURING",
    researchPriority: 3
  },
  {
    id: "copiam-consumer-india",
    name: "Copiam Consumer Care",
    region: "INTERNATIONAL",
    location: "Mumbai, Maharashtra, India",
    website: "https://www.copiamconsumer.com/",
    wholesale: true,
    status: "REQUIRES_CONTACT",
    categories: ["velas en vaso", "velas de colores", "velas religiosas", "fabricacion y exportacion"],
    strengths: ["fabricante de velas", "embarques aduaneros documentados a Religion Universe en Miami", "candidato directo India"],
    sourceEvidence: ["https://www.copiamconsumer.com/pages/about-us", "https://www.copiamconsumer.com/policies/contact-information", "https://importkey.com/i/copiam-consumer-care"],
    contacts: [
      { label: "Correo comercial", value: "gayatri.kulkarni@copiamconsumer.com", href: "mailto:gayatri.kulkarni@copiamconsumer.com" },
      { label: "Formulario", value: "Solicitar cotizacion", href: "https://www.copiamconsumer.com/pages/contact" }
    ],
    sourcingPolicy: "CUSTOM_MANUFACTURING",
    researchPriority: 1
  },
  {
    id: "devini-llp-india",
    name: "Devini LLP",
    region: "INTERNATIONAL",
    location: "Pitampura, Delhi, India",
    website: "https://www.trademo.com/companies/monzon-brothers-ii/3810816",
    wholesale: true,
    status: "REQUIRES_CONTACT",
    categories: ["artesanias de acero inoxidable", "hierro y aluminio", "cuentas de vidrio", "fabricacion de componentes"],
    strengths: ["proveedor aduanero documentado de Monzon Brothers", "embarques recientes desde India", "direccion comercial en conocimiento de embarque"],
    sourceEvidence: ["https://www.trademo.com/companies/monzon-brothers-ii/3810816", "https://panjiva.com/Monzon-Brothers-II-Inc/2070950"],
    contacts: [{ label: "Canal B2B", value: "Perfil de comercio exterior", href: "https://www.trademo.com/companies/monzon-brothers-ii/3810816" }],
    sourcingPolicy: "CUSTOM_MANUFACTURING",
    researchPriority: 1
  },
  {
    id: "china-western-hk",
    name: "China Western HK Co. Limited",
    region: "INTERNATIONAL",
    location: "Hong Kong / China",
    website: "https://www.pietrastudio.com/sourcing/suppliers/china-western-hk-co-ltd-ar3o",
    wholesale: true,
    status: "REQUIRES_CONTACT",
    categories: ["productos de madera", "fabricacion por contrato", "proyectos personalizados"],
    strengths: ["proveedor aduanero documentado de Monzon Brothers", "canal B2B para solicitud personalizada", "MOQ y plazo requieren negociacion"],
    sourceEvidence: ["https://importkey.com/i/monzon-brothers-ii", "https://www.pietrastudio.com/sourcing/suppliers/china-western-hk-co-ltd-ar3o"],
    contacts: [{ label: "Solicitud B2B", value: "Contactar por Pietra", href: "https://www.pietrastudio.com/sourcing/suppliers/china-western-hk-co-ltd-ar3o" }],
    sourcingPolicy: "CUSTOM_MANUFACTURING",
    researchPriority: 2
  },
  {
    id: "shiva-creations-india",
    name: "Shiva Creations",
    region: "INTERNATIONAL",
    location: "Jodhpur, Rajasthan, India",
    website: "https://www.exportersindia.com/shivacreations/about-us.htm",
    wholesale: true,
    status: "REQUIRES_CONTACT",
    categories: ["artesanias", "madera", "muebles y piezas personalizadas", "fabricacion para exportacion"],
    strengths: ["fabricante/exportador", "proveedor aduanero historico de Monzon Brothers", "formulario de consulta comercial"],
    sourceEvidence: ["https://importkey.com/i/monzon-brothers-ii", "https://www.exportersindia.com/shivacreations/about-us.htm"],
    contacts: [{ label: "Consulta comercial", value: "Formulario ExportersIndia", href: "https://www.exportersindia.com/shivacreations/about-us.htm" }],
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
