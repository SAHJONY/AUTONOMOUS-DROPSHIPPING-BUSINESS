import Stripe from "stripe";
import { kv } from "./kv";
import { postEntries } from "./ledger";
import { findOrderByExternalId, saveOrder } from "./orders";
import { listProducts, updateProduct } from "./store";
import type { Order, Product, ShippingAddress } from "./types";

export const PUBLIC_STORE_ORG_ID =
  process.env.PUBLIC_STORE_ORG_ID ?? "4c5dcff7503b4b68adbc5a7bffaf60d8";

export type NativeStoreSettings = {
  storeName: string;
  currency: "usd";
  supportEmail: string;
  flatShippingUsd: number;
  freeShippingThresholdUsd: number;
  allowedCountries: Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[];
};

export const DEFAULT_NATIVE_STORE_SETTINGS: NativeStoreSettings = {
  storeName: "BOTANICA OCHOSI",
  currency: "usd",
  supportEmail: "",
  flatShippingUsd: 6.99,
  freeShippingThresholdUsd: 75,
  allowedCountries: ["US"],
};

const settingsKey = (orgId: string) => `native-store-settings:${orgId}`;
export async function getNativeStoreSettings(orgId = PUBLIC_STORE_ORG_ID): Promise<NativeStoreSettings> {
  return { ...DEFAULT_NATIVE_STORE_SETTINGS, ...((await kv.get<Partial<NativeStoreSettings>>(settingsKey(orgId))) ?? {}) };
}
export async function setNativeStoreSettings(orgId: string, patch: Partial<NativeStoreSettings>) {
  const current = await getNativeStoreSettings(orgId);
  const next: NativeStoreSettings = {
    ...current,
    storeName: String(patch.storeName ?? current.storeName).trim().slice(0, 80) || current.storeName,
    supportEmail: String(patch.supportEmail ?? current.supportEmail).trim().slice(0, 160),
    flatShippingUsd: Math.max(0, Number(patch.flatShippingUsd ?? current.flatShippingUsd) || 0),
    freeShippingThresholdUsd: Math.max(0, Number(patch.freeShippingThresholdUsd ?? current.freeShippingThresholdUsd) || 0),
    allowedCountries: Array.isArray(patch.allowedCountries) && patch.allowedCountries.length ? patch.allowedCountries.slice(0, 20) : current.allowedCountries,
  };
  await kv.set(settingsKey(orgId), next);
  return next;
}

export type NativeCatalogProduct = {
  id: string;
  variantId: string;
  title: string;
  variantTitle: null;
  description: string;
  category: string;
  vendor: string;
  price: number;
  compareAtPrice: null;
  image: string | null;
  handle: string;
  productUrl: string;
  inventoryQuantity: number | null;
};

const slug = (value: string) =>
  value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function toNativeCatalog(products: Product[]): NativeCatalogProduct[] {
  return products
    .filter((product) => product.status === "launched" && product.price > 0)
    .filter((product) => product.inventory_policy === "continue" || product.inventory_quantity === undefined || product.inventory_quantity > 0)
    .map((product) => ({
      id: product.id,
      variantId: product.id,
      title: product.title,
      variantTitle: null,
      description: product.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 260),
      category: product.supplier || "Botanica",
      vendor: "BOTANICA OCHOSI",
      price: product.price,
      compareAtPrice: null,
      image: product.image_url ?? product.images?.[0] ?? null,
      handle: product.shopify_handle || slug(product.title) || product.id,
      productUrl: `/shop?product=${encodeURIComponent(product.shopify_handle || slug(product.title) || product.id)}`,
      inventoryQuantity: product.inventory_quantity ?? null,
    }));
}

export async function listNativeCatalog(orgId = PUBLIC_STORE_ORG_ID) {
  return toNativeCatalog(await listProducts(orgId));
}

export type CheckoutCartLine = { productId: string; quantity: number };
type PendingCheckout = { orgId: string; lines: CheckoutCartLine[]; createdAt: string };
const pendingKey = (id: string) => `native-checkout:${id}`;

export async function createNativeCheckout(lines: CheckoutCartLine[], origin: string) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error("Native checkout is not configured. Add STRIPE_SECRET_KEY.");
  const products = await listProducts(PUBLIC_STORE_ORG_ID);
  const settings = await getNativeStoreSettings(PUBLIC_STORE_ORG_ID);
  const requested = new Map(lines.map((line) => [line.productId, Math.max(1, Math.min(25, Math.round(line.quantity)))]));
  const selected = products.filter((p) => requested.has(p.id) && p.status === "launched" && p.price > 0);
  if (!selected.length || selected.length !== requested.size) throw new Error("One or more products are unavailable.");
  for (const product of selected) {
    const quantity = requested.get(product.id)!;
    if (product.inventory_policy !== "continue" && product.inventory_quantity !== undefined && product.inventory_quantity < quantity) {
      throw new Error(`${product.title} does not have enough inventory.`);
    }
  }

  const checkoutId = crypto.randomUUID().replace(/-/g, "");
  const pending: PendingCheckout = { orgId: PUBLIC_STORE_ORG_ID, lines: [...requested].map(([productId, quantity]) => ({ productId, quantity })), createdAt: new Date().toISOString() };
  await kv.set(pendingKey(checkoutId), pending);
  await kv.expire(pendingKey(checkoutId), 86400);

  const stripe = new Stripe(secret);
  const subtotal = selected.reduce((sum, product) => sum + product.price * requested.get(product.id)!, 0);
  const shippingAmount = settings.freeShippingThresholdUsd > 0 && subtotal >= settings.freeShippingThresholdUsd ? 0 : settings.flatShippingUsd;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: selected.map((product) => ({
      quantity: requested.get(product.id)!,
      price_data: { currency: settings.currency, unit_amount: Math.round(product.price * 100), product_data: { name: product.title, images: product.image_url ? [product.image_url] : undefined, metadata: { productId: product.id } } },
    })),
    shipping_address_collection: { allowed_countries: settings.allowedCountries },
    shipping_options: [{ shipping_rate_data: { type: "fixed_amount", fixed_amount: { amount: Math.round(shippingAmount * 100), currency: settings.currency }, display_name: shippingAmount === 0 ? "Envío gratis" : "Envío estándar", delivery_estimate: { minimum: { unit: "business_day", value: 3 }, maximum: { unit: "business_day", value: 10 } } } }],
    phone_number_collection: { enabled: true },
    allow_promotion_codes: true,
    automatic_tax: { enabled: process.env.STRIPE_AUTOMATIC_TAX === "true" },
    metadata: { orgId: PUBLIC_STORE_ORG_ID, checkoutId },
    success_url: `${origin}/shop?checkout=success`,
    cancel_url: `${origin}/shop?cart=1`,
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL.");
  return session.url;
}

