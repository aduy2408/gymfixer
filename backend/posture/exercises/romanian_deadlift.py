from __future__ import annotations

import math
import os
from enum import Enum

from posture.exercises.common import AngleBuffer, landmarks_visible, mp_pose, point_distance, safe_angle


class RomanianDeadliftPhase(str, Enum):
    STANDING = "STANDING"
    DESCENDING = "DESCENDING"
    BOTTOM = "BOTTOM"
    ASCENDING = "ASCENDING"


STAND_THRESH = 145.0
BOTTOM_THRESH = 110.0
ANGLE_DIRECTION_EPS = 1.5
INCOMPLETE_REP_FEEDBACK = "Complete the rep — hinge deeper before returning to standing."


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except ValueError:
        return default


def _segment_distance(point, start, end) -> float | None:
    try:
        px, py = float(point.x), float(point.y)
        sx, sy = float(start.x), float(start.y)
        ex, ey = float(end.x), float(end.y)
        dx, dy = ex - sx, ey - sy
        length_sq = dx * dx + dy * dy
        if length_sq == 0:
            return math.hypot(px - sx, py - sy)
        t = max(0.0, min(1.0, ((px - sx) * dx + (py - sy) * dy) / length_sq))
        return math.hypot(px - (sx + t * dx), py - (sy + t * dy))
    except (AttributeError, TypeError, ValueError):
        return None


def _side_visibility(landmarks, indices: list[int]) -> float:
    try:
        values = [float(getattr(landmarks[index], "visibility", 0.0)) for index in indices]
    except (IndexError, TypeError, ValueError):
        return -1.0
    return min(values) if values else -1.0


def get_angles(landmarks):
    if not landmarks or len(landmarks) < 33:
        return {}

    pose = mp_pose.PoseLandmark
    side_specs = {
        "left": {
            "ear": pose.LEFT_EAR.value,
            "shoulder": pose.LEFT_SHOULDER.value,
            "wrist": pose.LEFT_WRIST.value,
            "hip": pose.LEFT_HIP.value,
            "knee": pose.LEFT_KNEE.value,
            "ankle": pose.LEFT_ANKLE.value,
        },
        "right": {
            "ear": pose.RIGHT_EAR.value,
            "shoulder": pose.RIGHT_SHOULDER.value,
            "wrist": pose.RIGHT_WRIST.value,
            "hip": pose.RIGHT_HIP.value,
            "knee": pose.RIGHT_KNEE.value,
            "ankle": pose.RIGHT_ANKLE.value,
        },
    }
    required_names = ("shoulder", "hip", "knee")
    visible_sides = [
        (side, _side_visibility(landmarks, [spec[name] for name in required_names]))
        for side, spec in side_specs.items()
        if landmarks_visible(landmarks, [spec[name] for name in required_names])
    ]
    if not visible_sides:
        return {}

    side = max(visible_sides, key=lambda item: item[1])[0]
    spec = side_specs[side]
    shoulder = landmarks[spec["shoulder"]]
    wrist = landmarks[spec["wrist"]]
    hip = landmarks[spec["hip"]]
    knee = landmarks[spec["knee"]]
    ankle = landmarks[spec["ankle"]]

    angles: dict[str, float] = {"working_side": 1.0 if side == "right" else -1.0}
    hip_angle = safe_angle(shoulder, hip, knee)
    knee_angle = (
        safe_angle(hip, knee, ankle)
        if landmarks_visible(landmarks, [spec["ankle"]])
        else None
    )
    torso_length = point_distance(shoulder, hip)
    femur_length = point_distance(hip, knee)
    if hip_angle is not None:
        angles["hip_angle"] = hip_angle
    if knee_angle is not None:
        angles["knee_angle"] = knee_angle
    if torso_length:
        angles["torso_length"] = torso_length
        if femur_length:
            angles["torso_femur_ratio"] = torso_length / femur_length
        if landmarks_visible(landmarks, [spec["wrist"]]):
            shin_gap = (
                _segment_distance(wrist, knee, ankle)
                if landmarks_visible(landmarks, [spec["ankle"]])
                else None
            )
            thigh_gap = _segment_distance(wrist, hip, knee)
            gaps = [gap for gap in (shin_gap, thigh_gap) if gap is not None]
            if gaps:
                angles["wrist_leg_gap_ratio"] = min(gaps) / torso_length

        nose = landmarks[pose.NOSE.value]
        facing_delta = float(nose.x) - float(shoulder.x)
        facing_sign = 1.0 if facing_delta >= 0 else -1.0
        signed_torso_offset = (float(shoulder.x) - float(hip.x)) * facing_sign / torso_length
        angles["signed_torso_offset"] = signed_torso_offset
        angles["lean_back_ratio"] = max(0.0, -signed_torso_offset)
        angles["torso_vertical_ratio"] = abs(float(shoulder.y) - float(hip.y)) / torso_length

    if landmarks_visible(landmarks, [spec["ear"], spec["shoulder"], spec["hip"]]):
        neck_torso_angle = safe_angle(landmarks[spec["ear"]], shoulder, hip)
        if neck_torso_angle is not None:
            angles["neck_torso_angle"] = neck_torso_angle
    return angles


