from enum import IntEnum
from types import SimpleNamespace

from posture import mediapipe_utils
from posture.exercises import fly_pec
from posture.exercises.registry import ANGLE_FUNCTIONS, FEEDBACK_FUNCTIONS, PHASE_DETECTORS
from posture.phase_detector import PhaseDetector
from posture.rep_breakdown import INCOMPLETE_REP_ISSUES, build_rep_breakdown


def _update_many(detector: PhaseDetector, values: list[float]) -> tuple[str | None, int]:
    phase = None
    reps = 0
    for value in values:
        phase, reps = detector.update({"shoulder_flexion": value})
    return phase, reps


def test_fly_pec_registered_as_supported_exercise():
    assert ANGLE_FUNCTIONS["fly_pec"] is fly_pec.get_angles
    assert FEEDBACK_FUNCTIONS["fly_pec"] is fly_pec.generate_feedback
    assert PHASE_DETECTORS["fly_pec"] is fly_pec.PhaseDetector
    assert "fly_pec" in mediapipe_utils.ANGLE_FUNCTIONS


def test_fly_pec_counts_full_side_view_rep():
    detector = PhaseDetector("fly_pec")

    phase, reps = _update_many(
        detector,
        [82, 82, 82, 68, 56, 42, 36, 36, 48, 58, 70, 78, 82, 82],
    )

    assert phase == "OPEN"
    assert reps == 1


def test_fly_pec_shallow_attempt_does_not_count():
    detector = PhaseDetector("fly_pec")

    phase, reps = _update_many(detector, [82, 82, 70, 62, 56, 58, 66, 74, 82, 82])

    assert phase == "OPEN"
    assert reps == 0


def test_fly_pec_rep_breakdown_marks_incomplete_attempt():
    reps = build_rep_breakdown(
        [
            _entry(1, "CLOSING", 0, 66),
            _entry(2, "OPENING", 0, 58),
            _entry(3, "OPEN", 0, 76),
        ],
        exercise="fly_pec",
        total_reps=0,
    )

    assert len(reps) == 1
    assert reps[0]["completed"] is False
    assert INCOMPLETE_REP_ISSUES["fly_pec"] in reps[0]["issues"]


def test_fly_pec_get_angles_uses_visible_side(monkeypatch):
    monkeypatch.setattr(fly_pec, "mp_pose", _fake_mp_pose())
    landmarks = _landmarks()
    for index in (_Lm.LEFT_SHOULDER, _Lm.LEFT_ELBOW, _Lm.LEFT_WRIST, _Lm.LEFT_HIP):
        landmarks[index].visibility = 0.1

    angles = fly_pec.get_angles(landmarks)

    assert angles["working_side"] == 1.0
    assert angles["shoulder_flexion"] > 80
    assert angles["elbow_angle"] > 150
    assert "elbow_height_offset" in angles
    assert "torso_lean" in angles


def test_fly_pec_get_angles_returns_empty_without_complete_side(monkeypatch):
    monkeypatch.setattr(fly_pec, "mp_pose", _fake_mp_pose())
    landmarks = _landmarks()
    landmarks[_Lm.LEFT_ELBOW].visibility = 0.1
    landmarks[_Lm.RIGHT_ELBOW].visibility = 0.1

    assert fly_pec.get_angles(landmarks) == {}


def test_fly_pec_visibility_accepts_one_complete_side(monkeypatch):
    monkeypatch.setattr(mediapipe_utils, "mp_pose", _fake_mp_pose())
    landmarks = _landmarks()
    for index in (_Lm.LEFT_SHOULDER, _Lm.LEFT_ELBOW, _Lm.LEFT_WRIST, _Lm.LEFT_HIP):
        landmarks[index].visibility = 0.1

    visible, missing = mediapipe_utils.check_visibility(landmarks, "fly_pec")

    assert visible is True
    assert missing == []


