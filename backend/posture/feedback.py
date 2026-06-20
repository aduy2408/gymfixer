"""Compatibility facade for exercise-specific feedback generators."""

from __future__ import annotations

from posture.exercises.registry import FEEDBACK_FUNCTIONS


def generate_feedback(
    exercise: str,
    angles: dict,
    phase: str | None = None,
    camera_view: str | None = "side",
) -> list[str]:
    fn = FEEDBACK_FUNCTIONS.get(exercise)
    if fn is None:
        return ["Exercise not supported yet."]
    if exercise in {"bicep_curl", "squat", "lunge", "romanian_deadlift"}:
        return fn(angles, phase=phase, camera_view=camera_view)
    return fn(angles, phase=phase)
