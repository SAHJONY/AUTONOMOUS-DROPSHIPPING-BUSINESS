export type OduRecord = {
  index: number;
  key: string;
  left: string;
  right: string;
  display_es: string;
  display_en: string;
  tradition: "IFA";
  commercial_status: "EDUCATIONAL_REFERENCE";
};

/**
 * Sixteen principal Odù used to generate a deterministic 16 × 16 = 256 study index.
 * This module is indexing infrastructure only. It deliberately does not embed copyrighted
 * interpretations, verses, patakines, prescriptions, or proprietary "Dice Ifá" text.
 */
export const PRINCIPAL_ODU = [
  "Eji Ogbe",
  "Oyeku Meji",
  "Iwori Meji",
  "Odi Meji",
  "Irosun Meji",
  "Owonrin Meji",
  "Obara Meji",
  "Okanran Meji",
  "Ogunda Meji",
  "Osa Meji",
  "Ika Meji",
  "Oturupon Meji",
  "Otura Meji",
  "Irete Meji",
  "Ose Meji",
  "Ofun Meji",
] as const;

function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const ODU_256: OduRecord[] = PRINCIPAL_ODU.flatMap((left, leftIndex) =>
  PRINCIPAL_ODU.map((right, rightIndex) => ({
    index: leftIndex * 16 + rightIndex + 1,
    key: `${slug(left)}__${slug(right)}`,
    left,
    right,
    display_es: left === right ? left : `${left} / ${right}`,
    display_en: left === right ? left : `${left} / ${right}`,
    tradition: "IFA" as const,
    commercial_status: "EDUCATIONAL_REFERENCE" as const,
  })),
);

export type IfaKnowledgeNode = {
  odu_key: string;
  summary_es?: string;
  summary_en?: string;
  proverbs?: Array<{ text: string; source_id: string; rights_status: "AUTHORIZED" | "REFERENCE_ONLY" }>;
  patakines?: Array<{ title: string; summary_original_es: string; source_id: string; rights_status: "AUTHORIZED" | "REFERENCE_ONLY" }>;
  orishas?: string[];
  concepts?: string[];
  bibliography?: string[];
  culturally_verified: boolean;
  verified_by?: string;
  verified_at?: string;
};

export const IFA_CONTENT_HARD_GATES = {
  copyrighted_verbatim_text: "RIGHTS_VERIFIED",
  cultural_interpretation: "CULTURAL_VERIFIED",
  commercial_book_listing: "RESELLER_VERIFIED",
  shopify_publish: "COMMERCE_SAFE",
} as const;

export function getOduByIndex(index: number): OduRecord | undefined {
  return ODU_256.find((odu) => odu.index === index);
}

export function getOduByKey(key: string): OduRecord | undefined {
  return ODU_256.find((odu) => odu.key === key);
}
