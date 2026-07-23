import assert from "node:assert/strict";
import test from "node:test";

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
import { requireOrgRole } from "../lib/api";
import { createToken } from "../lib/auth";
import { OWNER_EMAIL } from "../lib/config";
import {
  addMembership,
  createOrg,
  createUser,
  getOrgSettings,
  isAutoApprovable,
  setOrgSettings,
} from "../lib/store";

type Route = (
  request: Request,
  context: { params: Promise<Record<string, string>> },
) => Promise<Response>;

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
  assert.deepEqual(await getOrgSettings(org.id), { autopilot: false, auto_publish: false });
  assert.deepEqual(await setOrgSettings(org.id, { autopilot: true, auto_publish: true }), {
    autopilot: false,
    auto_publish: false,
  });
});

test("cron routes fail closed without CRON_SECRET", async () => {
  assert.equal((await autonomousCron(new Request("http://localhost/api/cron/autonomous"))).status, 503);
  assert.equal((await stockCron(new Request("http://localhost/api/cron/stock"))).status, 503);
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
      name: "run costly agents",
      handler: runAgent as Route,
      path: `/api/orgs/${org.id}/agents/ceo/run`,
      params: { orgId: org.id, agent: "ceo" },
    },
    {
      name: "approve workflows",
      handler: decideApproval as Route,
      path: `/api/orgs/${org.id}/approvals/approval/decide`,
      params: { orgId: org.id, id: "approval" },
    },
    {
      name: "connect CJ",
      handler: connectCJ as Route,
      path: `/api/orgs/${org.id}/integrations/cj`,
      params: { orgId: org.id },
    },
    {
      name: "connect Higgsfield",
      handler: connectHiggsfield as Route,
      path: `/api/orgs/${org.id}/integrations/higgsfield`,
      params: { orgId: org.id },
    },
    {
      name: "connect Shopify",
      handler: connectShopify as Route,
      path: `/api/orgs/${org.id}/integrations/shopify`,
      params: { orgId: org.id },
    },
    {
      name: "acquire product imagery",
      handler: acquireImage as Route,
      path: `/api/orgs/${org.id}/products/product/image`,
      params: { orgId: org.id, productId: "product" },
    },
    {
      name: "publish products",
      handler: publishProduct as Route,
      path: `/api/orgs/${org.id}/products/product/publish`,
      params: { orgId: org.id, productId: "product" },
    },
    {
      name: "reimage products",
      handler: reimageProducts as Route,
      path: `/api/orgs/${org.id}/products/reimage`,
      params: { orgId: org.id },
    },
    {
      name: "create products",
      handler: createProduct as Route,
      path: `/api/orgs/${org.id}/products`,
      params: { orgId: org.id },
    },
    {
      name: "change autonomy settings",
      handler: changeSettings as Route,
      path: `/api/orgs/${org.id}/settings`,
      params: { orgId: org.id },
    },
    {
      name: "source supplier products",
      handler: sourceProducts as Route,
      path: `/api/orgs/${org.id}/source`,
      params: { orgId: org.id },
    },
    {
      name: "update stores",
      handler: updateStore as Route,
      path: `/api/orgs/${org.id}/stores/store`,
      params: { orgId: org.id, storeId: "store" },
    },
  ];

  for (const route of cases) {
    const response = await route.handler(request(route.path, token), {
      params: Promise.resolve(route.params),
    });
    assert.equal(response.status, 403, route.name);
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
