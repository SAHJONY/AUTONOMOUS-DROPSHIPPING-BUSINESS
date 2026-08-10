import { listGet, listReplace } from "@/lib/kv";
import { evaluateBotanicaSku } from "./catalog-service";
import { getCandidateSkuPipeline } from "./supplier-match";
import type { BotanicaSku, VerificationStatus } from "./commerce-schema";

export type EvidenceKind =
  | "SUPPLIER_TERMS"
  | "PRICE"
  | "INVENTORY"
  | "PROVENANCE"
  | "CULTURAL_REVIEW"
  | "RIGHTS"
  | "IMAGE_RIGHTS"
  | "SAFETY";

export type BotanicaEvidence = {
  id: string;
  candidate_id: string;
  kind: EvidenceKind;
  source_url?: string;
  note: string;
  verified: boolean;
  verified_by?: string;
  verified_at?: string;
  created_at: string;
};

export type CandidateVerificationRecord = {
  candidate_id: string;
  sku: BotanicaSku;
  evidence: BotanicaEvidence[];
  evaluation: ReturnType<typeof evaluateBotanicaSku>;
  updated_at: string;
};

const key = (orgId: string) => `botanica:verification:${orgId}`;

function now() { return new Date().toISOString(); }
function id() { return `ev_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`; }

export function requiredEvidenceForSku(sku: BotanicaSku): EvidenceKind[] {
  const kinds: EvidenceKind[] = ["SUPPLIER_TERMS", "PRICE", "INVENTORY", "PROVENANCE", "CULTURAL_REVIEW", "IMAGE_RIGHTS", "SAFETY"];
  if (sku.rights_status === "RIGHTS_PENDING" || sku.isbn) kinds.push("RIGHTS");
  return kinds;
}

export function applyVerifiedEvidence(base: BotanicaSku, evidence: BotanicaEvidence[], commercial?: {
  supplier_url?: string;
  supplier_sku?: string;
  unit_cost?: number;
  shipping_cost?: number;
  retail_price?: number;
  inventory_qty?: number;
}): BotanicaSku {
  const verified = new Set(evidence.filter((item) => item.verified).map((item) => item.kind));
  const unitCost = commercial?.unit_cost;
  const shippingCost = commercial?.shipping_cost ?? 0;
  const retailPrice = commercial?.retail_price;
  const inventoryQty = commercial?.inventory_qty;
  const supplierUrl = commercial?.supplier_url ?? base.supplier_url;
  const sourceEvidence = evidence.filter((item) => item.verified).map((item) => `${item.kind}:${item.source_url ?? item.note}`);

  const sku: BotanicaSku = {
    ...base,
    supplier_url: supplierUrl,
    supplier_sku: commercial?.supplier_sku ?? base.supplier_sku,
    supplier_status: verified.has("SUPPLIER_TERMS") && Boolean(supplierUrl) ? "VERIFIED" : "PENDING",
    cultural_status: verified.has("CULTURAL_REVIEW") ? "VERIFIED" : "PENDING",
    commerce_safety_status: verified.has("SAFETY") ? "VERIFIED" : "PENDING",
    rights_status: base.rights_status === "RIGHTS_PENDING"
      ? (verified.has("RIGHTS") ? "VERIFIED_AUTHORIZED" : "RIGHTS_PENDING")
      : (verified.has("PROVENANCE") ? "VERIFIED_AUTHORIZED" : base.rights_status),
    image_rights_verified: verified.has("IMAGE_RIGHTS"),
    unit_cost: verified.has("PRICE") && unitCost != null ? unitCost : undefined,
    shipping_cost: verified.has("PRICE") ? shippingCost : undefined,
    landed_cost: verified.has("PRICE") && unitCost != null ? unitCost + shippingCost : undefined,
    retail_price: verified.has("PRICE") && retailPrice != null ? retailPrice : undefined,
    inventory_qty: verified.has("INVENTORY") && inventoryQty != null ? inventoryQty : undefined,
    inventory_status: verified.has("INVENTORY") && inventoryQty != null
      ? inventoryQty > 5 ? "IN_STOCK" : inventoryQty > 0 ? "LOW_STOCK" : "OUT_OF_STOCK"
      : "UNKNOWN",
    inventory_verified_at: verified.has("INVENTORY") ? now() : undefined,
    price_verified_at: verified.has("PRICE") ? now() : undefined,
    source_verified_at: sourceEvidence.length ? now() : undefined,
    source_evidence: sourceEvidence,
    publish_status: "HOLD",
  };

  const evaluation = evaluateBotanicaSku(sku);
  return { ...sku, publish_status: evaluation.draft_ready ? "READY_FOR_REVIEW" : "HOLD" };
}

export async function listVerificationRecords(orgId: string): Promise<CandidateVerificationRecord[]> {
  return listGet<CandidateVerificationRecord>(key(orgId));
}

export async function upsertCandidateVerification(orgId: string, input: {
  candidate_id: string;
  evidence?: Omit<BotanicaEvidence, "id" | "candidate_id" | "created_at">;
  commercial?: Parameters<typeof applyVerifiedEvidence>[2];
}): Promise<CandidateVerificationRecord> {
  const pipeline = getCandidateSkuPipeline(3);
  const candidate = pipeline.find((entry) => entry.sku.id === input.candidate_id);
  if (!candidate) throw new Error("BOTANICA_CANDIDATE_NOT_FOUND");

  const records = await listVerificationRecords(orgId);
  const existing = records.find((record) => record.candidate_id === input.candidate_id);
  const evidence = [...(existing?.evidence ?? [])];
  if (input.evidence) evidence.unshift({ ...input.evidence, id: id(), candidate_id: input.candidate_id, created_at: now() });

  const sku = applyVerifiedEvidence(candidate.sku, evidence, input.commercial);
  const record: CandidateVerificationRecord = {
    candidate_id: input.candidate_id,
    sku,
    evidence,
    evaluation: evaluateBotanicaSku(sku),
    updated_at: now(),
  };
  const next = records.filter((item) => item.candidate_id !== input.candidate_id);
  next.unshift(record);
  await listReplace(key(orgId), next.slice(0, 1000));
  return record;
}

export function verificationStatus(record: CandidateVerificationRecord): VerificationStatus {
  return record.evaluation.draft_ready ? "VERIFIED" : "PENDING";
}
