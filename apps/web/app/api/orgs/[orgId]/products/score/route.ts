import { json, requireOrg } from "@/lib/api";
import { scoreProduct } from "@/lib/scoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrg(req, orgId);
  if ("response" in auth) return auth.response;
  const b = await req.json().catch(() => ({}));
  return json(
    scoreProduct({
      demand: Number(b.demand ?? 0),
      competition: Number(b.competition ?? 0),
      margin: Number(b.margin ?? 0),
      trend: Number(b.trend ?? 0),
      risk: Number(b.risk ?? 0),
    }),
  );
}
