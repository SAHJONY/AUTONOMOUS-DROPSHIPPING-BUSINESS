/**
 * Domain data access over the KV layer. All persistence for orgs, users,
 * products, agent runs, approvals, and business memory lives here.
 */
import { kv, listGet, listPush, listReplace } from "./kv";
import {
  AUTOPILOT_DEFAULT,
  AUTOPILOT_MAX_AD_BUDGET,
  AUTOPILOT_MAX_REFUND,
  ENGINE_NAME,
  isOwnerEmail,
  OWNER_EMAIL,
  OWNER_PASSWORD,
} from "./config";
import { ANTHROPIC_API_KEY } from "./config";
import { hashPassword, verifyPassword } from "./auth";
import type { OrgSettings } from "./types";
import { createShopifyProduct, mintAccessToken, type ShopifyCreds } from "./shopify";
import { cinematicPrompt, generateImage, type HiggsfieldCreds } from "./higgsfield";
import { cjGetAccessToken, cjSearchProducts, type CJCreds } from "./suppliers/cj";
import { marginScoreFromPrices, scoreProduct, VERDICT_LAUNCH } from "./scoring";
import type {
  AgentRun,
  ApprovalRequest,
  Dashboard,
  Membership,
  MemoryEntry,
  Organization,
  Product,
  Store,
  User,
} from "./types";

export function newId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}
export function nowISO(): string {
  return new Date().toISOString();
}

/* ---------- keys ---------- */
const K = {
  user: (id: string) => `user:${id}`,
  userByEmail: (email: string) => `user:email:${email.toLowerCase()}`,
  org: (id: string) => `org:${id}`,
  membershipsByUser: (uid: string) => `memberships:user:${uid}`,
  membershipsByOrg: (oid: string) => `memberships:org:${oid}`,
  products: (oid: string) => `products:${oid}`,
  runs: (oid: string) => `runs:${oid}`,
  approvals: (oid: string) => `approvals:${oid}`,
  memory: (oid: string) => `memory:${oid}`,
  stores: (oid: string) => `stores:${oid}`,
  settings: (oid: string) => `settings:${oid}`,
  shopify: (oid: string) => `shopify:${oid}`,
  shopifyToken: (oid: string) => `shopify_token:${oid}`,
  higgsfield: (oid: string) => `higgsfield:${oid}`,
  cj: (oid: string) => `cj:${oid}`,
  cjToken: (oid: string) => `cj_token:${oid}`,
  allOrgs: "index:orgs",
  allUsers: "index:users",
};

/* ---------- Shopify integration creds ---------- */

export async function getShopifyCreds(orgId: string): Promise<ShopifyCreds | null> {
  return kv.get<ShopifyCreds>(K.shopify(orgId));
}
export async function setShopifyCreds(orgId: string, creds: ShopifyCreds): Promise<void> {
  await kv.set(K.shopify(orgId), creds);
}
export async function clearShopifyCreds(orgId: string): Promise<void> {
  await kv.del(K.shopify(orgId));
  await kv.del(K.shopifyToken(orgId));
}

/**
 * Resolve a usable Admin API token: legacy static token if present, else mint a
 * short-lived one from Client ID/Secret (cached in KV until ~1 min before expiry).
 */
export async function resolveShopifyToken(
  orgId: string,
): Promise<{ ok: boolean; shop?: string; token?: string; error?: string }> {
  const creds = await getShopifyCreds(orgId);
  if (!creds) return { ok: false, error: "No Shopify store connected." };
  if (creds.token) return { ok: true, shop: creds.shop, token: creds.token };
  if (creds.client_id && creds.client_secret) {
    const now = Date.now();
    const cached = await kv.get<{ access_token: string; expires_at: number }>(K.shopifyToken(orgId));
    if (cached && cached.expires_at > now + 60_000) {
      return { ok: true, shop: creds.shop, token: cached.access_token };
    }
    const minted = await mintAccessToken(creds.shop, creds.client_id, creds.client_secret);
    if (!minted.ok || !minted.token) return { ok: false, error: minted.error ?? "Token mint failed." };
    await kv.set(K.shopifyToken(orgId), {
      access_token: minted.token,
      expires_at: now + (minted.expires_in ?? 86399) * 1000,
    });
    return { ok: true, shop: creds.shop, token: minted.token };
  }
  return { ok: false, error: "Incomplete Shopify credentials." };
}

