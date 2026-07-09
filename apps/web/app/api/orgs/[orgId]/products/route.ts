import { error, json, requireOrg } from "@/lib/api";
import { listProducts, newId, nowISO, saveProduct } from "@/lib/store";
import type { Product } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrg(req, orgId);
  if ("response" in auth) return auth.response;
  return json(await listProducts(orgId));
}

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrg(req, orgId);
  if ("response" in auth) return auth.response;
  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? "").trim();
  if (!title) return error("Product title is required.", 422);
  const product: Product = {
    id: newId(),
    org_id: orgId,
    title,
    description: String(body.description ?? ""),
    source: String(body.source ?? "manual"),
    supplier_url: String(body.supplier_url ?? ""),
    cost: Number(body.cost ?? 0),
    price: Number(body.price ?? 0),
    status: "discovered",
    created_at: nowISO(),
  };
  await saveProduct(product);
  return json(product, 201);
}
