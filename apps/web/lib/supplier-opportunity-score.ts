import { calculateSupplierDealIntelligence, type SupplierDealInput } from "./supplier-deal-intelligence";
import { wholesaleBrandReadiness } from "./wholesale-brand-readiness";

export type SupplierOpportunityInput = SupplierDealInput & {
  brandMode?: string;
  resaleAuthorizationStatus?: string;
  authorizationReference?: string;
};

const clamp = (value:number,min=0,max=100)=>Math.min(max,Math.max(min,value));
const rounded = (value:number)=>Math.round(value*100)/100;

export function scoreSupplierOpportunity(input:SupplierOpportunityInput){
  const deal=calculateSupplierDealIntelligence(input);
  const brand=wholesaleBrandReadiness(input);
  const blockers:string[]=[];
  if(!deal.fxReady)blockers.push("Falta tasa USD verificada.");
  if(deal.landedUnitCostUsd<=0)blockers.push("Falta costo puesto en almacén.");
  if(deal.totalDays<=0)blockers.push("Faltan tiempos de abastecimiento y entrega.");
  if(!brand.ready)blockers.push("Marca propia o autorización comercial pendiente.");
  const marginScore=clamp(deal.retailMarginPercent/35*30,0,30);
  const capitalRoi=deal.supplierMinimumInvestmentUsd>0?deal.retailProfitPerSupplierOrderUsd/deal.supplierMinimumInvestmentUsd*100:0;
  const capitalScore=clamp(capitalRoi/40*25,0,25);
  const speedScore=deal.totalDays>0?clamp((90-deal.totalDays)/90*20,0,20):0;
  const competitor=Number(input.competitorPriceUsd)||0;
  const competitiveGap=competitor>0?(competitor-deal.retailPriceUsd)/competitor*100:0;
  const competitionScore=competitor<=0?8:clamp(10+competitiveGap,0,15);
  const complianceScore=brand.ready?10:0;
  const score=blockers.some(item=>/tasa USD|costo puesto/.test(item))?0:Math.round(marginScore+capitalScore+speedScore+competitionScore+complianceScore);
  const verdict=score>=75&&brand.ready?"PRIORIZAR":score>=55?"REVISAR":score>0?"ESPERAR":"BLOQUEADO";
  return {
    score,verdict,blockers,capitalRoiPercent:rounded(capitalRoi),competitiveGapPercent:rounded(competitiveGap),
    profitPerCapitalDayUsd:deal.totalDays>0?rounded(deal.retailProfitPerSupplierOrderUsd/deal.totalDays):0,
    estimatedAnnualCapitalTurns:deal.totalDays>0?rounded(365/deal.totalDays):0,
  } as const;
}
