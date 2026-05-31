from __future__ import annotations

from posture.exercises.common import mp_pose, safe_angle


def get_angles(landmarks):
    angles = {}
    if not landmarks or len(landmarks) < 33:
        return angles

    for side, hip, knee, ankle, shoulder in [
        ("right", mp_pose.PoseLandmark.RIGHT_HIP.value, mp_pose.PoseLandmark.RIGHT_KNEE.value, mp_pose.PoseLandmark.RIGHT_ANKLE.value, mp_pose.PoseLandmark.RIGHT_SHOULDER.value),
        ("left", mp_pose.PoseLandmark.LEFT_HIP.value, mp_pose.PoseLandmark.LEFT_KNEE.value, mp_pose.PoseLandmark.LEFT_ANKLE.value, mp_pose.PoseLandmark.LEFT_SHOULDER.value),
    ]:
        val = safe_angle(landmarks[hip], landmarks[knee], landmarks[ankle])
        if val is not None:
            angles[f"{side}_knee"] = val
        val = safe_angle(landmarks[shoulder], landmarks[hip], landmarks[knee])
        if val is not None:
            angles[f"{side}_hip"] = val

    r_torso = safe_angle(
        landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value],
        landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value],
        landmarks[mp_pose.PoseLandmark.RIGHT_ANKLE.value],
    ) or 180.0
    l_torso = safe_angle(
        landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value],
        landmarks[mp_pose.PoseLandmark.LEFT_HIP.value],
        landmarks[mp_pose.PoseLandmark.LEFT_ANKLE.value],
    ) or 180.0
    angles["torso_angle"] = (r_torso + l_torso) / 2.0
    return angles


def generate_feedback(angles: dict, phase: str | None = None) -> list[str]:
    feedback: list[str] = []
    if not angles:
        return ["Please get fully into the frame."]
    if angles.get("right_knee", 180) > 150 and angles.get("left_knee", 180) > 150:
        feedback.append("Bend your front knee more to lower into the lunge.")
    if angles.get("right_knee", 0) < 50 or angles.get("left_knee", 0) < 50:
        feedback.append("Avoid dropping too low; control your depth.")
    if angles.get("torso_angle", 180) < 70:
        feedback.append("Keep your torso more upright; avoid leaning forward.")
    if not feedback:
        feedback.append("Good lunge form. Keep it controlled.")
    return feedback