/* ---------- Higgsfield (cinematic imagery) ---------- */

export async function getHiggsfieldCreds(orgId: string): Promise<HiggsfieldCreds | null> {
  return kv.get<HiggsfieldCreds>(K.higgsfield(orgId));
}
export async function setHiggsfieldCreds(orgId: string, creds: HiggsfieldCreds): Promise<void> {
  await kv.set(K.higgsfield(orgId), creds);
}
export async function clearHiggsfieldCreds(orgId: string): Promise<void> {
  await kv.del(K.higgsfield(orgId));
}

/** Extract the primary product image from a source/supplier page (Open Graph). */
export async function fetchSourceImage(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; SAHJONYBot/1.0)" } });
    if (!res.ok) return undefined;
    const html = await res.text();
    const patterns = [
      /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m?.[1]) return m[1];
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Acquire a product image, in priority order:
 *   1. an explicit URL (manually set / from a source),
 *   2. the source/supplier page's Open Graph image,
 *   3. a cinematic Higgsfield generation.
 */
export async function generateProductImage(
  orgId: string,
  productId: string,
  manualUrl?: string,
): Promise<{ ok: boolean; url?: string; source?: string; error?: string }> {
  const product = (await listProducts(orgId)).find((p) => p.id === productId);
  if (!product) return { ok: false, error: "Product not found." };

  // 1. Explicit URL
  if (manualUrl && manualUrl.trim()) {
    let u = manualUrl.trim();
    if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
    await updateProduct(orgId, productId, { image_url: u });
    return { ok: true, url: u, source: "manual" };
  }

  // 2. Source page image
  if (product.supplier_url) {
    const og = await fetchSourceImage(product.supplier_url);
    if (og) {
      await updateProduct(orgId, productId, { image_url: og });
      return { ok: true, url: og, source: "source" };
    }
  }

  // 3. Higgsfield generation
  const creds = await getHiggsfieldCreds(orgId);
  if (!creds) {
    return {
      ok: false,
      error: "No image at the source, and Higgsfield isn't connected. Paste an image URL or connect Higgsfield.",
    };
  }
  const res = await generateImage(creds, cinematicPrompt(product.title, product.description));
  if (!res.ok || !res.url) return { ok: false, error: res.error };
  await updateProduct(orgId, productId, { image_url: res.url });
  return { ok: true, url: res.url, source: "higgsfield" };
}

/* ---------- CJ Dropshipping (real product feed) ---------- */

export async function getCJCreds(orgId: string): Promise<CJCreds | null> {
  return kv.get<CJCreds>(K.cj(orgId));
}
export async function setCJCreds(orgId: string, creds: CJCreds): Promise<void> {
  await kv.set(K.cj(orgId), creds);
}
export async function clearCJCreds(orgId: string): Promise<void> {
  await kv.del(K.cj(orgId));
  await kv.del(K.cjToken(orgId));
}

async function resolveCJToken(orgId: string): Promise<{ ok: boolean; token?: string; error?: string }> {
  const creds = await getCJCreds(orgId);
  if (!creds) return { ok: false, error: "CJ Dropshipping not connected." };
  const now = Date.now();
  const cached = await kv.get<{ token: string; expires_at: number }>(K.cjToken(orgId));
  if (cached && cached.expires_at > now + 60_000) return { ok: true, token: cached.token };
  const minted = await cjGetAccessToken(creds);
  if (!minted.ok || !minted.token) return { ok: false, error: minted.error };
  await kv.set(K.cjToken(orgId), { token: minted.token, expires_at: minted.expires_at ?? now + 86_400_000 });
  return { ok: true, token: minted.token };
}

