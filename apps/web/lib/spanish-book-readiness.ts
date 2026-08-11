export type SpanishEditionClass = "SPANISH_ORIGINAL" | "OFFICIAL_TRANSLATION" | "BOTANICA_DESCRIPTION_ONLY";

export function spanishBookReadiness(input: {
  materialType?: string;
  spanishEditionClass?: string;
  isbn?: string;
  publisher?: string;
  publicationCountry?: string;
  authorizedReseller?: string;
  commercialEditionStatus?: string;
  rightsReference?: string;
}) {
  if (input.materialType !== "BOOK") return { applicable:false, ready:true, blockers:[] as string[] };
  const blockers:string[]=[];
  if (!input.spanishEditionClass) blockers.push("Falta clasificar la edición en español.");
  if (input.spanishEditionClass === "BOTANICA_DESCRIPTION_ONLY") blockers.push("Una descripción traducida por BOTANICA no convierte el libro en edición española.");
  if (!String(input.isbn??"").trim()) blockers.push("Falta ISBN.");
  if (!String(input.publisher??"").trim()) blockers.push("Falta editorial.");
  if (!String(input.publicationCountry??"").trim()) blockers.push("Falta país de publicación.");
  if (!String(input.authorizedReseller??"").trim()) blockers.push("Falta reseller o distribuidor autorizado.");
  if (input.commercialEditionStatus !== "VERIFIED") blockers.push("La edición comercial no está verificada.");
  if (!String(input.rightsReference??"").trim()) blockers.push("Falta referencia de derechos o autorización comercial.");
  return { applicable:true, ready:blockers.length===0, blockers };
}
