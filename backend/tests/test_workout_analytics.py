from __future__ import annotations

from types import SimpleNamespace

from workout_routes import _build_analytics_summary


def session(exercise: str):
    return SimpleNamespace(exercise=exercise)


def result(**overrides):
    data = {
        "rep_count": 0,
        "top_feedback_json": {},
        "decode_errors": 0,
        "no_pose_frames": 0,
        "visibility_failed_frames": 0,
        "waiting_for_subject_frames": 0,
        "rep_breakdown_json": [],
        "quality_ratio": None,
        "processing_ms": None,
        "llm_enabled": False,
    }
    data.update(overrides)
    return SimpleNamespace(**data)


def test_analytics_summary_uses_completed_rows_only_and_counts_failures():
    completed_rows = [
        (
            session("squat"),
            result(
                rep_count=8,
                top_feedback_json={"Keep knees aligned.": 2},
                no_pose_frames=3,
                waiting_for_subject_frames=7,
                rep_breakdown_json=[
                    {
                        "rep_number": 1,
                        "issues": ["Keep knees aligned.", "Go deeper."],
                        "issue_counts": {"Keep knees aligned.": 10, "Go deeper.": 4},
                    },
                    {
                        "rep_number": 2,
                        "issues": ["Keep knees aligned."],
                        "issue_counts": {"Keep knees aligned.": 8},
                    },
                ],
                llm_enabled=True,
            ),
        ),
        (
            session("squat"),
            result(
                rep_count=6,
                top_feedback_json={"Keep knees aligned.": 1, "Go deeper.": 2},
                visibility_failed_frames=4,
                decode_errors=1,
                rep_breakdown_json=[
                    {
                        "rep_number": 1,
                        "issues": [],
                        "issue_counts": {"Go deeper.": 12},
                    },
                ],
            ),
        ),
        (
            session("bicep_curl"),
            result(
                rep_count=10,
                rep_breakdown_json=[
                    {
                        "rep_number": 1,
                        "issues": ["Control the lowering phase."],
                        "issue_counts": {"Control the lowering phase.": 5},
                    },
                ],
            ),
        ),
        (session("deadlift"), None),
    ]

    summary = _build_analytics_summary(completed_rows, [])

    assert summary["total_sessions"] == 4
    assert summary["completed_sessions"] == 4
    assert summary["total_reps"] == 24
    assert summary["sessions_by_exercise"] == {"squat": 2, "bicep_curl": 1, "deadlift": 1}
    assert summary["reps_by_exercise"] == {"squat": 14, "bicep_curl": 10}
    assert summary["top_feedback"] == {"Keep knees aligned.": 3, "Go deeper.": 2}
    assert summary["top_rep_issues"] == {
        "Keep knees aligned.": 2,
        "Go deeper.": 2,
        "Control the lowering phase.": 1,
    }
    assert summary["rep_issues_by_exercise"] == {
        "squat": {"Keep knees aligned.": 2, "Go deeper.": 2},
        "bicep_curl": {"Control the lowering phase.": 1},
    }
    assert summary["top_failures"] == {
        "Keep knees aligned.": 2,
        "Go deeper.": 2,
        "Control the lowering phase.": 1,
    }
    assert summary["llm_enabled_count"] == 1
