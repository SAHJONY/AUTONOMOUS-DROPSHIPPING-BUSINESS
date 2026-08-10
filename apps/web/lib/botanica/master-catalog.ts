export type BotanicaGate =
  | "CULTURAL_VERIFIED"
  | "SUPPLIER_VERIFIED"
  | "RIGHTS_VERIFIED"
  | "COMMERCE_SAFE";

export type BotanicaProductFamily = {
  id: string;
  category: string;
  name_es: string;
  name_en: string;
  tags: string[];
  required_gates: BotanicaGate[];
  commerce_mode: "PHYSICAL" | "BOOK" | "EDUCATIONAL" | "REFERENCE_ONLY";
};

const PHYSICAL_GATES: BotanicaGate[] = ["CULTURAL_VERIFIED", "SUPPLIER_VERIFIED", "COMMERCE_SAFE"];
const BOOK_GATES: BotanicaGate[] = ["SUPPLIER_VERIFIED", "RIGHTS_VERIFIED", "COMMERCE_SAFE"];
const EDUCATION_GATES: BotanicaGate[] = ["CULTURAL_VERIFIED", "RIGHTS_VERIFIED", "COMMERCE_SAFE"];

function physical(id: string, category: string, name_es: string, name_en: string, tags: string[] = []): BotanicaProductFamily {
  return { id, category, name_es, name_en, tags, required_gates: PHYSICAL_GATES, commerce_mode: "PHYSICAL" };
}
function book(id: string, category: string, name_es: string, name_en: string, tags: string[] = []): BotanicaProductFamily {
  return { id, category, name_es, name_en, tags, required_gates: BOOK_GATES, commerce_mode: "BOOK" };
}
function education(id: string, category: string, name_es: string, name_en: string, tags: string[] = []): BotanicaProductFamily {
  return { id, category, name_es, name_en, tags, required_gates: EDUCATION_GATES, commerce_mode: "EDUCATIONAL" };
}

export const BOTANICA_CATEGORIES = [
  "Ifá y Diloggún",
  "Libros y Educación",
  "Orishas",
  "Collares, Ilekes y Pulseras",
  "Herramientas y Atributos",
  "Soperas, Recipientes y Altares",
  "Velas y Velones",
  "Hierbas y Ewé",
  "Baños y Despojos",
  "Aceites y Esencias",
  "Colonias y Perfumes",
  "Jabones y Limpiezas",
  "Inciensos y Sahumerios",
  "Polvos y Cascarilla",
  "Resguardos y Accesorios",
  "Textiles y Vestimenta",
  "Imágenes, Estatuas y Arte",
  "Instrumentos y Música",
  "Cultura Yoruba y Lucumí",
] as const;

export const ORISHA_COLLECTIONS = [
  "Eleguá", "Ogún", "Ochosi", "Osun", "Obatalá", "Yemayá", "Oshún", "Shangó",
  "Oyá", "Orula", "Babalú Ayé", "Aggayú", "Olokun", "Oduduwa", "Obba", "Yewá",
  "Naná Burukú", "Ibeyis", "Inle", "Asojano", "Egungun", "Ancestros",
] as const;

