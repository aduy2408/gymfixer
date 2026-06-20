from __future__ import annotations

from collections import Counter
from typing import Any

from posture.sessions_related.feedback_classifier import problem_feedback
from posture.sessions_related.llm_coach import POSTURE_LLM_MAX_LOG_FRAMES
from posture.rep_breakdown import build_rep_breakdown


def build_session_summary(
    *,
    exercise: str,
    camera_view: str,
    camera_view_counts: Counter[str],
    pose_backend: str,
    frame_count: int,
    frame_log: list[dict[str, Any]],
    issue_counts: Counter[str],
    phase_counts: Counter[str],
    visibility_failures: Counter[str],
    angle_values: dict[str, list[float]],
    rep_count: int,
    elapsed_ms: int,
) -> dict[str, Any]:
    ok_frames = sum(1 for entry in frame_log if entry.get("status") == "ok")
    no_pose_frames = sum(1 for entry in frame_log if entry.get("status") == "no_pose")
    visibility_failed_frames = sum(
        1 for entry in frame_log if entry.get("status") == "visibility_failed"
    )
    waiting_for_subject_frames = sum(
        1 for entry in frame_log if entry.get("status") == "waiting_for_subject"
    )
    unsupported_view_frames = sum(
        1 for entry in frame_log if entry.get("status") == "unsupported_camera_view"
    )
    decode_errors = sum(1 for entry in frame_log if entry.get("status") == "decode_error")

    angle_stats = {}
    for name, values in angle_values.items():
        if not values:
            continue
        angle_stats[name] = {
            "min": round(min(values), 2),
            "max": round(max(values), 2),
            "avg": round(sum(values) / len(values), 2),
        }

    rep_breakdown = build_rep_breakdown(
        frame_log,
        exercise=exercise,
        total_reps=rep_count,
        problem_feedback_fn=problem_feedback,
    )
    issue_counts.update(
        issue
        for rep in rep_breakdown
        if not rep.get("completed")
        for issue in rep.get("issues", [])
    )
    detected_camera_view = None
    camera_view_confidence = None
    if camera_view == "auto":
        ok_view_entries = [
            entry
            for entry in frame_log
            if entry.get("status") == "ok" and entry.get("camera_view")
        ]
        if camera_view_counts:
            detected_camera_view = camera_view_counts.most_common(1)[0][0]
        if ok_view_entries:
            confidences = [
                float(entry["camera_view_confidence"])
                for entry in ok_view_entries
                if entry.get("camera_view_confidence") is not None
            ]
            if confidences:
                camera_view_confidence = round(sum(confidences) / len(confidences), 3)

    return {
        "exercise": exercise,
        "camera_view": detected_camera_view or camera_view,
        "camera_view_requested": camera_view,
        "camera_view_counts": dict(camera_view_counts),
        "camera_view_confidence": camera_view_confidence,
        "pose_backend": pose_backend,
        "frames_received": frame_count,
        "frames_analyzed": ok_frames,
        "analysis_quality": build_analysis_quality(frame_log),
        "no_pose_frames": no_pose_frames,
        "visibility_failed_frames": visibility_failed_frames,
        "waiting_for_subject_frames": waiting_for_subject_frames,
        "unsupported_view_frames": unsupported_view_frames,
        "decode_errors": decode_errors,
        "rep_count": rep_count,
        "rep_breakdown": rep_breakdown,
        "phase_counts": dict(phase_counts),
        "top_feedback": dict(issue_counts.most_common(8)),
        "visibility_failures": dict(visibility_failures.most_common()),
        "angle_stats": angle_stats,
        "processing_ms": elapsed_ms,
        "llm_log_frame_limit": POSTURE_LLM_MAX_LOG_FRAMES,
    }


def build_analysis_quality(frame_log: list[dict[str, Any]]) -> dict[str, Any]:
    ok_indices = [
        entry["frame_index"]
        for entry in frame_log
        if entry.get("status") == "ok"
    ]
    if not ok_indices:
        return {
            "usable_frames": 0,
            "active_window_frames": 0,
            "active_window_usable_ratio": 0.0,
            "note": "No usable pose frames were detected.",
        }

    first_ok = min(ok_indices)
    last_ok = max(ok_indices)
    active_window = [
        entry
        for entry in frame_log
        if first_ok <= entry.get("frame_index", -1) <= last_ok
    ]
    active_window_frames = len(active_window)
    active_ok_frames = sum(1 for entry in active_window if entry.get("status") == "ok")
    active_ratio = active_ok_frames / active_window_frames if active_window_frames else 0.0

    return {
        "usable_frames": len(ok_indices),
        "first_usable_frame": first_ok,
        "last_usable_frame": last_ok,
        "active_window_frames": active_window_frames,
        "active_window_usable_ratio": round(active_ratio, 3),
        "setup_frames_before_subject_visible": first_ok,
        "frames_after_last_usable_pose": max(0, len(frame_log) - last_ok - 1),
        "note": (
            "Use active_window_usable_ratio to judge camera reliability. "
            "Frames before first_usable_frame are often setup/walk-in frames and "
            "should not be treated as form-analysis failure."
        ),
    }


def local_recommendations(summary: dict[str, Any]) -> str:
    if (
        summary.get("exercise") == "romanian_deadlift"
        and not summary.get("frames_analyzed")
        and summary.get("unsupported_view_frames")
    ):
        return (
            "No usable side-view frames were found. Record the full body and both hands "
            "from the side, then upload the video again."
        )
    top_feedback = list(summary.get("top_feedback", {}).keys())
    if not top_feedback:
        return "No reliable posture issues were detected in the submitted frames."

    cues = "\n".join(f"- {item}" for item in top_feedback[:5])
    return f"Focus on these corrections next set:\n{cues}"
