from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.orm import Session

from authentication.database import get_db
from authentication.models import User, UserFeedback
from authentication.utils import get_current_user
from usage_events import log_usage_event


router = APIRouter(prefix="/feedback", tags=["feedback"])


class FeedbackCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    message: str = Field(min_length=1, max_length=2000)
    source: Literal["popup", "sidebar"]

    @field_validator("message")
    @classmethod
    def validate_message(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Feedback message is required")
        return value


class FeedbackOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    rating: int
    message: str
    source: str
    created_at: datetime


@router.post("", response_model=FeedbackOut)
def create_feedback(
    feedback_in: FeedbackCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    feedback = UserFeedback(
        user_id=current_user.id,
        rating=feedback_in.rating,
        message=feedback_in.message,
        source=feedback_in.source,
    )
    db.add(feedback)
    log_usage_event(
        db,
        event_name="feedback_submitted",
        user_id=current_user.id,
        properties={"source": feedback_in.source, "rating": feedback_in.rating},
    )
    db.commit()
    db.refresh(feedback)
    return feedback
