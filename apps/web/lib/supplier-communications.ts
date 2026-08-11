export type SupplierCommunicationKind = "WHOLESALE_ACCOUNT" | "RESELL_AUTHORIZATION" | "PRIVATE_LABEL" | "CATALOG_QUOTE" | "SAMPLE_ORDER" | "IMPORT_DOCUMENTS" | "FOLLOW_UP";
export type SupplierCommunicationLanguage = "es" | "en";

export const SUPPLIER_COMMUNICATION_KINDS: Array<{ value: SupplierCommunicationKind; label: string }> = [
  { value:"WHOLESALE_ACCOUNT", label:"Abrir cuenta mayorista" }, { value:"RESELL_AUTHORIZATION", label:"Autorización de reventa" },
  { value:"PRIVATE_LABEL", label:"Propuesta de marca privada" }, { value:"CATALOG_QUOTE", label:"Catálogo, precios, MOQ y tiempos" },
  { value:"SAMPLE_ORDER", label:"Pedido de muestras" }, { value:"IMPORT_DOCUMENTS", label:"Documentos de exportación/importación" },
  { value:"FOLLOW_UP", label:"Seguimiento comercial" },
];

const subjects: Record<SupplierCommunicationKind, { es:string; en:string }> = {
  WHOLESALE_ACCOUNT:{es:"Solicitud de cuenta mayorista — BOTANICA OCHOSI",en:"Wholesale account application — BOTANICA OCHOSI"},
  RESELL_AUTHORIZATION:{es:"Solicitud de autorización escrita de reventa",en:"Request for written resale authorization"},
  PRIVATE_LABEL:{es:"Propuesta de fabricación y marca privada — BOTANICA OCHOSI",en:"Private-label manufacturing proposal — BOTANICA OCHOSI"},
  CATALOG_QUOTE:{es:"Solicitud de catálogo, precios, MOQ y tiempos",en:"Request for catalog, pricing, MOQ and lead times"},
  SAMPLE_ORDER:{es:"Solicitud de muestras y pedido inicial",en:"Sample request and initial order"},
  IMPORT_DOCUMENTS:{es:"Documentación requerida para exportación e importación",en:"Required export and import documentation"},
  FOLLOW_UP:{es:"Seguimiento — relación comercial BOTANICA OCHOSI",en:"Follow-up — BOTANICA OCHOSI business relationship"},
};

const requests: Record<SupplierCommunicationKind, { es:string; en:string }> = {
  WHOLESALE_ACCOUNT:{es:"Deseamos abrir una cuenta mayorista. Por favor, indíquenos los requisitos de solicitud, términos de pago, pedido mínimo, territorios autorizados y política de reventa online y B2B.",en:"We would like to open a wholesale account. Please provide your application requirements, payment terms, minimum order, authorized territories, and online/B2B resale policy."},
  RESELL_AUTHORIZATION:{es:"Solicitamos confirmación escrita de que podemos revender sus productos en nuestra tienda online y a botánicas aprobadas. Indique las marcas, productos, territorios y canales autorizados, y cualquier política MAP o restricción de uso de imágenes.",en:"We request written confirmation that we may resell your products through our online store and to approved botanicas. Please identify authorized brands, products, territories and channels, plus any MAP policy or image-use restrictions."},
  PRIVATE_LABEL:{es:"Nos interesa desarrollar productos con marca privada BOTANICA OCHOSI. Envíenos capacidades de fabricación, MOQ, formulaciones o personalización, empaque, pruebas, certificaciones, propiedad de diseños, tiempos y costos de muestra y producción.",en:"We are interested in developing BOTANICA OCHOSI private-label products. Please send manufacturing capabilities, MOQ, formulation/customization options, packaging, testing, certifications, design ownership, lead times, and sample/production costs."},
  CATALOG_QUOTE:{es:"Envíenos su catálogo mayorista vigente en CSV, XLSX o PDF con SKU, descripción, precio, moneda, MOQ, unidades por caja, disponibilidad, peso/dimensiones, país de origen, tiempos de preparación, opciones de envío y descuentos por volumen.",en:"Please send your current wholesale catalog in CSV, XLSX or PDF with SKU, description, price, currency, MOQ, case pack, availability, weight/dimensions, country of origin, processing time, shipping options, and volume discounts."},
  SAMPLE_ORDER:{es:"Deseamos evaluar muestras antes del pedido comercial. Confirme precio y cantidad de muestras, envío, tiempo de preparación, especificaciones, lote/fecha de fabricación cuando aplique y cómo se acredita el costo de muestra al primer pedido.",en:"We would like to evaluate samples before a commercial order. Please confirm sample price and quantity, shipping, processing time, specifications, lot/manufacture date where applicable, and whether sample cost is credited to the first order."},
  IMPORT_DOCUMENTS:{es:"Antes de importar necesitamos factura proforma y comercial, packing list, código HS sugerido, país de origen, composición/materiales, certificados aplicables, requisitos de exportación, Incoterm, dimensiones/peso y confirmación de que ningún material está restringido o protegido.",en:"Before importing, we require a pro forma and commercial invoice, packing list, suggested HS code, country of origin, composition/materials, applicable certificates, export requirements, Incoterm, dimensions/weight, and confirmation that no material is restricted or protected."},
  FOLLOW_UP:{es:"Damos seguimiento a nuestra solicitud. Para completar la evaluación necesitamos confirmar catálogo vigente, precios, MOQ, disponibilidad, tiempos, envío, autorización de reventa o marca privada y documentación comercial. Agradecemos una respuesta con el próximo paso y la persona responsable.",en:"We are following up on our request. To complete our review, we need to confirm the current catalog, pricing, MOQ, availability, lead times, shipping, resale/private-label authorization, and commercial documentation. Please reply with the next step and responsible contact."},
};

export function buildSupplierCommunication(kind: SupplierCommunicationKind, language: SupplierCommunicationLanguage, supplierName = "[NOMBRE DEL PROVEEDOR]") {
  const greeting = language === "es" ? `Estimado equipo de ${supplierName}:` : `Dear ${supplierName} team,`;
  const intro = language === "es" ? "Mi nombre es [NOMBRE] y represento a BOTANICA OCHOSI, comercio estadounidense especializado en productos de botánica y venta B2C/B2B a establecimientos aprobados." : "My name is [NAME], representing BOTANICA OCHOSI, a U.S. business specializing in botanica products and B2C/B2B sales to approved retailers.";
  const close = language === "es" ? "Por favor, incluya nombre y cargo del contacto autorizado, vigencia de la cotización y documentos adjuntos. Ningún pedido quedará autorizado hasta nuestra confirmación escrita.\n\nAtentamente,\n[NOMBRE]\nBOTANICA OCHOSI\n[EMAIL] · [TELÉFONO] · [SITIO WEB]" : "Please include the authorized contact's name/title, quote validity, and supporting documents. No order is authorized until our written confirmation.\n\nSincerely,\n[NAME]\nBOTANICA OCHOSI\n[EMAIL] · [PHONE] · [WEBSITE]";
  return { subject: subjects[kind][language], body: `${greeting}\n\n${intro}\n\n${requests[kind][language]}\n\n${close}` };
}
