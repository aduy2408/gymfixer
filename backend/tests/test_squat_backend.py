import os
from types import SimpleNamespace

os.environ.setdefault("POSTURE_DISABLE_DEFAULT_POSE_PROCESSOR", "1")

from posture.exercises import squat
from posture.phase_detector import PhaseDetector
from posture.rep_breakdown import INCOMPLETE_SQUAT_REP_ISSUE, build_rep_breakdown


def _update_many(detector: PhaseDetector, values: list[float]) -> tuple[str | None, int]:
    phase = None
    reps = 0
    for value in values:
        phase, reps = detector.update({"avg_knee": value})
    return phase, reps


def test_squat_counts_full_front_view_style_knee_sequence():
    detector = PhaseDetector("squat")

    phase, reps = _update_many(
        detector,
        [170, 170, 170, 170, 140, 135, 130, 125, 95, 92, 90, 95, 125, 130, 135, 140, 165, 168, 170, 170],
    )

    assert phase == "STANDING"
    assert reps == 1


def test_squat_shallow_attempt_does_not_count_full_rep():
    detector = PhaseDetector("squat")

    phase, reps = _update_many(
        detector,
        [170, 170, 170, 170, 140, 135, 125, 118, 116, 118, 126, 135, 165, 168, 170, 170],
    )

    assert phase == "STANDING"
    assert reps == 0


def test_squat_jitter_at_standing_does_not_double_count():
    detector = PhaseDetector("squat")

    _, reps = _update_many(
        detector,
        [170, 170, 170, 170, 140, 130, 95, 92, 90, 94, 125, 135, 165, 168, 151, 153, 149, 154, 170],
    )

    assert reps == 1


def test_squat_rep_breakdown_marks_full_rep_completed():
    frame_log = [
        _entry(1, "DESCENDING", 0, 140),
        _entry(2, "BOTTOM", 0, 95),
        _entry(3, "ASCENDING", 0, 130),
        _entry(4, "STANDING", 1, 165),
    ]

    reps = build_rep_breakdown(frame_log, exercise="squat", total_reps=1)

    assert len(reps) == 1
    assert reps[0]["completed"] is True
    assert reps[0]["rep_number"] == 1
    assert reps[0]["issues"] == []


def test_squat_rep_breakdown_marks_shallow_attempt_incomplete():
    frame_log = [
        _entry(1, "DESCENDING", 0, 140),
        _entry(2, "ASCENDING", 0, 118),
        _entry(3, "STANDING", 0, 165),
    ]

    reps = build_rep_breakdown(frame_log, exercise="squat", total_reps=0)

    assert len(reps) == 1
    assert reps[0]["completed"] is False
    assert INCOMPLETE_SQUAT_REP_ISSUE in reps[0]["issues"]


def test_squat_rep_breakdown_marks_mid_rep_session_end_incomplete():
    frame_log = [
        _entry(1, "DESCENDING", 0, 140),
        _entry(2, "BOTTOM", 0, 95),
    ]

    reps = build_rep_breakdown(frame_log, exercise="squat", total_reps=0)

    assert len(reps) == 1
    assert reps[0]["completed"] is False
    assert INCOMPLETE_SQUAT_REP_ISSUE in reps[0]["issues"]


def test_squat_feedback_front_view_feet_and_knees_too_wide():
    feedback = squat.generate_feedback(
        {
            "avg_knee": 90,
            "foot_shoulder_ratio": 3.0,
            "knee_foot_ratio": 1.2,
        },
        phase="BOTTOM",
        camera_view="front",
    )

    assert any("too wide" in item.lower() for item in feedback)
    assert any("knees are too wide" in item.lower() for item in feedback)


def test_squat_feedback_front_view_knees_caving():
    feedback = squat.generate_feedback(
        {
            "avg_knee": 90,
            "foot_shoulder_ratio": 1.5,
            "knee_foot_ratio": 0.5,
        },
        phase="BOTTOM",
        camera_view="front",
    )

    assert any("caving" in item.lower() for item in feedback)


def test_squat_feedback_side_view_shallow_and_torso_collapse():
    feedback = squat.generate_feedback(
        {
            "avg_knee": 115,
            "torso_lean": 35,
        },
        phase="BOTTOM",
        camera_view="side",
    )

    assert any("deeper" in item.lower() for item in feedback)
    assert any("collapse" in item.lower() for item in feedback)


