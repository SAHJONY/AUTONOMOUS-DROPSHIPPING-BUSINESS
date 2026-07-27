import { error, json, requireOrgRole } from "@/lib/api";
import { importFromSupplier } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Import real products (with real images + video) from the connected supplier. */
export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrgRole(req, orgId);
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => ({}));
  const query = String(body.query ?? "").trim() || "trending gadgets";
  const limit = Math.min(Math.max(Number(body.limit ?? 6), 1), 12);

  const res = await importFromSupplier(orgId, query, limit);
  if (!res.ok) return error(res.error ?? "Import failed.", 400);
  return json({ ok: true, imported: res.imported });
}