/** Import real products (with real images + video) from CJ into the catalog. */
export async function importFromSupplier(
  orgId: string,
  query: string,
  limit = 6,
): Promise<{ ok: boolean; imported?: number; error?: string }> {
  const tok = await resolveCJToken(orgId);
  if (!tok.ok || !tok.token) return { ok: false, error: tok.error };
  const search = await cjSearchProducts(tok.token, query, limit);
  if (!search.ok || !search.products) return { ok: false, error: search.error };

  let imported = 0;
  for (const sp of search.products) {
    const cost = sp.cost || 0;
    const price = cost > 0 ? Math.max(9.99, Math.ceil(cost * 3) - 0.01) : 0;
    const score = scoreProduct({
      demand: 82,
      competition: 50,
      margin: marginScoreFromPrices(cost, price),
      trend: 82,
      risk: 18,
    });
    const product: Product = {
      id: newId(),
      org_id: orgId,
      title: sp.title,
      description: sp.description,
      source: "CJ Dropshipping",
      supplier: "cj",
      supplier_url: sp.supplier_url ?? "",
      cost,
      price,
      status: score.verdict === VERDICT_LAUNCH ? "ready_to_launch" : "analyzed",
      score: score.total_score,
      verdict: score.verdict,
      image_url: sp.image_url,
      images: sp.images,
      video_url: sp.video_url,
      created_at: nowISO(),
    };
    await saveProduct(product);
    imported++;
  }
  return { ok: true, imported };
}

/* ---------- Auto-publish launch-ready products to Shopify ---------- */

/**
 * Publish every launch-ready product that isn't live yet to the connected
 * Shopify store — generating a cinematic image first when Higgsfield is
 * connected. Runs hands-free from the cron and after product discovery.
 */
export async function autoPublishReady(orgId: string): Promise<number> {
  const settings = await getOrgSettings(orgId);
  if (!settings.auto_publish) return 0;
  const resolved = await resolveShopifyToken(orgId);
  if (!resolved.ok || !resolved.token || !resolved.shop) return 0;

  const products = await listProducts(orgId);
  let count = 0;
  for (const p of products) {
    if (p.status !== "ready_to_launch" || p.storefront_url) continue;

    // Acquire an image (source page → Higgsfield) before publishing.
    let imageUrl = p.image_url;
    if (!imageUrl) {
      const img = await generateProductImage(orgId, p.id);
      if (img.ok) imageUrl = img.url;
    }

    const res = await createShopifyProduct(resolved.shop, resolved.token, {
      title: p.title,
      description: p.description,
      price: p.price,
      image_url: imageUrl,
      images: p.images,
      video_url: p.video_url,
    });
    if (res.ok) {
      await updateProduct(orgId, p.id, { status: "launched", storefront_url: res.url ?? "" });
      count++;
    }
  }
  return count;
}

/* ---------- org settings (autopilot) ---------- */

export async function getOrgSettings(orgId: string): Promise<OrgSettings> {
  const s = await kv.get<OrgSettings>(K.settings(orgId));
  return {
    autopilot: s?.autopilot ?? AUTOPILOT_DEFAULT,
    auto_publish: s?.auto_publish ?? true,
  };
}

export async function setOrgSettings(orgId: string, patch: Partial<OrgSettings>): Promise<OrgSettings> {
  const current = await getOrgSettings(orgId);
  const next = { ...current, ...patch };
  await kv.set(K.settings(orgId), next);
  return next;
}

/**
 * Autopilot policy — the ~2% that still needs a human. Returns true when a
 * gated action is safe to auto-approve. Large ad budgets and large refunds
 * always escalate to the owner.
 */
export function isAutoApprovable(action: string, payload: Record<string, unknown>): boolean {
  switch (action) {
    case "set_ad_budget":
      return Number(payload.daily_budget ?? 0) <= AUTOPILOT_MAX_AD_BUDGET;
    case "issue_refund":
      return Number(payload.amount ?? 0) <= AUTOPILOT_MAX_REFUND;
    case "create_store":
    case "kill_product":
      return true;
    default:
      return true;
  }
}

/* ---------- users ---------- */

export async function getUser(id: string): Promise<User | null> {
  return kv.get<User>(K.user(id));
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const id = await kv.get<string>(K.userByEmail(email));
  return id ? getUser(id) : null;
}

export async function createUser(data: {
  email: string;
  hashed_password: string;
  full_name?: string;
}): Promise<User> {
  const email = data.email.toLowerCase();
  const user: User = {
    id: newId(),
    email,
    hashed_password: data.hashed_password,
    full_name: data.full_name ?? "",
    is_active: true,
    is_owner: isOwnerEmail(email),
    created_at: nowISO(),
  };
  await kv.set(K.user(user.id), user);
  await kv.set(K.userByEmail(email), user.id);
  await kv.sadd(K.allUsers, user.id);
  return user;
}

