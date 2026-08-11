import { requireOrgRole } from "@/lib/api";
import { scanCompetitorPricesForOrg } from "@/lib/competitor-price-monitor";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrgRole(req, orgId, ["owner"]);
  if ("response" in auth) return auth.response;
  const result = await scanCompetitorPricesForOrg(orgId, 20);
  return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
}
