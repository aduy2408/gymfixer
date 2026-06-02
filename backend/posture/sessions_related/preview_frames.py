from __future__ import annotations

import base64
from typing import Any

from posture import visualizer
from posture.sessions_related.feedback_classifier import problem_feedback


def maybe_add_preview_frame(
    preview_frames: list[dict[str, Any]],
    *,
    frame,
    pose_landmarks,
    entry: dict[str, Any],
    include_preview: bool,
    preview_max_frames: int,
    preview_stride: int,
    preview_rep_issues: set[tuple[int, str]] | None = None,
    force: bool = False,
) -> None:
    if not include_preview or frame is None:
        return

    entry_issues = problem_feedback(entry.get("feedback") or [])
    rep_count = int(entry.get("rep_count") or 0)
    has_new_rep_issue = bool(
        preview_rep_issues is not None
        and any((rep_count, issue) not in preview_rep_issues for issue in entry_issues)
    )
    if len(preview_frames) >= preview_max_frames:
        if not has_new_rep_issue:
            return
        preview_frames.pop(0)

    if not _should_add_preview_frame(
        preview_frames,
        entry=entry,
        preview_stride=preview_stride,
        preview_rep_issues=preview_rep_issues,
        force=force,
    ):
        return

    skeleton_bytes = visualizer.draw_skeleton_bytes(
        frame,
        pose_landmarks=pose_landmarks,
        draw=pose_landmarks is not None,
    )
    height, width = frame.shape[:2]
    preview_frames.append(
        {
            "frame_index": int(entry.get("frame_index", 0)),
            "timestamp_ms": entry.get("timestamp_ms"),
            "width": width,
            "height": height,
            "status": entry.get("status"),
            "phase": entry.get("phase"),
            "rep_count": entry.get("rep_count"),
            "feedback": entry.get("feedback"),
            "problem_feedback": problem_feedback(entry.get("feedback") or []),
            "preview_reason": _preview_reason(preview_frames, entry, force=force),
            "image": (
                "data:image/jpeg;base64,"
                + base64.b64encode(skeleton_bytes).decode("ascii")
            ),
        }
    )
    if preview_rep_issues is not None:
        rep_count = int(entry.get("rep_count") or 0)
        for issue in problem_feedback(entry.get("feedback") or []):
            preview_rep_issues.add((rep_count, issue))


def _should_add_preview_frame(
    preview_frames: list[dict[str, Any]],
    *,
    entry: dict[str, Any],
    preview_stride: int,
    preview_rep_issues: set[tuple[int, str]] | None,
    force: bool,
) -> bool:
    frame_index = int(entry.get("frame_index", 0))
    entry_issues = problem_feedback(entry.get("feedback") or [])
    rep_count = int(entry.get("rep_count") or 0)
    has_new_rep_issue = bool(
        preview_rep_issues is not None
        and any((rep_count, issue) not in preview_rep_issues for issue in entry_issues)
    )
    if has_new_rep_issue:
        return True

    min_gap = max(1, preview_stride)
    last_frame = preview_frames[-1]["frame_index"] if preview_frames else None
    is_spaced = last_frame is None or frame_index - int(last_frame) >= min_gap
    if not is_spaced:
        return False

    if not entry_issues:
        return False
    existing_issues = {
        issue
        for preview in preview_frames
        for issue in problem_feedback(preview.get("feedback") or [])
    }
    has_new_issue = any(issue not in existing_issues for issue in entry_issues)
    if has_new_issue:
        return True

    return force and frame_index % preview_stride == 0


def _preview_reason(
    preview_frames: list[dict[str, Any]],
    entry: dict[str, Any],
    *,
    force: bool,
) -> str:
    entry_issues = problem_feedback(entry.get("feedback") or [])
    existing_issues = {
        issue
        for preview in preview_frames
        for issue in problem_feedback(preview.get("feedback") or [])
    }
    if any(issue not in existing_issues for issue in entry_issues):
        return "new_issue"
    return "repeated_issue"