def test_fly_pec_visibility_fails_without_complete_side(monkeypatch):
    monkeypatch.setattr(mediapipe_utils, "mp_pose", _fake_mp_pose())
    landmarks = _landmarks()
    landmarks[_Lm.LEFT_ELBOW].visibility = 0.1
    landmarks[_Lm.RIGHT_ELBOW].visibility = 0.1

    visible, missing = mediapipe_utils.check_visibility(landmarks, "fly_pec")

    assert visible is False
    assert "left elbow" in missing
    assert "right elbow" in missing


def test_fly_pec_feedback_flags_elbow_and_torso_errors():
    locked = fly_pec.generate_feedback(
        {
            "shoulder_flexion": 38,
            "elbow_angle": 178,
            "elbow_height_offset": 0.0,
            "torso_lean": 5,
        },
        phase="CLOSED",
        camera_view="side",
    )
    leaning = fly_pec.generate_feedback(
        {
            "shoulder_flexion": 55,
            "elbow_angle": 130,
            "elbow_height_offset": 0.2,
            "torso_lean": 25,
        },
        phase="CLOSING",
        camera_view="side",
    )

    assert any("soft bend" in item.lower() for item in locked)
    assert any("shoulder height" in item.lower() for item in leaning)
    assert any("torso steady" in item.lower() for item in leaning)


def _entry(frame_index: int, phase: str, rep_count: int, shoulder_flexion: float) -> dict:
    return {
        "frame_index": frame_index,
        "timestamp_ms": frame_index * 100,
        "status": "ok",
        "phase": phase,
        "rep_count": rep_count,
        "angles": {"shoulder_flexion": shoulder_flexion},
        "feedback": [],
        "problem_feedback": [],
    }


def _landmarks():
    points = [SimpleNamespace(x=0.5, y=0.2, z=0.0, visibility=1.0) for _ in range(33)]
    points[_Lm.NOSE] = SimpleNamespace(x=0.5, y=0.16, z=0.0, visibility=1.0)
    points[_Lm.RIGHT_SHOULDER] = SimpleNamespace(x=0.5, y=0.4, z=0.0, visibility=1.0)
    points[_Lm.RIGHT_ELBOW] = SimpleNamespace(x=0.85, y=0.4, z=0.0, visibility=1.0)
    points[_Lm.RIGHT_WRIST] = SimpleNamespace(x=1.05, y=0.4, z=0.0, visibility=1.0)
    points[_Lm.RIGHT_HIP] = SimpleNamespace(x=0.5, y=0.72, z=0.0, visibility=1.0)
    points[_Lm.LEFT_SHOULDER] = SimpleNamespace(x=0.48, y=0.4, z=0.0, visibility=1.0)
    points[_Lm.LEFT_ELBOW] = SimpleNamespace(x=0.16, y=0.4, z=0.0, visibility=1.0)
    points[_Lm.LEFT_WRIST] = SimpleNamespace(x=-0.02, y=0.4, z=0.0, visibility=1.0)
    points[_Lm.LEFT_HIP] = SimpleNamespace(x=0.48, y=0.72, z=0.0, visibility=1.0)
    return points


class _Lm:
    NOSE = 0
    LEFT_SHOULDER = 11
    RIGHT_SHOULDER = 12
    LEFT_ELBOW = 13
    RIGHT_ELBOW = 14
    LEFT_WRIST = 15
    RIGHT_WRIST = 16
    LEFT_HIP = 23
    RIGHT_HIP = 24


class _PoseLandmark(IntEnum):
    NOSE = _Lm.NOSE
    LEFT_SHOULDER = _Lm.LEFT_SHOULDER
    RIGHT_SHOULDER = _Lm.RIGHT_SHOULDER
    LEFT_ELBOW = _Lm.LEFT_ELBOW
    RIGHT_ELBOW = _Lm.RIGHT_ELBOW
    LEFT_WRIST = _Lm.LEFT_WRIST
    RIGHT_WRIST = _Lm.RIGHT_WRIST
    LEFT_HIP = _Lm.LEFT_HIP
    RIGHT_HIP = _Lm.RIGHT_HIP


def _fake_mp_pose():
    return SimpleNamespace(PoseLandmark=_PoseLandmark)
