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


class SquatPhase(str, Enum):
    STANDING = "STANDING"
    DESCENDING = "DESCENDING"
    BOTTOM = "BOTTOM"
    ASCENDING = "ASCENDING"


STAND_THRESH = 150
BOTTOM_THRESH = 100
ANGLE_DIRECTION_EPS = 1.5
SHALLOW_BOTTOM_THRESH = 110
INCOMPLETE_REP_FEEDBACK = "Complete the rep — reach squat depth before standing up."


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except ValueError:
        return default


def get_angles(landmarks):
    angles = {}
    if not landmarks or len(landmarks) < 33:
        return angles

    knee_values = []
    hip_values = []
    torso_leans = []

    for side, hip, knee, ankle, shoulder in [
        (
            "right",
            mp_pose.PoseLandmark.RIGHT_HIP.value,
            mp_pose.PoseLandmark.RIGHT_KNEE.value,
            mp_pose.PoseLandmark.RIGHT_ANKLE.value,
            mp_pose.PoseLandmark.RIGHT_SHOULDER.value,
        ),
        (
            "left",
            mp_pose.PoseLandmark.LEFT_HIP.value,
            mp_pose.PoseLandmark.LEFT_KNEE.value,
            mp_pose.PoseLandmark.LEFT_ANKLE.value,
            mp_pose.PoseLandmark.LEFT_SHOULDER.value,
        ),
    ]:
        if landmarks_visible(landmarks, [hip, knee, ankle]):
            val = safe_angle(landmarks[hip], landmarks[knee], landmarks[ankle])
            if val is not None:
                angles[f"{side}_knee"] = val
                knee_values.append(val)
        if landmarks_visible(landmarks, [shoulder, hip, knee]):
            val = safe_angle(landmarks[shoulder], landmarks[hip], landmarks[knee])
            if val is not None:
                angles[f"{side}_hip"] = val
                hip_values.append(val)
        if landmarks_visible(landmarks, [shoulder, hip]):
            lean = vertical_lean_degrees(landmarks[shoulder], landmarks[hip])
            if lean is not None:
                angles[f"{side}_torso_lean"] = lean
                torso_leans.append(lean)

    if knee_values:
        angles["avg_knee"] = sum(knee_values) / len(knee_values)
    if hip_values:
        angles["avg_hip"] = sum(hip_values) / len(hip_values)
    if torso_leans:
        angles["torso_lean"] = max(torso_leans)

    try:
        ls = mp_pose.PoseLandmark.LEFT_SHOULDER.value
        rs = mp_pose.PoseLandmark.RIGHT_SHOULDER.value
        lk = landmarks[mp_pose.PoseLandmark.LEFT_KNEE.value]
        rk = landmarks[mp_pose.PoseLandmark.RIGHT_KNEE.value]
        lf = mp_pose.PoseLandmark.LEFT_FOOT_INDEX.value
        rf = mp_pose.PoseLandmark.RIGHT_FOOT_INDEX.value
        if landmarks_visible(landmarks, [lf, rf]):
            foot_width = point_distance(landmarks[lf], landmarks[rf])
            if foot_width and foot_width > 0:
                knee_width = point_distance(lk, rk)
                if knee_width is not None:
                    angles["knee_foot_ratio"] = knee_width / foot_width
                    angles["knee_valgus_ratio"] = knee_width / foot_width
            if landmarks_visible(landmarks, [ls, rs]):
                shoulder_width = point_distance(landmarks[ls], landmarks[rs])
                if shoulder_width and shoulder_width > 0 and foot_width is not None:
                    angles["foot_shoulder_ratio"] = foot_width / shoulder_width
    except Exception:
        pass

    return angles


