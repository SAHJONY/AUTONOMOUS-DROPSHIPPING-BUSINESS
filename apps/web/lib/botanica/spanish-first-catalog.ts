export type BotanicaGate =
  | "STANDARD"
  | "SUPPLIER_VERIFY"
  | "PROVENANCE"
  | "CULTURAL_REVIEW"
  | "IMPORT_REVIEW"
  | "INGESTIBLE_REVIEW"
  | "AGRICULTURE_REVIEW"
  | "RIGHTS_REVIEW"
  | "PRACTITIONER_REVIEW";

export type BotanicaCatalogCandidate = {
  slug: string;
  titleEs: string;
  titleEn: string;
  category: string;
  subcategory: string;
  language: "ES" | "EN" | "ES/EN" | "N/A";
  gates: BotanicaGate[];
  status: "CANDIDATE" | "REFERENCE_ONLY";
  notes?: string;
};

/**
 * Spanish-first master candidate registry for BOTANICA OCHOSI.
 *
 * IMPORTANT:
 * - CANDIDATE does not mean stocked, purchased, legal to import, consecrated, or approved for Shopify.
 * - Prices, inventory and supplier claims must come from live verified commercial evidence.
 * - Sacred/practitioner items stay HOLD until provenance + cultural/practitioner review passes.
 * - No animal-derived, controlled, ingestible or agricultural item is auto-published.
 */
