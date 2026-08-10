import { json, requireOrgRole } from "@/lib/api";
import { getMasterCatalogSnapshot } from "@/lib/botanica/catalog-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrgRole(req, orgId, ["owner"]);
  if ("response" in auth) return auth.response;

  return json({
    ok: true,
    ...getMasterCatalogSnapshot(),
    governance: {
      autonomous_purchase: false,
      auto_publish: false,
      sku_publish_requires_verification: true,
      required_evidence: [
        "SUPPLIER_VERIFIED",
        "CULTURAL_VERIFIED",
        "COMMERCE_SAFE",
        "RIGHTS_VERIFIED",
        "IMAGE_RIGHTS_VERIFIED",
        "SOURCE_EVIDENCE",
        "VERIFIED_PRICE",
        "SUPPLIER_SOURCE",
        "SPANISH_CONTENT",
        "INVENTORY_AVAILABLE",
      ],
    },
  });
}
