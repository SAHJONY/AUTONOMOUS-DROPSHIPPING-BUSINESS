import { error, json, requireOrg } from "@/lib/api";
import { updateStore } from "@/lib/store";
import type { Store } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Link/update a store: set its storefront URL, status, or name. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string; storeId: string }> },
) {
  const { orgId, storeId } = await params;
  const auth = await requireOrg(req, orgId);
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => ({}));
  const patch: Partial<Store> = {};
  if (typeof body.url === "string") {
    let url = body.url.trim();
    if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
    patch.url = url;
  }
  if (typeof body.status === "string") patch.status = body.status;
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();

  const updated = await updateStore(orgId, storeId, patch);
  if (!updated) return error("Store not found", 404);
  return json(updated);
}
