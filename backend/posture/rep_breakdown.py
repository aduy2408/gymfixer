from __future__ import annotations

from collections import Counter, defaultdict
from typing import Any, Callable


INCOMPLETE_REP_ISSUES = {
    "squat": "Complete the rep — reach squat depth before standing up.",
    "lunge": "Complete the rep — lower into the lunge before standing up.",
    "romanian_deadlift": "Complete the rep — hinge deeper before returning to standing.",
    "fly_pec": "Complete the rep — bring the handle forward before reopening.",
}
INCOMPLETE_SQUAT_REP_ISSUE = INCOMPLETE_REP_ISSUES["squat"]
INCOMPLETE_LUNGE_REP_ISSUE = INCOMPLETE_REP_ISSUES["lunge"]


def build_rep_breakdown(
    frame_log: list[dict[str, Any]],
    *,
    exercise: str,
    total_reps: int,
    problem_feedback_fn: Callable[[list[str]], list[str]] | None = None,
) -> list[dict[str, Any]]:
    phase_sets = {
        "bicep_curl": {
            "idle": {"EXTENDED"},
            "active": {"CURLING", "CONTRACTED", "LOWERING"},
        },
        "squat": {
            "idle": {"STANDING"},
            "active": {"DESCENDING", "BOTTOM", "ASCENDING"},
        },
        "lunge": {
            "idle": {"STANDING"},
            "active": {"DESCENDING", "BOTTOM", "ASCENDING"},
        },
        "romanian_deadlift": {
            "idle": {"STANDING"},
            "active": {"DESCENDING", "BOTTOM", "ASCENDING"},
        },
        "fly_pec": {
            "idle": {"OPEN"},
            "active": {"CLOSING", "CLOSED", "OPENING"},
        },
    }
    phases = phase_sets.get(exercise)
    if not phases:
        return []

    reps: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    completed_reps_seen = 0

    for entry in frame_log:
        if entry.get("status") != "ok":
            continue

        phase = entry.get("phase")
        rep_count = int(entry.get("rep_count") or 0)
        is_active = phase in phases["active"]

        if current is None and is_active:
            current = _new_rep_accumulator(
                rep_number=completed_reps_seen + 1,
                entry=entry,
            )

        if current is not None:
            _add_entry_to_rep(current, entry, problem_feedback_fn=problem_feedback_fn)

        if current is not None and rep_count > completed_reps_seen:
            current["rep_number"] = rep_count
            reps.append(_finalise_rep_accumulator(current, completed=True))
            current = None
            completed_reps_seen = rep_count
            continue

        if (
            exercise in INCOMPLETE_REP_ISSUES
            and current is not None
            and phase in phases["idle"]
            and not current.get("saw_bottom")
        ):
            _add_incomplete_issue(current, exercise)
            reps.append(_finalise_rep_accumulator(current, completed=False))
            current = None

    if current is not None:
        if exercise in INCOMPLETE_REP_ISSUES:
            _add_incomplete_issue(current, exercise)
        reps.append(_finalise_rep_accumulator(current, completed=False))

    completed_numbers = {
        int(rep["rep_number"])
        for rep in reps
        if rep["completed"] and rep.get("rep_number") is not None
    }
    for missing_number in range(1, total_reps + 1):
        if missing_number in completed_numbers:
            continue
        reps.append(
            {
                "rep_number": missing_number,
                "completed": True,
                "start_frame": None,
                "end_frame": None,
                "start_ms": None,
                "end_ms": None,
                "duration_ms": None,
                "frame_count": 0,
                "phases": [],
                "issues": [],
                "issue_counts": {},
                "angle_stats": {},
            }
        )

    return sorted(reps, key=lambda rep: (int(rep["rep_number"]), not rep["completed"]))


def _new_rep_accumulator(rep_number: int, entry: dict[str, Any]) -> dict[str, Any]:
    return {
        "rep_number": rep_number,
        "start_frame": entry.get("frame_index"),
        "end_frame": entry.get("frame_index"),
        "start_ms": entry.get("timestamp_ms"),
        "end_ms": entry.get("timestamp_ms"),
        "frame_count": 0,
        "phases": Counter(),
        "issue_counts": Counter(),
        "angle_values": defaultdict(list),
        "saw_bottom": False,
    }


def _add_entry_to_rep(
    rep: dict[str, Any],
    entry: dict[str, Any],
    *,
    problem_feedback_fn: Callable[[list[str]], list[str]] | None,
) -> None:
    rep["end_frame"] = entry.get("frame_index")
    rep["end_ms"] = entry.get("timestamp_ms")
    rep["frame_count"] += 1
    phase = entry.get("phase")
    if phase:
        rep["phases"].update([phase])
        if phase in {"BOTTOM", "CLOSED"}:
            rep["saw_bottom"] = True

    problem_feedback = entry.get("problem_feedback")
    if problem_feedback is None and problem_feedback_fn is not None:
        problem_feedback = problem_feedback_fn(entry.get("feedback") or [])
    rep["issue_counts"].update(problem_feedback or [])

    for name, value in (entry.get("angles") or {}).items():
        rep["angle_values"][name].append(float(value))


def _add_incomplete_issue(rep: dict[str, Any], exercise: str) -> None:
    issue = INCOMPLETE_REP_ISSUES.get(exercise)
    if issue:
        rep["issue_counts"].update([issue])


def _finalise_rep_accumulator(rep: dict[str, Any], *, completed: bool) -> dict[str, Any]:
    start_ms = rep.get("start_ms")
    end_ms = rep.get("end_ms")
    duration_ms = None
    if start_ms is not None and end_ms is not None:
        duration_ms = max(0, int(end_ms) - int(start_ms))

    angle_stats = {}
    for name, values in rep["angle_values"].items():
        if not values:
            continue
        angle_stats[name] = {
            "min": round(min(values), 2),
            "max": round(max(values), 2),
            "avg": round(sum(values) / len(values), 2),
        }

    issue_counts = dict(rep["issue_counts"].most_common())
    return {
        "rep_number": int(rep["rep_number"]),
        "completed": completed,
        "start_frame": rep.get("start_frame"),
        "end_frame": rep.get("end_frame"),
        "start_ms": start_ms,
        "end_ms": end_ms,
        "duration_ms": duration_ms,
        "frame_count": int(rep["frame_count"]),
        "phases": list(rep["phases"].keys()),
        "issues": list(issue_counts.keys()),
        "issue_counts": issue_counts,
        "angle_stats": angle_stats,
    }
