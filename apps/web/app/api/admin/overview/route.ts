import { error, json, requireUser } from "@/lib/api";
import { buildDashboard, listAllOrgs, listAllUsers } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Owner-only god-mode: every org, every user, platform-wide totals. */
export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;
  if (!auth.user.is_owner) return error("Owner access only.", 403);

  const [orgs, users] = await Promise.all([listAllOrgs(), listAllUsers()]);
  const dashboards = await Promise.all(
    orgs.map(async (o) => ({ org: o, dashboard: await buildDashboard(o.id) })),
  );

  const totals = dashboards.reduce(
    (acc, d) => {
      acc.products += d.dashboard.products_total;
      acc.runs += d.dashboard.runs_total;
      acc.approvals += d.dashboard.pending_approvals;
      acc.stores += d.dashboard.stores_total;
      acc.tokens += d.dashboard.total_tokens_used;
      acc.revenue += d.dashboard.revenue_estimate;
      return acc;
    },
    { products: 0, runs: 0, approvals: 0, stores: 0, tokens: 0, revenue: 0 },
  );

  return json({
    owner: auth.user.email,
    orgs_total: orgs.length,
    users_total: users.length,
    totals,
    orgs: dashboards,
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      full_name: u.full_name,
      is_owner: u.is_owner,
      is_active: u.is_active,
      created_at: u.created_at,
    })),
  });
}
