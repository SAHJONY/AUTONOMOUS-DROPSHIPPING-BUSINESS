/**
 * Domain data access over the KV layer. All persistence for orgs, users,
 * products, agent runs, approvals, and business memory lives here.
 */
import { kv, listGet, listPush, listReplace, STORAGE_MODE } from "./kv";
import { BRAIN_MODEL, isOwnerEmail, OWNER_EMAIL, OWNER_PASSWORD } from "./config";
import { ANTHROPIC_API_KEY } from "./config";
import { hashPassword, verifyPassword } from "./auth";
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
  allOrgs: "index:orgs",
  allUsers: "index:users",
};

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
  const [products, runs, approvals, stores, memory] = await Promise.all([
    listProducts(orgId),
    listRuns(orgId, 500),
    listApprovals(orgId),
    listStores(orgId),
    listGet<MemoryEntry>(K.memory(orgId)),
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
    brain_model: BRAIN_MODEL,
    brain_live: !!ANTHROPIC_API_KEY,
    storage_mode: STORAGE_MODE,
  };
}
