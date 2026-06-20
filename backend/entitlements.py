from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Literal

from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session

from authentication.models import BillingSubscription, UsageEvent, User, WeeklyMealPlan, WeeklyWorkoutPlan, WorkoutSession

SubscriptionTier = Literal["free", "trial", "paid"]
QuotaKind = Literal["video_analysis", "ai_coaching", "workout_plan", "meal_plan"]

TRIAL_DAYS = 7
BILLING_GRACE_DAYS = 3

TIER_LIMITS: dict[SubscriptionTier, dict[str, int | None]] = {
    "free": {
        "video_analyses": 5,
        "ai_coaching": 0,
        "workout_plans": 1,
        "meal_plans": 1,
        "history_items": 5,
    },
    "trial": {
        "video_analyses": 20,
        "ai_coaching": 5,
        "workout_plans": 5,
        "meal_plans": 5,
        "history_items": None,
    },
    "paid": {
        "video_analyses": 100,
        "ai_coaching": 50,
        "workout_plans": 30,
        "meal_plans": 30,
        "history_items": None,
    },
}


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def as_aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def month_start(reference: datetime | None = None) -> datetime:
    current = reference or now_utc()
    return current.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def add_month(reference: datetime) -> datetime:
    year = reference.year + (1 if reference.month == 12 else 0)
    month = 1 if reference.month == 12 else reference.month + 1
    return reference.replace(year=year, month=month)


def stored_tier(user: User) -> SubscriptionTier:
    tier = (getattr(user, "subscription_tier", None) or "free").lower()
    return tier if tier in TIER_LIMITS else "free"  # type: ignore[return-value]


def billing_grace_days() -> int:
    try:
        import os

        return max(0, int(os.getenv("BILLING_GRACE_DAYS", str(BILLING_GRACE_DAYS))))
    except ValueError:
        return BILLING_GRACE_DAYS


def latest_billing_subscription(db: Session, user: User) -> BillingSubscription | None:
    if not hasattr(db, "query"):
        return None
    return (
        db.query(BillingSubscription)
        .filter(BillingSubscription.user_id == user.id)
        .order_by(BillingSubscription.created_at.desc(), BillingSubscription.id.desc())
        .first()
    )


def paid_access_active(
    user: User,
    reference: datetime | None = None,
    subscription: BillingSubscription | None = None,
) -> bool:
    current = reference or now_utc()
    if subscription:
        period_end = as_aware(subscription.current_period_end)
        if subscription.status == "active" and period_end and period_end >= current:
            return True
        if subscription.status == "past_due" and period_end and period_end + timedelta(days=billing_grace_days()) >= current:
            return True
        return False
    premium_expires_at = as_aware(getattr(user, "premium_expires_at", None))
    return bool(premium_expires_at and premium_expires_at >= current)


def effective_tier(
    user: User,
    reference: datetime | None = None,
    subscription: BillingSubscription | None = None,
) -> SubscriptionTier:
    tier = stored_tier(user)
    if tier == "paid":
        return "paid" if paid_access_active(user, reference, subscription) else "free"
    if tier != "trial":
        return tier
    trial_ends_at = as_aware(getattr(user, "trial_ends_at", None))
    if trial_ends_at and trial_ends_at >= (reference or now_utc()):
        return "trial"
    return "free"


def is_trial_expired(user: User, reference: datetime | None = None) -> bool:
    if stored_tier(user) != "trial":
        return False
    trial_ends_at = as_aware(getattr(user, "trial_ends_at", None))
    return bool(trial_ends_at and trial_ends_at < (reference or now_utc()))


def trial_window_start(user: User) -> datetime:
    return as_aware(getattr(user, "trial_started_at", None)) or as_aware(user.created_at) or month_start()


def usage_window(user: User, reference: datetime | None = None) -> tuple[str, datetime, datetime | None]:
    tier = effective_tier(user, reference)
    current = reference or now_utc()
    if tier == "trial":
        return "trial", trial_window_start(user), as_aware(getattr(user, "trial_ends_at", None))
    start = month_start(current)
    return "month", start, add_month(start)


def _count_video_analyses(db: Session, user: User, since: datetime) -> int:
    return (
        db.query(WorkoutSession)
        .filter(
            WorkoutSession.user_id == user.id,
            WorkoutSession.source_type == "video_upload",
            WorkoutSession.status.in_(["processing", "completed"]),
            WorkoutSession.created_at >= since,
        )
        .count()
    )


def _count_ai_coaching(db: Session, user: User, since: datetime) -> int:
    return (
        db.query(UsageEvent)
        .filter(
            UsageEvent.user_id == user.id,
            UsageEvent.event_name == "llm_enabled",
            UsageEvent.created_at >= since,
        )
        .count()
    )


def _count_workout_plans(db: Session, user: User, since: datetime) -> int:
    return (
        db.query(WeeklyWorkoutPlan)
        .filter(WeeklyWorkoutPlan.user_id == user.id, WeeklyWorkoutPlan.created_at >= since)
        .count()
    )