export async function listAllUsers(): Promise<User[]> {
  const ids = await kv.smembers(K.allUsers);
  const users = await Promise.all(ids.map((id) => getUser(id)));
  return users.filter(Boolean) as User[];
}

export async function setUserPassword(userId: string, hashed_password: string): Promise<void> {
  const user = await getUser(userId);
  if (user) await kv.set(K.user(userId), { ...user, hashed_password });
}

/**
 * Bootstrap / self-heal the owner account from the OWNER_PASSWORD env var.
 * Called on owner sign-in: if no owner exists it is created; if it exists but
 * its stored password no longer matches the env value, the hash is re-synced so
 * the Vercel env var is always the authoritative owner password.
 */
export async function ensureOwnerFromEnv(): Promise<void> {
  if (!OWNER_PASSWORD) return;
  const existing = await getUserByEmail(OWNER_EMAIL);
  if (!existing) {
    const user = await createUser({
      email: OWNER_EMAIL,
      hashed_password: await hashPassword(OWNER_PASSWORD),
      full_name: "Owner",
    });
    await createOrg("SAHJONY Commerce", user.id, "owner");
    return;
  }
  if (!(await verifyPassword(OWNER_PASSWORD, existing.hashed_password))) {
    await setUserPassword(existing.id, await hashPassword(OWNER_PASSWORD));
  }
}

/* ---------- orgs & memberships ---------- */

export async function getOrg(id: string): Promise<Organization | null> {
  return kv.get<Organization>(K.org(id));
}

export async function createOrg(name: string, ownerUserId: string, role: Membership["role"] = "owner"): Promise<Organization> {
  const org: Organization = { id: newId(), name, created_at: nowISO() };
  await kv.set(K.org(org.id), org);
  await kv.sadd(K.allOrgs, org.id);
  await addMembership(ownerUserId, org.id, role);
  return org;
}

export async function addMembership(userId: string, orgId: string, role: Membership["role"]): Promise<void> {
  const byUser = await listGet<Membership>(K.membershipsByUser(userId));
  if (!byUser.some((m) => m.org_id === orgId)) {
    byUser.push({ org_id: orgId, role });
    await listReplace(K.membershipsByUser(userId), byUser);
  }
  const byOrg = await listGet<{ user_id: string; role: string }>(K.membershipsByOrg(orgId));
  if (!byOrg.some((m) => m.user_id === userId)) {
    byOrg.push({ user_id: userId, role });
    await listReplace(K.membershipsByOrg(orgId), byOrg);
  }
}

export async function listOrgsForUser(user: User): Promise<Organization[]> {
  // The owner sees and controls every organization on the platform.
  if (user.is_owner) return listAllOrgs();
  const memberships = await listGet<Membership>(K.membershipsByUser(user.id));
  const orgs = await Promise.all(memberships.map((m) => getOrg(m.org_id)));
  return orgs.filter(Boolean) as Organization[];
}

export async function listAllOrgs(): Promise<Organization[]> {
  const ids = await kv.smembers(K.allOrgs);
  const orgs = await Promise.all(ids.map((id) => getOrg(id)));
  return (orgs.filter(Boolean) as Organization[]).sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
}

export async function userCanAccessOrg(user: User, orgId: string): Promise<boolean> {
  if (user.is_owner) return true; // unrestricted god-mode access
  const memberships = await listGet<Membership>(K.membershipsByUser(user.id));
  return memberships.some((m) => m.org_id === orgId);
}

/* ---------- products ---------- */

export async function listProducts(orgId: string): Promise<Product[]> {
  return listGet<Product>(K.products(orgId));
}
export async function saveProduct(p: Product): Promise<void> {
  await listPush(K.products(p.org_id), p, 1000);
}
export async function updateProduct(orgId: string, id: string, patch: Partial<Product>): Promise<Product | null> {
  const arr = await listProducts(orgId);
  const idx = arr.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  arr[idx] = { ...arr[idx], ...patch };
  await listReplace(K.products(orgId), arr);
  return arr[idx];
}

/* ---------- stores ---------- */

export async function listStores(orgId: string): Promise<Store[]> {
  return listGet<Store>(K.stores(orgId));
}
export async function saveStore(s: Store): Promise<void> {
  await listPush(K.stores(s.org_id), s, 200);
}
export async function updateStore(orgId: string, id: string, patch: Partial<Store>): Promise<Store | null> {
  const arr = await listStores(orgId);
  const idx = arr.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  arr[idx] = { ...arr[idx], ...patch };
  await listReplace(K.stores(orgId), arr);
  return arr[idx];
}

