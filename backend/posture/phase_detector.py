"""Phase detection state machines for gym exercises.

Each PhaseDetector tracks the current movement phase and rep count for a
specific exercise. Only squat and bicep curl are fully implemented; other
exercises pass through unchanged.

Usage:
    detector = PhaseDetector("squat")
    phase, rep_count = detector.update(angles)
    detector.reset()
"""

from __future__ import annotations
import logging
from enum import Enum
from collections import deque

logger = logging.getLogger("posture.phase_detector")


# ---------------------------------------------------------------------------
# Phase enums
# ---------------------------------------------------------------------------

class SquatPhase(str, Enum):
    STANDING   = "STANDING"
    DESCENDING = "DESCENDING"
    BOTTOM     = "BOTTOM"
    ASCENDING  = "ASCENDING"


class BicepCurlPhase(str, Enum):
    EXTENDED    = "EXTENDED"
    CURLING     = "CURLING"
    CONTRACTED  = "CONTRACTED"
    LOWERING    = "LOWERING"


# ---------------------------------------------------------------------------
# Angle smoothing buffer (median of last N frames to suppress outlier spikes)
# ---------------------------------------------------------------------------

class _AngleBuffer:
    def __init__(self, size: int = 5):
        self._buf: deque[float] = deque(maxlen=size)

    def push(self, value: float) -> float:
        self._buf.append(value)
        sorted_vals = sorted(self._buf)
        n = len(sorted_vals)
        mid = n // 2
        if n % 2 == 0:
            return (sorted_vals[mid - 1] + sorted_vals[mid]) / 2.0
        return sorted_vals[mid]

    def reset(self):
        self._buf.clear()


# ---------------------------------------------------------------------------
# Squat state machine
# ---------------------------------------------------------------------------
#
# Angle thresholds (degrees):
#   STANDING  : avg_knee > STAND_THRESH
#   DESCENDING: BOTTOM_THRESH < avg_knee <= STAND_THRESH  (going down)
#   BOTTOM    : avg_knee <= BOTTOM_THRESH
#   ASCENDING : BOTTOM_THRESH < avg_knee <= STAND_THRESH  (going up)
#
# Rep counted when: ASCENDING → STANDING

_SQ_STAND_THRESH  = 150   # above this = standing
_SQ_BOTTOM_THRESH = 100   # below this = at bottom
_ANGLE_DIRECTION_EPS = 1.5  # degrees; ignore tiny jitter when inferring direction

class _SquatDetector:
    def __init__(self):
        self.phase: SquatPhase = SquatPhase.STANDING
        self.rep_count: int = 0
        self._knee_buf = _AngleBuffer(size=4)
        self._last_avg_knee: float | None = None

    def update(self, angles: dict) -> tuple[SquatPhase, int]:
        rk = angles.get('right_knee', 180.0)
        lk = angles.get('left_knee', 180.0)
        raw_avg = (rk + lk) / 2.0
        avg_knee = self._knee_buf.push(raw_avg)

        prev = self.phase
        delta = None
        if self._last_avg_knee is not None:
            delta = avg_knee - self._last_avg_knee

        if avg_knee > _SQ_STAND_THRESH:
            if prev == SquatPhase.ASCENDING:
                self.rep_count += 1
                logger.info(f"Squat rep counted: {self.rep_count}")
            self.phase = SquatPhase.STANDING

        elif avg_knee <= _SQ_BOTTOM_THRESH:
            self.phase = SquatPhase.BOTTOM

        else:
            # Mid-range: knee angle decreases while descending and increases
            # while ascending. Fall back to previous phase when motion is flat.
            if delta is not None and delta < -_ANGLE_DIRECTION_EPS:
                self.phase = SquatPhase.DESCENDING
            elif delta is not None and delta > _ANGLE_DIRECTION_EPS:
                self.phase = SquatPhase.ASCENDING
            elif prev in (SquatPhase.STANDING, SquatPhase.DESCENDING):
                self.phase = SquatPhase.DESCENDING
            elif prev in (SquatPhase.BOTTOM, SquatPhase.ASCENDING):
                self.phase = SquatPhase.ASCENDING
            else:
                self.phase = SquatPhase.DESCENDING

        self._last_avg_knee = avg_knee
        return self.phase, self.rep_count

    def reset(self):
        self.phase = SquatPhase.STANDING
        self.rep_count = 0
        self._knee_buf.reset()
        self._last_avg_knee = None


# ---------------------------------------------------------------------------
# Bicep curl state machine
# ---------------------------------------------------------------------------
#
# Angle thresholds (degrees):
#   EXTENDED    : avg_elbow > EXTEND_THRESH
#   CURLING     : CONTRACTED_THRESH < avg_elbow <= EXTEND_THRESH  (going up)
#   CONTRACTED  : avg_elbow <= CONTRACTED_THRESH
#   LOWERING    : CONTRACTED_THRESH < avg_elbow <= EXTEND_THRESH  (going down)
#
# Rep counted when: LOWERING → EXTENDED

