import { describe,expect,it } from "vitest";
import { scoreSupplierOpportunity } from "../lib/supplier-opportunity-score";

const ready={wholesalePrice:10,shippingCost:1,handlingCost:1,currency:"USD",usdExchangeRate:1,moq:12,botanicaWholesaleEnabled:true,botanicaWholesalePrice:15,botanicaWholesaleMoq:12,supplierProcessingDays:2,importTransitDays:3,handlingDays:1,customerShippingDays:3,brandMode:"PRIVATE_LABEL",resaleAuthorizationStatus:"VERIFIED",authorizationReference:"Contrato"};
describe("supplier opportunity score",()=>{
 it("prioritizes a fast authorized profitable opportunity",()=>{const result=scoreSupplierOpportunity({...ready,competitorPriceUsd:18});expect(result.score).toBeGreaterThanOrEqual(75);expect(result.verdict).toBe("PRIORIZAR");expect(result.profitPerCapitalDayUsd).toBeGreaterThan(0);});
 it("blocks products without verified USD conversion",()=>{const result=scoreSupplierOpportunity({...ready,currency:"NGN",usdExchangeRate:0});expect(result.score).toBe(0);expect(result.verdict).toBe("BLOQUEADO");});
 it("does not prioritize unauthorized own-brand products",()=>{const result=scoreSupplierOpportunity({...ready,resaleAuthorizationStatus:"PENDING"});expect(result.verdict).not.toBe("PRIORIZAR");expect(result.blockers).toContain("Marca propia o autorización comercial pendiente.");});
});