def generate_feedback(
    angles: dict,
    phase: str | None = None,
    camera_view: str | None = "side",
) -> list[str]:
    if not angles:
        return ["Move fully into frame so one complete side of your body and both hands are visible."]
    if camera_view == "front":
        return ["Record Romanian deadlifts from the side so hip hinge and bar path can be assessed."]

    feedback: list[str] = []
    active = phase in {"DESCENDING", "BOTTOM", "ASCENDING"}
    knee_min = _env_float("POSTURE_RDL_KNEE_MIN", 45.0)
    neck_rounding = _env_float("POSTURE_RDL_NECK_TORSO_MIN", 140.0)
    torso_femur_min = _env_float("POSTURE_RDL_TORSO_FEMUR_MIN", 1.05)
    wrist_gap_max = _env_float("POSTURE_RDL_WRIST_LEG_GAP_MAX", 0.70)
    lean_back_max = _env_float("POSTURE_RDL_LOCKOUT_LEAN_BACK_MAX", 0.12)

    if active:
        neck_angle = angles.get("neck_torso_angle")
        torso_ratio = angles.get("torso_femur_ratio")
        if (neck_angle is not None and neck_angle < neck_rounding) or (
            torso_ratio is not None and torso_ratio < torso_femur_min
        ):
            feedback.append(
                "Your upper-back and neck alignment may be rounding — keep a long neutral spine; this is a pose-based cue, not a spinal diagnosis."
            )
        knee_angle = angles.get("knee_angle")
        if knee_angle is not None and knee_angle < knee_min:
            feedback.append("Avoid turning the hinge into a squat — keep only a soft bend in your knees.")
        wrist_gap = angles.get("wrist_leg_gap_ratio")
        if wrist_gap is not None and wrist_gap > wrist_gap_max:
            feedback.append("Keep the bar close to your legs — let your hands travel near your thighs and shins.")

    if phase == "STANDING" and angles.get("lean_back_ratio", 0.0) > lean_back_max:
        feedback.append("Avoid leaning back at lockout — finish tall with your ribs stacked over your hips.")

    if not feedback:
        if phase == "STANDING":
            feedback.append("Good lockout — reset tall before the next hinge.")
        elif active:
            feedback.append("Good hip hinge — keep the bar close and move with control.")
        else:
            feedback.append("Good Romanian deadlift position.")
    return feedback


class PhaseDetector:
    def __init__(self):
        self.phase = RomanianDeadliftPhase.STANDING
        self.rep_count = 0
        self._hip_buf = AngleBuffer(size=4)
        self._last_hip: float | None = None
        self._armed = False
        self._attempt_active = False
        self._saw_bottom = False

    def update(self, angles: dict) -> tuple[RomanianDeadliftPhase, int]:
        torso_vertical = angles.get("torso_vertical_ratio")
        if torso_vertical is not None:
            raw_torso_vertical = float(torso_vertical)
            movement_value = self._hip_buf.push(raw_torso_vertical)
            standing_value = raw_torso_vertical
            stand_thresh = _env_float("POSTURE_RDL_STAND_VERTICAL_RATIO", 0.60)
            bottom_thresh = _env_float("POSTURE_RDL_BOTTOM_VERTICAL_RATIO", 0.40)
            direction_eps = _env_float("POSTURE_RDL_VERTICAL_DIRECTION_EPS", 0.015)
        else:
            movement_value = self._hip_buf.push(float(angles.get("hip_angle", 180.0)))
            standing_value = movement_value
            stand_thresh = _env_float("POSTURE_RDL_STAND_THRESH", STAND_THRESH)
            bottom_thresh = _env_float("POSTURE_RDL_BOTTOM_THRESH", BOTTOM_THRESH)
            direction_eps = _env_float("POSTURE_RDL_DIRECTION_EPS", ANGLE_DIRECTION_EPS)
        previous = self.phase
        delta = movement_value - self._last_hip if self._last_hip is not None else None

        if standing_value >= stand_thresh:
            if self._armed and previous == RomanianDeadliftPhase.ASCENDING and self._attempt_active and self._saw_bottom:
                self.rep_count += 1
            self.phase = RomanianDeadliftPhase.STANDING
            self._armed = True
            self._attempt_active = False
            self._saw_bottom = False
        elif not self._armed:
            self.phase = RomanianDeadliftPhase.BOTTOM if movement_value <= bottom_thresh else RomanianDeadliftPhase.DESCENDING
        elif movement_value <= bottom_thresh:
            self.phase = RomanianDeadliftPhase.BOTTOM
            self._attempt_active = True
            self._saw_bottom = True
        else:
            if delta is not None and delta < -direction_eps:
                self.phase = RomanianDeadliftPhase.DESCENDING
            elif delta is not None and delta > direction_eps:
                self.phase = RomanianDeadliftPhase.ASCENDING
            elif previous in {RomanianDeadliftPhase.STANDING, RomanianDeadliftPhase.DESCENDING}:
                self.phase = RomanianDeadliftPhase.DESCENDING
            else:
                self.phase = RomanianDeadliftPhase.ASCENDING
            self._attempt_active = True

        self._last_hip = movement_value
        return self.phase, self.rep_count

    def reset(self) -> None:
        self.__init__()
