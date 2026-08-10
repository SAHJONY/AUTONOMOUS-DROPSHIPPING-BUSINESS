import { json, requireOrgRole } from "@/lib/api";
import { WHOLESALE_PRODUCT_EVIDENCE, publiclyPricedWholesaleProducts, wholesaleSupplierIds } from "@/lib/botanica/wholesale-products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrgRole(req, orgId, ["owner"]);
  if ("response" in auth) return auth.response;

  return json({
    ok: true,
    mode: "WHOLESALE_EVIDENCE_ONLY",
    supplier_count: wholesaleSupplierIds.length,
    product_count: WHOLESALE_PRODUCT_EVIDENCE.length,
    publicly_priced_count: publiclyPricedWholesaleProducts.length,
    autonomous_purchase: false,
    auto_publish: false,
    products: WHOLESALE_PRODUCT_EVIDENCE,
    governance: {
      shopify_draft_requires: [
        "CURRENT_STOCK",
        "RESELLER_OR_ACCOUNT_ELIGIBILITY",
        "LANDED_COST",
        "IMAGE_RIGHTS",
        "CULTURAL_AND_COMPLIANCE_GATES",
        "OWNER_REVIEW",
      ],
    },
  });
}
