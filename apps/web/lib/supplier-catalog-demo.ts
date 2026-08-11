export type SupplierCatalogDemoSeed = {
  id: string;
  supplier: string;
  sku: string;
  name: string;
  category: string;
  wholesalePrice: number;
  shippingCost: number;
  handlingCost: number;
  moq: number;
  unit: string;
  productUrl: string;
  supplierProcessingDays: number;
  importTransitDays: number;
  handlingDays: number;
  customerShippingDays: number;
  botanicaWholesaleEnabled: boolean;
  botanicaWholesalePrice: number;
  botanicaWholesaleMoq: number;
  materialType: "PRODUCT" | "BOOK";
  isbn?: string;
  publisher?: string;
  bookCollection?: string;
  notes: string;
};

const DEMO_NOTICE =
  "MUESTRA INTERNA: salvo cuando la fuente pública muestra el precio, costos accesorios, MOQ y tiempos son valores ilustrativos para probar el sistema. Confirmar cotización, inventario, autorización y costo puesto en almacén antes de comprar o publicar.";

/** Owner-only examples. They remain blocked from Shopify and may be removed safely. */
export const SUPPLIER_CATALOG_DEMO_SEEDS: SupplierCatalogDemoSeed[] = [
  {
    id: "demo-herramienta-oba",
    supplier: "Herramientas de Santeria",
    sku: "DEMO-TOOL1",
    name: "Herramienta de santo Obá — muestra",
    category: "Herramientas de santo",
    wholesalePrice: 66,
    shippingCost: 5,
    handlingCost: 2,
    moq: 1,
    unit: "juego",
    productUrl: "https://herramientasdesanteria.com/en/tool1",
    supplierProcessingDays: 3,
    importTransitDays: 0,
    handlingDays: 1,
    customerShippingDays: 5,
    botanicaWholesaleEnabled: true,
    botanicaWholesalePrice: 84,
    botanicaWholesaleMoq: 3,
    materialType: "PRODUCT",
    notes: `Precio mayorista unitario observado públicamente; demás valores ilustrativos. ${DEMO_NOTICE}`
  },
  {
    id: "demo-libro-divinacion-afrocubana",
    supplier: "Original Publications Wholesale",
    sku: "DEMO-ISBN-0892818107",
    name: "Secrets of Afro-Cuban Divination — muestra",
    category: "Libros Ifá, Lucumí y diloggún",
    wholesalePrice: 20.29,
    shippingCost: 3,
    handlingCost: 1,
    moq: 1,
    unit: "libro",
    productUrl: "https://www.originalpublicationsw.com/seofafdi.html",
    supplierProcessingDays: 2,
    importTransitDays: 0,
    handlingDays: 1,
    customerShippingDays: 5,
    botanicaWholesaleEnabled: true,
    botanicaWholesalePrice: 27.5,
    botanicaWholesaleMoq: 3,
    materialType: "BOOK",
    isbn: "0892818107",
    publisher: "Destiny Books / Inner Traditions",
    bookCollection: "LUCUMI_SANTERIA",
    notes: `Precio mayorista observado públicamente; edición en inglés y derechos comerciales todavía bloqueados hasta verificar reseller. ${DEMO_NOTICE}`
  },
  {
    id: "demo-opon-ifa",
    supplier: "Yoruba Imports",
    sku: "DEMO-OPON-IFA",
    name: "Opón Ifá — muestra operativa",
    category: "Herramientas de Ifá",
    wholesalePrice: 42,
    shippingCost: 8,
    handlingCost: 3,
    moq: 2,
    unit: "unidad",
    productUrl: "https://yorubaimports.com/",
    supplierProcessingDays: 4,
    importTransitDays: 0,
    handlingDays: 2,
    customerShippingDays: 5,
    botanicaWholesaleEnabled: true,
    botanicaWholesalePrice: 61,
    botanicaWholesaleMoq: 4,
    materialType: "PRODUCT",
    notes: DEMO_NOTICE
  },
  {
    id: "demo-collar-yemaya",
    supplier: "Yoruba Distribuidores LLC",
    sku: "DEMO-COLLAR-YEMAYA",
    name: "Collar de Yemayá azul y blanco — muestra",
    category: "Collares y elekes",
    wholesalePrice: 8,
    shippingCost: 1.5,
    handlingCost: 0.75,
    moq: 12,
    unit: "unidad",
    productUrl: "https://yorubadistribuidores.com/product/collar-yemaya-azul-blanco/",
    supplierProcessingDays: 3,
    importTransitDays: 0,
    handlingDays: 1,
    customerShippingDays: 5,
    botanicaWholesaleEnabled: true,
    botanicaWholesalePrice: 11.5,
    botanicaWholesaleMoq: 24,
    materialType: "PRODUCT",
    notes: DEMO_NOTICE
  }
];
