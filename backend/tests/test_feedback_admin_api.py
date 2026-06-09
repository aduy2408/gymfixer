from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from admin_routes import router as admin_router
from authentication.database import get_db
from authentication.utils import get_current_user
from feedback_routes import router as feedback_router


def make_user(**overrides):
    data = {
        "id": 42,
        "name": "Test User",
        "email": "test@example.com",
        "role": "user",
        "created_at": datetime(2026, 6, 1, tzinfo=timezone.utc),
    }
    data.update(overrides)
    return SimpleNamespace(**data)


class QueryStub:
    def __init__(self, scalar_value=0, rows=None):
        self.scalar_value = scalar_value
        self.rows = rows or []

    def filter(self, *args, **kwargs):
        return self

    def select_from(self, *args, **kwargs):
        return self

    def group_by(self, *args, **kwargs):
        return self

    def order_by(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    def join(self, *args, **kwargs):
        return self

    def all(self):
        return self.rows

    def scalar(self):
        return self.scalar_value


class FakeDb:
    def __init__(self):
        self.added = []

    def add(self, row):
        self.added.append(row)
        if getattr(row, "id", None) is None:
            row.id = 1
        if getattr(row, "created_at", None) is None:
            row.created_at = datetime(2026, 6, 1, tzinfo=timezone.utc)

    def commit(self):
        pass

    def refresh(self, row):
        pass

    def query(self, *models):
        return QueryStub()


def make_app(current_user, db):
    app = FastAPI()
    app.include_router(feedback_router)
    app.include_router(admin_router)
    app.dependency_overrides[get_current_user] = lambda: current_user
    app.dependency_overrides[get_db] = lambda: db
    return app


def test_feedback_requires_valid_payload():
    client = TestClient(make_app(make_user(), FakeDb()))

    response = client.post("/feedback", json={"rating": 6, "message": "", "source": "popup"})

    assert response.status_code == 422


def test_feedback_submit_persists_row_and_usage_event():
    db = FakeDb()
    client = TestClient(make_app(make_user(), db))

    response = client.post("/feedback", json={"rating": 5, "message": "Great app", "source": "sidebar"})

    assert response.status_code == 200
    assert response.json()["rating"] == 5
    assert any(row.__class__.__name__ == "UserFeedback" for row in db.added)
    assert any(getattr(row, "event_name", "") == "feedback_submitted" for row in db.added)


def test_admin_routes_reject_regular_user():
    client = TestClient(make_app(make_user(role="user"), FakeDb()))

    feedback_response = client.get("/admin/feedback")
    analytics_response = client.get("/admin/analytics")

    assert feedback_response.status_code == 403
    assert analytics_response.status_code == 403


def test_admin_feedback_lists_user_context():
    feedback = SimpleNamespace(
        id=1,
        user_id=42,
        rating=4,
        message="Useful",
        source="popup",
        created_at=datetime(2026, 6, 1, tzinfo=timezone.utc),
    )
    user = make_user(role="admin")

    class AdminDb(FakeDb):
        def query(self, *models):
            return QueryStub(rows=[(feedback, user)])

    client = TestClient(make_app(user, AdminDb()))

    response = client.get("/admin/feedback")

    assert response.status_code == 200
    assert response.json()[0]["user_email"] == "test@example.com"


def test_admin_analytics_returns_grouped_counts():
    class AdminDb(FakeDb):
        calls = 0

        def query(self, *models):
            self.calls += 1
            if self.calls == 1:
                return QueryStub(scalar_value=3)
            if self.calls == 2:
                return QueryStub(scalar_value=1)
            if self.calls == 3:
                return QueryStub(scalar_value=2)
            if self.calls == 4:
                return QueryStub(rows=[("facebook", 2), ("tiktok", 1)])
            if self.calls == 5:
                return QueryStub(rows=[("analysis_completed", 5)])
            if self.calls == 6:
                return QueryStub(scalar_value=2)
            if self.calls == 7:
                return QueryStub(scalar_value=4.5)
            if self.calls == 8:
                return QueryStub(rows=[("sidebar", 2)])
            if self.calls == 9:
                return QueryStub(rows=[(5, 2)])
            return QueryStub(rows=[])

    client = TestClient(make_app(make_user(role="admin"), AdminDb()))

    response = client.get("/admin/analytics")

    assert response.status_code == 200
    payload = response.json()
    assert payload["user_counts"]["total"] == 3
    assert payload["user_counts"]["new"] == 2
    assert payload["discovery_sources"][0]["source"] == "facebook"
    assert payload["feature_usage"][0]["feature"] == "Video Analysis"
    assert payload["usage_events"][0]["event_name"] == "analysis_completed"
    assert payload["feedback_summary"]["average_rating"] == 4.5
