"""Deterministic product opportunity scoring.

Agents call this as a tool instead of inventing scores, so launch decisions
are reproducible and auditable. Weights follow the product strategy:
demand 30%, competition 20%, margin 25%, trend 15%, risk 10%.

All factor inputs are 0-100. `competition` and `risk` are supplied as raw
levels (higher = worse) and inverted internally.
"""

from dataclasses import asdict, dataclass

from app.core.config import get_settings

WEIGHTS = {
    "demand": 0.30,
    "competition": 0.20,
    "margin": 0.25,
    "trend": 0.15,
    "risk": 0.10,
}

VERDICT_LAUNCH = "launch"
VERDICT_WATCH = "watch"
VERDICT_REJECT = "reject"

WATCH_THRESHOLD = 70.0


@dataclass
class ProductScore:
    demand: float
    competition: float
    margin: float
    trend: float
    risk: float
    total_score: float
    verdict: str
    rationale: str

    def as_dict(self) -> dict:
        return asdict(self)


def _clamp(value: float) -> float:
    return max(0.0, min(100.0, float(value)))


def margin_score_from_prices(cost: float, price: float) -> float:
    """Map a gross margin percentage onto a 0-100 score.

    Dropshipping viability roughly requires >= 60% gross margin for a top
    score; 30% is breakeven territory once ads are factored in.
    """
    if price <= 0:
        return 0.0
    margin_pct = (price - max(cost, 0.0)) / price * 100
    return _clamp((margin_pct / 60.0) * 100)


def score_product(
    demand: float,
    competition: float,
    margin: float,
    trend: float,
    risk: float,
) -> ProductScore:
    demand = _clamp(demand)
    competition = _clamp(competition)
    margin = _clamp(margin)
    trend = _clamp(trend)
    risk = _clamp(risk)

    total = (
        demand * WEIGHTS["demand"]
        + (100 - competition) * WEIGHTS["competition"]
        + margin * WEIGHTS["margin"]
        + trend * WEIGHTS["trend"]
        + (100 - risk) * WEIGHTS["risk"]
    )
    total = round(total, 2)

    threshold = get_settings().launch_score_threshold
    if total >= threshold:
        verdict = VERDICT_LAUNCH
        rationale = f"Score {total} meets the launch threshold of {threshold}."
    elif total >= WATCH_THRESHOLD:
        verdict = VERDICT_WATCH
        rationale = (
            f"Score {total} is promising but below the launch threshold of {threshold}; "
            "monitor and re-evaluate."
        )
    else:
        verdict = VERDICT_REJECT
        rationale = f"Score {total} is below the watch threshold of {WATCH_THRESHOLD}."

    return ProductScore(
        demand=demand,
        competition=competition,
        margin=margin,
        trend=trend,
        risk=risk,
        total_score=total,
        verdict=verdict,
        rationale=rationale,
    )
