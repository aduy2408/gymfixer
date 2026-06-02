from __future__ import annotations

from collections import Counter, deque
from dataclasses import dataclass
from math import hypot
from typing import Any


class LandmarkIndex:
    LEFT_SHOULDER = 11
    RIGHT_SHOULDER = 12
    LEFT_HIP = 23
    RIGHT_HIP = 24
    LEFT_KNEE = 25
    RIGHT_KNEE = 26
    LEFT_ANKLE = 27
    RIGHT_ANKLE = 28


@dataclass(frozen=True)
class CameraViewEstimate:
    view: str
    confidence: float


class CameraViewDetector:
    """Estimate camera view from pose geometry without loading an ML model."""

    def __init__(self, *, window_size: int = 7, visibility_threshold: float = 0.5):
        self.window_size = window_size
        self.visibility_threshold = visibility_threshold
        self._recent: deque[CameraViewEstimate] = deque(maxlen=window_size)
        self.counts: Counter[str] = Counter()

    def update(self, landmarks: list[Any]) -> CameraViewEstimate:
        estimate = estimate_camera_view(
            landmarks,
            visibility_threshold=self.visibility_threshold,
        )
        self._recent.append(estimate)
        self.counts.update([estimate.view])
        return self.smoothed()

    def smoothed(self) -> CameraViewEstimate:
        if not self._recent:
            return CameraViewEstimate(view="three_quarter", confidence=0.0)

        weighted: Counter[str] = Counter()
        confidence_sum: Counter[str] = Counter()
        for estimate in self._recent:
            weighted[estimate.view] += max(0.05, estimate.confidence)
            confidence_sum[estimate.view] += estimate.confidence

        view, score = weighted.most_common(1)[0]
        total = sum(weighted.values()) or 1.0
        avg_confidence = confidence_sum[view] / max(1, sum(1 for item in self._recent if item.view == view))
        return CameraViewEstimate(
            view=view,
            confidence=round(min(1.0, (score / total + avg_confidence) / 2.0), 3),
        )


def estimate_camera_view(
    landmarks: list[Any],
    *,
    visibility_threshold: float = 0.5,
) -> CameraViewEstimate:
    if not landmarks or len(landmarks) <= LandmarkIndex.RIGHT_ANKLE:
        return CameraViewEstimate(view="three_quarter", confidence=0.0)

    required = [
        LandmarkIndex.LEFT_SHOULDER,
        LandmarkIndex.RIGHT_SHOULDER,
        LandmarkIndex.LEFT_HIP,
        LandmarkIndex.RIGHT_HIP,
    ]
    if not all(_visible(landmarks, idx, visibility_threshold) for idx in required):
        return CameraViewEstimate(view="three_quarter", confidence=0.2)

    left_shoulder = landmarks[LandmarkIndex.LEFT_SHOULDER]
    right_shoulder = landmarks[LandmarkIndex.RIGHT_SHOULDER]
    left_hip = landmarks[LandmarkIndex.LEFT_HIP]
    right_hip = landmarks[LandmarkIndex.RIGHT_HIP]

    torso_height = _avg_distance(
        (left_shoulder, left_hip),
        (right_shoulder, right_hip),
    )
    if torso_height <= 0:
        return CameraViewEstimate(view="three_quarter", confidence=0.0)

    shoulder_width = _distance(left_shoulder, right_shoulder) / torso_height
    hip_width = _distance(left_hip, right_hip) / torso_height
    width_score = (shoulder_width + hip_width) / 2.0

    symmetry_score = _visibility_symmetry(landmarks, visibility_threshold)
    z_score = _z_separation_score(landmarks, torso_height)

    # Front-facing frames show clear left/right body width. Side-facing frames
    # collapse left/right points in image space, often with one side less visible.
    if width_score >= 0.55 and symmetry_score >= 0.65:
        confidence = _clamp((width_score - 0.45) / 0.45 * 0.7 + symmetry_score * 0.3)
        return CameraViewEstimate(view="front", confidence=round(confidence, 3))

    if width_score <= 0.32 or (width_score <= 0.42 and (symmetry_score < 0.55 or z_score > 0.45)):
        confidence = _clamp((0.45 - width_score) / 0.35 * 0.7 + (1.0 - symmetry_score) * 0.3)
        return CameraViewEstimate(view="side", confidence=round(confidence, 3))

    confidence = _clamp(1.0 - abs(width_score - 0.46) / 0.35)
    return CameraViewEstimate(view="three_quarter", confidence=round(confidence, 3))


def _visible(landmarks: list[Any], idx: int, threshold: float) -> bool:
    try:
        return getattr(landmarks[idx], "visibility", 1.0) >= threshold
    except (IndexError, ValueError):
        return False


def _distance(a: Any, b: Any) -> float:
    return hypot(float(a.x) - float(b.x), float(a.y) - float(b.y))


def _avg_distance(*pairs: tuple[Any, Any]) -> float:
    distances = [_distance(a, b) for a, b in pairs]
    return sum(distances) / len(distances) if distances else 0.0


def _visibility_symmetry(landmarks: list[Any], threshold: float) -> float:
    pairs = [
        (LandmarkIndex.LEFT_SHOULDER, LandmarkIndex.RIGHT_SHOULDER),
        (LandmarkIndex.LEFT_HIP, LandmarkIndex.RIGHT_HIP),
        (LandmarkIndex.LEFT_KNEE, LandmarkIndex.RIGHT_KNEE),
        (LandmarkIndex.LEFT_ANKLE, LandmarkIndex.RIGHT_ANKLE),
    ]
    scores = []
    for left, right in pairs:
        if not _visible(landmarks, left, threshold) or not _visible(landmarks, right, threshold):
            continue
        lv = float(getattr(landmarks[left], "visibility", 1.0))
        rv = float(getattr(landmarks[right], "visibility", 1.0))
        scores.append(1.0 - min(1.0, abs(lv - rv)))
    return sum(scores) / len(scores) if scores else 0.5


def _z_separation_score(landmarks: list[Any], torso_height: float) -> float:
    pairs = [
        (LandmarkIndex.LEFT_SHOULDER, LandmarkIndex.RIGHT_SHOULDER),
        (LandmarkIndex.LEFT_HIP, LandmarkIndex.RIGHT_HIP),
    ]
    values = []
    for left, right in pairs:
        try:
            values.append(abs(float(landmarks[left].z) - float(landmarks[right].z)) / torso_height)
        except (AttributeError, IndexError, TypeError, ValueError):
            continue
    return max(values) if values else 0.0


def _clamp(value: float) -> float:
    return max(0.0, min(1.0, value))
