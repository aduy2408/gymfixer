from __future__ import annotations

import os
import time
from collections import Counter, defaultdict
from typing import Any

from posture import feedback as feedback_module
from posture import mediapipe_utils
from posture.camera_view import CameraViewDetector
from posture.sessions_related.feedback_classifier import problem_feedback
from posture.sessions_related.llm_coach import (
    GEMINI_MAX_OUTPUT_TOKENS,
    GEMINI_MODEL,
    build_gemini_posture_prompt,
    call_gemini_posture_coach,
)
from posture.phase_detector import PhaseDetector
from posture.sessions_related.preview_frames import maybe_add_preview_frame
from posture.sessions_related.session_models import SessionFrame, normalise_camera_view, normalise_pose_backend
from posture.sessions_related.session_summary import build_session_summary, local_recommendations
from posture.sessions_related.subject_gate import SUBJECT_READY_MIN_FRAMES, subject_ready_for_analysis
from posture.sessions_related.video_sampling import decode_base64_frame


def analyze_posture_session(
    exercise: str,
    encoded_frames: list[SessionFrame],
    *,
    call_llm: bool = False,
    include_preview: bool = False,
    preview_max_frames: int = 24,
    camera_view: str = "auto",
    pose_backend: str | None = None,
) -> dict[str, Any]:
    """Process a full exercise session and return rule/LLM coaching output."""
    if exercise not in mediapipe_utils.ANGLE_FUNCTIONS:
        supported = ", ".join(sorted(mediapipe_utils.ANGLE_FUNCTIONS))
        raise ValueError(f"Unsupported exercise '{exercise}'. Supported: {supported}")
    camera_view = normalise_camera_view(camera_view)
    pose_backend = normalise_pose_backend(pose_backend)

    try:
        pose_processor = mediapipe_utils.get_cached_pose_processor(pose_backend)
        pose_processor.reset_state()
    except RuntimeError as exc:
        raise ValueError(str(exc)) from exc
    pose_backend = getattr(pose_processor, "backend_name", "mediapipe")
    phase_detector = PhaseDetector(exercise)
    camera_view_detector = CameraViewDetector(
        visibility_threshold=float(os.getenv("MP_VIS_THRESHOLD", "0.5"))
    )
    started_at = time.time()

    frame_log: list[dict[str, Any]] = []
    issue_counts: Counter[str] = Counter()
    phase_counts: Counter[str] = Counter()
    visibility_failures: Counter[str] = Counter()
    angle_values: dict[str, list[float]] = defaultdict(list)
    rep_count = 0
    preview_frames: list[dict[str, Any]] = []
    preview_stride = max(1, len(encoded_frames) // max(1, preview_max_frames))
    preview_rep_issues: set[tuple[int, str]] = set()
    subject_ready_streak = 0

    for index, session_frame in enumerate(encoded_frames):
        frame = decode_base64_frame(session_frame.frame)
        if frame is None:
            entry = {
                "frame_index": index,
                "timestamp_ms": session_frame.timestamp_ms,
                "status": "decode_error",
                "feedback": ["Frame could not be decoded."],
            }
            frame_log.append(entry)
            issue_counts.update(entry["feedback"])
            maybe_add_preview_frame(
                preview_frames,
                frame=frame,
                pose_landmarks=None,
                entry=entry,
                include_preview=include_preview,
                preview_max_frames=preview_max_frames,
                preview_stride=preview_stride,
            )
            continue

        pose_landmarks, _raw_landmarks, smoothed_landmarks = pose_processor.process(frame)
        if not pose_landmarks or not smoothed_landmarks:
            entry = {
                "frame_index": index,
                "timestamp_ms": session_frame.timestamp_ms,
                "status": "no_pose",
                "feedback": ["No person detected."],
            }
            frame_log.append(entry)
            issue_counts.update(entry["feedback"])
            continue

        subject_ready, subject_reason = subject_ready_for_analysis(
            smoothed_landmarks,
            exercise,
        )
        if subject_ready:
            subject_ready_streak += 1
        else:
            subject_ready_streak = 0

        if not subject_ready or subject_ready_streak < SUBJECT_READY_MIN_FRAMES:
            if subject_ready:
                feedback = [
                    f"Hold still - starting analysis in "
                    f"{SUBJECT_READY_MIN_FRAMES - subject_ready_streak} frames."
                ]
            else:
                feedback = [f"Move fully into frame - {subject_reason}."]
                visibility_failures.update([subject_reason])
            entry = {
                "frame_index": index,
                "timestamp_ms": session_frame.timestamp_ms,
                "status": "waiting_for_subject",
                "visibility_ok": False,
                "feedback": feedback,
            }
            frame_log.append(entry)
            maybe_add_preview_frame(
                preview_frames,
                frame=frame,
                pose_landmarks=pose_landmarks,
                entry=entry,
                include_preview=include_preview,
                preview_max_frames=preview_max_frames,
                preview_stride=preview_stride,
                force=not subject_ready,
            )
            continue

        visibility_ok, missing_keypoints = mediapipe_utils.check_visibility(
            smoothed_landmarks,
            exercise,
        )
        if not visibility_ok:
            feedback = [f"Move into frame - can't see: {', '.join(missing_keypoints)}."]
            visibility_failures.update(missing_keypoints)
            entry = {
                "frame_index": index,
                "timestamp_ms": session_frame.timestamp_ms,
                "status": "visibility_failed",
                "visibility_ok": False,
                "missing_keypoints": missing_keypoints,
                "feedback": feedback,
            }
            frame_log.append(entry)
            issue_counts.update(feedback)
            maybe_add_preview_frame(
                preview_frames,
                frame=frame,
                pose_landmarks=pose_landmarks,
                entry=entry,
                include_preview=include_preview,
                preview_max_frames=preview_max_frames,
                preview_stride=preview_stride,
                force=True,
            )
            continue

        angles = mediapipe_utils.get_angles_for_exercise(exercise, smoothed_landmarks)
        phase, rep_count = phase_detector.update(angles)
        camera_view_estimate = (
            camera_view_detector.update(smoothed_landmarks)
            if camera_view == "auto"
            else None
        )
        effective_camera_view = (
            camera_view_estimate.view
            if camera_view_estimate is not None
            else camera_view
        )

        feedback = feedback_module.generate_feedback(
            exercise,
            angles,
            phase=phase,
            camera_view=effective_camera_view,
        )
        problem_items = problem_feedback(feedback)

        for name, value in angles.items():
            angle_values[name].append(float(value))
        if phase:
            phase_counts.update([phase])
        issue_counts.update(problem_items)

        entry = {
            "frame_index": index,
            "timestamp_ms": session_frame.timestamp_ms,
            "status": "ok",
            "visibility_ok": True,
            "camera_view": effective_camera_view,
            "camera_view_confidence": (
                camera_view_estimate.confidence
                if camera_view_estimate is not None
                else None
            ),
            "phase": phase,
            "rep_count": rep_count,
            "angles": _round_angles(angles),
            "feedback": feedback,
            "problem_feedback": problem_items,
        }
        frame_log.append(entry)
        maybe_add_preview_frame(
            preview_frames,
            frame=frame,
            pose_landmarks=pose_landmarks,
            entry=entry,
            include_preview=include_preview,
            preview_max_frames=preview_max_frames,
            preview_stride=preview_stride,
            preview_rep_issues=preview_rep_issues,
        )

    summary = build_session_summary(
        exercise=exercise,
        camera_view=camera_view,
        camera_view_counts=camera_view_detector.counts,
        pose_backend=pose_backend,
        frame_count=len(encoded_frames),
        frame_log=frame_log,
        issue_counts=issue_counts,
        phase_counts=phase_counts,
        visibility_failures=visibility_failures,
        angle_values=angle_values,
        rep_count=rep_count,
        elapsed_ms=int((time.time() - started_at) * 1000),
    )

    llm = {
        "enabled": False,
        "model": GEMINI_MODEL,
        "max_output_tokens": GEMINI_MAX_OUTPUT_TOKENS,
        "prompt_chars": 0,
        "finish_reason": None,
        "usage_metadata": None,
        "recommendations": local_recommendations(summary),
        "error": None,
    }
    if call_llm:
        prompt = build_gemini_posture_prompt(summary, frame_log)
        llm["enabled"] = True
        llm["prompt_chars"] = len(prompt)
        llm_result = call_gemini_posture_coach(prompt)
        llm.update(llm_result)

    return {
        "exercise": exercise,
        "camera_view": camera_view,
        "pose_backend": pose_backend,
        "summary": summary,
        "llm": llm,
        "frame_log": frame_log,
        "preview_frames": preview_frames,
    }


def _round_angles(angles: dict[str, float]) -> dict[str, float]:
    return {name: round(float(value), 2) for name, value in angles.items()}
