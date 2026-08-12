import { requireOrgRole } from "@/lib/api";
import { ACCIO_OWNER_RULES, assessAccioSourcingBatch, type AccioCandidate } from "@/lib/accio-sourcing";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CANDIDATES = 50;

/**
 * Assess quotes the owner brought back from Accio Work. Advisory only — this
 * never publishes, never spends, and never contacts a supplier.
 */
export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrgRole(req, orgId, ["owner"]);
  if ("response" in auth) return auth.response;
  const body = await req.json().catch(() => null);
  const candidates = Array.isArray(body?.candidates) ? (body.candidates as AccioCandidate[]) : null;
  if (!candidates) return NextResponse.json({ detail: "Envía { candidates: [...] } con al menos una cotización." }, { status: 400 });
  if (candidates.length > MAX_CANDIDATES) return NextResponse.json({ detail: `Máximo ${MAX_CANDIDATES} cotizaciones por evaluación.` }, { status: 400 });
  const assessment = assessAccioSourcingBatch(candidates);
  return NextResponse.json(
    { ...assessment, rules: ACCIO_OWNER_RULES },
    { headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } },
  );
}
