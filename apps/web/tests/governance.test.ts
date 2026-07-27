import assert from "node:assert/strict";
import { test } from "vitest";

import { POST as runAgent } from "../app/api/orgs/[orgId]/agents/[agent]/run/route";
import { POST as decideApproval } from "../app/api/orgs/[orgId]/approvals/[id]/decide/route";
import { POST as connectCJ } from "../app/api/orgs/[orgId]/integrations/cj/route";
import { POST as connectHiggsfield } from "../app/api/orgs/[orgId]/integrations/higgsfield/route";
import { POST as connectShopify } from "../app/api/orgs/[orgId]/integrations/shopify/route";
import { POST as acquireImage } from "../app/api/orgs/[orgId]/products/[productId]/image/route";
import { POST as publishProduct } from "../app/api/orgs/[orgId]/products/[productId]/publish/route";
import { POST as reimageProducts } from "../app/api/orgs/[orgId]/products/reimage/route";
import { POST as createProduct } from "../app/api/orgs/[orgId]/products/route";
import { POST as changeSettings } from "../app/api/orgs/[orgId]/settings/route";
import { POST as sourceProducts } from "../app/api/orgs/[orgId]/source/route";
import { POST as updateStore } from "../app/api/orgs/[orgId]/stores/[storeId]/route";
import { POST as register } from "../app/api/auth/register/route";
import { GET as autonomousCron } from "../app/api/cron/autonomous/route";
import { GET as stockCron } from "../app/api/cron/stock/route";
import { GET as fulfillmentCron } from "../app/api/cron/fulfillment/route";
import { POST as syncOrders } from "../app/api/orgs/[orgId]/orders/sync/route";
import { POST as driveOrder } from "../app/api/orgs/[orgId]/orders/[orderId]/route";
import { requireOrgRole } from "../lib/api";
import { createToken } from "../lib/auth";
import { OWNER_EMAIL } from "../lib/config";
import { decideApproval as decideApprovalCore } from "../lib/brain";
import { cronGovernanceStatus, governanceCapabilities } from "../lib/governance";
import type { Role } from "../lib/types";
import {
  addMembership,
  createOrg,
  createUser,
  getOrgSettings,
  isAutoApprovable,
  listApprovalAudit,
  saveApproval,
  setOrgSettings,
} from "../lib/store";

type Route = (
  request: Request,
  context: { params: Promise<Record<string, string>> },
) => Promise<Response>;

/**
 * Route handlers declare their own concrete params shape, which is narrower than
 * the uniform record this suite drives them with. The cast goes through unknown
 * so the suite stays type-checked rather than opted out of type checking.
 */
const asRoute = (handler: unknown): Route => handler as Route;

function request(path: string, token: string, body: Record<string, unknown> = {}): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

test("public registration cannot provision the configured owner", async () => {
  const response = await register(
    new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: OWNER_EMAIL,
        password: "not-the-owner-password",
        organization_name: "Attacker",
      }),
    }),
  );
  assert.equal(response.status, 403);
});

test("autonomy policy requires manual approval for every gated action", () => {
  assert.equal(isAutoApprovable("create_store", {}), false);
  assert.equal(isAutoApprovable("kill_product", {}), false);
  assert.equal(isAutoApprovable("set_ad_budget", { daily_budget: 1 }), false);
  assert.equal(isAutoApprovable("issue_refund", { amount: 1 }), false);
  assert.equal(isAutoApprovable("publish_product_to_shopify", {}), false);
  assert.equal(isAutoApprovable("future_capital_action", {}), false);
});

test("new organizations and attempted settings changes remain fail closed", async () => {
  const owner = await createUser({
    email: `settings-owner-${crypto.randomUUID()}@example.com`,
    hashed_password: "unused",
  });
  const org = await createOrg("Fail-closed settings test", owner.id, "owner");
  // auto_fulfill joins the fail-closed set: it is the switch that lets the
  // business spend real money at the supplier, so it must stay off too.
  assert.deepEqual(await getOrgSettings(org.id), {
    autopilot: false,
    auto_publish: false,
    auto_fulfill: false,
  });
  assert.deepEqual(
    await setOrgSettings(org.id, { autopilot: true, auto_publish: true, auto_fulfill: true }),
    { autopilot: false, auto_publish: false, auto_fulfill: false },
  );
});

