from app.services import scoring


def test_weights_sum_to_one():
    assert abs(sum(scoring.WEIGHTS.values()) - 1.0) < 1e-9


def test_perfect_product_scores_100_and_launches():
    result = scoring.score_product(demand=100, competition=0, margin=100, trend=100, risk=0)
    assert result.total_score == 100.0
    assert result.verdict == scoring.VERDICT_LAUNCH


def test_weak_product_is_rejected():
    result = scoring.score_product(demand=20, competition=90, margin=10, trend=15, risk=80)
    assert result.total_score < 70
    assert result.verdict == scoring.VERDICT_REJECT


def test_mid_product_is_watch():
    # demand 80*.3 + (100-40)*.2 + 70*.25 + 60*.15 + (100-30)*.1 = 69.5 -> just below watch
    result = scoring.score_product(demand=80, competition=40, margin=75, trend=65, risk=30)
    assert 70 <= result.total_score < 85
    assert result.verdict == scoring.VERDICT_WATCH


def test_inputs_are_clamped():
    result = scoring.score_product(demand=150, competition=-10, margin=120, trend=200, risk=-5)
    assert result.total_score == 100.0


def test_margin_score_from_prices():
    assert scoring.margin_score_from_prices(cost=0, price=100) == 100.0
    assert scoring.margin_score_from_prices(cost=40, price=100) == 100.0  # 60% margin caps
    assert scoring.margin_score_from_prices(cost=70, price=100) == 50.0  # 30% margin -> 50
    assert scoring.margin_score_from_prices(cost=10, price=0) == 0.0
