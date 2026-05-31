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


class BicepCurlPhase(str, Enum):
    EXTENDED = "EXTENDED"
    CURLING = "CURLING"
    CONTRACTED = "CONTRACTED"
    LOWERING = "LOWERING"


ANGLE_DIRECTION_EPS = 1.5
CURL_EXTEND_THRESH = 120
CURL_CONTRACTED_THRESH = 100


def get_angles(landmarks):
    angles = {}
    if not landmarks or len(landmarks) < 33:
        return angles

    side_specs = [
        (
            "right",
            mp_pose.PoseLandmark.RIGHT_SHOULDER.value,
            mp_pose.PoseLandmark.RIGHT_ELBOW.value,
            mp_pose.PoseLandmark.RIGHT_WRIST.value,
            mp_pose.PoseLandmark.RIGHT_HIP.value,
            mp_pose.PoseLandmark.RIGHT_INDEX.value,
            mp_pose.PoseLandmark.RIGHT_EAR.value,
        ),
        (
            "left",
            mp_pose.PoseLandmark.LEFT_SHOULDER.value,
            mp_pose.PoseLandmark.LEFT_ELBOW.value,
            mp_pose.PoseLandmark.LEFT_WRIST.value,
            mp_pose.PoseLandmark.LEFT_HIP.value,
            mp_pose.PoseLandmark.LEFT_INDEX.value,
            mp_pose.PoseLandmark.LEFT_EAR.value,
        ),
    ]

    torso_leans = []
    elbow_drifts = []
    elbow_flare_angles = []
    wrist_flexion_angles = []
    shoulder_elevation_ratios = []

    for side, sh, el, wr, hip, index, ear in side_specs:
        if not landmarks_visible(landmarks, [sh, el, wr]):
            continue

        shoulder = landmarks[sh]
        elbow = landmarks[el]
        wrist = landmarks[wr]
        elbow_angle = safe_angle(shoulder, elbow, wrist)
        if elbow_angle is not None:
            angles[f"{side}_elbow"] = elbow_angle

        upper_arm_lean = vertical_lean_degrees(elbow, shoulder)
        if upper_arm_lean is not None:
            angles[f"{side}_upper_arm_lean"] = upper_arm_lean
            elbow_flare_angles.append(upper_arm_lean)

        upper_arm_len = point_distance(shoulder, elbow) or 0.001
        drift_normalizer = upper_arm_len
        if landmarks_visible(landmarks, [sh, hip]):
            hip_lm = landmarks[hip]
            torso_len = point_distance(shoulder, hip_lm) or 0.001
            drift_normalizer = torso_len

            torso_lean = vertical_lean_degrees(shoulder, hip_lm)
            if torso_lean is not None:
                angles[f"{side}_torso_lean"] = torso_lean
                torso_leans.append(torso_lean)

            if landmarks_visible(landmarks, [ear]):
                ear_lm = landmarks[ear]
                shoulder_to_ear = max(0.0, float(shoulder.y) - float(ear_lm.y))
                elevation_ratio = shoulder_to_ear / torso_len
                angles[f"{side}_shoulder_elevation_ratio"] = elevation_ratio
                shoulder_elevation_ratios.append(elevation_ratio)

        elbow_xy_offset = abs(float(elbow.x) - float(shoulder.x)) / drift_normalizer
        elbow_z_offset = abs(float(elbow.z) - float(shoulder.z)) / drift_normalizer
        elbow_drift = max(elbow_xy_offset, elbow_z_offset)
        angles[f"{side}_elbow_xy_offset"] = elbow_xy_offset
        angles[f"{side}_elbow_z_offset"] = elbow_z_offset
        angles[f"{side}_elbow_drift"] = elbow_drift
        elbow_drifts.append(elbow_drift)

        if landmarks_visible(landmarks, [index]):
            wrist_angle = safe_angle(elbow, wrist, landmarks[index])
            if wrist_angle is not None:
                angles[f"{side}_wrist_angle"] = wrist_angle
                wrist_flexion_angles.append(wrist_angle)

    if torso_leans:
        angles["torso_lean"] = max(torso_leans)
    if elbow_drifts:
        angles["elbow_drift"] = max(elbow_drifts)
    if elbow_flare_angles:
        angles["elbow_flare_angle"] = max(elbow_flare_angles)
    if wrist_flexion_angles:
        angles["wrist_angle"] = min(wrist_flexion_angles)
    if shoulder_elevation_ratios:
        angles["shoulder_elevation_ratio"] = min(shoulder_elevation_ratios)

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

    elbows = [
        value
        for value in (angles.get("right_elbow"), angles.get("left_elbow"))
        if value is not None
    ]
    max_elbow = max(elbows) if elbows else None
    min_elbow = min(elbows) if elbows else None
    max_drift = max(
        angles.get("elbow_drift", 0.0),
        angles.get("right_elbow_drift", 0.0),
        angles.get("left_elbow_drift", 0.0),
    )
    torso_lean = angles.get("torso_lean")
    wrist_angle = angles.get("wrist_angle")
    elbow_flare = angles.get("elbow_flare_angle")
    shoulder_elevation = angles.get("shoulder_elevation_ratio")

    drift_thresh = float(os.getenv("POSTURE_CURL_ELBOW_DRIFT_THRESH", "0.40"))
    torso_lean_thresh = float(os.getenv("POSTURE_CURL_TORSO_LEAN_THRESH", "14.0"))
    top_rom_thresh = float(os.getenv("POSTURE_CURL_TOP_ROM_THRESH", "80.0"))
    bottom_rom_thresh = float(os.getenv("POSTURE_CURL_BOTTOM_ROM_THRESH", "150.0"))
    wrist_flexion_thresh = float(os.getenv("POSTURE_CURL_WRIST_FLEXION_THRESH", "150.0"))
    elbow_flare_thresh = float(os.getenv("POSTURE_CURL_ELBOW_FLARE_THRESH", "32.0"))
    shoulder_elevation_thresh = float(os.getenv("POSTURE_CURL_SHOULDER_ELEVATION_THRESH", "0.38"))

    def add_wrist_cue() -> None:
        if wrist_angle is not None and wrist_angle < wrist_flexion_thresh:
            feedback.append("Keep your wrist neutral — don't curl the weight with your forearm.")

    def add_side_momentum_cues() -> None:
        if torso_lean is not None and torso_lean > torso_lean_thresh:
            feedback.append("Keep your torso upright — don't lean back to curl the weight.")
        if max_drift > drift_thresh:
            feedback.append("Keep your elbows pinned to your sides — don't let them travel forward.")

    def add_front_stability_cues() -> None:
        if shoulder_elevation is not None and shoulder_elevation < shoulder_elevation_thresh:
            feedback.append("Relax your traps — don't shrug your shoulders during the curl.")
        if elbow_flare is not None and elbow_flare > elbow_flare_thresh:
            feedback.append("Keep your elbows tucked — don't flare them out to the side.")

    if phase == "CURLING":
        if side_like:
            add_side_momentum_cues()
        if front_like:
            add_front_stability_cues()
        add_wrist_cue()
        if not feedback:
            feedback.append("Curl up — squeeze at the top!")
    elif phase == "CONTRACTED":
        if max_elbow is not None and max_elbow > top_rom_thresh:
            feedback.append("Finish the curl higher — don't stop short at the top.")
        if side_like:
            add_side_momentum_cues()
        if front_like:
            add_front_stability_cues()
        add_wrist_cue()
        if not feedback:
            feedback.append("Great contraction! Now lower slowly.")
    elif phase == "LOWERING":
        if side_like:
            add_side_momentum_cues()
        if front_like:
            add_front_stability_cues()
        add_wrist_cue()
        if not feedback:
            feedback.append("Good control on the way down.")
    elif phase == "EXTENDED":
        if min_elbow is not None and min_elbow < bottom_rom_thresh:
            feedback.append("Lower to full elbow extension before starting the next rep.")
        add_wrist_cue()
        if not feedback:
            feedback.append("Arms extended — ready for the next curl.")
    else:
        if max_elbow is not None and max_elbow > 165:
            feedback.append("Use a controlled curl — don't just hang at the bottom.")
        if min_elbow is not None and min_elbow < 40:
            feedback.append("Avoid over-curling; keep tension and control at the top.")
        if side_like:
            add_side_momentum_cues()
        if front_like:
            add_front_stability_cues()
        add_wrist_cue()
        if not feedback:
            feedback.append("Nice curls — controlled tempo and full range.")

    return feedback


