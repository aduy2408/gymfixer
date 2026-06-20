from __future__ import annotations

import logging
import math
import os
import sys
import types
from collections import deque


logger = logging.getLogger("posture.exercises")


def import_mediapipe():
    # MediaPipe 0.10.x imports its audio Tasks API at package import time. On
    # headless Linux, sounddevice/PortAudio can hang while probing audio devices,
    # even though GymFixer only uses pose estimation.
    if os.getenv("POSTURE_DISABLE_MEDIAPIPE_AUDIO", "1") == "1" and "sounddevice" not in sys.modules:
        sys.modules["sounddevice"] = types.ModuleType("sounddevice")
    import mediapipe as mp

    return mp


class _LazyMediaPipePose:
    def __getattr__(self, name: str):
        mp = import_mediapipe()
        return getattr(mp.solutions.pose, name)


mp_pose = _LazyMediaPipePose()


class AngleBuffer:
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

    def reset(self) -> None:
        self._buf.clear()


VIS_THRESHOLD = 0.5


def set_visibility_threshold(value: float) -> None:
    global VIS_THRESHOLD
    VIS_THRESHOLD = float(value)


def safe_angle(a, b, c):
    try:
        ba_x = a.x - b.x
        ba_y = a.y - b.y
        bc_x = c.x - b.x
        bc_y = c.y - b.y

        denom = math.hypot(ba_x, ba_y) * math.hypot(bc_x, bc_y)
        if denom == 0:
            return None
        cosine_angle = (ba_x * bc_x + ba_y * bc_y) / denom
        cosine_angle = max(min(cosine_angle, 1.0), -1.0)
        return math.degrees(math.acos(cosine_angle))
    except Exception:
        logger.exception("Error calculating angle")
        return None


def vertical_lean_degrees(top, bottom) -> float | None:
    try:
        dx = float(top.x) - float(bottom.x)
        dy = float(bottom.y) - float(top.y)
        length = math.hypot(dx, dy)
        if length == 0:
            return None
        return math.degrees(math.atan2(abs(dx), abs(dy)))
    except Exception:
        logger.exception("Error calculating vertical lean")
        return None


def point_distance(a, b) -> float | None:
    try:
        return math.hypot(float(a.x) - float(b.x), float(a.y) - float(b.y))
    except Exception:
        logger.exception("Error calculating point distance")
        return None


def has_enough_landmarks(landmarks) -> bool:
    return bool(landmarks) and len(landmarks) >= 33


def landmarks_visible(landmarks, indices) -> bool:
    if not has_enough_landmarks(landmarks):
        return False
    for idx in indices:
        try:
            if getattr(landmarks[idx], "visibility", 1.0) < VIS_THRESHOLD:
                return False
        except (IndexError, ValueError):
            return False
    return True


def normalise_camera_view(camera_view: str | None) -> str:
    value = (camera_view or "side").strip().lower().replace("-", "_")
    aliases = {
        "45": "three_quarter",
        "45_degree": "three_quarter",
        "three_quarter": "three_quarter",
        "quarter": "three_quarter",
        "front": "front",
        "side": "side",
    }
    return aliases.get(value, "side")
