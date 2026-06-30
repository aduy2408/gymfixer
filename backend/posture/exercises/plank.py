from __future__ import annotations

import math
import os

from posture.exercises.common import landmarks_visible, mp_pose, point_distance, safe_angle


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except ValueError:
        return default


def _line_offset_ratio(point, start, end) -> float | None:
    try:
        px, py = float(point.x), float(point.y)
        sx, sy = float(start.x), float(start.y)
        ex, ey = float(end.x), float(end.y)
        dx, dy = ex - sx, ey - sy
        length = math.hypot(dx, dy)
        if length == 0:
            return None
        return ((px - sx) * dy - (py - sy) * dx) / length
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
            "shoulder": pose.LEFT_SHOULDER.value,
            "elbow": pose.LEFT_ELBOW.value,
            "wrist": pose.LEFT_WRIST.value,
            "hip": pose.LEFT_HIP.value,
            "knee": pose.LEFT_KNEE.value,
            "ankle": pose.LEFT_ANKLE.value,
        },
        "right": {
            "shoulder": pose.RIGHT_SHOULDER.value,
            "elbow": pose.RIGHT_ELBOW.value,
            "wrist": pose.RIGHT_WRIST.value,
            "hip": pose.RIGHT_HIP.value,
            "knee": pose.RIGHT_KNEE.value,
            "ankle": pose.RIGHT_ANKLE.value,
        },
    }

    angles: dict[str, float] = {}
    body_values = []
    alignment_values = []
    hip_offsets = []
    elbow_values = []
    support_offsets = []
    visible_sides = []

    for side, spec in side_specs.items():
        required = [spec["shoulder"], spec["hip"], spec["knee"], spec["ankle"]]
        if not landmarks_visible(landmarks, required):
            continue

        visible_sides.append((side, _side_visibility(landmarks, required)))
        shoulder = landmarks[spec["shoulder"]]
        hip = landmarks[spec["hip"]]
        knee = landmarks[spec["knee"]]
        ankle = landmarks[spec["ankle"]]

        body_angle = safe_angle(shoulder, hip, knee)
        alignment_angle = safe_angle(shoulder, hip, ankle)
        body_length = point_distance(shoulder, ankle)
        hip_line_offset = _line_offset_ratio(hip, shoulder, ankle)

        if body_angle is not None:
            angles[f"{side}_body_angle"] = body_angle
            body_values.append(body_angle)
        if alignment_angle is not None:
            angles[f"{side}_alignment_angle"] = alignment_angle
            alignment_values.append(alignment_angle)
        if hip_line_offset is not None and body_length:
            offset_ratio = hip_line_offset / body_length
            angles[f"{side}_hip_line_offset"] = offset_ratio
            hip_offsets.append(offset_ratio)

        if landmarks_visible(landmarks, [spec["shoulder"], spec["elbow"], spec["wrist"]]):
            elbow_angle = safe_angle(shoulder, landmarks[spec["elbow"]], landmarks[spec["wrist"]])
            if elbow_angle is not None:
                angles[f"{side}_elbow"] = elbow_angle
                elbow_values.append(elbow_angle)

        if landmarks_visible(landmarks, [spec["shoulder"], spec["elbow"]]) and body_length:
            support_offset = abs(float(shoulder.x) - float(landmarks[spec["elbow"]].x)) / body_length
            angles[f"{side}_shoulder_elbow_offset"] = support_offset
            support_offsets.append(support_offset)

    if visible_sides:
        working_side = max(visible_sides, key=lambda item: item[1])[0]
        angles["working_side"] = 1.0 if working_side == "right" else -1.0
    if body_values:
        angles["body_angle"] = sum(body_values) / len(body_values)
    if alignment_values:
        angles["alignment_angle"] = sum(alignment_values) / len(alignment_values)
    if hip_offsets:
        angles["hip_line_offset"] = sum(hip_offsets) / len(hip_offsets)
    if elbow_values:
        angles["avg_elbow"] = sum(elbow_values) / len(elbow_values)
    if support_offsets:
        angles["shoulder_elbow_offset"] = sum(support_offsets) / len(support_offsets)

    return angles


def generate_feedback(angles: dict, phase: str | None = None) -> list[str]:
    if not angles:
        return ["Move fully into frame so your shoulders, elbows, hips, knees, and ankles are visible."]

    feedback: list[str] = []
    body_angle = angles.get("body_angle")
    alignment_angle = angles.get("alignment_angle")
    hip_offset = angles.get("hip_line_offset")
    avg_elbow = angles.get("avg_elbow")
    support_offset = angles.get("shoulder_elbow_offset")

    hip_high_thresh = _env_float("POSTURE_PLANK_HIP_HIGH_OFFSET", 0.150)
    hip_low_thresh = _env_float("POSTURE_PLANK_HIP_LOW_OFFSET", -0.030)
    min_body_angle = _env_float("POSTURE_PLANK_BODY_ANGLE_MIN", 135.0)
    min_alignment_angle = _env_float("POSTURE_PLANK_ALIGNMENT_ANGLE_MIN", 140.0)
    support_offset_max = _env_float("POSTURE_PLANK_SHOULDER_ELBOW_OFFSET_MAX", 0.16)
    elbow_min = _env_float("POSTURE_PLANK_ELBOW_MIN", 55.0)
    elbow_max = _env_float("POSTURE_PLANK_ELBOW_MAX", 125.0)

    if hip_offset is not None:
        if hip_offset < hip_low_thresh:
            feedback.append("Raise your hips slightly — keep your lower back from sagging.")
        elif hip_offset > hip_high_thresh:
            feedback.append("Lower your hips — keep your body in one straight line.")

    if body_angle is not None and body_angle < min_body_angle:
        feedback.append("Brace your core and keep your shoulders, hips, and knees aligned.")
    elif alignment_angle is not None and alignment_angle < min_alignment_angle:
        feedback.append("Lengthen through your heels and keep your shoulders, hips, and ankles aligned.")

    if support_offset is not None and support_offset > support_offset_max:
        feedback.append("Keep your elbows under your shoulders for a stronger support position.")
    elif avg_elbow is not None and (avg_elbow < elbow_min or avg_elbow > elbow_max):
        feedback.append("Keep your forearms planted with elbows close to a right angle.")

    if not feedback:
        feedback.append("Good plank form — keep your body straight and core braced.")
    return feedback
