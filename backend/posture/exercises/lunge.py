from __future__ import annotations

import os
from enum import Enum

from posture.exercises.common import (
    AngleBuffer,
    landmarks_visible,
    mp_pose,
    normalise_camera_view,
    point_distance,
    safe_angle,
    vertical_lean_degrees,
)


class LungePhase(str, Enum):
    STANDING = "STANDING"
    DESCENDING = "DESCENDING"
    BOTTOM = "BOTTOM"
    ASCENDING = "ASCENDING"


STAND_THRESH = 155
BOTTOM_THRESH = 125
ANGLE_DIRECTION_EPS = 1.5
INCOMPLETE_REP_FEEDBACK = "Complete the rep — lower into the lunge before standing up."


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except ValueError:
        return default


def get_angles(landmarks):
    angles = {}
    if not landmarks or len(landmarks) < 33:
        return angles

    side_specs = [
        (
            "right",
            mp_pose.PoseLandmark.RIGHT_SHOULDER.value,
            mp_pose.PoseLandmark.RIGHT_HIP.value,
            mp_pose.PoseLandmark.RIGHT_KNEE.value,
            mp_pose.PoseLandmark.RIGHT_ANKLE.value,
            mp_pose.PoseLandmark.RIGHT_FOOT_INDEX.value,
        ),
        (
            "left",
            mp_pose.PoseLandmark.LEFT_SHOULDER.value,
            mp_pose.PoseLandmark.LEFT_HIP.value,
            mp_pose.PoseLandmark.LEFT_KNEE.value,
            mp_pose.PoseLandmark.LEFT_ANKLE.value,
            mp_pose.PoseLandmark.LEFT_FOOT_INDEX.value,
        ),
    ]

    knee_values: dict[str, float] = {}
    hip_values = []
    torso_leans = []

    for side, shoulder, hip, knee, ankle, foot in side_specs:
        if landmarks_visible(landmarks, [hip, knee, ankle]):
            knee_angle = safe_angle(landmarks[hip], landmarks[knee], landmarks[ankle])
            if knee_angle is not None:
                angles[f"{side}_knee"] = knee_angle
                knee_values[side] = knee_angle
        if landmarks_visible(landmarks, [shoulder, hip, knee]):
            hip_angle = safe_angle(landmarks[shoulder], landmarks[hip], landmarks[knee])
            if hip_angle is not None:
                angles[f"{side}_hip"] = hip_angle
                hip_values.append(hip_angle)
        if landmarks_visible(landmarks, [shoulder, hip]):
            lean = vertical_lean_degrees(landmarks[shoulder], landmarks[hip])
            if lean is not None:
                angles[f"{side}_torso_lean"] = lean
                torso_leans.append(lean)
        if landmarks_visible(landmarks, [knee, ankle, foot]):
            foot_len = point_distance(landmarks[ankle], landmarks[foot]) or 0.001
            knee_over_toe = (float(landmarks[knee].x) - float(landmarks[foot].x)) / foot_len
            angles[f"{side}_knee_over_toe_ratio"] = knee_over_toe

    if knee_values:
        angles["min_knee"] = min(knee_values.values())
        angles["max_knee"] = max(knee_values.values())
    if hip_values:
        angles["avg_hip"] = sum(hip_values) / len(hip_values)
    if torso_leans:
        angles["torso_lean"] = max(torso_leans)

    if knee_values:
        front_side = min(knee_values, key=knee_values.get)
        rear_side = "left" if front_side == "right" else "right"
        angles["front_leg_side"] = 1.0 if front_side == "right" else -1.0
        angles["front_knee"] = knee_values[front_side]
        if rear_side in knee_values:
            angles["rear_knee"] = knee_values[rear_side]
        ratio = angles.get(f"{front_side}_knee_over_toe_ratio")
        if ratio is not None:
            angles["front_knee_over_toe_ratio"] = ratio

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
    side_like = view in {"side", "three_quarter"}
    front_like = view in {"front", "three_quarter"}

    front_knee = angles.get("front_knee", angles.get("min_knee"))
    rear_knee = angles.get("rear_knee")
    torso_lean = angles.get("torso_lean")
    knee_over_toe = angles.get("front_knee_over_toe_ratio")

    knee_min = _env_float("POSTURE_LUNGE_BOTTOM_KNEE_MIN", 60.0)
    knee_max = _env_float("POSTURE_LUNGE_BOTTOM_KNEE_MAX", 125.0)
    torso_lean_thresh = _env_float("POSTURE_LUNGE_TORSO_LEAN_THRESH", 24.0)
    knee_over_toe_thresh = _env_float("POSTURE_LUNGE_KNEE_OVER_TOE_THRESH", 0.35)

    def add_depth_cues() -> None:
        if front_knee is not None:
            if front_knee > knee_max:
                feedback.append("Go deeper — lower until your front knee reaches a stronger lunge angle.")
            elif front_knee < knee_min:
                feedback.append("Avoid dropping too low — keep your front knee under control.")
        if rear_knee is not None and rear_knee < knee_min:
            feedback.append("Avoid dropping too low — keep your back knee controlled above the floor.")

    def add_torso_cue() -> None:
        if torso_lean is not None and torso_lean > torso_lean_thresh:
            feedback.append("Keep your torso upright — avoid leaning forward during the lunge.")

    def add_knee_travel_cue() -> None:
        if knee_over_toe is not None and abs(knee_over_toe) > knee_over_toe_thresh:
            feedback.append("Avoid letting your front knee travel too far past your toes.")

    if phase == "DESCENDING":
        if side_like:
            add_torso_cue()
            add_knee_travel_cue()
        if front_like and front_knee is not None and front_knee > knee_max:
            feedback.append("Lower under control — go deeper before driving back up.")
        if not feedback:
            feedback.append("Good descent — keep the lunge controlled.")
    elif phase == "BOTTOM":
        add_depth_cues()
        if side_like:
            add_torso_cue()
            add_knee_travel_cue()
        if not feedback:
            feedback.append("Good lunge depth — drive back up through your front foot.")
    elif phase == "ASCENDING":
        if side_like:
            add_torso_cue()
            add_knee_travel_cue()
        if not feedback:
            feedback.append("Strong drive — return to standing with control.")
    elif phase == "STANDING":
        feedback.append("Reset tall before the next lunge.")
    else:
        add_depth_cues()
        if side_like:
            add_torso_cue()
            add_knee_travel_cue()
        if not feedback:
            feedback.append("Good lunge form. Keep it controlled.")

    return feedback


