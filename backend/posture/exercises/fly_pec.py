from __future__ import annotations

import os
from enum import Enum

from posture.exercises.common import (
    AngleBuffer,
    landmarks_visible,
    mp_pose,
    normalise_camera_view,
    safe_angle,
    vertical_lean_degrees,
)


class FlyPecPhase(str, Enum):
    OPEN = "OPEN"
    CLOSING = "CLOSING"
    CLOSED = "CLOSED"
    OPENING = "OPENING"


OPEN_THRESH = 70.0
CLOSED_THRESH = 42.0
ANGLE_DIRECTION_EPS = 1.5


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except ValueError:
        return default


def get_angles(landmarks):
    angles = {}
    if not landmarks or len(landmarks) < 33:
        return angles

    side_specs = {
        "right": {
            "shoulder": mp_pose.PoseLandmark.RIGHT_SHOULDER.value,
            "elbow": mp_pose.PoseLandmark.RIGHT_ELBOW.value,
            "wrist": mp_pose.PoseLandmark.RIGHT_WRIST.value,
            "hip": mp_pose.PoseLandmark.RIGHT_HIP.value,
        },
        "left": {
            "shoulder": mp_pose.PoseLandmark.LEFT_SHOULDER.value,
            "elbow": mp_pose.PoseLandmark.LEFT_ELBOW.value,
            "wrist": mp_pose.PoseLandmark.LEFT_WRIST.value,
            "hip": mp_pose.PoseLandmark.LEFT_HIP.value,
        },
    }

    candidates: list[tuple[str, float, dict[str, float]]] = []
    for side, spec in side_specs.items():
        required = [spec["shoulder"], spec["elbow"], spec["wrist"], spec["hip"]]
        if not landmarks_visible(landmarks, required):
            continue

        shoulder = landmarks[spec["shoulder"]]
        elbow = landmarks[spec["elbow"]]
        wrist = landmarks[spec["wrist"]]
        hip = landmarks[spec["hip"]]

        shoulder_flexion = safe_angle(elbow, shoulder, hip)
        elbow_angle = safe_angle(shoulder, elbow, wrist)
        torso_lean = vertical_lean_degrees(shoulder, hip)
        if shoulder_flexion is None or elbow_angle is None:
            continue

        side_angles = {
            "shoulder_flexion": shoulder_flexion,
            "elbow_angle": elbow_angle,
            "elbow_height_offset": float(elbow.y) - float(shoulder.y),
        }
        if torso_lean is not None:
            side_angles["torso_lean"] = torso_lean

        visibility = min(float(getattr(landmarks[idx], "visibility", 1.0)) for idx in required)
        candidates.append((side, visibility, side_angles))

    if not candidates:
        return angles

    side, _visibility, selected = max(candidates, key=lambda item: item[1])
    angles.update(selected)
    angles["working_side"] = 1.0 if side == "right" else -1.0
    return angles


def generate_feedback(
    angles: dict,
    phase: str | None = None,
    camera_view: str | None = "side",
) -> list[str]:
    feedback: list[str] = []
    if not angles:
        return ["Please get fully into the frame."]

    view = normalise_camera_view(camera_view)
    shoulder_flexion = angles.get("shoulder_flexion")
    elbow_angle = angles.get("elbow_angle")
    elbow_height_offset = angles.get("elbow_height_offset")
    torso_lean = angles.get("torso_lean")

    closed_thresh = _env_float("POSTURE_FLY_PEC_CLOSED_THRESH", CLOSED_THRESH)
    open_thresh = _env_float("POSTURE_FLY_PEC_OPEN_THRESH", OPEN_THRESH)
    elbow_min = _env_float("POSTURE_FLY_PEC_ELBOW_MIN", 105.0)
    elbow_max = _env_float("POSTURE_FLY_PEC_ELBOW_MAX", 170.0)
    elbow_drop_thresh = _env_float("POSTURE_FLY_PEC_ELBOW_DROP_THRESH", 0.12)
    torso_lean_thresh = _env_float("POSTURE_FLY_PEC_TORSO_LEAN_THRESH", 18.0)

    def add_control_cues() -> None:
        if elbow_angle is not None and elbow_angle > elbow_max:
            feedback.append("Keep a soft bend in your elbow — don't lock your arm straight.")
        elif elbow_angle is not None and elbow_angle < elbow_min:
            feedback.append("Open your elbow angle slightly — don't turn the fly into a press.")
        if elbow_height_offset is not None and elbow_height_offset > elbow_drop_thresh:
            feedback.append("Keep your elbow close to shoulder height through the fly.")
        if torso_lean is not None and torso_lean > torso_lean_thresh and view in {"side", "three_quarter"}:
            feedback.append("Keep your torso steady — don't lean forward to move the handle.")

    if phase == "CLOSING":
        add_control_cues()
        if not feedback:
            feedback.append("Bring the handle forward under control.")
    elif phase == "CLOSED":
        if shoulder_flexion is not None and shoulder_flexion > closed_thresh:
            feedback.append("Finish the rep — bring the handle farther forward before reopening.")
        add_control_cues()
        if not feedback:
            feedback.append("Good squeeze — now reopen with control.")
    elif phase == "OPENING":
        add_control_cues()
        if not feedback:
            feedback.append("Control the return — don't let the stack pull your arm back.")
    elif phase == "OPEN":
        if shoulder_flexion is not None and shoulder_flexion < open_thresh:
            feedback.append("Open fully before starting the next rep.")
        add_control_cues()
        if not feedback:
            feedback.append("Open position — start the next fly smoothly.")
    else:
        if shoulder_flexion is not None and shoulder_flexion > open_thresh:
            feedback.append("Bring the handle forward to complete the chest fly.")
        add_control_cues()
        if not feedback:
            feedback.append("Good pec fly form — keep the motion smooth.")

    return feedback


class PhaseDetector:
    def __init__(self):
        self.phase: FlyPecPhase = FlyPecPhase.OPEN
        self.rep_count: int = 0
        self._angle_buf = AngleBuffer(size=4)
        self._last_angle: float | None = None
        self._attempt_active = False
        self._saw_closed = False

    def update(self, angles: dict) -> tuple[FlyPecPhase, int]:
        raw_angle = angles.get("shoulder_flexion")
        if raw_angle is None:
            return self.phase, self.rep_count

        angle = self._angle_buf.push(float(raw_angle))
        prev = self.phase
        delta = None
        if self._last_angle is not None:
            delta = angle - self._last_angle

        if angle >= OPEN_THRESH:
            if prev == FlyPecPhase.OPENING and self._attempt_active and self._saw_closed:
                self.rep_count += 1
            self.phase = FlyPecPhase.OPEN
            self._attempt_active = False
            self._saw_closed = False
        elif angle <= CLOSED_THRESH:
            self.phase = FlyPecPhase.CLOSED
            self._attempt_active = True
            self._saw_closed = True
        else:
            if delta is not None and delta < -ANGLE_DIRECTION_EPS:
                self.phase = FlyPecPhase.CLOSING
            elif delta is not None and delta > ANGLE_DIRECTION_EPS:
                self.phase = FlyPecPhase.OPENING
            elif prev in (FlyPecPhase.OPEN, FlyPecPhase.CLOSING):
                self.phase = FlyPecPhase.CLOSING
            else:
                self.phase = FlyPecPhase.OPENING
            self._attempt_active = True

        self._last_angle = angle
        return self.phase, self.rep_count

    def reset(self) -> None:
        self.phase = FlyPecPhase.OPEN
        self.rep_count = 0
        self._angle_buf.reset()
        self._last_angle = None
        self._attempt_active = False
        self._saw_closed = False
