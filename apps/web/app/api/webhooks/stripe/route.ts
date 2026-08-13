import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { ingestPaidStripeCheckout } from "@/lib/native-commerce";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !webhookSecret || !signature) return NextResponse.json({ ok: false }, { status: 503 });
  try {
    const stripe = new Stripe(secret);
    const event = stripe.webhooks.constructEvent(await request.text(), signature, webhookSecret);
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      await ingestPaidStripeCheckout(event.data.object);
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json({ ok: false, detail: error instanceof Error ? error.message : "Invalid webhook." }, { status: 400 });
  }
}