_CURL_EXTEND_THRESH = 120      # above this = returned to bottom/extended enough
_CURL_CONTRACTED_THRESH = 100  # below this = curled high enough to count the rep


class _SingleArmCurlDetector:
    def __init__(self):
        self.phase: BicepCurlPhase = BicepCurlPhase.EXTENDED
        self.rep_count: int = 0
        self._angle_buf = _AngleBuffer(size=1)
        self._last_angle: float | None = None

    def update(self, raw_angle: float) -> tuple[BicepCurlPhase, int]:
        angle = self._angle_buf.push(raw_angle)
        prev = self.phase
        delta = None
        if self._last_angle is not None:
            delta = angle - self._last_angle

        if angle >= _CURL_EXTEND_THRESH:
            if prev in (BicepCurlPhase.CONTRACTED, BicepCurlPhase.LOWERING):
                self.rep_count += 1
                logger.info(f"Bicep curl arm rep counted: {self.rep_count}")
            self.phase = BicepCurlPhase.EXTENDED
        elif angle <= _CURL_CONTRACTED_THRESH:
            self.phase = BicepCurlPhase.CONTRACTED
        else:
            if delta is not None and delta < -_ANGLE_DIRECTION_EPS:
                self.phase = BicepCurlPhase.CURLING
            elif delta is not None and delta > _ANGLE_DIRECTION_EPS:
                self.phase = BicepCurlPhase.LOWERING
            elif prev in (BicepCurlPhase.EXTENDED, BicepCurlPhase.CURLING):
                self.phase = BicepCurlPhase.CURLING
            else:
                self.phase = BicepCurlPhase.LOWERING

        self._last_angle = angle
        return self.phase, self.rep_count

    def reset(self):
        self.phase = BicepCurlPhase.EXTENDED
        self.rep_count = 0
        self._angle_buf.reset()
        self._last_angle = None


class _BicepCurlDetector:
    def __init__(self):
        self.phase: BicepCurlPhase = BicepCurlPhase.EXTENDED
        self.rep_count: int = 0
        self._arms = {
            "left": _SingleArmCurlDetector(),
            "right": _SingleArmCurlDetector(),
        }

    def update(self, angles: dict) -> tuple[BicepCurlPhase, int]:
        updated_phases: list[BicepCurlPhase] = []
        for side in ("left", "right"):
            value = angles.get(f"{side}_elbow")
            if value is None:
                continue
            phase, _reps = self._arms[side].update(float(value))
            updated_phases.append(phase)

        if not updated_phases:
            return self.phase, self.rep_count

        self.rep_count = max(arm.rep_count for arm in self._arms.values())
        self.phase = self._combined_phase(updated_phases)
        return self.phase, self.rep_count

    def reset(self):
        self.phase = BicepCurlPhase.EXTENDED
        self.rep_count = 0
        for arm in self._arms.values():
            arm.reset()

    def _combined_phase(self, phases: list[BicepCurlPhase]) -> BicepCurlPhase:
        for phase in (
            BicepCurlPhase.LOWERING,
            BicepCurlPhase.CONTRACTED,
            BicepCurlPhase.CURLING,
        ):
            if phase in phases:
                return phase
        return BicepCurlPhase.EXTENDED


# ---------------------------------------------------------------------------
# Public facade
# ---------------------------------------------------------------------------

class PhaseDetector:
    """Unified phase detector for all supported exercises.

    For squat and bicep_curl: full state machine + rep counting.
    For other exercises: returns phase=None, rep_count=0.

    Example:
        detector = PhaseDetector("squat")
        phase, rep_count = detector.update(angles)
        # phase is a SquatPhase enum value, e.g. SquatPhase.BOTTOM
        print(phase.value, rep_count)   # "BOTTOM" 3
    """

    _SUPPORTED = {
        'squat': _SquatDetector,
        'bicep_curl': _BicepCurlDetector,
    }

    def __init__(self, exercise: str):
        self.exercise = exercise
        cls = self._SUPPORTED.get(exercise)
        self._impl = cls() if cls else None

    def update(self, angles: dict) -> tuple[str | None, int]:
        """Update state machine with latest angles.

        Returns:
            (phase_str, rep_count) where phase_str is the enum .value string
            or None for unsupported exercises.
        """
        if self._impl is None:
            return None, 0
        phase, reps = self._impl.update(angles)
        return phase.value, reps

    def reset(self):
        """Reset phase and rep counter (call when exercise changes)."""
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
