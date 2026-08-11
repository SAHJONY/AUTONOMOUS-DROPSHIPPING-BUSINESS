export type DealProfitInput = {
  quantity: number;
  unitPrice: number;
  unitCost: number;
  supplierShipping: number;
  customerShipping: number;
  handling: number;
  paymentFeePercent: number;
  advertising: number;
  taxesAndDuties: number;
  otherCosts: number;
};

const safe = (value: number) => Math.max(0, Number(value) || 0);
const money = (value: number) => Math.round(value * 100) / 100;

export function calculateDealProfit(input: DealProfitInput) {
  const quantity = Math.max(1, Math.floor(safe(input.quantity)));
  const revenue = quantity * safe(input.unitPrice);
  const merchandiseCost = quantity * safe(input.unitCost);
  const paymentFees = revenue * safe(input.paymentFeePercent) / 100;
  const totalCosts = merchandiseCost + safe(input.supplierShipping) + safe(input.customerShipping) +
    safe(input.handling) + paymentFees + safe(input.advertising) + safe(input.taxesAndDuties) + safe(input.otherCosts);
  const netProfit = revenue - totalCosts;
  return {
    quantity,
    revenue: money(revenue),
    merchandiseCost: money(merchandiseCost),
    paymentFees: money(paymentFees),
    totalCosts: money(totalCosts),
    netProfit: money(netProfit),
    profitPerUnit: money(netProfit / quantity),
    marginPercent: revenue > 0 ? money(netProfit / revenue * 100) : 0,
    breakEvenUnitPrice: money(totalCosts / quantity),
  };
}
