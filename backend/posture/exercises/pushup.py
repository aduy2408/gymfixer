from __future__ import annotations

from posture.exercises.common import mp_pose, safe_angle


def get_angles(landmarks):
    angles = {}
    if not landmarks or len(landmarks) < 33:
        return angles

    for side, sh, el, wr, hip, ankle in [
        ("right", mp_pose.PoseLandmark.RIGHT_SHOULDER.value, mp_pose.PoseLandmark.RIGHT_ELBOW.value, mp_pose.PoseLandmark.RIGHT_WRIST.value, mp_pose.PoseLandmark.RIGHT_HIP.value, mp_pose.PoseLandmark.RIGHT_ANKLE.value),
        ("left", mp_pose.PoseLandmark.LEFT_SHOULDER.value, mp_pose.PoseLandmark.LEFT_ELBOW.value, mp_pose.PoseLandmark.LEFT_WRIST.value, mp_pose.PoseLandmark.LEFT_HIP.value, mp_pose.PoseLandmark.LEFT_ANKLE.value),
    ]:
        val = safe_angle(landmarks[sh], landmarks[el], landmarks[wr])
        if val is not None:
            angles[f"{side}_elbow"] = val

    r_body = safe_angle(
        landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value],
        landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value],
        landmarks[mp_pose.PoseLandmark.RIGHT_ANKLE.value],
    ) or 180.0
    l_body = safe_angle(
        landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value],
        landmarks[mp_pose.PoseLandmark.LEFT_HIP.value],
        landmarks[mp_pose.PoseLandmark.LEFT_ANKLE.value],
    ) or 180.0
    angles["body_angle"] = (r_body + l_body) / 2.0
    return angles


def generate_feedback(angles: dict, phase: str | None = None) -> list[str]:
    feedback: list[str] = []
    if not angles:
        return ["Please get fully into the frame."]
    if angles.get("body_angle", 180) < 160:
        feedback.append("Keep your body straight from head to heels.")
    if angles.get("right_elbow", 180) > 160 and angles.get("left_elbow", 180) > 160:
        feedback.append("Lower your chest more to increase muscle engagement.")
    if angles.get("right_elbow", 0) < 60 or angles.get("left_elbow", 0) < 60:
        feedback.append("Control the descent; don't drop too quickly.")
    if not feedback:
        feedback.append("Good pushup form — full range and a straight body.")
    return feedback
