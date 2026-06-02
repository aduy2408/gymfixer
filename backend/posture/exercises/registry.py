from __future__ import annotations

from posture.exercises import bicep_curl, deadlift, lunge, pushup, shoulder_press, squat


ANGLE_FUNCTIONS = {
    "squat": squat.get_angles,
    "lunge": lunge.get_angles,
    "deadlift": deadlift.get_angles,
    "pushup": pushup.get_angles,
    "shoulder_press": shoulder_press.get_angles,
    "bicep_curl": bicep_curl.get_angles,
}

FEEDBACK_FUNCTIONS = {
    "squat": squat.generate_feedback,
    "lunge": lunge.generate_feedback,
    "deadlift": deadlift.generate_feedback,
    "pushup": pushup.generate_feedback,
    "shoulder_press": shoulder_press.generate_feedback,
    "bicep_curl": bicep_curl.generate_feedback,
}

PHASE_DETECTORS = {
    "squat": squat.PhaseDetector,
    "lunge": lunge.PhaseDetector,
    "bicep_curl": bicep_curl.PhaseDetector,
}
