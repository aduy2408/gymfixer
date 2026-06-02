from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

from posture import mediapipe_utils


load_dotenv(Path(__file__).resolve().parents[1] / ".env")

SUBJECT_READY_MIN_FRAMES = int(os.getenv("POSTURE_SUBJECT_READY_MIN_FRAMES", "3"))
SUBJECT_MIN_BBOX_AREA = float(os.getenv("POSTURE_SUBJECT_MIN_BBOX_AREA", "0.035"))
SUBJECT_MIN_BBOX_WIDTH = float(os.getenv("POSTURE_SUBJECT_MIN_BBOX_WIDTH", "0.12"))
SUBJECT_MIN_BBOX_HEIGHT = float(os.getenv("POSTURE_SUBJECT_MIN_BBOX_HEIGHT", "0.20"))


def subject_ready_for_analysis(landmarks, exercise: str) -> tuple[bool, str]:
    """Reject setup/walk-in frames before phase detection."""
    if not landmarks or len(landmarks) < 33:
        return False, "no subject detected"

    vis_threshold = float(os.getenv("MP_VIS_THRESHOLD", "0.5"))

    def visible(idx: int) -> bool:
        try:
            return getattr(landmarks[idx], "visibility", 0.0) >= vis_threshold
        except (IndexError, ValueError):
            return False

    pose = mediapipe_utils.mp_pose.PoseLandmark
    face_indices = [
        pose.NOSE.value,
        pose.LEFT_EYE.value,
        pose.RIGHT_EYE.value,
        pose.LEFT_EAR.value,
        pose.RIGHT_EAR.value,
    ]
    if sum(1 for idx in face_indices if visible(idx)) < 2:
        return False, "face is not visible yet"

    visible_points = [lm for lm in landmarks if getattr(lm, "visibility", 0.0) >= vis_threshold]
    if len(visible_points) < 8:
        return False, "not enough body keypoints are visible"

    xs = [float(lm.x) for lm in visible_points]
    ys = [float(lm.y) for lm in visible_points]
    bbox_width = max(xs) - min(xs)
    bbox_height = max(ys) - min(ys)
    bbox_area = bbox_width * bbox_height
    if bbox_width < SUBJECT_MIN_BBOX_WIDTH or bbox_height < SUBJECT_MIN_BBOX_HEIGHT:
        return False, "body is too small or only partly in frame"
    if bbox_area < SUBJECT_MIN_BBOX_AREA:
        return False, "body is too small in frame"

    if exercise == "bicep_curl":
        side_sets = [
            [pose.LEFT_SHOULDER.value, pose.LEFT_ELBOW.value, pose.LEFT_WRIST.value],
            [pose.RIGHT_SHOULDER.value, pose.RIGHT_ELBOW.value, pose.RIGHT_WRIST.value],
        ]
        if not any(all(visible(idx) for idx in side) for side in side_sets):
            return False, "working arm is not fully visible"

    return True, "subject ready"
