import { json, requireOrgRole } from "@/lib/api";
import { getCandidateSkuPipeline, SUPPLIER_CANDIDATES } from "@/lib/botanica/supplier-match";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrgRole(req, orgId, ["owner"]);
  if ("response" in auth) return auth.response;

  const candidates = getCandidateSkuPipeline(3);
  return json({
    ok: true,
    mode: "CANDIDATE_ONLY",
    autonomous_purchase: false,
    auto_publish: false,
    supplier_count: SUPPLIER_CANDIDATES.length,
    candidate_count: candidates.length,
    draft_ready_count: candidates.filter((candidate) => candidate.evaluation.draft_ready).length,
    suppliers: SUPPLIER_CANDIDATES,
    candidates: candidates.map(({ family, supplier, score, sku, evaluation }) => ({
      id: sku.id,
      family_id: family.id,
      family_name_es: family.name_es,
      family_name_en: family.name_en,
      category: family.category,
      commerce_mode: family.commerce_mode,
      supplier_id: supplier.id,
      supplier_name: supplier.name,
      supplier_priority: supplier.priority,
      supplier_verification: supplier.verification_status,
      match_score: score,
      publish_status: sku.publish_status,
      draft_ready: evaluation.draft_ready,
      failures: evaluation.failures,
    })),
  });
}