test("cron routes fail closed without CRON_SECRET", async () => {
  assert.equal((await autonomousCron(new Request("http://localhost/api/cron/autonomous"))).status, 503);
  assert.equal((await stockCron(new Request("http://localhost/api/cron/stock"))).status, 503);
  // The fulfillment cron is the one that spends money at the supplier, so it
  // must fail closed exactly like the others.
  assert.equal(
    (await fulfillmentCron(new Request("http://localhost/api/cron/fulfillment"))).status,
    503,
  );
});

test("members cannot execute any privileged organization route", async () => {
  const owner = await createUser({
    email: `route-owner-${crypto.randomUUID()}@example.com`,
    hashed_password: "unused",
  });
  const member = await createUser({
    email: `route-member-${crypto.randomUUID()}@example.com`,
    hashed_password: "unused",
  });
  const org = await createOrg("Governance test", owner.id, "owner");
  await addMembership(member.id, org.id, "member");
  const token = await createToken(member.id);

  const cases: Array<{
    name: string;
    handler: Route;
    path: string;
    params: Record<string, string>;
  }> = [
    {
      // Spends real cash at the supplier for every eligible order.
      name: "run the fulfillment cycle",
      handler: asRoute(syncOrders),
      path: `/api/orgs/${org.id}/orders/sync`,
      params: { orgId: org.id },
    },
    {
      // `place` bypasses the autonomous cost cap outright.
      name: "place a supplier order by hand",
      handler: asRoute(driveOrder),
      path: `/api/orgs/${org.id}/orders/order_1`,
      params: { orgId: org.id, orderId: "order_1" },
    },
    {
      name: "run costly agents",
      handler: asRoute(runAgent),
      path: `/api/orgs/${org.id}/agents/ceo/run`,
      params: { orgId: org.id, agent: "ceo" },
    },
    {
      name: "approve workflows",
      handler: asRoute(decideApproval),
      path: `/api/orgs/${org.id}/approvals/approval/decide`,
      params: { orgId: org.id, id: "approval" },
    },
    {
      name: "connect CJ",
      handler: asRoute(connectCJ),
      path: `/api/orgs/${org.id}/integrations/cj`,
      params: { orgId: org.id },
    },
    {
      name: "connect Higgsfield",
      handler: asRoute(connectHiggsfield),
      path: `/api/orgs/${org.id}/integrations/higgsfield`,
      params: { orgId: org.id },
    },
    {
      name: "connect Shopify",
      handler: asRoute(connectShopify),
      path: `/api/orgs/${org.id}/integrations/shopify`,
      params: { orgId: org.id },
    },
    {
      name: "acquire product imagery",
      handler: asRoute(acquireImage),
      path: `/api/orgs/${org.id}/products/product/image`,
      params: { orgId: org.id, productId: "product" },
    },
    {
      name: "publish products",
      handler: asRoute(publishProduct),
      path: `/api/orgs/${org.id}/products/product/publish`,
      params: { orgId: org.id, productId: "product" },
    },
    {
      name: "reimage products",
      handler: asRoute(reimageProducts),
      path: `/api/orgs/${org.id}/products/reimage`,
      params: { orgId: org.id },
    },
    {
      name: "create products",
      handler: asRoute(createProduct),
      path: `/api/orgs/${org.id}/products`,
      params: { orgId: org.id },
    },
    {
      name: "change autonomy settings",
      handler: asRoute(changeSettings),
      path: `/api/orgs/${org.id}/settings`,
      params: { orgId: org.id },
    },
    {
      name: "source supplier products",
      handler: asRoute(sourceProducts),
      path: `/api/orgs/${org.id}/source`,
      params: { orgId: org.id },
    },
    {
      name: "update stores",
      handler: asRoute(updateStore),
      path: `/api/orgs/${org.id}/stores/store`,
      params: { orgId: org.id, storeId: "store" },
    },
  ];

  for (const route of cases) {
    const response = await route.handler(request(route.path, token), {
      params: Promise.resolve(route.params),
    });
    assert.equal(response.status, route.name === "publish products" ? 423 : 403, route.name);
  }
});

test("administrators pass the shared privileged-role guard", async () => {
  const owner = await createUser({
    email: `guard-owner-${crypto.randomUUID()}@example.com`,
    hashed_password: "unused",
  });
  const admin = await createUser({
    email: `guard-admin-${crypto.randomUUID()}@example.com`,
    hashed_password: "unused",
  });
  const org = await createOrg("Role guard test", owner.id, "owner");
  await addMembership(admin.id, org.id, "admin");
  const token = await createToken(admin.id);

  const result = await requireOrgRole(request(`/api/orgs/${org.id}/settings`, token), org.id);
  assert.equal("role" in result && result.role, "admin");
});

