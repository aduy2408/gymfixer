from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

import entitlements as entitlement_module
from authentication.database import get_db
from authentication.routes import router as auth_router
from authentication.utils import get_current_user


def make_user(**overrides):
    data = {
        "id": 42,
        "name": "Test User",
        "email": "test@example.com",
        "subscription_tier": "free",
        "trial_started_at": None,
        "trial_ends_at": None,
        "premium_expires_at": None,
        "created_at": datetime(2026, 6, 1, tzinfo=timezone.utc),
    }
    data.update(overrides)
    return SimpleNamespace(**data)


def make_app(current_user):
    app = FastAPI()
    app.include_router(auth_router)
    fake_db = SimpleNamespace(
        flush=lambda: None,
        commit=lambda: None,
        add=lambda row: None,
    )
    app.dependency_overrides[get_current_user] = lambda: current_user
    app.dependency_overrides[get_db] = lambda: fake_db
    return app


def patch_zero_usage(monkeypatch):
    monkeypatch.setattr(entitlement_module, "_count_video_analyses", lambda db, user, since: 0)
    monkeypatch.setattr(entitlement_module, "_count_ai_coaching", lambda db, user, since: 0)
    monkeypatch.setattr(entitlement_module, "_count_workout_plans", lambda db, user, since: 0)
    monkeypatch.setattr(entitlement_module, "_count_meal_plans", lambda db, user, since: 0)


def test_get_subscription_endpoint_returns_limits(monkeypatch):
    patch_zero_usage(monkeypatch)
    client = TestClient(make_app(make_user()))

    response = client.get("/auth/subscription")

    assert response.status_code == 200
    payload = response.json()
    assert payload["tier"] == "free"
    assert payload["limits"]["video_analyses"] == 5
    assert payload["features"]["vitpose"] is False


def test_start_trial_endpoint_updates_user_and_logs(monkeypatch):
    patch_zero_usage(monkeypatch)
    current_user = make_user()
    client = TestClient(make_app(current_user))

    response = client.post("/auth/trial/start")

    assert response.status_code == 200
    payload = response.json()
    assert payload["tier"] == "trial"
    assert current_user.subscription_tier == "trial"
    assert current_user.trial_started_at is not None
    assert current_user.trial_ends_at is not None


def test_start_trial_endpoint_rejects_reuse(monkeypatch):
    patch_zero_usage(monkeypatch)
    current_user = make_user(trial_started_at=datetime(2026, 6, 1, tzinfo=timezone.utc))
    client = TestClient(make_app(current_user))

    response = client.post("/auth/trial/start")

    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "trial_already_used"