def _count_meal_plans(db: Session, user: User, since: datetime) -> int:
    return (
        db.query(WeeklyMealPlan)
        .filter(WeeklyMealPlan.user_id == user.id, WeeklyMealPlan.created_at >= since)
        .count()
    )


def subscription_summary(db: Session, user: User) -> dict[str, Any]:
    reference = now_utc()
    billing_subscription = latest_billing_subscription(db, user)
    tier = effective_tier(user, reference, billing_subscription)
    window, since, reset_at = usage_window(user, reference)
    limits = TIER_LIMITS[tier]
    usage = {
        "video_analyses": _count_video_analyses(db, user, since),
        "ai_coaching": _count_ai_coaching(db, user, since),
        "workout_plans": _count_workout_plans(db, user, since),
        "meal_plans": _count_meal_plans(db, user, since),
    }
    remaining = {
        key: None if limits[key] is None else max(0, int(limits[key] or 0) - int(usage.get(key, 0)))
        for key in ("video_analyses", "ai_coaching", "workout_plans", "meal_plans")
    }
    billing = None
    if billing_subscription:
        payment_method = getattr(billing_subscription, "payment_method", None)
        billing = {
            "status": billing_subscription.status,
            "amount_vnd": billing_subscription.amount_vnd,
            "interval": billing_subscription.interval,
            "current_period_start": billing_subscription.current_period_start,
            "current_period_end": billing_subscription.current_period_end,
            "next_billing_at": billing_subscription.next_billing_at,
            "cancel_at_period_end": billing_subscription.cancel_at_period_end,
            "payment_method": None
            if not payment_method
            else {
                "id": payment_method.id,
                "provider": payment_method.provider,
                "masked_card": payment_method.masked_card,
                "bank_code": payment_method.bank_code,
                "card_type": payment_method.card_type,
                "status": payment_method.status,
            },
        }
    return {
        "tier": tier,
        "stored_tier": stored_tier(user),
        "trial_started_at": getattr(user, "trial_started_at", None),
        "trial_ends_at": getattr(user, "trial_ends_at", None),
        "trial_expired": is_trial_expired(user, reference),
        "premium_expires_at": getattr(user, "premium_expires_at", None),
        "window": window,
        "window_started_at": since,
        "resets_at": reset_at,
        "limits": limits,
        "usage": usage,
        "remaining": remaining,
        "billing": billing,
        "features": {
            "vitpose": tier in {"trial", "paid"},
            "ai_coaching": tier in {"trial", "paid"} and int(limits["ai_coaching"] or 0) > 0,
            "full_history": limits["history_items"] is None,
        },
    }


def start_trial_for_user(db: Session, user: User) -> dict[str, Any]:
    if stored_tier(user) == "paid":
        raise HTTPException(status_code=400, detail={"code": "already_paid", "message": "Paid users do not need a trial."})
    if getattr(user, "trial_started_at", None):
        raise HTTPException(status_code=400, detail={"code": "trial_already_used", "message": "Trial has already been used for this account."})
    started_at = now_utc()
    user.subscription_tier = "trial"
    user.trial_started_at = started_at
    user.trial_ends_at = started_at + timedelta(days=TRIAL_DAYS)
    db.flush()
    return subscription_summary(db, user)


def history_limit_for_user(user: User, requested_limit: int) -> int:
    limit = min(max(requested_limit, 1), 100)
    history_limit = TIER_LIMITS[effective_tier(user)]["history_items"]
    return limit if history_limit is None else min(limit, int(history_limit))


def require_video_analysis_access(
    db: Session,
    user: User,
    *,
    pose_backend: str,
    call_llm: bool,
) -> None:
    summary = subscription_summary(db, user)
    if pose_backend == "vitpose" and not summary["features"]["vitpose"]:
        _raise_entitlement_error("feature_not_available", "ViTPose analysis is available on Trial and Paid plans.", summary)
    _require_quota(summary, "video_analyses", "tier_limit_exceeded", "Video analysis quota reached for this plan.")
    if call_llm:
        if not summary["features"]["ai_coaching"]:
            _raise_entitlement_error("feature_not_available", "AI coaching is available on Trial and Paid plans.", summary)
        _require_quota(summary, "ai_coaching", "tier_limit_exceeded", "AI coaching quota reached for this plan.")


def require_plan_access(db: Session, user: User, *, plan_type: Literal["workout", "meal"]) -> None:
    summary = subscription_summary(db, user)
    quota_key = "workout_plans" if plan_type == "workout" else "meal_plans"
    label = "Workout plan" if plan_type == "workout" else "Meal plan"
    _require_quota(summary, quota_key, "tier_limit_exceeded", f"{label} quota reached for this plan.")


def _require_quota(summary: dict[str, Any], key: str, code: str, message: str) -> None:
    limit = summary["limits"][key]
    if limit is not None and summary["usage"][key] >= limit:
        _raise_entitlement_error(code, message, summary)


def _raise_entitlement_error(code: str, message: str, summary: dict[str, Any]) -> None:
    raise HTTPException(
        status_code=403,
        detail={
            "code": code,
            "message": message,
            "subscription": jsonable_encoder(summary),
        },
    )
