import { NextRequest, NextResponse } from "next/server";
import { createNativeCheckout, type CheckoutCartLine } from "@/lib/native-commerce";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { lines?: CheckoutCartLine[] };
    if (!Array.isArray(body.lines) || body.lines.length === 0 || body.lines.length > 50) {
      return NextResponse.json({ ok: false, detail: "The cart is empty or invalid." }, { status: 400 });
    }
    const origin = new URL(request.url).origin;
    const url = await createNativeCheckout(body.lines, origin);
    return NextResponse.json({ ok: true, url });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Checkout could not be created.";
    return NextResponse.json({ ok: false, detail }, { status: detail.includes("configured") ? 503 : 400 });
  }
}