def test_squat_missing_foot_index_keeps_depth_metrics():
    squat.mp_pose = _fake_mp_pose()
    landmarks = _landmarks()
    landmarks[_Lm.LEFT_FOOT_INDEX].visibility = 0.0
    landmarks[_Lm.RIGHT_FOOT_INDEX].visibility = 0.0

    angles = squat.get_angles(landmarks)

    assert "avg_knee" in angles
    assert "foot_shoulder_ratio" not in angles
    assert "knee_foot_ratio" not in angles


def _entry(frame_index: int, phase: str, rep_count: int, avg_knee: float) -> dict:
    return {
        "frame_index": frame_index,
        "timestamp_ms": frame_index * 100,
        "status": "ok",
        "phase": phase,
        "rep_count": rep_count,
        "angles": {"avg_knee": avg_knee},
        "feedback": [],
        "problem_feedback": [],
    }


def _landmarks():
    landmarks = [SimpleNamespace(x=0.0, y=0.0, z=0.0, visibility=1.0) for _ in range(33)]
    landmarks[_Lm.LEFT_SHOULDER] = SimpleNamespace(x=0.4, y=0.2, z=0.0, visibility=1.0)
    landmarks[_Lm.RIGHT_SHOULDER] = SimpleNamespace(x=0.6, y=0.2, z=0.0, visibility=1.0)
    landmarks[_Lm.LEFT_HIP] = SimpleNamespace(x=0.42, y=0.5, z=0.0, visibility=1.0)
    landmarks[_Lm.RIGHT_HIP] = SimpleNamespace(x=0.58, y=0.5, z=0.0, visibility=1.0)
    landmarks[_Lm.LEFT_KNEE] = SimpleNamespace(x=0.42, y=0.7, z=0.0, visibility=1.0)
    landmarks[_Lm.RIGHT_KNEE] = SimpleNamespace(x=0.58, y=0.7, z=0.0, visibility=1.0)
    landmarks[_Lm.LEFT_ANKLE] = SimpleNamespace(x=0.35, y=0.9, z=0.0, visibility=1.0)
    landmarks[_Lm.RIGHT_ANKLE] = SimpleNamespace(x=0.65, y=0.9, z=0.0, visibility=1.0)
    landmarks[_Lm.LEFT_FOOT_INDEX] = SimpleNamespace(x=0.3, y=0.95, z=0.0, visibility=1.0)
    landmarks[_Lm.RIGHT_FOOT_INDEX] = SimpleNamespace(x=0.7, y=0.95, z=0.0, visibility=1.0)
    return landmarks


class _Lm:
    LEFT_SHOULDER = 11
    RIGHT_SHOULDER = 12
    LEFT_HIP = 23
    RIGHT_HIP = 24
    LEFT_KNEE = 25
    RIGHT_KNEE = 26
    LEFT_ANKLE = 27
    RIGHT_ANKLE = 28
    LEFT_FOOT_INDEX = 31
    RIGHT_FOOT_INDEX = 32


def _fake_mp_pose():
    class PoseLandmark:
        LEFT_SHOULDER = SimpleNamespace(value=_Lm.LEFT_SHOULDER)
        RIGHT_SHOULDER = SimpleNamespace(value=_Lm.RIGHT_SHOULDER)
        LEFT_HIP = SimpleNamespace(value=_Lm.LEFT_HIP)
        RIGHT_HIP = SimpleNamespace(value=_Lm.RIGHT_HIP)
        LEFT_KNEE = SimpleNamespace(value=_Lm.LEFT_KNEE)
        RIGHT_KNEE = SimpleNamespace(value=_Lm.RIGHT_KNEE)
        LEFT_ANKLE = SimpleNamespace(value=_Lm.LEFT_ANKLE)
        RIGHT_ANKLE = SimpleNamespace(value=_Lm.RIGHT_ANKLE)
        LEFT_FOOT_INDEX = SimpleNamespace(value=_Lm.LEFT_FOOT_INDEX)
        RIGHT_FOOT_INDEX = SimpleNamespace(value=_Lm.RIGHT_FOOT_INDEX)

    return SimpleNamespace(PoseLandmark=PoseLandmark)
