from __future__ import annotations

from posture.exercises.common import mp_pose, safe_angle


def get_angles(landmarks):
    angles = {}
    if not landmarks or len(landmarks) < 33:
        return angles

    for side, sh, el, wr, hip in [
        ("right", mp_pose.PoseLandmark.RIGHT_SHOULDER.value, mp_pose.PoseLandmark.RIGHT_ELBOW.value, mp_pose.PoseLandmark.RIGHT_WRIST.value, mp_pose.PoseLandmark.RIGHT_HIP.value),
        ("left", mp_pose.PoseLandmark.LEFT_SHOULDER.value, mp_pose.PoseLandmark.LEFT_ELBOW.value, mp_pose.PoseLandmark.LEFT_WRIST.value, mp_pose.PoseLandmark.LEFT_HIP.value),
    ]:
        val = safe_angle(landmarks[sh], landmarks[el], landmarks[wr])
        if val is not None:
            angles[f"{side}_elbow"] = val
        val = safe_angle(landmarks[el], landmarks[sh], landmarks[hip])
        if val is not None:
            angles[f"{side}_shoulder_abd"] = val
    return angles


def generate_feedback(angles: dict, phase: str | None = None) -> list[str]:
    feedback: list[str] = []
    if not angles:
        return ["Please get fully into the frame."]
    if angles.get("right_elbow", 0) < 160 or angles.get("left_elbow", 0) < 160:
        feedback.append("Extend your arms fully at the top for full lockout.")
    if angles.get("right_shoulder_abd", 180) < 60 or angles.get("left_shoulder_abd", 180) < 60:
        feedback.append("Keep your elbows in line and press vertically.")
    if not feedback:
        feedback.append("Good shoulder press — stable torso and full extension.")
    return feedback