export const BOTANICA_MASTER_CATALOG: BotanicaProductFamily[] = [
  education("ifa-256-odu", "Ifá y Diloggún", "Índice de los 256 Odù de Ifá", "256 Ifá Odù Index", ["ifa", "odu", "dice-ifa"]),
  education("ifa-dice-ifa", "Ifá y Diloggún", "Dice Ifá / Tratados de Odù", "Dice Ifá / Odù Treatises", ["dice-ifa", "tratados"]),
  education("ifa-patakines", "Ifá y Diloggún", "Patakines e Itan", "Patakines and Itan", ["patakines", "itan"]),
  education("ifa-refranes", "Ifá y Diloggún", "Refranes de Odù", "Odù Proverbs", ["refranes"]),
  education("ifa-diloggun", "Ifá y Diloggún", "Diloggún: estudio y referencias", "Diloggún Study and References", ["diloggun"]),
  physical("ifa-opon", "Ifá y Diloggún", "Tablero de Ifá / Opón Ifá", "Ifá Divination Tray / Opon Ifa", ["ifa", "tool"]),
  physical("ifa-iroke", "Ifá y Diloggún", "Iroke Ifá", "Iroke Ifa", ["ifa", "tool"]),
  physical("ifa-ikin", "Ifá y Diloggún", "Ikin de Ifá", "Ikin Ifa", ["ifa", "tool"]),
  physical("ifa-opkele", "Ifá y Diloggún", "Opelé / Okpele", "Opele / Okpele", ["ifa", "tool"]),
  physical("ifa-iyerosun", "Ifá y Diloggún", "Iyerosun", "Iyerosun", ["ifa", "material"]),
  physical("ifa-agere", "Ifá y Diloggún", "Agere Ifá", "Agere Ifa", ["ifa", "container"]),
  physical("diloggun-cowries", "Ifá y Diloggún", "Caracoles para Diloggún", "Diloggún Cowries", ["diloggun", "cowries"]),
  physical("diloggun-mat", "Ifá y Diloggún", "Estera para consulta", "Divination Mat", ["diloggun", "mat"]),

  book("book-ifa-spanish", "Libros y Educación", "Libros de Ifá en Español", "Spanish Ifá Books", ["books", "spanish-first"]),
  book("book-dice-ifa", "Libros y Educación", "Libros Dice Ifá y tratados de Odù", "Dice Ifá and Odù Books", ["books", "dice-ifa"]),
  book("book-santeria-lucumi", "Libros y Educación", "Libros de Santería y Lucumí", "Santería and Lucumí Books", ["books", "lucumi"]),
  book("book-orishas", "Libros y Educación", "Libros sobre Orishas", "Orisha Books", ["books", "orishas"]),
  book("book-patakines", "Libros y Educación", "Libros de Patakines e Itan", "Patakines and Itan Books", ["books", "patakines"]),
  book("book-diloggun", "Libros y Educación", "Libros de Diloggún", "Diloggún Books", ["books", "diloggun"]),
  book("book-yoruba-culture", "Libros y Educación", "Cultura e Historia Yoruba", "Yoruba Culture and History", ["books", "yoruba"]),
  book("book-yoruba-spanish-dictionary", "Libros y Educación", "Diccionarios Yoruba–Español", "Yoruba–Spanish Dictionaries", ["books", "dictionary"]),

  physical("ileke-elec", "Collares, Ilekes y Pulseras", "Ilekes y collares de Orisha", "Orisha Ilekes and Necklaces", ["ileke", "beads"]),
  physical("pulsera-orisha", "Collares, Ilekes y Pulseras", "Pulseras de Orisha", "Orisha Bracelets", ["bracelet", "beads"]),
  physical("ide-orula", "Collares, Ilekes y Pulseras", "Idé de Orula", "Orula Ide Bracelet", ["orula", "ide"]),
  physical("beads-loose", "Collares, Ilekes y Pulseras", "Cuentas sueltas por color y tamaño", "Loose Beads by Color and Size", ["beads", "supplies"]),
  physical("thread-cord", "Collares, Ilekes y Pulseras", "Hilo y cordón para cuentas", "Beading Thread and Cord", ["supplies"]),

  physical("herramienta-elegua", "Herramientas y Atributos", "Herramientas de Eleguá", "Elegua Tools", ["elegua"]),
  physical("herramienta-ogun", "Herramientas y Atributos", "Herramientas de Ogún", "Ogun Tools", ["ogun"]),
  physical("herramienta-ochosi", "Herramientas y Atributos", "Arco, flecha y atributos de Ochosi", "Ochosi Bow, Arrow and Attributes", ["ochosi"]),
  physical("herramienta-shango", "Herramientas y Atributos", "Hacha y atributos de Shangó", "Shango Axe and Attributes", ["shango"]),
  physical("herramienta-oya", "Herramientas y Atributos", "Iruké y atributos de Oyá", "Oya Iruke and Attributes", ["oya"]),
  physical("herramienta-obatala", "Herramientas y Atributos", "Herramientas de Obatalá", "Obatala Tools", ["obatala"]),
  physical("herramienta-yemaya", "Herramientas y Atributos", "Herramientas de Yemayá", "Yemaya Tools", ["yemaya"]),
  physical("herramienta-oshun", "Herramientas y Atributos", "Herramientas de Oshún", "Oshun Tools", ["oshun"]),
  physical("herramienta-orula", "Herramientas y Atributos", "Atributos de Orula", "Orula Attributes", ["orula"]),
  physical("campanas", "Herramientas y Atributos", "Campanas rituales", "Ritual Bells", ["bell"]),
  physical("maracas", "Herramientas y Atributos", "Maracas rituales", "Ritual Maracas", ["maracas"]),

  physical("sopera-orisha", "Soperas, Recipientes y Altares", "Soperas de Orisha", "Orisha Tureens", ["sopera"]),
  physical("bateas", "Soperas, Recipientes y Altares", "Bateas y recipientes", "Wooden Bowls and Vessels", ["vessel"]),
  physical("tinajas", "Soperas, Recipientes y Altares", "Tinajas", "Clay Jars", ["jar"]),
  physical("jicaras", "Soperas, Recipientes y Altares", "Jícaras", "Gourd Bowls", ["gourd"]),
  physical("platos-cazuelas", "Soperas, Recipientes y Altares", "Platos, cazuelas y recipientes", "Plates, Bowls and Vessels", ["altar"]),
  physical("altares", "Soperas, Recipientes y Altares", "Accesorios para altar", "Altar Accessories", ["altar"]),

  physical("candle-plain", "Velas y Velones", "Velas lisas por color", "Plain Candles by Color", ["candle"]),
  physical("candle-7day", "Velas y Velones", "Velones de 7 días", "7-Day Candles", ["candle"]),
  physical("candle-orisha", "Velas y Velones", "Velas dedicadas por Orisha", "Orisha Devotional Candles", ["candle", "orisha"]),
  physical("candle-figural", "Velas y Velones", "Velas figurativas", "Figural Candles", ["candle"]),
  physical("candle-taper", "Velas y Velones", "Velas cónicas", "Taper Candles", ["candle"]),
  physical("candle-tealight", "Velas y Velones", "Velas pequeñas / tealights", "Tealight Candles", ["candle"]),

  physical("ewe-fresh", "Hierbas y Ewé", "Ewé / hierbas frescas verificadas", "Verified Fresh Ewe / Herbs", ["ewe", "herbs"]),
  physical("ewe-dried", "Hierbas y Ewé", "Hierbas secas", "Dried Herbs", ["ewe", "herbs"]),
  physical("ewe-blends", "Hierbas y Ewé", "Mezclas tradicionales de hierbas", "Traditional Herbal Blends", ["ewe", "blend"]),
  physical("herb-bags", "Hierbas y Ewé", "Hierbas empacadas por especie", "Single-Herb Packs", ["herbs"]),

  physical("bath-herbal", "Baños y Despojos", "Baños de hierbas", "Herbal Baths", ["bath"]),
  physical("bath-floral", "Baños y Despojos", "Baños florales", "Floral Baths", ["bath"]),
  physical("bath-orisha", "Baños y Despojos", "Baños temáticos por Orisha", "Orisha-Themed Baths", ["bath", "orisha"]),
  physical("bath-cleansing", "Baños y Despojos", "Baños de limpieza espiritual", "Spiritual Cleansing Baths", ["bath"]),
  physical("bath-prosperity", "Baños y Despojos", "Baños de prosperidad tradicionales", "Traditional Prosperity Baths", ["bath"]),

  physical("oil-orisha", "Aceites y Esencias", "Aceites temáticos por Orisha", "Orisha-Themed Oils", ["oil", "orisha"]),
  physical("oil-anointing", "Aceites y Esencias", "Aceites de unción tradicionales", "Traditional Anointing Oils", ["oil"]),
  physical("essence-floral", "Aceites y Esencias", "Esencias florales aromáticas", "Aromatic Floral Essences", ["essence"]),
  physical("essence-herbal", "Aceites y Esencias", "Esencias herbales aromáticas", "Aromatic Herbal Essences", ["essence"]),

  physical("cologne-florida-water", "Colonias y Perfumes", "Agua Florida", "Florida Water", ["cologne"]),
  physical("cologne-kananga", "Colonias y Perfumes", "Agua de Kananga", "Kananga Water", ["cologne"]),
  physical("cologne-rose", "Colonias y Perfumes", "Agua de rosas", "Rose Water", ["cologne"]),
  physical("cologne-violet", "Colonias y Perfumes", "Agua de violetas", "Violet Water", ["cologne"]),
  physical("perfume-traditional", "Colonias y Perfumes", "Perfumes y colonias tradicionales", "Traditional Perfumes and Colognes", ["cologne"]),

  physical("soap-castile", "Jabones y Limpiezas", "Jabón de Castilla", "Castile Soap", ["soap"]),
  physical("soap-coconut", "Jabones y Limpiezas", "Jabón de coco", "Coconut Soap", ["soap"]),
  physical("soap-herbal", "Jabones y Limpiezas", "Jabones herbales", "Herbal Soaps", ["soap"]),
  physical("soap-orisha", "Jabones y Limpiezas", "Jabones temáticos por Orisha", "Orisha-Themed Soaps", ["soap", "orisha"]),

  physical("incense-sticks", "Inciensos y Sahumerios", "Varitas de incienso", "Incense Sticks", ["incense"]),
  physical("incense-cones", "Inciensos y Sahumerios", "Conos de incienso", "Incense Cones", ["incense"]),
  physical("resin-frankincense", "Inciensos y Sahumerios", "Olíbano", "Frankincense Resin", ["resin"]),
  physical("resin-myrrh", "Inciensos y Sahumerios", "Mirra", "Myrrh Resin", ["resin"]),
  physical("charcoal", "Inciensos y Sahumerios", "Carbón para sahumerio", "Incense Charcoal", ["incense"]),
  physical("incense-burner", "Inciensos y Sahumerios", "Incensarios y quemadores", "Incense Burners", ["incense"]),

  physical("cascarilla", "Polvos y Cascarilla", "Cascarilla", "Cascarilla", ["cascarilla"]),
  physical("chalk-white", "Polvos y Cascarilla", "Tiza blanca ritual", "White Ritual Chalk", ["chalk"]),
  physical("powder-traditional", "Polvos y Cascarilla", "Polvos tradicionales no peligrosos", "Non-Hazardous Traditional Powders", ["powder"]),

  physical("amulets", "Resguardos y Accesorios", "Amuletos y resguardos culturales", "Cultural Amulets and Talismans", ["amulet"]),
  physical("pouches", "Resguardos y Accesorios", "Bolsitas y estuches", "Pouches and Cases", ["accessory"]),
  physical("shells", "Resguardos y Accesorios", "Caracoles decorativos y de estudio", "Decorative and Study Shells", ["shell"]),
  physical("coins", "Resguardos y Accesorios", "Monedas y fichas rituales", "Ritual Coins and Tokens", ["token"]),

  physical("cloth-orisha", "Textiles y Vestimenta", "Telas por colores de Orisha", "Orisha Color Fabrics", ["textile"]),
  physical("headwraps", "Textiles y Vestimenta", "Pañuelos y turbantes", "Headwraps and Turbans", ["textile"]),
  physical("skirts", "Textiles y Vestimenta", "Faldas tradicionales", "Traditional Skirts", ["textile"]),
  physical("white-clothing", "Textiles y Vestimenta", "Ropa blanca", "White Clothing", ["textile"]),
  physical("sashes", "Textiles y Vestimenta", "Bandas y cintas", "Sashes and Ribbons", ["textile"]),

  physical("statue-orisha", "Imágenes, Estatuas y Arte", "Estatuas de Orishas", "Orisha Statues", ["art", "orisha"]),
  physical("image-orisha", "Imágenes, Estatuas y Arte", "Imágenes de Orishas", "Orisha Images", ["art", "orisha"]),
  physical("prints", "Imágenes, Estatuas y Arte", "Láminas y arte cultural", "Cultural Prints and Art", ["art"]),
  physical("altar-cloth", "Imágenes, Estatuas y Arte", "Paños decorativos para altar", "Decorative Altar Cloths", ["art", "altar"]),

  physical("bata-drums", "Instrumentos y Música", "Tambores batá", "Bata Drums", ["music", "drum"]),
  physical("shekere", "Instrumentos y Música", "Shekeré", "Shekere", ["music"]),
  physical("bells-music", "Instrumentos y Música", "Campanas y agogó", "Bells and Agogo", ["music"]),
  physical("percussion-accessories", "Instrumentos y Música", "Accesorios de percusión", "Percussion Accessories", ["music"]),

  education("culture-lucumi", "Cultura Yoruba y Lucumí", "Material educativo Lucumí", "Lucumí Educational Material", ["lucumi"]),
  education("culture-yoruba", "Cultura Yoruba y Lucumí", "Material educativo Yoruba", "Yoruba Educational Material", ["yoruba"]),
  education("culture-orisha", "Cultura Yoruba y Lucumí", "Guías culturales de Orishas", "Orisha Cultural Guides", ["orisha"]),
  education("language-yoruba", "Cultura Yoruba y Lucumí", "Aprendizaje básico de Yoruba", "Basic Yoruba Learning", ["yoruba", "language"]),
];

export const PROHIBITED_AUTONOMOUS_CATALOG_CLASSES = [
  "live_animals",
  "controlled_substances",
  "prescription_medicine",
  "hazardous_chemicals",
  "poisons",
  "weapons",
  "unverified_medical_claim_products",
  "pirated_books_or_pdfs",
  "copyrighted_text_without_rights",
] as const;

export function isPublishableFamily(family: BotanicaProductFamily, passed: BotanicaGate[]): boolean {
  return family.required_gates.every((gate) => passed.includes(gate));
}

export function spanishFirstTitle(family: BotanicaProductFamily, locale = "es"): string {
  return locale.toLowerCase().startsWith("es") ? family.name_es : family.name_en;
}
