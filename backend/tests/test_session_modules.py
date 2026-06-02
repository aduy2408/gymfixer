from collections import Counter, defaultdict

import numpy as np

from posture.sessions_related.preview_frames import maybe_add_preview_frame
from posture.sessions_related.session_models import normalise_camera_view, normalise_pose_backend
from posture.sessions_related.session_summary import build_session_summary, local_recommendations


def test_normalise_camera_view_accepts_auto_aliases():
    assert normalise_camera_view("detect") == "auto"
    assert normalise_camera_view("45-degree") == "three_quarter"
    assert normalise_camera_view("front") == "front"


def test_normalise_pose_backend_accepts_aliases():
    assert normalise_pose_backend("mp") == "mediapipe"
    assert normalise_pose_backend("vit") == "vitpose"


def test_session_summary_includes_camera_counts_rep_breakdown_and_feedback():
    frame_log = [
        {
            "frame_index": 1,
            "timestamp_ms": 100,
            "status": "ok",
            "camera_view": "front",
            "camera_view_confidence": 0.8,
            "phase": "DESCENDING",
            "rep_count": 0,
            "angles": {"front_knee": 140},
            "feedback": ["Go deeper — lower into the lunge."],
            "problem_feedback": ["Go deeper — lower into the lunge."],
        },
        {
            "frame_index": 2,
            "timestamp_ms": 200,
            "status": "ok",
            "camera_view": "front",
            "camera_view_confidence": 0.9,
            "phase": "BOTTOM",
            "rep_count": 0,
            "angles": {"front_knee": 110},
            "feedback": [],
            "problem_feedback": [],
        },
        {
            "frame_index": 3,
            "timestamp_ms": 300,
            "status": "ok",
            "camera_view": "front",
            "camera_view_confidence": 0.85,
            "phase": "STANDING",
            "rep_count": 1,
            "angles": {"front_knee": 165},
            "feedback": [],
            "problem_feedback": [],
        },
    ]

    summary = build_session_summary(
        exercise="lunge",
        camera_view="auto",
        camera_view_counts=Counter({"front": 3}),
        pose_backend="mediapipe",
        frame_count=3,
        frame_log=frame_log,
        issue_counts=Counter({"Go deeper — lower into the lunge.": 1}),
        phase_counts=Counter({"DESCENDING": 1, "BOTTOM": 1, "STANDING": 1}),
        visibility_failures=Counter(),
        angle_values=defaultdict(list, {"front_knee": [140, 110, 165]}),
        rep_count=1,
        elapsed_ms=123,
    )

    assert summary["camera_view"] == "front"
    assert summary["camera_view_requested"] == "auto"
    assert summary["camera_view_counts"] == {"front": 3}
    assert summary["rep_breakdown"][0]["completed"] is True
    assert "Go deeper — lower into the lunge." in summary["top_feedback"]


def test_local_recommendations_lists_top_feedback():
    text = local_recommendations({"top_feedback": {"Go deeper.": 2}})

    assert "Go deeper." in text


def test_preview_keeps_repeated_issue_for_new_rep():
    frame = np.zeros((24, 32, 3), dtype=np.uint8)
    preview_frames = []
    preview_rep_issues: set[tuple[int, str]] = set()
    issue = "Go deeper — aim for depth."

    maybe_add_preview_frame(
        preview_frames,
        frame=frame,
        pose_landmarks=None,
        entry=_entry(frame_index=1, rep_count=0, issue=issue),
        include_preview=True,
        preview_max_frames=2,
        preview_stride=1,
        preview_rep_issues=preview_rep_issues,
    )
    maybe_add_preview_frame(
        preview_frames,
        frame=frame,
        pose_landmarks=None,
        entry=_entry(frame_index=2, rep_count=1, issue=issue),
        include_preview=True,
        preview_max_frames=2,
        preview_stride=1,
        preview_rep_issues=preview_rep_issues,
    )

    assert len(preview_frames) == 2
    assert (0, issue) in preview_rep_issues
    assert (1, issue) in preview_rep_issues


def _entry(*, frame_index: int, rep_count: int, issue: str) -> dict:
    return {
        "frame_index": frame_index,
        "timestamp_ms": frame_index * 100,
        "status": "ok",
        "phase": "BOTTOM",
        "rep_count": rep_count,
        "feedback": [issue],
    }
