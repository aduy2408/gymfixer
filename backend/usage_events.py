from typing import Any

from sqlalchemy.orm import Session

from authentication.models import UsageEvent


def log_usage_event(
    db: Session,
    *,
    event_name: str,
    user_id: int | None = None,
    session_id: int | None = None,
    properties: dict[str, Any] | None = None,
) -> UsageEvent:
    event = UsageEvent(
        user_id=user_id,
        session_id=session_id,
        event_name=event_name,
        properties_json=properties or {},
    )
    db.add(event)
    return event
