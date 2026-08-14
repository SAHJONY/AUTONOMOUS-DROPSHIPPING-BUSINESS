import { error, json, requireOrgRole } from "@/lib/api";
import { addFactoryMaterial, addFactoryRecipe, createProductionOrder, getFactory, releaseProductionOrder } from "@/lib/botanica-factory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrgRole(req, orgId, ["owner", "admin"]);
  if ("response" in auth) return auth.response;
  return json(await getFactory(orgId));
}

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrgRole(req, orgId, ["owner", "admin"]);
  if ("response" in auth) return auth.response;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  try {
    if (body.action === "add_material") return json(await addFactoryMaterial(orgId, body), 201);
    if (body.action === "add_recipe") return json(await addFactoryRecipe(orgId, body), 201);
    if (body.action === "create_order") return json(await createProductionOrder(orgId, body), 201);
    if (body.action === "release_order") return json(await releaseProductionOrder(orgId, body));
    return error("Unknown factory action.", 422);
  } catch (cause) {
    return error(cause instanceof Error ? cause.message : "Factory request failed.", 422);
  }
}
