export const BOTANICA_STORE_CATEGORIES = [
  "ACEITES",
  "AGUAS AROMÁTICAS",
  "AMULETOS",
  "BARRO / CLAY",
  "BAÑOS / RIEGOS",
  "CARACOLES",
  "CLOTHING, FABRIC & GORROS",
  "COLLARES",
  "CORONAS DE SANTOS",
  "COLONIA / COLOGNE",
  "ELEGUÁ / ESHU",
  "ENVASES VACÍOS",
  "ESTERAS / MATS",
  "HERRAMIENTAS ORICHAS",
  "HIERBAS",
  "IFÁ",
  "ILDE / BRACELETS",
  "IMÁGENES / SANTOS",
  "IMPORTED PERFUMES",
  "INCIENSOS",
  "INGREDIENTES",
  "JABONES / SOAPS",
  "KNIFE",
  "LAVADO DE PISO / FLOOR WASH",
  "WOOD / MADERA",
  "MISCELLANEOUS",
  "MUÑECAS / DOLLS",
  "PALOS",
  "PEDESTAL",
  "PERFUMES AROMÁTICOS 1 OZ",
  "PERFUMES & COLONIAS / PERFUMES & COLOGNES",
  "POLVOS",
  "PORCELANA",
  "QUEMADORES / BURNERS",
  "SAGE",
  "VELAS / CANDLES",
] as const;

export type BotanicaStoreCategory = (typeof BOTANICA_STORE_CATEGORIES)[number];

export function isBotanicaStoreCategory(value: unknown): value is BotanicaStoreCategory {
  return typeof value === "string" && (BOTANICA_STORE_CATEGORIES as readonly string[]).includes(value);
}