def generate_feedback(
    angles: dict,
    phase: str | None = None,
    camera_view: str | None = "side",
) -> list[str]:
    feedback: list[str] = []
    view = normalise_camera_view(camera_view)
    side_like = view in {"side", "three_quarter"}
    front_like = view in {"front", "three_quarter"}

    avg_knee = angles.get("avg_knee")
    avg_hip = angles.get("avg_hip")
    torso_lean = angles.get("torso_lean")
    foot_shoulder = angles.get("foot_shoulder_ratio")
    knee_foot = angles.get("knee_foot_ratio", angles.get("knee_valgus_ratio"))

    foot_min = _env_float("POSTURE_SQUAT_FOOT_SHOULDER_MIN", 1.2)
    foot_max = _env_float("POSTURE_SQUAT_FOOT_SHOULDER_MAX", 2.8)
    torso_lean_thresh = _env_float("POSTURE_SQUAT_TORSO_LEAN_THRESH", 28.0)

    def stage_for_phase() -> str:
        if phase == "STANDING":
            return "up"
        if phase == "BOTTOM":
            return "down"
        return "middle"

    def knee_thresholds() -> tuple[float, float]:
        stage = stage_for_phase()
        defaults = {
            "up": (0.5, 1.0),
            "middle": (0.7, 1.0),
            "down": (0.7, 1.1),
        }
        lo, hi = defaults[stage]
        prefix = f"POSTURE_SQUAT_KNEE_FOOT_{stage.upper()}"
        return (
            _env_float(f"{prefix}_MIN", lo),
            _env_float(f"{prefix}_MAX", hi),
        )

    def add_front_placement_cues() -> None:
        if foot_shoulder is not None:
            if foot_shoulder < foot_min:
                feedback.append("Your stance is too narrow — set your feet closer to shoulder width.")
            elif foot_shoulder > foot_max:
                feedback.append("Your stance is too wide — bring your feet closer to shoulder width.")
        if knee_foot is not None:
            knee_min, knee_max = knee_thresholds()
            if knee_foot < knee_min:
                feedback.append("Push your knees out — they're caving in.")
            elif knee_foot > knee_max:
                feedback.append("Your knees are too wide — keep them tracking over your feet.")

    def add_side_torso_cues() -> None:
        if torso_lean is not None and torso_lean > torso_lean_thresh:
            feedback.append("Keep your chest up — avoid letting your torso collapse forward.")
        elif avg_hip is not None and avg_hip < 60:
            feedback.append("Keep your chest up and back straight as you lower.")

    if phase == "DESCENDING":
        if side_like:
            add_side_torso_cues()
        if front_like:
            add_front_placement_cues()
        if not feedback:
            feedback.append("Good descent — control the movement.")
    elif phase == "BOTTOM":
        if avg_knee is not None and avg_knee > SHALLOW_BOTTOM_THRESH:
            feedback.append("Go deeper — aim for thighs parallel to the floor.")
        elif avg_knee is not None and avg_knee < 60:
            feedback.append("You're going too low — keep your knees comfortable.")
        if front_like:
            add_front_placement_cues()
        if side_like:
            add_side_torso_cues()
        if not feedback:
            feedback.append("Great depth! Drive up through your heels.")
    elif phase == "ASCENDING":
        if front_like:
            add_front_placement_cues()
        if side_like:
            add_side_torso_cues()
        if not feedback:
            feedback.append("Strong drive — almost there!")
    elif phase == "STANDING":
        if front_like:
            add_front_placement_cues()
        if not feedback:
            feedback.append("Good rep! Brace your core before the next descent.")
    else:
        if avg_knee is not None and avg_knee > SHALLOW_BOTTOM_THRESH:
            feedback.append("Bend your knees more to reach proper squat depth.")
        if avg_knee is not None and avg_knee < 60:
            feedback.append("You're going too low — keep your knees comfortable.")
        if side_like:
            add_side_torso_cues()
        if front_like:
            add_front_placement_cues()
        if not feedback:
            feedback.append("Excellent squat! Keep that form.")

    return feedback


class PhaseDetector:
    def __init__(self):
        self.phase: SquatPhase = SquatPhase.STANDING
        self.rep_count: int = 0
        self._knee_buf = AngleBuffer(size=4)
        self._last_avg_knee: float | None = None
        self._attempt_active = False
        self._saw_bottom = False

    def update(self, angles: dict) -> tuple[SquatPhase, int]:
        raw_avg = angles.get("avg_knee")
        if raw_avg is None:
            rk = angles.get("right_knee", 180.0)
            lk = angles.get("left_knee", 180.0)
            raw_avg = (rk + lk) / 2.0
        avg_knee = self._knee_buf.push(raw_avg)

        prev = self.phase
        delta = None
        if self._last_avg_knee is not None:
            delta = avg_knee - self._last_avg_knee

        if avg_knee > STAND_THRESH:
            if prev == SquatPhase.ASCENDING and self._attempt_active and self._saw_bottom:
                self.rep_count += 1
            self._attempt_active = False
            self._saw_bottom = False
            self.phase = SquatPhase.STANDING
        elif avg_knee <= BOTTOM_THRESH:
            self.phase = SquatPhase.BOTTOM
            self._attempt_active = True
            self._saw_bottom = True
        else:
            if delta is not None and delta < -ANGLE_DIRECTION_EPS:
                self.phase = SquatPhase.DESCENDING
            elif delta is not None and delta > ANGLE_DIRECTION_EPS:
                self.phase = SquatPhase.ASCENDING
            elif prev in (SquatPhase.STANDING, SquatPhase.DESCENDING):
                self.phase = SquatPhase.DESCENDING
            else:
                self.phase = SquatPhase.ASCENDING
            self._attempt_active = True

        self._last_avg_knee = avg_knee
        return self.phase, self.rep_count

    def reset(self) -> None:
        self.phase = SquatPhase.STANDING
        self.rep_count = 0
        self._knee_buf.reset()
        self._last_avg_knee = None
        self._attempt_active = False
        self._saw_bottom = False