class SingleArmCurlDetector:
    def __init__(self):
        self.phase: BicepCurlPhase = BicepCurlPhase.EXTENDED
        self.rep_count: int = 0
        self._angle_buf = AngleBuffer(size=1)
        self._last_angle: float | None = None

    def update(self, raw_angle: float) -> tuple[BicepCurlPhase, int]:
        angle = self._angle_buf.push(raw_angle)
        prev = self.phase
        delta = None
        if self._last_angle is not None:
            delta = angle - self._last_angle

        if angle >= CURL_EXTEND_THRESH:
            if prev in (BicepCurlPhase.CONTRACTED, BicepCurlPhase.LOWERING):
                self.rep_count += 1
            self.phase = BicepCurlPhase.EXTENDED
        elif angle <= CURL_CONTRACTED_THRESH:
            self.phase = BicepCurlPhase.CONTRACTED
        else:
            if delta is not None and delta < -ANGLE_DIRECTION_EPS:
                self.phase = BicepCurlPhase.CURLING
            elif delta is not None and delta > ANGLE_DIRECTION_EPS:
                self.phase = BicepCurlPhase.LOWERING
            elif prev in (BicepCurlPhase.EXTENDED, BicepCurlPhase.CURLING):
                self.phase = BicepCurlPhase.CURLING
            else:
                self.phase = BicepCurlPhase.LOWERING

        self._last_angle = angle
        return self.phase, self.rep_count

    def reset(self) -> None:
        self.phase = BicepCurlPhase.EXTENDED
        self.rep_count = 0
        self._angle_buf.reset()
        self._last_angle = None


class PhaseDetector:
    def __init__(self):
        self.phase: BicepCurlPhase = BicepCurlPhase.EXTENDED
        self.rep_count: int = 0
        self._arms = {
            "left": SingleArmCurlDetector(),
            "right": SingleArmCurlDetector(),
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

    def reset(self) -> None:
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
