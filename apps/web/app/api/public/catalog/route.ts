import { NextResponse } from "next/server";
import { listNativeCatalog } from "@/lib/native-commerce";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const products = await listNativeCatalog();
  return NextResponse.json(
    { ok: true, provider: "native", checkoutProvider: "stripe", shop: null, products, count: products.length },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
