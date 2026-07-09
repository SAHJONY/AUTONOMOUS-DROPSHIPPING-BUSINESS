/**
 * Deterministic product opportunity scoring — ported verbatim from the API.
 * Agents call this as a tool instead of inventing scores, so launch decisions
 * are reproducible and auditable.
 *
 * Weights: demand 30%, competition 20%, margin 25%, trend 15%, risk 10%.
 * All inputs are 0-100. `competition` and `risk` are raw levels (higher = worse)
 * and are inverted internally.
 */
import { LAUNCH_SCORE_THRESHOLD } from "./config";

export const WEIGHTS = {
  demand: 0.3,
  competition: 0.2,
  margin: 0.25,
  trend: 0.15,
  risk: 0.1,
} as const;

export const VERDICT_LAUNCH = "launch";
export const VERDICT_WATCH = "watch";
export const VERDICT_REJECT = "reject";
export const WATCH_THRESHOLD = 70.0;

export interface ProductScore {
  demand: number;
  competition: number;
  margin: number;
  trend: number;
  risk: number;
  total_score: number;
  verdict: string;
  rationale: string;
}

const clamp = (v: number) => Math.max(0, Math.min(100, Number(v) || 0));

export function marginScoreFromPrices(cost: number, price: number): number {
  if (price <= 0) return 0;
  const marginPct = ((price - Math.max(cost, 0)) / price) * 100;
  return clamp((marginPct / 60) * 100);
}

export function scoreProduct(input: {
  demand: number;
  competition: number;
  margin: number;
  trend: number;
  risk: number;
}): ProductScore {
  const demand = clamp(input.demand);
  const competition = clamp(input.competition);
  const margin = clamp(input.margin);
  const trend = clamp(input.trend);
  const risk = clamp(input.risk);

  const total =
    Math.round(
      (demand * WEIGHTS.demand +
        (100 - competition) * WEIGHTS.competition +
        margin * WEIGHTS.margin +
        trend * WEIGHTS.trend +
        (100 - risk) * WEIGHTS.risk) *
        100,
    ) / 100;

  let verdict: string;
  let rationale: string;
  if (total >= LAUNCH_SCORE_THRESHOLD) {
    verdict = VERDICT_LAUNCH;
    rationale = `Score ${total} meets the launch threshold of ${LAUNCH_SCORE_THRESHOLD}.`;
  } else if (total >= WATCH_THRESHOLD) {
    verdict = VERDICT_WATCH;
    rationale = `Score ${total} is promising but below the launch threshold of ${LAUNCH_SCORE_THRESHOLD}; monitor and re-evaluate.`;
  } else {
    verdict = VERDICT_REJECT;
    rationale = `Score ${total} is below the watch threshold of ${WATCH_THRESHOLD}.`;
  }

  return { demand, competition, margin, trend, risk, total_score: total, verdict, rationale };
}
