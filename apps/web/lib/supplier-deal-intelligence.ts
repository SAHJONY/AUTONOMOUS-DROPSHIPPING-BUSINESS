import { convertToUsd } from "./currency-conversion";
import { calculateSupplierFulfillmentDays } from "./supplier-fulfillment-time";
import { calculateSupplierRetailPrice } from "./supplier-pricing";

export const DEFAULT_BOTANICA_WHOLESALE_MARKUP_PERCENT = 20;

export type SupplierDealInput = {
  wholesalePrice: number;
  shippingCost?: number;
  handlingCost?: number;
  markupPercent?: number;
  currency: string;
  usdExchangeRate?: number;
  moq?: number;
  botanicaWholesaleEnabled?: boolean;
  botanicaWholesalePrice?: number;
  botanicaWholesaleMoq?: number;
  competitorPriceUsd?: number;
  competitivePriceRecommendationUsd?: number;
  supplierProcessingDays?: number;
  importTransitDays?: number;
  handlingDays?: number;
  customerShippingDays?: number;
};

const money = (value: number) => Math.round(value * 100) / 100;
const positive = (value: unknown) => Math.max(0, Number(value) || 0);

export function calculateSupplierDealIntelligence(input: SupplierDealInput) {
  const rate = input.currency.trim().toUpperCase() === "USD" ? 1 : positive(input.usdExchangeRate);
  const supplierUnitCostUsd = convertToUsd(positive(input.wholesalePrice), input.currency, rate);
  const inboundShippingUsd = convertToUsd(positive(input.shippingCost), input.currency, rate);
  const handlingUsd = convertToUsd(positive(input.handlingCost), input.currency, rate);
  const landedUnitCostUsd = money(supplierUnitCostUsd + inboundShippingUsd + handlingUsd);
  const formulaRetailUsd = convertToUsd(calculateSupplierRetailPrice(input), input.currency, rate);
  const protectedCompetitive = positive(input.competitivePriceRecommendationUsd);
  const retailPriceUsd = money(Math.max(formulaRetailUsd, protectedCompetitive));
  const enteredWholesaleUsd = input.botanicaWholesaleEnabled
    ? convertToUsd(positive(input.botanicaWholesalePrice), input.currency, rate)
    : 0;
  const recommendedWholesaleUsd = money(landedUnitCostUsd * (1 + DEFAULT_BOTANICA_WHOLESALE_MARKUP_PERCENT / 100));
  const botanicaWholesalePriceUsd = money(Math.max(enteredWholesaleUsd, recommendedWholesaleUsd));
  const supplierOrderQuantity = Math.max(1, Math.ceil(positive(input.moq) || 1));
  const botanicaOrderQuantity = Math.max(1, Math.ceil(positive(input.botanicaWholesaleMoq) || supplierOrderQuantity));
  const retailProfitPerUnitUsd = money(retailPriceUsd - landedUnitCostUsd);
  const wholesaleProfitPerUnitUsd = money(botanicaWholesalePriceUsd - landedUnitCostUsd);
  const totalDays = calculateSupplierFulfillmentDays(input);
  return {
    fxReady: rate > 0,
    supplierUnitCostUsd,
    inboundShippingUsd,
    handlingUsd,
    landedUnitCostUsd,
    retailPriceUsd,
    retailProfitPerUnitUsd,
    retailMarginPercent: retailPriceUsd > 0 ? money(retailProfitPerUnitUsd / retailPriceUsd * 100) : 0,
    botanicaWholesalePriceUsd,
    wholesaleProfitPerUnitUsd,
    wholesaleMarginPercent: botanicaWholesalePriceUsd > 0 ? money(wholesaleProfitPerUnitUsd / botanicaWholesalePriceUsd * 100) : 0,
    supplierOrderQuantity,
    supplierMinimumInvestmentUsd: money(landedUnitCostUsd * supplierOrderQuantity),
    retailProfitPerSupplierOrderUsd: money(retailProfitPerUnitUsd * supplierOrderQuantity),
    botanicaOrderQuantity,
    botanicaOrderRevenueUsd: money(botanicaWholesalePriceUsd * botanicaOrderQuantity),
    botanicaOrderProfitUsd: money(wholesaleProfitPerUnitUsd * botanicaOrderQuantity),
    totalDays,
  };
}