class PhaseDetector:
    def __init__(self):
        self.phase: LungePhase = LungePhase.STANDING
        self.rep_count: int = 0
        self._knee_buf = AngleBuffer(size=4)
        self._last_min_knee: float | None = None
        self._attempt_active = False
        self._saw_bottom = False

    def update(self, angles: dict) -> tuple[LungePhase, int]:
        raw_min = angles.get("front_knee", angles.get("min_knee"))
        if raw_min is None:
            knees = [
                value
                for value in (angles.get("right_knee"), angles.get("left_knee"))
                if value is not None
            ]
            raw_min = min(knees) if knees else 180.0
        min_knee = self._knee_buf.push(float(raw_min))

        prev = self.phase
        delta = None
        if self._last_min_knee is not None:
            delta = min_knee - self._last_min_knee

        if min_knee > STAND_THRESH:
            if prev == LungePhase.ASCENDING and self._attempt_active and self._saw_bottom:
                self.rep_count += 1
            self.phase = LungePhase.STANDING
            self._attempt_active = False
            self._saw_bottom = False
        elif min_knee <= BOTTOM_THRESH:
            self.phase = LungePhase.BOTTOM
            self._attempt_active = True
            self._saw_bottom = True
        else:
            if delta is not None and delta < -ANGLE_DIRECTION_EPS:
                self.phase = LungePhase.DESCENDING
            elif delta is not None and delta > ANGLE_DIRECTION_EPS:
                self.phase = LungePhase.ASCENDING
            elif prev in (LungePhase.STANDING, LungePhase.DESCENDING):
                self.phase = LungePhase.DESCENDING
            else:
                self.phase = LungePhase.ASCENDING
            self._attempt_active = True

        self._last_min_knee = min_knee
        return self.phase, self.rep_count

    def reset(self) -> None:
        self.phase = LungePhase.STANDING
        self.rep_count = 0
        self._knee_buf.reset()
        self._last_min_knee = None
        self._attempt_active = False
        self._saw_bottom = False