test("commerce publishing is locked for every authenticated organization role", async () => {
  const owner = await createUser({
    email: `lock-owner-${crypto.randomUUID()}@example.com`,
    hashed_password: "unused",
  });
  const org = await createOrg("Commerce lock test", owner.id, "owner");
  const identities: { user: Awaited<ReturnType<typeof createUser>>; role: Role }[] = [
    { user: owner, role: "owner" },
  ];
  for (const role of ["admin", "member", "viewer"] as const) {
    const user = await createUser({
      email: `lock-${role}-${crypto.randomUUID()}@example.com`,
      hashed_password: "unused",
    });
    await addMembership(user.id, org.id, role);
    identities.push({ user, role });
  }
  for (const identity of identities) {
    const token = await createToken(identity.user.id);
    const response = await publishProduct(
      request(`/api/orgs/${org.id}/products/missing/publish`, token),
      { params: Promise.resolve({ orgId: org.id, productId: "missing" }) },
    );
    assert.equal(response.status, 423, identity.role);
  }
});

test("approval claims execute once under concurrent decisions and append immutable events", async () => {
  const owner = await createUser({
    email: `claim-owner-${crypto.randomUUID()}@example.com`,
    hashed_password: "unused",
  });
  const org = await createOrg("Atomic approval test", owner.id, "owner");
  const approvalId = crypto.randomUUID();
  await saveApproval({
    id: approvalId,
    org_id: org.id,
    agent_run_id: null,
    agent_name: "ceo",
    action: "kill_product",
    payload: { product_id: "missing" },
    risk_level: "high",
    reason: "Concurrency fixture",
    status: "pending",
    result: "",
    decided_by: null,
    created_at: new Date().toISOString(),
    decided_at: null,
  });

  const outcomes = await Promise.allSettled([
    decideApprovalCore(org.id, approvalId, "approve", owner.id, "owner"),
    decideApprovalCore(org.id, approvalId, "approve", owner.id, "owner"),
  ]);
  assert.equal(outcomes.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(outcomes.filter((result) => result.status === "rejected").length, 1);
  const events = await listApprovalAudit(org.id);
  assert.equal(events.filter((event) => event.result === "claimed").length, 1);
  assert.equal(events.filter((event) => event.result === "executed").length, 1);
});

test("failed approval execution is finalized and recorded immutably", async () => {
  const owner = await createUser({
    email: `failure-owner-${crypto.randomUUID()}@example.com`,
    hashed_password: "unused",
  });
  const org = await createOrg("Failure audit test", owner.id, "owner");
  const approvalId = crypto.randomUUID();
  await saveApproval({
    id: approvalId,
    org_id: org.id,
    agent_run_id: null,
    agent_name: "ceo",
    action: "removed_action",
    payload: {},
    risk_level: "high",
    reason: "Failure fixture",
    status: "pending",
    result: "",
    decided_by: null,
    created_at: new Date().toISOString(),
    decided_at: null,
  });
  await assert.rejects(
    decideApprovalCore(org.id, approvalId, "approve", owner.id, "owner"),
    /no longer available/,
  );
  const events = await listApprovalAudit(org.id);
  const failure = events.find((event) => event.result === "failed");
  assert.equal(failure?.next_state, "failed");
  assert.match(failure?.failure ?? "", /no longer available/);
});

test("command-deck capabilities enforce the role and release-gate matrix", () => {
  assert.equal(governanceCapabilities("owner", true).canPublish, true);
  assert.equal(governanceCapabilities("admin", true).canApprove, true);
  assert.equal(governanceCapabilities("member", true).canManage, false);
  assert.equal(governanceCapabilities("viewer", true).readOnly, true);
  assert.equal(governanceCapabilities("owner", false).canPublish, false);
  assert.match(governanceCapabilities("admin", false).publishingReason ?? "", /locked/i);
});

test("cron authentication precedes the autonomy release gate", () => {
  assert.equal(cronGovernanceStatus("", "", false), 503);
  assert.equal(cronGovernanceStatus("Bearer wrong", "secret", false), 401);
  assert.equal(cronGovernanceStatus("Bearer secret", "secret", false), 423);
  assert.equal(cronGovernanceStatus("Bearer secret", "secret", true), null);
});
