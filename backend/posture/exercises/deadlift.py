from __future__ import annotations

from posture.exercises.common import mp_pose, safe_angle


def get_angles(landmarks):
    angles = {}
    if not landmarks or len(landmarks) < 33:
        return angles

    for side, sh, hip, knee, ankle in [
        ("right", mp_pose.PoseLandmark.RIGHT_SHOULDER.value, mp_pose.PoseLandmark.RIGHT_HIP.value, mp_pose.PoseLandmark.RIGHT_KNEE.value, mp_pose.PoseLandmark.RIGHT_ANKLE.value),
        ("left", mp_pose.PoseLandmark.LEFT_SHOULDER.value, mp_pose.PoseLandmark.LEFT_HIP.value, mp_pose.PoseLandmark.LEFT_KNEE.value, mp_pose.PoseLandmark.LEFT_ANKLE.value),
    ]:
        val = safe_angle(landmarks[sh], landmarks[hip], landmarks[knee])
        if val is not None:
            angles[f"{side}_hip"] = val
        val = safe_angle(landmarks[sh], landmarks[hip], landmarks[ankle])
        if val is not None:
            angles[f"{side}_back"] = val
        val = safe_angle(landmarks[hip], landmarks[knee], landmarks[ankle])
        if val is not None:
            angles[f"{side}_knee"] = val
    return angles


def generate_feedback(angles: dict, phase: str | None = None) -> list[str]:
    feedback: list[str] = []
    if not angles:
        return ["Please get fully into the frame."]
    if angles.get("right_back", 180) < 140 or angles.get("left_back", 180) < 140:
        feedback.append("Keep your back straighter; hinge at the hips, not the spine.")
    if angles.get("right_hip", 180) < 30 or angles.get("left_hip", 180) < 30:
        feedback.append("Drive the movement with your hips; push them back.")
    if angles.get("right_knee", 0) < 120 or angles.get("left_knee", 0) < 120:
        feedback.append("Don't bend your knees too much; maintain a slight bend.")
    if not feedback:
        feedback.append("Nice deadlift posture — maintain the hip hinge and straight back.")
    return feedback
