from __future__ import annotations

from collections import Counter
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from authentication.database import get_db
from authentication.models import AnalysisResult, User, WorkoutSession
from authentication.utils import get_current_user

router = APIRouter(tags=["users", "workouts", "analytics"])


@router.get("/me")
def me(current_user: User = Depends(get_current_user)) -> dict[str, Any]:
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "created_at": current_user.created_at,
    }


@router.get("/workouts")
def list_workouts(
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    limit = min(max(limit, 1), 100)
    sessions = (
        db.query(WorkoutSession)
        .options(joinedload(WorkoutSession.analysis_result))
        .filter(WorkoutSession.user_id == current_user.id)
        .order_by(WorkoutSession.created_at.desc())
        .limit(limit)
        .all()
    )
    return [_session_to_response(session, include_analysis=False) for session in sessions]


@router.get("/workouts/{session_id}")
def get_workout(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    session = (
        db.query(WorkoutSession)
        .options(joinedload(WorkoutSession.analysis_result))
        .filter(
            WorkoutSession.id == session_id,
            WorkoutSession.user_id == current_user.id,
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Workout session not found.")
    return _session_to_response(session, include_analysis=True)


@router.get("/analytics/summary")
def analytics_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    completed_rows = (
        db.query(WorkoutSession, AnalysisResult)
        .join(AnalysisResult, AnalysisResult.session_id == WorkoutSession.id)
        .filter(
            WorkoutSession.user_id == current_user.id,
            WorkoutSession.status == "completed",
        )
        .all()
    )

    total_sessions = len(completed_rows)
    total_reps = sum(result.rep_count or 0 for _, result in completed_rows)
    sessions_by_exercise: Counter[str] = Counter()
    reps_by_exercise: Counter[str] = Counter()
    top_feedback: Counter[str] = Counter()
    quality_values: list[float] = []
    processing_values: list[int] = []
    llm_enabled_count = 0

    for session, result in completed_rows:
        sessions_by_exercise.update([session.exercise])
        reps_by_exercise.update({session.exercise: result.rep_count or 0})
        if result.top_feedback_json:
            top_feedback.update(result.top_feedback_json)
        if result.quality_ratio is not None:
            quality_values.append(float(result.quality_ratio))
        if result.processing_ms is not None:
            processing_values.append(int(result.processing_ms))
        if result.llm_enabled:
            llm_enabled_count += 1

    recent_sessions = (
        db.query(WorkoutSession)
        .options(joinedload(WorkoutSession.analysis_result))
        .filter(WorkoutSession.user_id == current_user.id)
        .order_by(WorkoutSession.created_at.desc())
        .limit(5)
        .all()
    )

    return {
        "total_sessions": total_sessions,
        "total_reps": total_reps,
        "sessions_by_exercise": dict(sessions_by_exercise),
        "reps_by_exercise": dict(reps_by_exercise),
        "avg_quality_ratio": _average(quality_values),
        "avg_processing_ms": _average(processing_values),
        "top_feedback": dict(top_feedback.most_common(8)),
        "llm_enabled_count": llm_enabled_count,
        "recent_sessions": [
            _session_to_response(session, include_analysis=False)
            for session in recent_sessions
        ],
    }


def _average(values: list[float] | list[int]) -> float | None:
    if not values:
        return None
    return round(sum(values) / len(values), 3)


def _session_to_response(
    session: WorkoutSession,
    *,
    include_analysis: bool,
) -> dict[str, Any]:
    result = session.analysis_result
    response: dict[str, Any] = {
        "id": session.id,
        "user_id": session.user_id,
        "exercise": session.exercise,
        "camera_view": session.camera_view,
        "pose_backend": session.pose_backend,
        "source_type": session.source_type,
        "file_name": session.file_name,
        "file_size_bytes": session.file_size_bytes,
        "sample_fps": session.sample_fps,
        "max_frames": session.max_frames,
        "include_preview": session.include_preview,
        "preview_max_frames": session.preview_max_frames,
        "llm_requested": session.llm_requested,
        "status": session.status,
        "started_at": session.started_at,
        "completed_at": session.completed_at,
        "created_at": session.created_at,
        "analysis_id": result.id if result else None,
        "summary": result.summary_json if result else None,
    }
    if include_analysis and result:
        response["analysis"] = {
            "id": result.id,
            "frames_received": result.frames_received,
            "frames_analyzed": result.frames_analyzed,
            "rep_count": result.rep_count,
            "processing_ms": result.processing_ms,
            "quality_ratio": result.quality_ratio,
            "no_pose_frames": result.no_pose_frames,
            "visibility_failed_frames": result.visibility_failed_frames,
            "waiting_for_subject_frames": result.waiting_for_subject_frames,
            "decode_errors": result.decode_errors,
            "summary": result.summary_json,
            "angle_stats": result.angle_stats_json,
            "top_feedback": result.top_feedback_json,
            "visibility_failures": result.visibility_failures_json,
            "llm": {
                "enabled": result.llm_enabled,
                "model": result.llm_model,
                "usage_metadata": result.llm_usage_json,
                "recommendations": result.llm_recommendations,
                "error": None,
            },
            "created_at": result.created_at,
        }
    return response
