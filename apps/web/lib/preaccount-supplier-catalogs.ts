export type PreaccountSupplierCatalog = {
  supplier: string;
  catalogUrl: string;
  applicationUrl: string;
  fulfillment: "DROPSHIP_CONFIRMED" | "NO_MINIMUM_ONLY";
  integration: string;
  publicCategories: string[];
  requirements: string[];
  contacts: { label: string; value: string; href: string }[];
  firstRequest: string;
};

/**
 * Pre-account catalog map. These are supplier capabilities, not sellable SKUs.
 * Complete products, costs and inventory may only enter the private catalog from
 * an authorized supplier feed or owner-provided file after account approval.
 */
export const PREACCOUNT_SUPPLIER_CATALOGS: PreaccountSupplierCatalog[] = [
  {
    supplier: "AzureGreen Wholesale",
    catalogUrl: "https://www.azuregreenw.com/",
    applicationUrl: "mailto:wholesaleaccounts@azuregreen.com",
    fulfillment: "DROPSHIP_CONFIRMED",
    integration: "CSV/XML autorizado después de aprobación",
    publicCategories: ["velas", "libros", "incienso", "aceites", "hierbas", "cristales", "joyería", "herramientas rituales"],
    requirements: ["cuenta mayorista aprobada", "feed CSV/XML vigente", "costo y stock confirmados"]
    ,contacts: [
      { label: "Correo mayorista", value: "wholesaleaccounts@azuregreen.com", href: "mailto:wholesaleaccounts@azuregreen.com" },
      { label: "Teléfono", value: "+1 413-623-2155", href: "tel:+14136232155" }
    ],
    firstRequest: "Solicitar cuenta dropship, feed CSV/XML, lista de costos, política de imágenes y envío ciego."
  },
  {
    supplier: "Candle Builders",
    catalogUrl: "https://candlebuilders.com/pages/candle-builders-drop-shipping-sellers-guide",
    applicationUrl: "https://candlebuilders.com/pages/account-application",
    fulfillment: "DROPSHIP_CONFIRMED",
    integration: "App 2.0 para Shopify",
    publicCategories: ["velas privadas de 4 oz", "velas privadas de 9 oz", "velas privadas de 13.75 oz", "etiquetas personalizadas"],
    requirements: ["cuenta aprobada", "diseños originales de BOTANICA OCHOSI", "muestra y costo final verificados"]
    ,contacts: [{ label: "Solicitud", value: "Formulario de cuenta", href: "https://candlebuilders.com/pages/account-application" }],
    firstRequest: "Solicitar aprobación App 2.0, tabla de costo/envío, archivos de etiqueta y una muestra sin activar fulfillment."
  },
  {
    supplier: "Enchanted Soul",
    catalogUrl: "https://enchantedsoul.store/blogs/enchanted-musings/wholesale-ritual-herbs-metaphysical-stores",
    applicationUrl: "https://enchantedsoul.store/",
    fulfillment: "DROPSHIP_CONFIRMED",
    integration: "Shopify Collective o carga autorizada",
    publicCategories: ["hierbas rituales elegibles", "sales", "incienso", "materiales espirituales"],
    requirements: ["confirmar SKU elegible para dropshipping", "revisión regulatoria por producto", "precio y stock vigentes"]
    ,contacts: [{ label: "Contacto", value: "Tienda y soporte oficial", href: "https://enchantedsoul.store/" }],
    firstRequest: "Confirmar acceso por Shopify Collective, SKU dropship elegibles, packing slip ciego y política de devoluciones."
  },
  {
    supplier: "Photograve",
    catalogUrl: "https://www.photograve.com/",
    applicationUrl: "mailto:info@photograve.com",
    fulfillment: "DROPSHIP_CONFIRMED",
    integration: "Cuenta comercial; feed por confirmar",
    publicCategories: ["joyería personalizada", "dijes", "placas", "piezas hechas a pedido"],
    requirements: ["cuenta comercial", "derechos del diseño", "tabla de costos y personalización"]
    ,contacts: [
      { label: "Correo", value: "info@photograve.com", href: "mailto:info@photograve.com" },
      { label: "Teléfono", value: "+1 800-897-5608", href: "tel:+18008975608" }
    ],
    firstRequest: "Solicitar cuenta dropship, catálogo/feed, precios de personalización y confirmación de empaque con nuestra devolución."
  },
  {
    supplier: "PMD Crystal & Fossil",
    catalogUrl: "https://pmdcrystalandfossil.com/",
    applicationUrl: "https://pmdcrystalandfossil.com/wholesale-verification/",
    fulfillment: "NO_MINIMUM_ONLY",
    integration: "Importación de catálogo por negociar",
    publicCategories: ["cristales", "fósiles", "tallas minerales", "joyería", "portavelas"],
    requirements: ["EIN/resale certificate", "sitio comercial activo", "dropshipping directo todavía no confirmado"]
    ,contacts: [
      { label: "Correo", value: "Petru@pmdcrystal.com", href: "mailto:Petru@pmdcrystal.com" },
      { label: "Petru", value: "+1 972-890-4691", href: "tel:+19728904691" },
      { label: "David", value: "+1 972-998-6730", href: "tel:+19729986730" }
    ],
    firstRequest: "Abrir cuenta sin mínimo y negociar por escrito dropshipping ciego de unidades individuales antes de cargar productos."
  },
  {
    supplier: "Volcanic Earth",
    catalogUrl: "https://volcanicearth.com/wp-content/uploads/2022/02/faq-drop-shipping-program.pdf",
    applicationUrl: "mailto:sales@volcanicearth.com",
    fulfillment: "DROPSHIP_CONFIRMED",
    integration: "Pedidos manuales; feed por confirmar",
    publicCategories: ["jabones", "cuidado corporal", "cuidado de piel", "productos naturales"],
    requirements: ["revisión de etiquetado/importación", "costo internacional", "plazo y tracking confirmados"]
    ,contacts: [
      { label: "Ventas", value: "sales@volcanicearth.com", href: "mailto:sales@volcanicearth.com" },
      { label: "Contacto comercial", value: "barry@volcanicearth.com", href: "mailto:barry@volcanicearth.com" }
    ],
    firstRequest: "Solicitar catálogo dropship, costo a Houston, tracking, composición/etiquetas y documentación de importación."
  },
  {
    supplier: "Prodigi",
    catalogUrl: "https://www.prodigi.com/",
    applicationUrl: "https://www.prodigi.com/",
    fulfillment: "DROPSHIP_CONFIRMED",
    integration: "Shopify app, API o formulario manual",
    publicCategories: ["velas personalizadas", "impresos", "arte", "libros personalizados", "artículos de hogar"],
    requirements: ["cuenta gratuita", "diseños propios/licenciados", "muestra y costo por región"],
    contacts: [
      { label: "Ventas", value: "sales@prodigi.com", href: "mailto:sales@prodigi.com" },
      { label: "Soporte", value: "support@prodigi.com", href: "mailto:support@prodigi.com" }
    ],
    firstRequest: "Solicitar precios estadounidenses, feed/API, vela de muestra, empaque white-label y tiempos a clientes nationwide."
  },
  {
    supplier: "Printify",
    catalogUrl: "https://printify.com/personalized-candles/",
    applicationUrl: "https://printify.com/app/register",
    fulfillment: "DROPSHIP_CONFIRMED",
    integration: "Aplicación oficial de Shopify",
    publicCategories: ["velas personalizadas", "productos print-on-demand", "regalos con marca"],
    requirements: ["cuenta", "proveedor de impresión seleccionado", "muestra y margen final verificados"],
    contacts: [{ label: "Ayuda", value: "Centro de ayuda / chat", href: "https://help.printify.com/" }],
    firstRequest: "Abrir cuenta, elegir proveedor estadounidense y pedir muestra antes de conectar productos al storefront."
  }
];

export const preaccountCatalogStats = () => ({
  suppliers: PREACCOUNT_SUPPLIER_CATALOGS.length,
  dropshipConfirmed: PREACCOUNT_SUPPLIER_CATALOGS.filter((item) => item.fulfillment === "DROPSHIP_CONFIRMED").length,
  publicCategoryLanes: new Set(PREACCOUNT_SUPPLIER_CATALOGS.flatMap((item) => item.publicCategories)).size
});
