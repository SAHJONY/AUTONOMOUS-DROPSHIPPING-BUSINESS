import { error } from "@/lib/api";
import { handleMcpRequest } from "@/lib/mcp";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * MCP endpoint for Accio Work (or any MCP client the owner runs).
 *
 * Fail-closed like the crons: with no `MCP_ACCESS_TOKEN` configured the endpoint
 * is disabled rather than open. The token is compared in constant time, and it
 * is the only credential — this surface exposes no money-moving tool, so a leak
 * cannot spend anything, but it can read the business, hence the auth.
 */
const MCP_ACCESS_TOKEN = process.env.MCP_ACCESS_TOKEN ?? "";
const MCP_ORG_ID = process.env.MCP_ORG_ID ?? "";

function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = Buffer.from(a, "utf8");
  const bBytes = Buffer.from(b, "utf8");
  const length = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < length; i++) diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  return diff === 0;
}

export async function POST(req: Request) {
  if (!MCP_ACCESS_TOKEN) return error("MCP server is disabled: MCP_ACCESS_TOKEN is not configured.", 503);
  if (!MCP_ORG_ID) return error("MCP server is disabled: MCP_ORG_ID is not configured.", 503);

  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !timingSafeEqual(token, MCP_ACCESS_TOKEN)) return error("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (body === null) return error("Invalid JSON body.", 400);

  // A batch is a JSON array; anything that produces no response is a notification.
  if (Array.isArray(body)) {
    const responses = (await Promise.all(body.map((entry) => handleMcpRequest(MCP_ORG_ID, entry)))).filter(Boolean);
    return responses.length === 0 ? new NextResponse(null, { status: 202 }) : NextResponse.json(responses);
  }

  const response = await handleMcpRequest(MCP_ORG_ID, body);
  return response === null ? new NextResponse(null, { status: 202 }) : NextResponse.json(response);
}
