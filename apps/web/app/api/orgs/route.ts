import { error, json, requireUser } from "@/lib/api";
import { createOrg, getUserOrgRole, listOrgsForUser } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;
  const orgs = await listOrgsForUser(auth.user);
  return json(
    await Promise.all(
      orgs.map(async (org) => ({ ...org, role: await getUserOrgRole(auth.user, org.id) })),
    ),
  );
}

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) return error("Organization name is required.", 422);
  const org = await createOrg(name, auth.user.id, "owner");
  return json(org, 201);
}
