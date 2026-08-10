import { json, requireOrgRole } from "@/lib/api";
import {
  FIRST_100_WHOLESALE_PRODUCTS,
  first100PubliclyPricedProducts,
  first100WholesaleSupplierIds,
} from "@/lib/botanica/wholesale-products-first100";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrgRole(req, orgId, ["owner"]);
  if ("response" in auth) return auth.response;

  return json({
    ok: true,
    mode: "WHOLESALE_EVIDENCE_ONLY",
    supplier_count: first100WholesaleSupplierIds.length,
    product_count: FIRST_100_WHOLESALE_PRODUCTS.length,
    publicly_priced_count: first100PubliclyPricedProducts.length,
    autonomous_purchase: false,
    auto_publish: false,
    products: FIRST_100_WHOLESALE_PRODUCTS,
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
