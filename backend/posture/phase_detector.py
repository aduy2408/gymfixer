"""Compatibility facade for exercise-specific phase detectors."""

from __future__ import annotations

from posture.exercises.registry import PHASE_DETECTORS


class PhaseDetector:
    """Unified phase detector for supported exercises."""

    _SUPPORTED = PHASE_DETECTORS

    def __init__(self, exercise: str):
        self.exercise = exercise
        cls = self._SUPPORTED.get(exercise)
        self._impl = cls() if cls else None

    def update(self, angles: dict) -> tuple[str | None, int]:
        if self._impl is None:
            return None, 0
        phase, reps = self._impl.update(angles)
        return phase.value, reps

    def reset(self) -> None:
        if self._impl is not None:
            self._impl.reset()

    @property
    def rep_count(self) -> int:
        if self._impl is None:
            return 0
        return self._impl.rep_count

    @property
    def phase(self) -> str | None:
        if self._impl is None:
            return None
        return self._impl.phase.value
