from typing import Any, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from authentication.database import get_db
from authentication.models import User
from authentication.utils import get_current_user
from usage_events import log_usage_event


router = APIRouter(prefix="/usage-events", tags=["usage-events"])

ClientEventName = Literal[
    "dashboard_viewed",
    "admin_viewed",
    "feedback_popup_shown",
    "feedback_popup_dismissed",
    "feedback_sidebar_opened",
    "onboarding_intro_viewed",
    "onboarding_metrics_started",
    "onboarding_completed",
    "quota_error_shown",
    "plan_generation_failed",
]


class ClientUsageEvent(BaseModel):
    event_name: ClientEventName
    properties: dict[str, Any] = Field(default_factory=dict)

    @field_validator("properties")
    @classmethod
    def validate_properties(cls, value: dict[str, Any]) -> dict[str, Any]:
        safe: dict[str, Any] = {}
        for key, raw in value.items():
            if len(key) > 80:
                continue
            if isinstance(raw, (str, int, float, bool)) or raw is None:
                safe[key] = raw[:300] if isinstance(raw, str) else raw
        return safe


@router.post("")
def create_usage_event(
    event_in: ClientUsageEvent,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    log_usage_event(
        db,
        event_name=event_in.event_name,
        user_id=current_user.id,
        properties=event_in.properties,
    )
    db.commit()
    return {"ok": True}
