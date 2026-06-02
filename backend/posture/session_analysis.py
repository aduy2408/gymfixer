from __future__ import annotations

import os
import tempfile

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session as DBSession

from authentication.database import get_db
from authentication.models import User
from authentication.utils import get_current_user
from entitlements import require_video_analysis_access
from posture.sessions_related.session_models import (
    PostureSessionRequest,
    normalise_pose_backend,
)
from posture.sessions_related.session_persistence import (
    create_workout_session,
    mark_workout_session_failed,
    persist_analysis_result,
)
from posture.sessions_related.session_processor import analyze_posture_session
from posture.sessions_related.video_sampling import sample_video_frames


router = APIRouter(prefix="/posture", tags=["posture"])


@router.post("/analyze-session")
async def analyze_session(request: PostureSessionRequest):
    """Analyze a batch of already-captured frame images."""
    try:
        return analyze_posture_session(
            request.exercise,
            request.frames,
            call_llm=request.call_llm,
            camera_view=request.camera_view,
            pose_backend=request.pose_backend,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/analyze-video")
async def analyze_video(
    exercise: str = Form(...),
    camera_view: str = Form("auto"),
    pose_backend: str | None = Form(None),
    file: UploadFile = File(...),
    call_llm: bool = Form(False),
    sample_fps: float = Form(8.0),
    max_frames: int = Form(360),
    include_preview: bool = Form(True),
    preview_max_frames: int = Form(24),
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Analyze an uploaded exercise video by sampling frames from it."""
    if sample_fps <= 0:
        raise HTTPException(status_code=400, detail="sample_fps must be greater than 0.")
    if max_frames <= 0:
        raise HTTPException(status_code=400, detail="max_frames must be greater than 0.")
    if preview_max_frames <= 0:
        raise HTTPException(status_code=400, detail="preview_max_frames must be greater than 0.")

    try:
        normalised_pose_backend = normalise_pose_backend(pose_backend)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    require_video_analysis_access(
        db,
        current_user,
        pose_backend=normalised_pose_backend,
        call_llm=call_llm,
    )

    suffix = os.path.splitext(file.filename or "")[1] or ".mp4"
    temp_path = None
    try:
        workout_session = create_workout_session(
            db,
            current_user=current_user,
            exercise=exercise,
            camera_view=camera_view,
            pose_backend=normalised_pose_backend,
            file=file,
            call_llm=call_llm,
            sample_fps=sample_fps,
            max_frames=max_frames,
            include_preview=include_preview,
            preview_max_frames=preview_max_frames,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_path = temp_file.name
            while chunk := await file.read(1024 * 1024):
                temp_file.write(chunk)

        frames = sample_video_frames(
            temp_path,
            sample_fps=sample_fps,
            max_frames=max_frames,
        )
        if not frames:
            raise HTTPException(
                status_code=400,
                detail="No readable frames were found in the uploaded video.",
            )

        result = analyze_posture_session(
            exercise,
            frames,
            call_llm=call_llm,
            include_preview=include_preview,
            preview_max_frames=preview_max_frames,
            camera_view=camera_view,
            pose_backend=normalised_pose_backend,
        )
        analysis = persist_analysis_result(db, workout_session, result)
        result["session_id"] = workout_session.id
        result["analysis_id"] = analysis.id
        return result
    except HTTPException as exc:
        mark_workout_session_failed(
            db,
            workout_session,
            error=str(exc.detail),
        )
        raise
    except ValueError as exc:
        mark_workout_session_failed(db, workout_session, error=str(exc))
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        mark_workout_session_failed(db, workout_session, error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        await file.close()
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)
