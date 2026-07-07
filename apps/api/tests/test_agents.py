from sqlalchemy import select

from app.agents.orchestrator import REGISTRY, execute_approved_action, run_agent
from app.models import (
    ApprovalRequest,
    ApprovalStatus,
    MemoryEntry,
    Product,
    ProductStatus,
    RunStatus,
)
from tests.fakes import FakeAnthropic, FakeResponse, FakeTextBlock, FakeToolUseBlock


def test_registry_contains_all_agents():
    expected = {
        "ceo",
        "product_hunter",
        "supplier",
        "store_builder",
        "marketing",
        "advertising",
        "finance",
        "support",
    }
    assert expected == set(REGISTRY)


def test_list_agents_endpoint(client):
    resp = client.get("/agents")
    assert resp.status_code == 200
    agents = {a["name"]: a for a in resp.json()}
    assert "score_product_opportunity" in agents["product_hunter"]["tools"]
    assert "issue_refund" in agents["support"]["high_risk_tools"]
    assert "set_ad_budget" in agents["advertising"]["high_risk_tools"]


def test_product_hunter_saves_scored_product(db, client, auth_headers):
    _, org_id = auth_headers
    fake = FakeAnthropic(
        [
            FakeResponse(
                content=[
                    FakeToolUseBlock(
                        id="tu_1",
                        name="save_product",
                        input={
                            "title": "Magnetic Phone Mount",
                            "demand": 95,
                            "competition": 15,
                            "margin": 92,
                            "trend": 88,
                            "risk": 8,
                            "cost": 3.2,
                            "price": 19.99,
                        },
                    )
                ],
                stop_reason="tool_use",
            ),
            FakeResponse(
                content=[FakeTextBlock(text="Saved a launch-ready product.")],
                stop_reason="end_turn",
            ),
        ]
    )

    run = run_agent(
        db, org_id=org_id, agent_name="product_hunter", task="Find winners", client=fake
    )

    assert run.status == RunStatus.completed
    assert run.iterations == 2
    assert run.input_tokens == 200 and run.output_tokens == 100

    product = db.scalar(select(Product).where(Product.org_id == org_id))
    assert product is not None
    assert product.status == ProductStatus.ready_to_launch
    analysis = product.analyses[0]
    assert analysis.total_score >= 85
    assert analysis.verdict == "launch"


def test_high_risk_tool_is_gated_and_approval_executes_it(db, client, auth_headers):
    headers, org_id = auth_headers
    fake = FakeAnthropic(
        [
            FakeResponse(
                content=[
                    FakeToolUseBlock(
                        id="tu_1",
                        name="issue_refund",
                        input={"order_id": "ORD-1", "amount": 25.0, "reason": "damaged item"},
                    )
                ],
                stop_reason="tool_use",
            ),
            FakeResponse(
                content=[FakeTextBlock(text="Refund queued for approval.")],
                stop_reason="end_turn",
            ),
        ]
    )

    run = run_agent(db, org_id=org_id, agent_name="support", task="Handle refund", client=fake)
    assert run.status == RunStatus.awaiting_approval

    # The refund was NOT executed — no memory entry yet, but an approval exists.
    assert db.scalar(select(MemoryEntry).where(MemoryEntry.org_id == org_id)) is None
    approval = db.scalar(select(ApprovalRequest).where(ApprovalRequest.org_id == org_id))
    assert approval is not None
    assert approval.status == ApprovalStatus.pending
    assert approval.action == "issue_refund"

    # Approve via API — this executes the stored action.
    resp = client.post(
        f"/orgs/{org_id}/approvals/{approval.id}/decide",
        json={"decision": "approve"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "approved"
    assert "Refund of $25.00" in resp.json()["result"]

    db.expire_all()
    entry = db.scalar(select(MemoryEntry).where(MemoryEntry.org_id == org_id))
    assert entry is not None and "ORD-1" in entry.content
    db.refresh(run)
    assert run.status == RunStatus.completed


def test_rejecting_approval_does_not_execute(db, client, auth_headers):
    headers, org_id = auth_headers
    fake = FakeAnthropic(
        [
            FakeResponse(
                content=[
                    FakeToolUseBlock(
                        id="tu_1",
                        name="set_ad_budget",
                        input={"channel": "meta", "daily_budget": 500.0},
                    )
                ],
                stop_reason="tool_use",
            ),
            FakeResponse(
                content=[FakeTextBlock(text="Budget change queued.")], stop_reason="end_turn"
            ),
        ]
    )
    run_agent(db, org_id=org_id, agent_name="advertising", task="Scale ads", client=fake)
    approval = db.scalar(select(ApprovalRequest).where(ApprovalRequest.org_id == org_id))

    resp = client.post(
        f"/orgs/{org_id}/approvals/{approval.id}/decide",
        json={"decision": "reject", "reason": "budget too high"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "rejected"
    assert db.scalar(select(MemoryEntry).where(MemoryEntry.org_id == org_id)) is None

    # Deciding twice conflicts.
    resp = client.post(
        f"/orgs/{org_id}/approvals/{approval.id}/decide",
        json={"decision": "approve"},
        headers=headers,
    )
    assert resp.status_code == 409


def test_double_execute_raises(db, auth_headers):
    _, org_id = auth_headers
    approval = ApprovalRequest(
        org_id=org_id,
        agent_name="support",
        action="issue_refund",
        payload={"order_id": "ORD-9", "amount": 10.0},
    )
    db.add(approval)
    db.commit()

    execute_approved_action(db, approval, decided_by="tester")
    try:
        execute_approved_action(db, approval, decided_by="tester")
        raise AssertionError("expected ValueError")
    except ValueError:
        pass


def test_run_endpoint_without_api_key_returns_503(client, auth_headers):
    headers, org_id = auth_headers
    resp = client.post(
        f"/orgs/{org_id}/agents/ceo/run", json={"task": "Daily review"}, headers=headers
    )
    assert resp.status_code == 503

    # The failed run is still recorded for auditability.
    runs = client.get(f"/orgs/{org_id}/runs", headers=headers).json()
    assert len(runs) == 1
    assert runs[0]["status"] == "failed"


def test_unknown_agent_404(client, auth_headers):
    headers, org_id = auth_headers
    resp = client.post(
        f"/orgs/{org_id}/agents/nonexistent/run", json={"task": "x"}, headers=headers
    )
    assert resp.status_code == 404
