from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from authentication.database import get_db
from authentication.models import UsageEvent, User, UserFeedback, UserProfile
from authentication.utils import get_current_user


router = APIRouter(prefix="/admin", tags=["admin"])

AnalyticsRange = Literal["7d", "30d", "all"]

FEATURE_EVENT_LABELS = {
    "analysis_completed": "Video Analysis",
    "weekly_workout_plan_created": "Workout Plans",
    "weekly_meal_plan_created": "Meal Plans",
    "trial_started": "Trial Starts",
    "feedback_submitted": "Feedback",
}

IMPORTANT_EVENTS = {
    "register",
    "google_login",
    "analysis_completed",
    "weekly_workout_plan_created",
    "weekly_meal_plan_created",
    "trial_started",
    "feedback_submitted",
    "quota_error_shown",
    "analysis_failed",
    "plan_generation_failed",
}


def require_admin_user(current_user: User = Depends(get_current_user)) -> User:
    if getattr(current_user, "role", "user") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


class AdminFeedbackItem(BaseModel):
    id: int
    user_id: int
    user_name: str
    user_email: str
    rating: int
    message: str
    source: str
    created_at: datetime


@router.get("/feedback", response_model=list[AdminFeedbackItem])
def list_feedback(
    current_user: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(UserFeedback, User)
        .join(User, User.id == UserFeedback.user_id)
        .order_by(UserFeedback.created_at.desc())
        .limit(200)
        .all()
    )
    return [
        {
            "id": feedback.id,
            "user_id": user.id,
            "user_name": user.name,
            "user_email": user.email,
            "rating": feedback.rating,
            "message": feedback.message,
            "source": feedback.source,
            "created_at": feedback.created_at,
        }
        for feedback, user in rows
    ]


def _range_start(range_value: AnalyticsRange) -> datetime | None:
    if range_value == "7d":
        return datetime.now(timezone.utc) - timedelta(days=7)
    if range_value == "30d":
        return datetime.now(timezone.utc) - timedelta(days=30)
    return None


def _apply_since(query, column, since: datetime | None):
    if since is None:
        return query
    return query.filter(column >= since)


def _with_percent(rows: list[dict]) -> list[dict]:
    total = sum(int(row["count"]) for row in rows)
    return [
        {
            **row,
            "count": int(row["count"]),
            "percentage": round((int(row["count"]) / total) * 100, 1) if total else 0,
        }
        for row in rows
    ]


@router.get("/analytics")
def admin_analytics(
    range: AnalyticsRange = Query(default="30d"),
    current_user: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> dict:
    since = _range_start(range)
    total_users = db.query(func.count(User.id)).scalar() or 0
    admin_users = db.query(func.count(User.id)).filter(User.role == "admin").scalar() or 0
    new_users = _apply_since(db.query(func.count(User.id)), User.created_at, since).scalar() or 0

    discovery_rows = (
        _apply_since(
            db.query(UserProfile.discovery_source, func.count(User.id))
            .select_from(User)
            .outerjoin(UserProfile, UserProfile.user_id == User.id),
            User.created_at,
            since,
        )
        .group_by(UserProfile.discovery_source)
        .all()
    )
    usage_rows = (
        _apply_since(
            db.query(UsageEvent.event_name, func.count(UsageEvent.id)),
            UsageEvent.created_at,
            since,
        )
        .group_by(UsageEvent.event_name)
        .order_by(func.count(UsageEvent.id).desc())
        .limit(20)
        .all()
    )
    feedback_count = _apply_since(db.query(func.count(UserFeedback.id)), UserFeedback.created_at, since).scalar() or 0
    average_rating = _apply_since(db.query(func.avg(UserFeedback.rating)), UserFeedback.created_at, since).scalar()
    feedback_source_rows = (
        _apply_since(
            db.query(UserFeedback.source, func.count(UserFeedback.id)),
            UserFeedback.created_at,
            since,
        )
        .group_by(UserFeedback.source)
        .all()
    )
    rating_rows = (
        _apply_since(
            db.query(UserFeedback.rating, func.count(UserFeedback.id)),
            UserFeedback.created_at,
            since,
        )
        .group_by(UserFeedback.rating)
        .order_by(UserFeedback.rating)
        .all()
    )
    feature_counts: dict[str, int] = defaultdict(int)
    raw_usage_rows = []
    for event_name, count in usage_rows:
        raw_usage_rows.append({"event_name": event_name, "count": count})
        label = FEATURE_EVENT_LABELS.get(event_name)
        if label:
            feature_counts[label] += int(count)
    recent_rows = (
        _apply_since(
            db.query(UsageEvent, User)
            .outerjoin(User, User.id == UsageEvent.user_id)
            .filter(UsageEvent.event_name.in_(tuple(IMPORTANT_EVENTS))),
            UsageEvent.created_at,
            since,
        )
        .order_by(UsageEvent.created_at.desc())
        .limit(50)
        .all()
    )
    video_analyses = feature_counts.get("Video Analysis", 0)
    plan_generations = feature_counts.get("Workout Plans", 0) + feature_counts.get("Meal Plans", 0)

    return {
        "range": range,
        "user_counts": {
            "total": total_users,
            "new": new_users,
            "admins": admin_users,
            "regular": max(total_users - admin_users, 0),
        },
        "top_metrics": {
            "video_analyses": video_analyses,
            "plan_generations": plan_generations,
        },
        "discovery_sources": _with_percent([
            {"source": source or "unknown", "count": count}
            for source, count in discovery_rows
        ]),
        "feature_usage": _with_percent([
            {"feature": feature, "count": count}
            for feature, count in sorted(feature_counts.items(), key=lambda item: item[1], reverse=True)
        ]),
        "feedback_sources": _with_percent([
            {"source": source or "unknown", "count": count}
            for source, count in feedback_source_rows
        ]),
        "rating_distribution": _with_percent([
            {"rating": rating, "count": count}
            for rating, count in rating_rows
        ]),
        "usage_events": _with_percent(raw_usage_rows),
        "feedback_summary": {
            "count": feedback_count,
            "average_rating": round(float(average_rating), 2) if average_rating is not None else None,
        },
        "recent_events": [
            {
                "id": event.id,
                "event_name": event.event_name,
                "user_id": user.id if user else None,
                "user_name": user.name if user else None,
                "user_email": user.email if user else None,
                "properties": event.properties_json or {},
                "created_at": event.created_at,
            }
            for event, user in recent_rows
        ],
    }
