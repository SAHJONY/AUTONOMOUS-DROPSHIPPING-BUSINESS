import { error, requireOrgRole } from "@/lib/api";
import { getNbdTradeStatus, nbdFindCompanies } from "@/lib/nbd-trade";
import { NextResponse } from "next/server";

export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=30;
const privateJson=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"private, no-store","X-Robots-Tag":"noindex, nofollow"}});

export async function GET(req:Request,{params}:{params:Promise<{orgId:string}>}){const {orgId}=await params;const auth=await requireOrgRole(req,orgId,["owner"]);if("response" in auth)return auth.response;return privateJson(getNbdTradeStatus());}
export async function POST(req:Request,{params}:{params:Promise<{orgId:string}>}){const {orgId}=await params;const auth=await requireOrgRole(req,orgId,["owner"]);if("response" in auth)return auth.response;const body=await req.json().catch(()=>({}));const companyName=String(body.company_name??"").trim();if(companyName.length<2||companyName.length>200)return error("Company name must contain 2–200 characters.",422);const result=await nbdFindCompanies(companyName,Number(body.page)||1);if(!result.ok)return error(result.error??"NBD search failed.",502);return privateJson({ok:true,query:companyName,data:result.data});}
