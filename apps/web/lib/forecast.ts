/**
 * Live financial forecast. Derives unit economics from the real product
 * catalog and projects a 12-month, three-scenario model (conservative / base /
 * aggressive). Deterministic — the same inputs always yield the same forecast.
 */
import type { Product } from "./types";

const FEE_RATE = 0.03; // payment processing
const REFUND_RATE = 0.04; // refund / chargeback reserve
const MONTHS = 12;

export interface ForecastMonth {
  month: number;
  ad_spend: number;
  orders: number;
  revenue: number;
  net: number;
  cumulative: number;
}

export interface ForecastScenario {
  key: string;
  label: string;
  roas: number;
  cpa: number;
  net_per_order: number;
  months: ForecastMonth[];
  annual: { ad_spend: number; orders: number; revenue: number; net: number; net_margin: number };
  breakeven_month: number | null;
  exit_run_rate_revenue: number;
  exit_run_rate_net: number;
}

export interface Forecast {
  assumptions: {
    aov: number;
    cogs: number;
    fee_rate: number;
    refund_rate: number;
    contribution_before_ad: number;
    derived_from_catalog: boolean;
  };
  catalog: { products_total: number; ready_to_launch: number; launched: number };
  scenarios: ForecastScenario[];
  generated_for_months: number;
}

const SCENARIO_CFG = [
  { key: "conservative", label: "Conservative", roas: 1.9, startAd: 1500, growth: 1.22 },
  { key: "base", label: "Base", roas: 2.2, startAd: 2000, growth: 1.35 },
  { key: "aggressive", label: "Aggressive", roas: 2.9, startAd: 2500, growth: 1.45 },
];

const r2 = (n: number) => Math.round(n * 100) / 100;
const r0 = (n: number) => Math.round(n);

function deriveEconomics(products: Product[]): { aov: number; cogs: number; derived: boolean } {
  const priced = products.filter((p) => p.price > 0);
  if (!priced.length) return { aov: 40, cogs: 14, derived: false };
  const aov = priced.reduce((s, p) => s + p.price, 0) / priced.length;
  const withCost = priced.filter((p) => p.cost > 0);
  const cogs = withCost.length
    ? withCost.reduce((s, p) => s + p.cost, 0) / withCost.length
    : aov * 0.35;
  return { aov: r2(aov), cogs: r2(Math.min(cogs, aov * 0.9)), derived: true };
}

function buildScenario(
  cfg: (typeof SCENARIO_CFG)[number],
  aov: number,
  cogs: number,
): ForecastScenario {
  const cpa = aov / cfg.roas;
  const contributionBeforeAd = aov - cogs - aov * FEE_RATE - aov * REFUND_RATE;
  const netPerOrder = contributionBeforeAd - cpa;

  const months: ForecastMonth[] = [];
  let cumulative = 0;
  let breakeven: number | null = null;

  for (let m = 1; m <= MONTHS; m++) {
    const adSpend = cfg.startAd * Math.pow(cfg.growth, m - 1);
    const orders = adSpend / cpa;
    const revenue = orders * aov;
    const opex = 350 + (m - 1) * 45; // lean infra + tools ramp (Vercel/Upstash/engine/Shopify/apps)
    const net = orders * netPerOrder - opex;
    cumulative += net;
    if (breakeven === null && cumulative > 0) breakeven = m;
    months.push({
      month: m,
      ad_spend: r0(adSpend),
      orders: r0(orders),
      revenue: r0(revenue),
      net: r0(net),
      cumulative: r0(cumulative),
    });
  }

  const annualRevenue = months.reduce((s, x) => s + x.revenue, 0);
  const annualNet = months.reduce((s, x) => s + x.net, 0);
  const last = months[months.length - 1];

  return {
    key: cfg.key,
    label: cfg.label,
    roas: cfg.roas,
    cpa: r2(cpa),
    net_per_order: r2(netPerOrder),
    months,
    annual: {
      ad_spend: months.reduce((s, x) => s + x.ad_spend, 0),
      orders: months.reduce((s, x) => s + x.orders, 0),
      revenue: annualRevenue,
      net: annualNet,
      net_margin: annualRevenue ? r2((annualNet / annualRevenue) * 100) : 0,
    },
    breakeven_month: breakeven,
    exit_run_rate_revenue: last.revenue * 12,
    exit_run_rate_net: last.net * 12,
  };
}

export function buildForecast(products: Product[]): Forecast {
  const { aov, cogs, derived } = deriveEconomics(products);
  return {
    assumptions: {
      aov,
      cogs,
      fee_rate: FEE_RATE,
      refund_rate: REFUND_RATE,
      contribution_before_ad: r2(aov - cogs - aov * FEE_RATE - aov * REFUND_RATE),
      derived_from_catalog: derived,
    },
    catalog: {
      products_total: products.length,
      ready_to_launch: products.filter((p) => p.status === "ready_to_launch").length,
      launched: products.filter((p) => p.status === "launched").length,
    },
    scenarios: SCENARIO_CFG.map((c) => buildScenario(c, aov, cogs)),
    generated_for_months: MONTHS,
  };
}
