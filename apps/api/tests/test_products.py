def test_create_and_list_products(client, auth_headers):
    headers, org_id = auth_headers
    resp = client.post(
        f"/orgs/{org_id}/products",
        json={"title": "LED Dog Collar", "cost": 4.5, "price": 24.99, "source": "aliexpress"},
        headers=headers,
    )
    assert resp.status_code == 201
    product = resp.json()
    assert product["status"] == "discovered"

    resp = client.get(f"/orgs/{org_id}/products", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_score_endpoint(client, auth_headers):
    headers, org_id = auth_headers
    resp = client.post(
        f"/orgs/{org_id}/products/score",
        json={"demand": 95, "competition": 20, "margin": 90, "trend": 85, "risk": 10},
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_score"] >= 85
    assert body["verdict"] == "launch"


def test_score_endpoint_validates_range(client, auth_headers):
    headers, org_id = auth_headers
    resp = client.post(
        f"/orgs/{org_id}/products/score",
        json={"demand": 200, "competition": 20, "margin": 90, "trend": 85, "risk": 10},
        headers=headers,
    )
    assert resp.status_code == 422


def test_dashboard(client, auth_headers):
    headers, org_id = auth_headers
    client.post(
        f"/orgs/{org_id}/products",
        json={"title": "Posture Corrector"},
        headers=headers,
    )
    resp = client.get(f"/orgs/{org_id}/dashboard", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["products_total"] == 1
    assert body["pending_approvals"] == 0