export const spanishFirstBotanicaCatalog: BotanicaCatalogCandidate[] = [
  // IFÁ · HERRAMIENTAS DE ADIVINACIÓN
  {slug:"ikin-ifa",titleEs:"Ikin Ifá · nueces sagradas de palma",titleEn:"Ikin Ifá · sacred palm nuts",category:"Ifá",subcategory:"Herramientas de adivinación",language:"N/A",gates:["PROVENANCE","PRACTITIONER_REVIEW","IMPORT_REVIEW"],status:"CANDIDATE"},
  {slug:"opele-ifa",titleEs:"Opele Ifá · cadena de adivinación",titleEn:"Opele Ifá · divination chain",category:"Ifá",subcategory:"Herramientas de adivinación",language:"N/A",gates:["PROVENANCE","PRACTITIONER_REVIEW"],status:"CANDIDATE"},
  {slug:"opon-ifa",titleEs:"Opon Ifá · tablero de adivinación",titleEn:"Opon Ifá · divination tray",category:"Ifá",subcategory:"Herramientas de adivinación",language:"N/A",gates:["PROVENANCE","CULTURAL_REVIEW"],status:"CANDIDATE"},
  {slug:"iroke-ifa",titleEs:"Iroke Ifá · llamador ritual",titleEn:"Iroke Ifá · divination tapper",category:"Ifá",subcategory:"Herramientas de adivinación",language:"N/A",gates:["PROVENANCE","CULTURAL_REVIEW"],status:"CANDIDATE"},
  {slug:"iyerosun",titleEs:"Iyerosun · polvo de adivinación",titleEn:"Iyerosun · divination powder",category:"Ifá",subcategory:"Material ritual",language:"N/A",gates:["PROVENANCE","IMPORT_REVIEW","PRACTITIONER_REVIEW"],status:"CANDIDATE"},
  {slug:"agere-ifa",titleEs:"Agere Ifá · recipiente tallado",titleEn:"Agere Ifá · carved divination bowl",category:"Ifá",subcategory:"Recipientes",language:"N/A",gates:["PROVENANCE","CULTURAL_REVIEW"],status:"CANDIDATE"},
  {slug:"ide-ifa",titleEs:"Idé Ifá · pulsera tradicional",titleEn:"Ide Ifá · traditional bracelet",category:"Ifá",subcategory:"Wearables",language:"N/A",gates:["CULTURAL_REVIEW","SUPPLIER_VERIFY"],status:"CANDIDATE"},
  {slug:"ifa-bag",titleEs:"Bolsa protectora para herramientas de Ifá",titleEn:"Protective Ifá tool bag",category:"Ifá",subcategory:"Accesorios",language:"N/A",gates:["STANDARD"],status:"CANDIDATE"},
  {slug:"ifa-case",titleEs:"Estuche rígido para Opele y accesorios",titleEn:"Hard case for Opele and accessories",category:"Ifá",subcategory:"Accesorios",language:"N/A",gates:["STANDARD"],status:"CANDIDATE"},
  {slug:"ifa-study-journal",titleEs:"Cuaderno de estudio de Odù",titleEn:"Odù study journal",category:"Ifá",subcategory:"Estudio",language:"ES/EN",gates:["RIGHTS_REVIEW","PRACTITIONER_REVIEW"],status:"CANDIDATE",notes:"Contenido original BOTANICA OCHOSI; no copiar corpus protegido."},

  // DICE IFÁ · RECURSOS DIGITALES / ESTUDIO
  {slug:"idafa-dice-ifa",titleEs:"Idafa: Dice Ifá Yoruba · recurso digital",titleEn:"Idafa: Dice Ifá Yoruba · digital reference",category:"Dice Ifá",subcategory:"Aplicaciones educativas",language:"ES/EN",gates:["RIGHTS_REVIEW","PRACTITIONER_REVIEW"],status:"REFERENCE_ONLY",notes:"Referencia/afiliación potencial únicamente. No revender ni reproducir contenido sin acuerdo comercial."},
  {slug:"dice-ifa-study-card-set",titleEs:"Tarjetas de estudio de los 16 Odù mayores",titleEn:"16 principal Odù study cards",category:"Dice Ifá",subcategory:"Estudio",language:"ES/EN",gates:["RIGHTS_REVIEW","PRACTITIONER_REVIEW"],status:"CANDIDATE",notes:"Solo terminología factual o contenido original/revisado; no copiar versos protegidos."},
  {slug:"odu-256-index",titleEs:"Índice de estudio de los 256 Odù",titleEn:"256 Odù study index",category:"Dice Ifá",subcategory:"Estudio",language:"ES/EN",gates:["RIGHTS_REVIEW","PRACTITIONER_REVIEW"],status:"CANDIDATE"},
  {slug:"odu-pronunciation-guide",titleEs:"Guía de pronunciación de nombres de Odù",titleEn:"Odù name pronunciation guide",category:"Dice Ifá",subcategory:"Audio educativo",language:"ES/EN",gates:["RIGHTS_REVIEW","PRACTITIONER_REVIEW"],status:"CANDIDATE",notes:"Audio debe ser propio o licenciado y validado por hablante/practicante competente."},

  // DILOGGÚN / CARACOLES / OBÍ
  {slug:"cowrie-shell-set",titleEs:"Juego de caracoles para estudio de diloggún",titleEn:"Cowrie shell set for diloggún study",category:"Diloggún",subcategory:"Caracoles",language:"N/A",gates:["PROVENANCE","CULTURAL_REVIEW","IMPORT_REVIEW"],status:"CANDIDATE"},
  {slug:"cowrie-practice-mat",titleEs:"Tapete de práctica para caracoles",titleEn:"Cowrie practice mat",category:"Diloggún",subcategory:"Accesorios",language:"N/A",gates:["STANDARD"],status:"CANDIDATE"},
  {slug:"obi-abata",titleEs:"Obì Abàtà · nuez de kola",titleEn:"Obi Abata · kola nut",category:"Obí",subcategory:"Material natural",language:"N/A",gates:["AGRICULTURE_REVIEW","IMPORT_REVIEW","INGESTIBLE_REVIEW","PROVENANCE"],status:"CANDIDATE"},
  {slug:"obi-study-set",titleEs:"Set didáctico no consagrado para estudio de Obí",titleEn:"Non-consecrated Obi study set",category:"Obí",subcategory:"Estudio",language:"ES/EN",gates:["CULTURAL_REVIEW","PRACTITIONER_REVIEW"],status:"CANDIDATE"},

  // ORISHAS · IMPLEMENTOS
  {slug:"ochosi-bow-arrow",titleEs:"Arco y flecha ceremonial de Ochosi",titleEn:"Ochosi ceremonial bow and arrow",category:"Orishas",subcategory:"Ochosi",language:"N/A",gates:["PROVENANCE","CULTURAL_REVIEW"],status:"CANDIDATE"},
  {slug:"ogun-iron-tools",titleEs:"Herramientas de hierro para Ogún",titleEn:"Ogun iron tools",category:"Orishas",subcategory:"Ogún",language:"N/A",gates:["PROVENANCE","CULTURAL_REVIEW"],status:"CANDIDATE"},
  {slug:"shango-double-axe",titleEs:"Oshé de Shangó · hacha doble decorativa/ceremonial",titleEn:"Shango oshe · double axe",category:"Orishas",subcategory:"Shangó",language:"N/A",gates:["PROVENANCE","CULTURAL_REVIEW"],status:"CANDIDATE"},
  {slug:"oshun-brass-fan",titleEs:"Abanico de latón para Oshún",titleEn:"Oshun brass fan",category:"Orishas",subcategory:"Oshún",language:"N/A",gates:["SUPPLIER_VERIFY","CULTURAL_REVIEW"],status:"CANDIDATE"},
  {slug:"yemaya-fan",titleEs:"Abanico ceremonial para Yemayá",titleEn:"Yemaya ceremonial fan",category:"Orishas",subcategory:"Yemayá",language:"N/A",gates:["SUPPLIER_VERIFY","CULTURAL_REVIEW"],status:"CANDIDATE"},
  {slug:"oya-ceremonial-set",titleEs:"Set ceremonial para Oyá",titleEn:"Oya ceremonial set",category:"Orishas",subcategory:"Oyá",language:"N/A",gates:["PROVENANCE","CULTURAL_REVIEW"],status:"CANDIDATE"},
  {slug:"obatala-white-metal-set",titleEs:"Implementos de metal blanco para Obatalá",titleEn:"Obatala white-metal implements",category:"Orishas",subcategory:"Obatalá",language:"N/A",gates:["PROVENANCE","CULTURAL_REVIEW"],status:"CANDIDATE"},
  {slug:"elegua-decorative-vessel",titleEs:"Recipiente decorativo para Eleguá/Eshú · no consagrado",titleEn:"Decorative Elegua/Esu vessel · non-consecrated",category:"Orishas",subcategory:"Eleguá / Eshú",language:"N/A",gates:["CULTURAL_REVIEW","PROVENANCE"],status:"CANDIDATE"},
  {slug:"orisha-statue-ochosi",titleEs:"Figura artesanal de Ochosi",titleEn:"Handcrafted Ochosi figure",category:"Orishas",subcategory:"Arte",language:"N/A",gates:["PROVENANCE","CULTURAL_REVIEW"],status:"CANDIDATE"},
  {slug:"orisha-statue-yemaya",titleEs:"Figura artesanal de Yemayá",titleEn:"Handcrafted Yemaya figure",category:"Orishas",subcategory:"Arte",language:"N/A",gates:["PROVENANCE","CULTURAL_REVIEW"],status:"CANDIDATE"},
  {slug:"orisha-statue-oshun",titleEs:"Figura artesanal de Oshún",titleEn:"Handcrafted Oshun figure",category:"Orishas",subcategory:"Arte",language:"N/A",gates:["PROVENANCE","CULTURAL_REVIEW"],status:"CANDIDATE"},
  {slug:"orisha-statue-shango",titleEs:"Figura artesanal de Shangó",titleEn:"Handcrafted Shango figure",category:"Orishas",subcategory:"Arte",language:"N/A",gates:["PROVENANCE","CULTURAL_REVIEW"],status:"CANDIDATE"},

  // COLLARES / IDE / ELEKES
  {slug:"eleke-ochosi",titleEs:"Eleke de Ochosi",titleEn:"Ochosi eleke",category:"Collares y cuentas",subcategory:"Eleke",language:"N/A",gates:["CULTURAL_REVIEW","SUPPLIER_VERIFY"],status:"CANDIDATE"},
  {slug:"eleke-ogun",titleEs:"Eleke de Ogún",titleEn:"Ogun eleke",category:"Collares y cuentas",subcategory:"Eleke",language:"N/A",gates:["CULTURAL_REVIEW","SUPPLIER_VERIFY"],status:"CANDIDATE"},
  {slug:"eleke-shango",titleEs:"Eleke de Shangó",titleEn:"Shango eleke",category:"Collares y cuentas",subcategory:"Eleke",language:"N/A",gates:["CULTURAL_REVIEW","SUPPLIER_VERIFY"],status:"CANDIDATE"},
  {slug:"eleke-oshun",titleEs:"Eleke de Oshún",titleEn:"Oshun eleke",category:"Collares y cuentas",subcategory:"Eleke",language:"N/A",gates:["CULTURAL_REVIEW","SUPPLIER_VERIFY"],status:"CANDIDATE"},
  {slug:"eleke-yemaya",titleEs:"Eleke de Yemayá",titleEn:"Yemaya eleke",category:"Collares y cuentas",subcategory:"Eleke",language:"N/A",gates:["CULTURAL_REVIEW","SUPPLIER_VERIFY"],status:"CANDIDATE"},
  {slug:"eleke-obatala",titleEs:"Eleke de Obatalá",titleEn:"Obatala eleke",category:"Collares y cuentas",subcategory:"Eleke",language:"N/A",gates:["CULTURAL_REVIEW","SUPPLIER_VERIFY"],status:"CANDIDATE"},
  {slug:"cowrie-bracelet",titleEs:"Pulsera decorativa de caracoles",titleEn:"Decorative cowrie bracelet",category:"Collares y cuentas",subcategory:"Joyería",language:"N/A",gates:["SUPPLIER_VERIFY","IMPORT_REVIEW"],status:"CANDIDATE"},
  {slug:"yoruba-brass-bracelet",titleEs:"Pulsera de latón estilo Yoruba",titleEn:"Yoruba-style brass bracelet",category:"Collares y cuentas",subcategory:"Joyería",language:"N/A",gates:["PROVENANCE","SUPPLIER_VERIFY"],status:"CANDIDATE"},

  // HIERBAS / BOTÁNICA NATURAL
  {slug:"ewe-dried-herb-single",titleEs:"Ewé seca · especie individual verificada",titleEn:"Dried ewe herb · verified single species",category:"Hierbas",subcategory:"Ewé",language:"N/A",gates:["AGRICULTURE_REVIEW","IMPORT_REVIEW","PROVENANCE"],status:"CANDIDATE",notes:"Nunca publicar como mezcla no identificada. Exigir nombre botánico y país de origen."},
  {slug:"romero-seco",titleEs:"Romero seco",titleEn:"Dried rosemary",category:"Hierbas",subcategory:"Hierbas comunes",language:"N/A",gates:["SUPPLIER_VERIFY"],status:"CANDIDATE"},
  {slug:"albahaca-seca",titleEs:"Albahaca seca",titleEn:"Dried basil",category:"Hierbas",subcategory:"Hierbas comunes",language:"N/A",gates:["SUPPLIER_VERIFY"],status:"CANDIDATE"},
  {slug:"ruda-seca",titleEs:"Ruda seca",titleEn:"Dried rue",category:"Hierbas",subcategory:"Hierbas comunes",language:"N/A",gates:["SUPPLIER_VERIFY","INGESTIBLE_REVIEW"],status:"CANDIDATE",notes:"No realizar claims médicos ni recomendar ingestión."},
  {slug:"abre-camino-herbal-blend",titleEs:"Mezcla botánica Abre Camino · composición declarada",titleEn:"Road Opener botanical blend · disclosed composition",category:"Hierbas",subcategory:"Mezclas",language:"N/A",gates:["SUPPLIER_VERIFY","AGRICULTURE_REVIEW"],status:"CANDIDATE"},
  {slug:"despojo-herbal-blend",titleEs:"Mezcla botánica para despojo · composición declarada",titleEn:"Cleansing botanical blend · disclosed composition",category:"Hierbas",subcategory:"Mezclas",language:"N/A",gates:["SUPPLIER_VERIFY","AGRICULTURE_REVIEW"],status:"CANDIDATE"},

  // ACEITES / BAÑOS / AGUAS · SOLO COSMÉTICO/EXTERNO HASTA REVISIÓN
  {slug:"spiritual-oil-ochosi",titleEs:"Aceite espiritual de Ochosi · uso externo",titleEn:"Ochosi spiritual oil · external use",category:"Aceites y aguas",subcategory:"Aceites",language:"ES/EN",gates:["SUPPLIER_VERIFY","CULTURAL_REVIEW"],status:"CANDIDATE"},
  {slug:"spiritual-oil-oshun",titleEs:"Aceite espiritual de Oshún · uso externo",titleEn:"Oshun spiritual oil · external use",category:"Aceites y aguas",subcategory:"Aceites",language:"ES/EN",gates:["SUPPLIER_VERIFY","CULTURAL_REVIEW"],status:"CANDIDATE"},
  {slug:"spiritual-oil-elegua",titleEs:"Aceite espiritual de Eleguá · uso externo",titleEn:"Elegua spiritual oil · external use",category:"Aceites y aguas",subcategory:"Aceites",language:"ES/EN",gates:["SUPPLIER_VERIFY","CULTURAL_REVIEW"],status:"CANDIDATE"},
  {slug:"florida-water",titleEs:"Agua Florida",titleEn:"Florida Water",category:"Aceites y aguas",subcategory:"Aguas",language:"N/A",gates:["SUPPLIER_VERIFY"],status:"CANDIDATE"},
  {slug:"ritual-bath-road-opener",titleEs:"Baño espiritual Abre Camino · uso externo",titleEn:"Road Opener spiritual bath · external use",category:"Aceites y aguas",subcategory:"Baños",language:"ES/EN",gates:["SUPPLIER_VERIFY"],status:"CANDIDATE"},
  {slug:"ritual-bath-cleansing",titleEs:"Baño espiritual de limpieza · uso externo",titleEn:"Spiritual cleansing bath · external use",category:"Aceites y aguas",subcategory:"Baños",language:"ES/EN",gates:["SUPPLIER_VERIFY"],status:"CANDIDATE"},

  // VELAS
  {slug:"candle-white-7day",titleEs:"Vela blanca de 7 días",titleEn:"White 7-day candle",category:"Velas",subcategory:"Vaso",language:"N/A",gates:["STANDARD"],status:"CANDIDATE"},
  {slug:"candle-blue-7day",titleEs:"Vela azul de 7 días",titleEn:"Blue 7-day candle",category:"Velas",subcategory:"Vaso",language:"N/A",gates:["STANDARD"],status:"CANDIDATE"},
  {slug:"candle-yellow-7day",titleEs:"Vela amarilla de 7 días",titleEn:"Yellow 7-day candle",category:"Velas",subcategory:"Vaso",language:"N/A",gates:["STANDARD"],status:"CANDIDATE"},
  {slug:"candle-red-7day",titleEs:"Vela roja de 7 días",titleEn:"Red 7-day candle",category:"Velas",subcategory:"Vaso",language:"N/A",gates:["STANDARD"],status:"CANDIDATE"},
  {slug:"candle-green-7day",titleEs:"Vela verde de 7 días",titleEn:"Green 7-day candle",category:"Velas",subcategory:"Vaso",language:"N/A",gates:["STANDARD"],status:"CANDIDATE"},
  {slug:"candle-purple-7day",titleEs:"Vela morada de 7 días",titleEn:"Purple 7-day candle",category:"Velas",subcategory:"Vaso",language:"N/A",gates:["STANDARD"],status:"CANDIDATE"},
  {slug:"candle-black-7day",titleEs:"Vela negra de 7 días",titleEn:"Black 7-day candle",category:"Velas",subcategory:"Vaso",language:"N/A",gates:["STANDARD"],status:"CANDIDATE"},
  {slug:"candle-ochosi",titleEs:"Vela temática de Ochosi",titleEn:"Ochosi themed candle",category:"Velas",subcategory:"Orishas",language:"ES/EN",gates:["CULTURAL_REVIEW","SUPPLIER_VERIFY"],status:"CANDIDATE"},
  {slug:"candle-orisha-assortment",titleEs:"Colección de velas de Orishas",titleEn:"Orisha candle assortment",category:"Velas",subcategory:"Orishas",language:"ES/EN",gates:["CULTURAL_REVIEW","SUPPLIER_VERIFY"],status:"CANDIDATE"},

  // INCIENSOS / RESINAS
  {slug:"frankincense-resin",titleEs:"Resina de incienso",titleEn:"Frankincense resin",category:"Inciensos",subcategory:"Resinas",language:"N/A",gates:["SUPPLIER_VERIFY","IMPORT_REVIEW"],status:"CANDIDATE"},
  {slug:"myrrh-resin",titleEs:"Resina de mirra",titleEn:"Myrrh resin",category:"Inciensos",subcategory:"Resinas",language:"N/A",gates:["SUPPLIER_VERIFY","IMPORT_REVIEW"],status:"CANDIDATE"},
  {slug:"charcoal-discs",titleEs:"Discos de carbón para incienso",titleEn:"Incense charcoal discs",category:"Inciensos",subcategory:"Accesorios",language:"N/A",gates:["STANDARD"],status:"CANDIDATE"},
  {slug:"incense-burner-brass",titleEs:"Incensario de latón",titleEn:"Brass incense burner",category:"Inciensos",subcategory:"Quemadores",language:"N/A",gates:["STANDARD"],status:"CANDIDATE"},
  {slug:"incense-road-opener",titleEs:"Incienso Abre Camino",titleEn:"Road Opener incense",category:"Inciensos",subcategory:"Mezclas",language:"ES/EN",gates:["SUPPLIER_VERIFY"],status:"CANDIDATE"},
  {slug:"incense-cleansing",titleEs:"Incienso de limpieza",titleEn:"Cleansing incense",category:"Inciensos",subcategory:"Mezclas",language:"ES/EN",gates:["SUPPLIER_VERIFY"],status:"CANDIDATE"},

  // JABONES / POLVOS / CASCARILLA
  {slug:"african-black-soap",titleEs:"Jabón negro africano",titleEn:"African black soap",category:"Jabones y polvos",subcategory:"Jabones",language:"N/A",gates:["SUPPLIER_VERIFY","IMPORT_REVIEW"],status:"CANDIDATE"},
  {slug:"cascarilla",titleEs:"Cascarilla ritual · composición declarada",titleEn:"Ritual cascarilla · disclosed composition",category:"Jabones y polvos",subcategory:"Polvos",language:"N/A",gates:["SUPPLIER_VERIFY"],status:"CANDIDATE"},
  {slug:"camwood-osun",titleEs:"Osun / camwood · composición verificada",titleEn:"Osun / camwood · verified composition",category:"Jabones y polvos",subcategory:"Polvos",language:"N/A",gates:["IMPORT_REVIEW","PROVENANCE","SUPPLIER_VERIFY"],status:"CANDIDATE"},
  {slug:"shea-butter-ori",titleEs:"Orí · manteca de karité",titleEn:"Ori · shea butter",category:"Jabones y polvos",subcategory:"Mantecas",language:"N/A",gates:["SUPPLIER_VERIFY","IMPORT_REVIEW"],status:"CANDIDATE"},
  {slug:"palm-oil-epo-pupa",titleEs:"Epo pupa · aceite de palma",titleEn:"Epo pupa · palm oil",category:"Jabones y polvos",subcategory:"Aceites tradicionales",language:"N/A",gates:["INGESTIBLE_REVIEW","IMPORT_REVIEW","PROVENANCE"],status:"CANDIDATE"},

  // RECIPIENTES / SOPERAS / ACCESORIOS
  {slug:"white-porcelain-tureen",titleEs:"Sopera de porcelana blanca",titleEn:"White porcelain tureen",category:"Recipientes",subcategory:"Soperas",language:"N/A",gates:["STANDARD"],status:"CANDIDATE"},
  {slug:"blue-white-tureen",titleEs:"Sopera azul y blanca",titleEn:"Blue and white tureen",category:"Recipientes",subcategory:"Soperas",language:"N/A",gates:["STANDARD"],status:"CANDIDATE"},
  {slug:"yellow-tureen",titleEs:"Sopera amarilla",titleEn:"Yellow tureen",category:"Recipientes",subcategory:"Soperas",language:"N/A",gates:["STANDARD"],status:"CANDIDATE"},
  {slug:"clay-bowl",titleEs:"Cuenco de barro natural",titleEn:"Natural clay bowl",category:"Recipientes",subcategory:"Barro",language:"N/A",gates:["SUPPLIER_VERIFY"],status:"CANDIDATE"},
  {slug:"brass-bowl",titleEs:"Cuenco de latón",titleEn:"Brass bowl",category:"Recipientes",subcategory:"Metal",language:"N/A",gates:["STANDARD"],status:"CANDIDATE"},
  {slug:"offering-tray",titleEs:"Bandeja para ofrendas",titleEn:"Offering tray",category:"Recipientes",subcategory:"Bandejas",language:"N/A",gates:["STANDARD"],status:"CANDIDATE"},

  // TEXTILES / ROPA
  {slug:"white-ceremonial-cloth",titleEs:"Tela blanca ceremonial",titleEn:"White ceremonial cloth",category:"Textiles",subcategory:"Telas",language:"N/A",gates:["STANDARD"],status:"CANDIDATE"},
  {slug:"orisha-color-cloth",titleEs:"Tela por colores de Orisha",titleEn:"Orisha-color cloth",category:"Textiles",subcategory:"Telas",language:"N/A",gates:["CULTURAL_REVIEW"],status:"CANDIDATE"},
  {slug:"aso-oke",titleEs:"Aso-Oke Yoruba · textil verificado",titleEn:"Yoruba Aso-Oke · verified textile",category:"Textiles",subcategory:"Yoruba",language:"N/A",gates:["PROVENANCE","IMPORT_REVIEW"],status:"CANDIDATE"},
  {slug:"adire",titleEs:"Adire Yoruba · textil teñido",titleEn:"Yoruba Adire · dyed textile",category:"Textiles",subcategory:"Yoruba",language:"N/A",gates:["PROVENANCE","IMPORT_REVIEW"],status:"CANDIDATE"},
  {slug:"white-head-wrap",titleEs:"Pañuelo blanco para la cabeza",titleEn:"White head wrap",category:"Textiles",subcategory:"Ropa",language:"N/A",gates:["STANDARD"],status:"CANDIDATE"},

  // MÚSICA
  {slug:"shekere",titleEs:"Shekeré / Ṣẹ̀kẹ̀rẹ̀",titleEn:"Shekere",category:"Música",subcategory:"Percusión",language:"N/A",gates:["PROVENANCE","IMPORT_REVIEW"],status:"CANDIDATE"},
  {slug:"agogo",titleEs:"Agogó · campana metálica",titleEn:"Agogo bell",category:"Música",subcategory:"Campanas",language:"N/A",gates:["PROVENANCE"],status:"CANDIDATE"},
  {slug:"dundun",titleEs:"Dùndún · tambor parlante",titleEn:"Dundun talking drum",category:"Música",subcategory:"Tambores",language:"N/A",gates:["PROVENANCE","IMPORT_REVIEW"],status:"CANDIDATE"},
  {slug:"bata-style-drum",titleEs:"Tambor estilo batá · materiales verificados",titleEn:"Bata-style drum · verified materials",category:"Música",subcategory:"Tambores",language:"N/A",gates:["PROVENANCE","IMPORT_REVIEW","CULTURAL_REVIEW"],status:"CANDIDATE"},

  // LIBROS / EDUCACIÓN
  {slug:"ifa-books-spanish",titleEs:"Libros autorizados de Ifá en español",titleEn:"Authorized Spanish-language Ifá books",category:"Libros",subcategory:"Ifá en Español",language:"ES",gates:["RIGHTS_REVIEW","SUPPLIER_VERIFY"],status:"CANDIDATE"},
  {slug:"santeria-books-spanish",titleEs:"Libros autorizados de Santería/Lucumí en español",titleEn:"Authorized Spanish Santería/Lucumí books",category:"Libros",subcategory:"Santería / Lucumí",language:"ES",gates:["RIGHTS_REVIEW","SUPPLIER_VERIFY"],status:"CANDIDATE"},
  {slug:"patakines-books-spanish",titleEs:"Patakines e itan · ediciones autorizadas en español",titleEn:"Patakines and itan · authorized Spanish editions",category:"Libros",subcategory:"Patakines e Itan",language:"ES",gates:["RIGHTS_REVIEW","SUPPLIER_VERIFY"],status:"CANDIDATE"},
  {slug:"yoruba-spanish-dictionary",titleEs:"Diccionario Yoruba–Español autorizado",titleEn:"Authorized Yoruba–Spanish dictionary",category:"Libros",subcategory:"Idiomas",language:"ES",gates:["RIGHTS_REVIEW","SUPPLIER_VERIFY"],status:"CANDIDATE"},
  {slug:"yoruba-english-dictionary",titleEs:"Diccionario Yoruba–Inglés autorizado",titleEn:"Authorized Yoruba–English dictionary",category:"Libros",subcategory:"Idiomas",language:"EN",gates:["RIGHTS_REVIEW","SUPPLIER_VERIFY"],status:"CANDIDATE"},

  // REGALOS / ARTE / HOGAR
  {slug:"ochosi-art-print",titleEs:"Lámina artística original de Ochosi",titleEn:"Original Ochosi art print",category:"Arte y regalos",subcategory:"Láminas",language:"ES/EN",gates:["RIGHTS_REVIEW","CULTURAL_REVIEW"],status:"CANDIDATE"},
  {slug:"orisha-art-print-series",titleEs:"Colección de láminas originales de Orishas",titleEn:"Original Orisha art print series",category:"Arte y regalos",subcategory:"Láminas",language:"ES/EN",gates:["RIGHTS_REVIEW","CULTURAL_REVIEW"],status:"CANDIDATE"},
  {slug:"yoruba-symbol-notebook",titleEs:"Cuaderno de diseño Yoruba original",titleEn:"Original Yoruba-design notebook",category:"Arte y regalos",subcategory:"Papelería",language:"ES/EN",gates:["RIGHTS_REVIEW","CULTURAL_REVIEW"],status:"CANDIDATE"},
  {slug:"ochosi-tote",titleEs:"Bolsa BOTANICA OCHOSI",titleEn:"BOTANICA OCHOSI tote bag",category:"Arte y regalos",subcategory:"Marca",language:"ES/EN",gates:["STANDARD"],status:"CANDIDATE"},
  {slug:"ochosi-shirt",titleEs:"Camiseta BOTANICA OCHOSI",titleEn:"BOTANICA OCHOSI shirt",category:"Arte y regalos",subcategory:"Marca",language:"ES/EN",gates:["STANDARD"],status:"CANDIDATE"},
];

export const spanishFirstCategoryOrder = [
  "Ifá",
  "Dice Ifá",
  "Diloggún",
  "Obí",
  "Orishas",
  "Collares y cuentas",
  "Hierbas",
  "Aceites y aguas",
  "Velas",
  "Inciensos",
  "Jabones y polvos",
  "Recipientes",
  "Textiles",
  "Música",
  "Libros",
  "Arte y regalos",
] as const;

export const catalogCandidateCounts = spanishFirstBotanicaCatalog.reduce<Record<string, number>>((acc, item) => {
  acc[item.category] = (acc[item.category] ?? 0) + 1;
  return acc;
}, {});
