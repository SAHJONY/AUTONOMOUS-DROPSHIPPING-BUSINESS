import { error, json, requireOrgRole } from "@/lib/api";
import { listVerificationRecords, upsertCandidateVerification } from "@/lib/botanica/verification-workbench";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrgRole(req, orgId, ["owner"]);
  if ("response" in auth) return auth.response;
  return json({ ok: true, records: await listVerificationRecords(orgId) });
}

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrgRole(req, orgId, ["owner"]);
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => ({}));
  const candidateId = String(body.candidate_id ?? "").trim();
  if (!candidateId) return error("candidate_id is required.", 422);

  const allowedKinds = new Set(["SUPPLIER_TERMS","PRICE","INVENTORY","PROVENANCE","CULTURAL_REVIEW","RIGHTS","IMAGE_RIGHTS","SAFETY"]);
  const evidence = body.evidence ? {
    kind: String(body.evidence.kind ?? ""),
    source_url: String(body.evidence.source_url ?? "").trim() || undefined,
    note: String(body.evidence.note ?? "").trim(),
    verified: body.evidence.verified === true,
    verified_by: auth.user?.email ?? undefined,
    verified_at: body.evidence.verified === true ? new Date().toISOString() : undefined,
  } : undefined;

  if (evidence && !allowedKinds.has(evidence.kind)) return error("Invalid evidence kind.", 422);
  if (evidence?.verified && !evidence.note && !evidence.source_url) return error("Verified evidence requires a source URL or note.", 422);

  try {
    const record = await upsertCandidateVerification(orgId, {
      candidate_id: candidateId,
      evidence: evidence as never,
      commercial: body.commercial ? {
        supplier_url: String(body.commercial.supplier_url ?? "").trim() || undefined,
        supplier_sku: String(body.commercial.supplier_sku ?? "").trim() || undefined,
        unit_cost: body.commercial.unit_cost == null ? undefined : Number(body.commercial.unit_cost),
        shipping_cost: body.commercial.shipping_cost == null ? undefined : Number(body.commercial.shipping_cost),
        retail_price: body.commercial.retail_price == null ? undefined : Number(body.commercial.retail_price),
        inventory_qty: body.commercial.inventory_qty == null ? undefined : Number(body.commercial.inventory_qty),
      } : undefined,
    });
    return json({ ok: true, record });
  } catch (e) {
    if ((e as Error).message === "BOTANICA_CANDIDATE_NOT_FOUND") return error("Candidate SKU not found.", 404);
    return error((e as Error).message, 500);
  }
}