function stripeAddress(session: Stripe.Checkout.Session): ShippingAddress {
  const details = session.collected_information?.shipping_details ?? session.customer_details;
  const address = details?.address;
  return { name: details?.name ?? "", phone: session.customer_details?.phone ?? "", line1: address?.line1 ?? "", line2: address?.line2 ?? "", city: address?.city ?? "", province: address?.state ?? "", province_code: address?.state ?? "", zip: address?.postal_code ?? "", country: address?.country ?? "", country_code: address?.country ?? "" };
}

export async function ingestPaidStripeCheckout(session: Stripe.Checkout.Session): Promise<Order | null> {
  if (session.payment_status !== "paid") return null;
  const checkoutId = session.metadata?.checkoutId;
  const orgId = session.metadata?.orgId;
  if (!checkoutId || !orgId) throw new Error("Checkout metadata is missing.");
  const existing = await findOrderByExternalId(orgId, session.id);
  if (existing) return existing;
  const pending = await kv.get<PendingCheckout>(pendingKey(checkoutId));
  if (!pending || pending.orgId !== orgId) throw new Error("Checkout cart expired or was not found.");
  const products = await listProducts(orgId);
  const now = new Date().toISOString();
  const lines = pending.lines.map((line) => {
    const product = products.find((p) => p.id === line.productId);
    if (!product) throw new Error(`Product ${line.productId} no longer exists.`);
    return { sku: product.sku ?? "", title: product.title, quantity: line.quantity, unit_price: product.price, product_id: product.id, supplier_pid: product.supplier_pid, supplier_vid: product.supplier_vid, unit_cost: product.cost };
  });
  const total = (session.amount_total ?? 0) / 100;
  const subtotal = (session.amount_subtotal ?? 0) / 100;
  const shipping = (session.total_details?.amount_shipping ?? 0) / 100;
  const tax = (session.total_details?.amount_tax ?? 0) / 100;
  const discount = (session.total_details?.amount_discount ?? 0) / 100;
  const order: Order = { id: crypto.randomUUID().replace(/-/g, ""), org_id: orgId, channel: "native", external_id: session.id, order_number: `WEB-${session.id.slice(-8).toUpperCase()}`, email: session.customer_details?.email ?? session.customer_email ?? "", customer_name: session.customer_details?.name ?? "", currency: (session.currency ?? "usd").toUpperCase(), subtotal, shipping, tax, discount, total, financial_status: "paid", fulfillment_status: "unfulfilled", stage: "received", lines, shipping_address: stripeAddress(session), supplier: "", cogs: 0, supplier_shipping: 0, refunded: 0, events: [{ at: now, kind: "received", detail: "Paid order received through native Stripe checkout." }], placed_at: now, created_at: now, updated_at: now };
  await saveOrder(order);
  await postEntries(orgId, [
    { account: "revenue", amount: subtotal, dedupe_key: `order:${session.id}:revenue`, memo: `Native sale ${order.order_number}`, order_id: order.id, currency: order.currency },
    { account: "tax", amount: order.tax, dedupe_key: `order:${session.id}:tax`, memo: `Tax on ${order.order_number}`, order_id: order.id, currency: order.currency },
    { account: "shipping_income", amount: order.shipping, dedupe_key: `order:${session.id}:shipping`, memo: `Shipping on ${order.order_number}`, order_id: order.id, currency: order.currency },
    { account: "discount", amount: order.discount, dedupe_key: `order:${session.id}:discount`, memo: `Discount on ${order.order_number}`, order_id: order.id, currency: order.currency },
    { account: "cogs", amount: lines.reduce((sum, line) => sum + line.unit_cost * line.quantity, 0), dedupe_key: `order:${session.id}:cogs`, memo: `Estimated COGS for ${order.order_number}`, order_id: order.id, currency: order.currency },
  ]);
  await Promise.all(lines.map(async (line) => {
    const product = products.find((p) => p.id === line.product_id);
    if (product?.inventory_quantity !== undefined) await updateProduct(orgId, product.id, { inventory_quantity: Math.max(0, product.inventory_quantity - line.quantity) });
  }));
  await kv.del(pendingKey(checkoutId));
  return order;
}
