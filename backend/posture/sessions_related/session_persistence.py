from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import UploadFile
from sqlalchemy.orm import Session as DBSession

from authentication.models import AnalysisResult, User, WorkoutSession
from posture.sessions_related.llm_coach import GEMINI_MODEL
from posture.sessions_related.session_models import normalise_camera_view, normalise_pose_backend
from usage_events import log_usage_event


def create_workout_session(
    db: DBSession,
    *,
    current_user: User,
    exercise: str,
    camera_view: str,
    pose_backend: str | None,
    file: UploadFile,
    call_llm: bool,
    sample_fps: float,
    max_frames: int,
    include_preview: bool,
    preview_max_frames: int,
) -> WorkoutSession:
    workout_session = WorkoutSession(
        user_id=current_user.id,
        exercise=exercise,
        camera_view=normalise_camera_view(camera_view),
        pose_backend=normalise_pose_backend(pose_backend),
        source_type="video_upload",
        file_name=file.filename,
        file_size_bytes=getattr(file, "size", None),
        sample_fps=sample_fps,
        max_frames=max_frames,
        include_preview=include_preview,
        preview_max_frames=preview_max_frames,
        llm_requested=call_llm,
        status="processing",
    )
    db.add(workout_session)
    db.flush()
    log_usage_event(
        db,
        event_name="analysis_started",
        user_id=current_user.id,
        session_id=workout_session.id,
        properties={
            "exercise": exercise,
            "camera_view": workout_session.camera_view,
            "pose_backend": workout_session.pose_backend,
            "file_name": file.filename,
            "sample_fps": sample_fps,
            "max_frames": max_frames,
        },
    )
    if call_llm:
        log_usage_event(
            db,
            event_name="llm_enabled",
            user_id=current_user.id,
            session_id=workout_session.id,
            properties={"model": GEMINI_MODEL},
        )
    db.commit()
    db.refresh(workout_session)
    return workout_session


def persist_analysis_result(
    db: DBSession,
    workout_session: WorkoutSession,
    result: dict[str, Any],
) -> AnalysisResult:
    summary = result.get("summary", {})
    llm = result.get("llm", {})
    analysis_quality = summary.get("analysis_quality") or {}

    analysis = AnalysisResult(
        session_id=workout_session.id,
        frames_received=int(summary.get("frames_received") or 0),
        frames_analyzed=int(summary.get("frames_analyzed") or 0),
        rep_count=int(summary.get("rep_count") or 0),
        processing_ms=int(summary.get("processing_ms") or 0),
        quality_ratio=analysis_quality.get("active_window_usable_ratio"),
        no_pose_frames=int(summary.get("no_pose_frames") or 0),
        visibility_failed_frames=int(summary.get("visibility_failed_frames") or 0),
        waiting_for_subject_frames=int(summary.get("waiting_for_subject_frames") or 0),
        decode_errors=int(summary.get("decode_errors") or 0),
        summary_json=summary,
        angle_stats_json=summary.get("angle_stats") or {},
        top_feedback_json=summary.get("top_feedback") or {},
        visibility_failures_json=summary.get("visibility_failures") or {},
        rep_breakdown_json=summary.get("rep_breakdown") or [],
        llm_enabled=bool(llm.get("enabled")),
        llm_model=llm.get("model"),
        llm_usage_json=llm.get("usage_metadata"),
        llm_recommendations=llm.get("recommendations"),
    )
    workout_session.status = "completed"
    workout_session.completed_at = datetime.now(timezone.utc)
    db.add(analysis)
    db.flush()
    log_usage_event(
        db,
        event_name="analysis_completed",
        user_id=workout_session.user_id,
        session_id=workout_session.id,
        properties={
            "analysis_id": analysis.id,
            "exercise": workout_session.exercise,
            "camera_view": workout_session.camera_view,
            "pose_backend": workout_session.pose_backend,
            "llm_requested": workout_session.llm_requested,
            "status": workout_session.status,
            "processing_ms": analysis.processing_ms,
            "rep_count": analysis.rep_count,
            "frames_analyzed": analysis.frames_analyzed,
            "quality_ratio": analysis.quality_ratio,
            "llm_enabled": analysis.llm_enabled,
        },
    )
    db.commit()
    db.refresh(analysis)
    return analysis


def mark_workout_session_failed(
    db: DBSession,
    workout_session: WorkoutSession,
    *,
    error: str,
) -> None:
    workout_session.status = "failed"
    workout_session.completed_at = datetime.now(timezone.utc)
    log_usage_event(
        db,
        event_name="analysis_failed",
        user_id=workout_session.user_id,
        session_id=workout_session.id,
        properties={"error": error[:1000]},
    )
    db.commit()
