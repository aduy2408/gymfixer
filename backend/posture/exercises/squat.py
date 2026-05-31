from __future__ import annotations

from enum import Enum

from posture.exercises.common import AngleBuffer, mp_pose, safe_angle


class SquatPhase(str, Enum):
    STANDING = "STANDING"
    DESCENDING = "DESCENDING"
    BOTTOM = "BOTTOM"
    ASCENDING = "ASCENDING"


STAND_THRESH = 150
BOTTOM_THRESH = 100
ANGLE_DIRECTION_EPS = 1.5


def get_angles(landmarks):
    angles = {}
    if not landmarks or len(landmarks) < 33:
        return angles

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
        val = safe_angle(landmarks[hip], landmarks[knee], landmarks[ankle])
        if val is not None:
            angles[f"{side}_knee"] = val
        val = safe_angle(landmarks[shoulder], landmarks[hip], landmarks[knee])
        if val is not None:
            angles[f"{side}_hip"] = val

    try:
        lk = landmarks[mp_pose.PoseLandmark.LEFT_KNEE.value]
        rk = landmarks[mp_pose.PoseLandmark.RIGHT_KNEE.value]
        la = landmarks[mp_pose.PoseLandmark.LEFT_ANKLE.value]
        ra = landmarks[mp_pose.PoseLandmark.RIGHT_ANKLE.value]
        knee_width = abs(lk.x - rk.x)
        ankle_width = abs(la.x - ra.x)
        if ankle_width > 0:
            angles["knee_valgus_ratio"] = knee_width / ankle_width
    except Exception:
        pass

    return angles


def generate_feedback(angles: dict, phase: str | None = None) -> list[str]:
    feedback: list[str] = []

    rk = angles.get("right_knee")
    lk = angles.get("left_knee")
    rh = angles.get("right_hip")
    lh = angles.get("left_hip")
    valgus = angles.get("knee_valgus_ratio")

    if phase == "DESCENDING":
        if rh is not None and lh is not None and min(rh, lh) < 60:
            feedback.append("Keep your chest up and back straight as you lower.")
        if valgus is not None and valgus < 0.80:
            feedback.append("Push your knees out — they're caving in.")
        if not feedback:
            feedback.append("Good descent — control the movement.")
    elif phase == "BOTTOM":
        if rk is not None and lk is not None:
            avg_knee = (rk + lk) / 2.0
            if avg_knee > 110:
                feedback.append("Go a bit deeper — aim for thighs parallel to the floor.")
            elif avg_knee < 60:
                feedback.append("That's very deep — ensure knees stay comfortable.")
        if valgus is not None and valgus < 0.80:
            feedback.append("Drive your knees outward at the bottom.")
        if rh is not None and lh is not None and min(rh, lh) < 55:
            feedback.append("Maintain a neutral spine — avoid rounding your lower back.")
        if not feedback:
            feedback.append("Great depth! Drive up through your heels.")
    elif phase == "ASCENDING":
        if valgus is not None and valgus < 0.80:
            feedback.append("Keep knees pushed out as you drive up.")
        if rh is not None and lh is not None and min(rh, lh) < 60:
            feedback.append("Chest up — don't let your torso collapse forward.")
        if not feedback:
            feedback.append("Strong drive — almost there!")
    elif phase == "STANDING":
        feedback.append("Good rep! Brace your core before the next descent.")
    else:
        if rk is not None and lk is not None:
            if max(rk, lk) > 100:
                feedback.append("Bend your knees more to reach proper squat depth.")
            if min(rk, lk) < 60:
                feedback.append("You're going too low — keep knees above 60°.")
        if rh is not None and lh is not None and min(rh, lh) < 70:
            feedback.append("Keep your back straighter to protect your spine.")
        if valgus is not None and valgus < 0.80:
            feedback.append("Watch your knees — they're caving inward.")
        if not feedback:
            feedback.append("Excellent squat! Keep that form.")

    return feedback


class PhaseDetector:
    def __init__(self):
        self.phase: SquatPhase = SquatPhase.STANDING
        self.rep_count: int = 0
        self._knee_buf = AngleBuffer(size=4)
        self._last_avg_knee: float | None = None

    def update(self, angles: dict) -> tuple[SquatPhase, int]:
        rk = angles.get("right_knee", 180.0)
        lk = angles.get("left_knee", 180.0)
        raw_avg = (rk + lk) / 2.0
        avg_knee = self._knee_buf.push(raw_avg)

        prev = self.phase
        delta = None
        if self._last_avg_knee is not None:
            delta = avg_knee - self._last_avg_knee

        if avg_knee > STAND_THRESH:
            if prev == SquatPhase.ASCENDING:
                self.rep_count += 1
            self.phase = SquatPhase.STANDING
        elif avg_knee <= BOTTOM_THRESH:
            self.phase = SquatPhase.BOTTOM
        else:
            if delta is not None and delta < -ANGLE_DIRECTION_EPS:
                self.phase = SquatPhase.DESCENDING
            elif delta is not None and delta > ANGLE_DIRECTION_EPS:
                self.phase = SquatPhase.ASCENDING
            elif prev in (SquatPhase.STANDING, SquatPhase.DESCENDING):
                self.phase = SquatPhase.DESCENDING
            else:
                self.phase = SquatPhase.ASCENDING

        self._last_avg_knee = avg_knee
        return self.phase, self.rep_count

    def reset(self) -> None:
        self.phase = SquatPhase.STANDING
        self.rep_count = 0
        self._knee_buf.reset()
        self._last_avg_knee = None
