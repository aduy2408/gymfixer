from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import entitlements as e


def db():
    return SimpleNamespace(flush=lambda: None)


def user(**overrides):
    data = {
        "id": 1,
        "created_at": datetime(2026, 6, 1, tzinfo=timezone.utc),
        "subscription_tier": "free",
        "trial_started_at": None,
        "trial_ends_at": None,
    }
    data.update(overrides)
    return SimpleNamespace(**data)


def patch_usage(monkeypatch, *, videos=0, ai=0, workouts=0, meals=0):
    monkeypatch.setattr(e, "_count_video_analyses", lambda db, current_user, since: videos)
    monkeypatch.setattr(e, "_count_ai_coaching", lambda db, current_user, since: ai)
    monkeypatch.setattr(e, "_count_workout_plans", lambda db, current_user, since: workouts)
    monkeypatch.setattr(e, "_count_meal_plans", lambda db, current_user, since: meals)


def test_free_summary_limits_and_features(monkeypatch):
    patch_usage(monkeypatch, videos=2, ai=0, workouts=1, meals=0)

    summary = e.subscription_summary(object(), user())

    assert summary["tier"] == "free"
    assert summary["limits"]["video_analyses"] == 5
    assert summary["remaining"]["video_analyses"] == 3
    assert summary["remaining"]["workout_plans"] == 0
    assert summary["features"] == {
        "vitpose": False,
        "ai_coaching": False,
        "full_history": False,
    }


def test_trial_is_effective_until_expiry(monkeypatch):
    patch_usage(monkeypatch)
    trial_user = user(
        subscription_tier="trial",
        trial_started_at=e.now_utc() - timedelta(days=1),
        trial_ends_at=e.now_utc() + timedelta(days=6),
    )

    summary = e.subscription_summary(object(), trial_user)

    assert summary["tier"] == "trial"
    assert summary["window"] == "trial"
    assert summary["features"]["vitpose"] is True
    assert summary["features"]["ai_coaching"] is True


def test_expired_trial_falls_back_to_free(monkeypatch):
    patch_usage(monkeypatch)
    expired = user(
        subscription_tier="trial",
        trial_started_at=e.now_utc() - timedelta(days=10),
        trial_ends_at=e.now_utc() - timedelta(days=3),
    )

    summary = e.subscription_summary(object(), expired)

    assert summary["stored_tier"] == "trial"
    assert summary["tier"] == "free"
    assert summary["trial_expired"] is True


def test_start_trial_sets_window_once(monkeypatch):
    patch_usage(monkeypatch)
    current = user()

    summary = e.start_trial_for_user(db(), current)

    assert current.subscription_tier == "trial"
    assert current.trial_started_at is not None
    assert current.trial_ends_at - current.trial_started_at == timedelta(days=e.TRIAL_DAYS)
    assert summary["tier"] == "trial"

    with pytest.raises(HTTPException) as exc:
        e.start_trial_for_user(db(), current)
    assert exc.value.status_code == 400
    assert exc.value.detail["code"] == "trial_already_used"


def test_paid_user_cannot_start_trial(monkeypatch):
    patch_usage(monkeypatch)

    with pytest.raises(HTTPException) as exc:
        e.start_trial_for_user(db(), user(subscription_tier="paid"))

    assert exc.value.status_code == 400
    assert exc.value.detail["code"] == "already_paid"


def test_free_blocks_vitpose_and_ai_coaching(monkeypatch):
    patch_usage(monkeypatch)

    with pytest.raises(HTTPException) as vitpose_exc:
        e.require_video_analysis_access(object(), user(), pose_backend="vitpose", call_llm=False)
    assert vitpose_exc.value.status_code == 403
    assert vitpose_exc.value.detail["code"] == "feature_not_available"

    with pytest.raises(HTTPException) as ai_exc:
        e.require_video_analysis_access(object(), user(), pose_backend="mediapipe", call_llm=True)
    assert ai_exc.value.status_code == 403
    assert ai_exc.value.detail["code"] == "feature_not_available"


def test_video_and_ai_quota_errors_include_subscription(monkeypatch):
    trial_user = user(
        subscription_tier="trial",
        trial_started_at=e.now_utc() - timedelta(days=1),
        trial_ends_at=e.now_utc() + timedelta(days=6),
    )
    patch_usage(monkeypatch, videos=20, ai=0)
    with pytest.raises(HTTPException) as video_exc:
        e.require_video_analysis_access(object(), trial_user, pose_backend="mediapipe", call_llm=False)
    assert video_exc.value.detail["code"] == "tier_limit_exceeded"
    assert video_exc.value.detail["subscription"]["remaining"]["video_analyses"] == 0

    patch_usage(monkeypatch, videos=1, ai=5)
    with pytest.raises(HTTPException) as ai_exc:
        e.require_video_analysis_access(object(), trial_user, pose_backend="mediapipe", call_llm=True)
    assert ai_exc.value.detail["code"] == "tier_limit_exceeded"
    assert ai_exc.value.detail["subscription"]["remaining"]["ai_coaching"] == 0


def test_plan_quota_and_history_limits(monkeypatch):
    patch_usage(monkeypatch, workouts=1, meals=1)

    with pytest.raises(HTTPException) as workout_exc:
        e.require_plan_access(object(), user(), plan_type="workout")
    assert workout_exc.value.detail["code"] == "tier_limit_exceeded"

    with pytest.raises(HTTPException) as meal_exc:
        e.require_plan_access(object(), user(), plan_type="meal")
    assert meal_exc.value.detail["code"] == "tier_limit_exceeded"

    assert e.history_limit_for_user(user(), 100) == 5
    assert e.history_limit_for_user(user(subscription_tier="paid"), 100) == 100