/* ---------- runs ---------- */

export async function listRuns(orgId: string, limit = 100): Promise<AgentRun[]> {
  return (await listGet<AgentRun>(K.runs(orgId))).slice(0, limit);
}
export async function saveRun(r: AgentRun): Promise<void> {
  await listPush(K.runs(r.org_id), r, 500);
}
export async function updateRun(orgId: string, id: string, patch: Partial<AgentRun>): Promise<void> {
  const arr = await listGet<AgentRun>(K.runs(orgId));
  const idx = arr.findIndex((r) => r.id === id);
  if (idx !== -1) {
    arr[idx] = { ...arr[idx], ...patch };
    await listReplace(K.runs(orgId), arr);
  }
}

/* ---------- approvals ---------- */

export async function listApprovals(orgId: string): Promise<ApprovalRequest[]> {
  return listGet<ApprovalRequest>(K.approvals(orgId));
}
export async function saveApproval(a: ApprovalRequest): Promise<void> {
  await listPush(K.approvals(a.org_id), a, 500);
}
export async function getApproval(orgId: string, id: string): Promise<ApprovalRequest | null> {
  return (await listApprovals(orgId)).find((a) => a.id === id) ?? null;
}
export async function updateApproval(orgId: string, id: string, patch: Partial<ApprovalRequest>): Promise<void> {
  const arr = await listApprovals(orgId);
  const idx = arr.findIndex((a) => a.id === id);
  if (idx !== -1) {
    arr[idx] = { ...arr[idx], ...patch };
    await listReplace(K.approvals(orgId), arr);
  }
}

/* ---------- memory ---------- */

export async function remember(orgId: string, key: string, content: string, agentName = ""): Promise<MemoryEntry> {
  const entry: MemoryEntry = {
    id: newId(),
    org_id: orgId,
    agent_name: agentName,
    key,
    content,
    created_at: nowISO(),
  };
  await listPush(K.memory(orgId), entry, 1000);
  return entry;
}
export async function recall(orgId: string, query = "", limit = 20): Promise<MemoryEntry[]> {
  let entries = await listGet<MemoryEntry>(K.memory(orgId));
  if (query) {
    const q = query.toLowerCase();
    entries = entries.filter(
      (e) => e.key.toLowerCase().includes(q) || e.content.toLowerCase().includes(q),
    );
  }
  return entries.slice(0, limit);
}

/* ---------- dashboard ---------- */

export async function buildDashboard(orgId: string): Promise<Dashboard> {
  const [products, runs, approvals, stores, memory, settings] = await Promise.all([
    listProducts(orgId),
    listRuns(orgId, 500),
    listApprovals(orgId),
    listStores(orgId),
    listGet<MemoryEntry>(K.memory(orgId)),
    getOrgSettings(orgId),
  ]);

  const productsByStatus: Record<string, number> = {};
  for (const p of products) productsByStatus[p.status] = (productsByStatus[p.status] ?? 0) + 1;

  const runsByStatus: Record<string, number> = {};
  for (const r of runs) runsByStatus[r.status] = (runsByStatus[r.status] ?? 0) + 1;

  const tokens = runs.reduce((sum, r) => sum + r.input_tokens + r.output_tokens, 0);

  // Rough revenue signal: launched products' per-unit margin as a proxy.
  const revenue = products
    .filter((p) => p.status === "launched")
    .reduce((sum, p) => sum + Math.max(0, p.price - p.cost), 0);

  return {
    products_total: products.length,
    products_by_status: productsByStatus,
    runs_total: runs.length,
    runs_by_status: runsByStatus,
    pending_approvals: approvals.filter((a) => a.status === "pending").length,
    stores_total: stores.length,
    total_tokens_used: tokens,
    memory_entries: memory.length,
    revenue_estimate: Math.round(revenue * 100) / 100,
    engine: ENGINE_NAME,
    engine_online: !!ANTHROPIC_API_KEY,
    autopilot: settings.autopilot,
    auto_publish: settings.auto_publish,
    autonomy_pct: settings.autopilot ? 98 : 60,
  };
}
