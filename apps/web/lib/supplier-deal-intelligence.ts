import { convertToUsd } from "./currency-conversion";
import { calculateSupplierFulfillmentDays } from "./supplier-fulfillment-time";
import { calculateSupplierRetailPrice } from "./supplier-pricing";

export const DEFAULT_BOTANICA_WHOLESALE_MARKUP_PERCENT = 20;

/**
 * How the supplier quoted inbound freight.
 *
 * Air freight is normally quoted per unit; sea freight and consolidated
 * shipments are quoted for the whole batch. Getting this wrong is expensive in
 * both directions — a $500 container read as per-unit makes a good deal look
 * impossible, and a per-unit air rate read as a batch total hides the real cost.
 */
export type FreightMode = "PER_UNIT" | "PER_SHIPMENT";

export type SupplierDealInput = {
  wholesalePrice: number;
  shippingCost?: number;
  /** Defaults to PER_UNIT, which is how this field has always been read. */
  freightMode?: FreightMode;
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
  const orderQuantity = Math.max(1, Math.ceil(positive(input.moq) || 1));
  // A batch-priced shipment only becomes a unit cost once it is spread over the
  // units it carries. Amortize before anything else uses the number.
  const freightPerUnit = input.freightMode === "PER_SHIPMENT"
    ? positive(input.shippingCost) / orderQuantity
    : positive(input.shippingCost);
  const inboundShippingUsd = convertToUsd(freightPerUnit, input.currency, rate);
  const handlingUsd = convertToUsd(positive(input.handlingCost), input.currency, rate);
  const landedUnitCostUsd = money(supplierUnitCostUsd + inboundShippingUsd + handlingUsd);
  const formulaRetailUsd = convertToUsd(calculateSupplierRetailPrice({ ...input, shippingCost: freightPerUnit }), input.currency, rate);
  const protectedCompetitive = positive(input.competitivePriceRecommendationUsd);
  const retailPriceUsd = money(Math.max(formulaRetailUsd, protectedCompetitive));
  const enteredWholesaleUsd = input.botanicaWholesaleEnabled
    ? convertToUsd(positive(input.botanicaWholesalePrice), input.currency, rate)
    : 0;
  const recommendedWholesaleUsd = money(landedUnitCostUsd * (1 + DEFAULT_BOTANICA_WHOLESALE_MARKUP_PERCENT / 100));
  const botanicaWholesalePriceUsd = money(Math.max(enteredWholesaleUsd, recommendedWholesaleUsd));
  const supplierOrderQuantity = orderQuantity;
  const botanicaOrderQuantity = Math.max(1, Math.ceil(positive(input.botanicaWholesaleMoq) || supplierOrderQuantity));
  const retailProfitPerUnitUsd = money(retailPriceUsd - landedUnitCostUsd);
  const wholesaleProfitPerUnitUsd = money(botanicaWholesalePriceUsd - landedUnitCostUsd);
  const totalDays = calculateSupplierFulfillmentDays(input);
  return {
    fxReady: rate > 0,
    supplierUnitCostUsd,
    inboundShippingUsd,
    freightMode: input.freightMode ?? "PER_UNIT",
    inboundFreightPerOrderUsd: money(inboundShippingUsd * orderQuantity),
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
