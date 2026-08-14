import { error, json, requireOrgRole } from "@/lib/api";
import { seedFirst25NativeDrafts } from "@/lib/botanica-first-25-native";
import { listGet, listReplace } from "@/lib/kv";
import type { Product } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrgRole(req, orgId, ["owner"]);
  if ("response" in auth) return auth.response;
  const body = await req.json().catch(() => ({}));
  if (body.confirmation !== "CREATE FIRST 25 HOLD DRAFTS") return error("Exact confirmation is required.", 422);
  const key = `products:${orgId}`;
  const existing = await listGet<Product>(key);
  const result = seedFirst25NativeDrafts(orgId, existing);
  await listReplace(key, result.products.slice(0, 1000));
  return json({ ok: true, created: result.created.length, already_present: result.existing, total_candidates: 25 });
}
