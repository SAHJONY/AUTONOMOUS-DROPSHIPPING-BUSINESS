import { describe, expect, it } from "vitest";
import { applyVerifiedEvidence, requiredEvidenceForSku, type BotanicaEvidence } from "../lib/botanica/verification-workbench";
import { createCandidateSku, SUPPLIER_CANDIDATES } from "../lib/botanica/supplier-match";
import { BOTANICA_MASTER_CATALOG } from "../lib/botanica/master-catalog";
import { evaluateBotanicaSku } from "../lib/botanica/catalog-service";

function evidence(kind: BotanicaEvidence["kind"], verified = true): BotanicaEvidence {
  return { id:`e-${kind}`,candidate_id:"candidate",kind,note:`verified ${kind}`,verified,verified_at:verified?new Date().toISOString():undefined,created_at:new Date().toISOString() };
}

describe("BOTANICA verification workbench",()=>{
  it("keeps partial evidence on HOLD",()=>{
    const family=BOTANICA_MASTER_CATALOG.find(f=>f.id==="candle-plain")!;
    const sku=createCandidateSku(family,SUPPLIER_CANDIDATES[0]);
    const updated=applyVerifiedEvidence(sku,[evidence("SUPPLIER_TERMS"),evidence("PRICE")],{supplier_url:"https://supplier.example",unit_cost:3,shipping_cost:1,retail_price:10});
    expect(updated.publish_status).toBe("HOLD");
    expect(evaluateBotanicaSku(updated).draft_ready).toBe(false);
  });

  it("promotes complete physical SKU only to READY_FOR_REVIEW",()=>{
    const family=BOTANICA_MASTER_CATALOG.find(f=>f.id==="candle-plain")!;
    const sku=createCandidateSku(family,SUPPLIER_CANDIDATES[0]);
    const all=["SUPPLIER_TERMS","PRICE","INVENTORY","PROVENANCE","CULTURAL_REVIEW","IMAGE_RIGHTS","SAFETY"].map(k=>evidence(k as BotanicaEvidence["kind"]));
    const updated=applyVerifiedEvidence(sku,all,{supplier_url:"https://supplier.example",supplier_sku:"C-7D",unit_cost:3,shipping_cost:1,retail_price:10,inventory_qty:25});
    expect(updated.publish_status).toBe("READY_FOR_REVIEW");
    expect(evaluateBotanicaSku(updated).draft_ready).toBe(true);
    expect(evaluateBotanicaSku(updated).live_ready).toBe(false);
  });

  it("requires explicit RIGHTS evidence for book candidates",()=>{
    const family=BOTANICA_MASTER_CATALOG.find(f=>f.id==="book-ifa-spanish")!;
    const sku=createCandidateSku(family,SUPPLIER_CANDIDATES[1]);
    expect(requiredEvidenceForSku(sku)).toContain("RIGHTS");
    const noRights=["SUPPLIER_TERMS","PRICE","INVENTORY","PROVENANCE","CULTURAL_REVIEW","IMAGE_RIGHTS","SAFETY"].map(k=>evidence(k as BotanicaEvidence["kind"]));
    const blocked=applyVerifiedEvidence(sku,noRights,{supplier_url:"https://publisher.example",unit_cost:10,shipping_cost:2,retail_price:25,inventory_qty:9});
    expect(blocked.publish_status).toBe("HOLD");
    expect(evaluateBotanicaSku(blocked).failures).toContain("RIGHTS_VERIFIED");
  });
});
