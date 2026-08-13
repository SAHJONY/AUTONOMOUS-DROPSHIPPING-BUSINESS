import { error, json, requireOrgRole } from "@/lib/api";
import { getNativeStoreSettings, setNativeStoreSettings } from "@/lib/native-commerce";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrgRole(req, orgId, ["owner", "admin"]);
  if ("response" in auth) return auth.response;
  return json(await getNativeStoreSettings(orgId));
}

export async function PATCH(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrgRole(req, orgId, ["owner"]);
  if ("response" in auth) return auth.response;
  const body = await req.json().catch(() => ({}));
  const countries = Array.isArray(body.allowedCountries) ? body.allowedCountries.map(String).map((v: string) => v.toUpperCase()).filter((v: string) => /^[A-Z]{2}$/.test(v)) : undefined;
  if (Array.isArray(body.allowedCountries) && !countries?.length) return error("At least one valid two-letter country code is required.", 422);
  return json(await setNativeStoreSettings(orgId, {
    storeName: body.storeName,
    supportEmail: body.supportEmail,
    flatShippingUsd: body.flatShippingUsd,
    freeShippingThresholdUsd: body.freeShippingThresholdUsd,
    allowedCountries: countries as never,
  }));
}
