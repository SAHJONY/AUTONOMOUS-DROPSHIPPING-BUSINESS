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

  it("preserves verified commercial values when later evidence arrives without resubmitting pricing",()=>{
    const family=BOTANICA_MASTER_CATALOG.find(f=>f.id==="candle-plain")!;
    const sku=createCandidateSku(family,SUPPLIER_CANDIDATES[0]);
    const priced=applyVerifiedEvidence(sku,[evidence("SUPPLIER_TERMS"),evidence("PRICE"),evidence("INVENTORY")],{supplier_url:"https://supplier.example",supplier_sku:"C-7D",unit_cost:3,shipping_cost:1,retail_price:10,inventory_qty:25});
    const laterEvidence=[evidence("SUPPLIER_TERMS"),evidence("PRICE"),evidence("INVENTORY"),evidence("PROVENANCE"),evidence("CULTURAL_REVIEW"),evidence("IMAGE_RIGHTS"),evidence("SAFETY")];
    const updated=applyVerifiedEvidence(priced,laterEvidence);
    expect(updated.unit_cost).toBe(3);
    expect(updated.landed_cost).toBe(4);
    expect(updated.retail_price).toBe(10);
    expect(updated.inventory_qty).toBe(25);
    expect(updated.publish_status).toBe("READY_FOR_REVIEW");
  });

  it("marks live readiness only after owner-controlled Shopify draft state",()=>{
    const family=BOTANICA_MASTER_CATALOG.find(f=>f.id==="candle-plain")!;
    const sku=createCandidateSku(family,SUPPLIER_CANDIDATES[0]);
    const all=["SUPPLIER_TERMS","PRICE","INVENTORY","PROVENANCE","CULTURAL_REVIEW","IMAGE_RIGHTS","SAFETY"].map(k=>evidence(k as BotanicaEvidence["kind"]));
    const ready=applyVerifiedEvidence(sku,all,{supplier_url:"https://supplier.example",unit_cost:3,shipping_cost:1,retail_price:10,inventory_qty:25});
    expect(evaluateBotanicaSku(ready).live_ready).toBe(false);
    expect(evaluateBotanicaSku({...ready,publish_status:"SHOPIFY_DRAFT"}).live_ready).toBe(true);
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
