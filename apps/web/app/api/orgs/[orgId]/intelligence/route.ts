import { json, requireOrgRole } from "@/lib/api";
import { buildAssortmentGap } from "@/lib/intelligence";
import { listProducts } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The current assortment gap, computed on demand.
 *
 * The autonomous tick files the same brief into business memory every pass; this
 * is for looking at it now. Read-only — it runs no lookups and spends nothing.
 */
export async function GET(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrgRole(req, orgId);
  if ("response" in auth) return auth.response;
  return json(buildAssortmentGap(await listProducts(orgId)));
}
