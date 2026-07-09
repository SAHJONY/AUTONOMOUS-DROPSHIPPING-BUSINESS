import { json } from "@/lib/api";
import { ALL_AGENTS } from "@/lib/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return json(
    ALL_AGENTS.map((a) => {
      const tools = a.tools();
      return {
        name: a.name,
        description: a.description,
        tools: tools.map((t) => t.name),
        high_risk_tools: tools.filter((t) => t.requires_approval).map((t) => t.name),
      };
    }),
  );
}
