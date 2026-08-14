import { buildAccioSourcingBrief } from "@/lib/accio-work";
import { error, requireOrgRole } from "@/lib/api";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const privateJson = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrgRole(req, orgId, ["owner"]);
  if ("response" in auth) return auth.response;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return error("A sourcing request is required.", 422);
  const input = body as Record<string, unknown>;
  try {
    const brief = buildAccioSourcingBrief({
      query: String(input.query ?? "").slice(0, 500),
      destination: String(input.destination ?? "").slice(0, 200),
      targetRetailUsd: Number(input.targetRetailUsd ?? 0),
      maximumMoq: Number(input.maximumMoq ?? 1),
    });
    return privateJson({ ok: true, brief });
  } catch (cause) {
    return error(cause instanceof Error ? cause.message : "Accio brief was blocked.", 422);
  }
}
