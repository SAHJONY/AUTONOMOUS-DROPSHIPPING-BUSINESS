import os
import tempfile

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Configure the environment BEFORE importing the app so settings pick it up.
_tmpdir = tempfile.mkdtemp(prefix="commerce-os-test-")
os.environ["DATABASE_URL"] = f"sqlite:///{_tmpdir}/test.db"
os.environ["SECRET_KEY"] = "test-secret-key-that-is-long-enough-for-hs256"
os.environ.pop("ANTHROPIC_API_KEY", None)

from app.core.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402

engine = create_engine(
    os.environ["DATABASE_URL"], connect_args={"check_same_thread": False}
)
TestSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@pytest.fixture(autouse=True)
def _fresh_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture
def db():
    session = TestSession()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    def override_get_db():
        session = TestSession()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers(client):
    """Register a user + org and return (headers, org_id)."""
    resp = client.post(
        "/auth/register",
        json={
            "email": "founder@example.com",
            "password": "supersecret1",
            "full_name": "Founder",
            "organization_name": "Acme Dropshipping",
        },
    )
    assert resp.status_code == 201, resp.text
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    orgs = client.get("/orgs", headers=headers).json()
    return headers, orgs[0]["id"]
