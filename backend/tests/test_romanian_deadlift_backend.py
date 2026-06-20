from collections import Counter
from enum import IntEnum
from types import SimpleNamespace

from posture.exercises import romanian_deadlift as rdl
from posture import mediapipe_utils
from posture.phase_detector import PhaseDetector
from posture.rep_breakdown import build_rep_breakdown
from posture.sessions_related import session_processor
from posture.sessions_related.feedback_classifier import is_problem_feedback


def _update_many(detector: PhaseDetector, values: list[float]) -> tuple[str | None, int]:
    phase = None
    reps = 0
    for value in values:
        phase, reps = detector.update({"hip_angle": value})
    return phase, reps


def test_rdl_counts_only_a_full_rep_after_observing_standing():
    detector = PhaseDetector("romanian_deadlift")

    _, reps = _update_many(detector, [100, 100, 120, 140, 165, 165, 165, 165])
    assert reps == 0

    phase, reps = _update_many(
        detector,
        [145, 130, 105, 100, 100, 115, 130, 145, 165, 168, 170, 170],
    )
    assert phase == "STANDING"
    assert reps == 1


def test_rdl_shallow_attempt_does_not_count():
    detector = PhaseDetector("romanian_deadlift")
    _, reps = _update_many(
        detector,
        [170, 170, 170, 170, 145, 135, 125, 120, 122, 135, 150, 165, 170, 170],
    )
    assert reps == 0


def test_rdl_rep_breakdown_marks_shallow_attempt_incomplete():
    reps = build_rep_breakdown(
        [
            _entry(1, "DESCENDING", 0, 145),
            _entry(2, "ASCENDING", 0, 120),
            _entry(3, "STANDING", 0, 165),
        ],
        exercise="romanian_deadlift",
        total_reps=0,
    )
    assert len(reps) == 1
    assert reps[0]["completed"] is False
    assert any("hinge deeper" in issue.lower() for issue in reps[0]["issues"])


def test_rdl_feedback_covers_five_core_issues(monkeypatch):
    monkeypatch.setenv("POSTURE_RDL_NECK_TORSO_MIN", "140")
    active_feedback = rdl.generate_feedback(
        {
            "neck_torso_angle": 130,
            "torso_femur_ratio": 1.2,
            "knee_angle": 35,
            "wrist_leg_gap_ratio": 0.8,
        },
        phase="BOTTOM",
        camera_view="side",
    )
    assert any("pose-based cue" in item.lower() for item in active_feedback)
    assert any("hinge into a squat" in item.lower() for item in active_feedback)
    assert any("bar close" in item.lower() for item in active_feedback)
    assert all(is_problem_feedback(item) for item in active_feedback)

    standing_feedback = rdl.generate_feedback(
        {"lean_back_ratio": 0.2}, phase="STANDING", camera_view="side"
    )
    assert any("leaning back" in item.lower() for item in standing_feedback)

    front_feedback = rdl.generate_feedback(
        {"hip_angle": 100}, phase="BOTTOM", camera_view="front"
    )
    assert any("from the side" in item.lower() for item in front_feedback)


def test_rdl_get_angles_uses_the_fully_visible_side(monkeypatch):
    monkeypatch.setattr(rdl, "mp_pose", _fake_mp_pose())
    landmarks = _landmarks()
    for index in (_Lm.LEFT_SHOULDER, _Lm.LEFT_WRIST, _Lm.LEFT_HIP, _Lm.LEFT_KNEE, _Lm.LEFT_ANKLE):
        landmarks[index].visibility = 0.1

    angles = rdl.get_angles(landmarks)

    assert angles["working_side"] == 1.0
    assert "hip_angle" in angles
    assert "knee_angle" in angles
    assert "wrist_leg_gap_ratio" in angles
    assert "neck_torso_angle" in angles


def test_rdl_get_angles_returns_empty_without_one_complete_side(monkeypatch):
    monkeypatch.setattr(rdl, "mp_pose", _fake_mp_pose())
    landmarks = _landmarks()
    landmarks[_Lm.LEFT_KNEE].visibility = 0.1
    landmarks[_Lm.RIGHT_KNEE].visibility = 0.1
    assert rdl.get_angles(landmarks) == {}


def test_rdl_visibility_accepts_one_complete_side(monkeypatch):
    monkeypatch.setattr(mediapipe_utils, "mp_pose", _fake_mp_pose())
    landmarks = _landmarks()
    for index in (_Lm.LEFT_SHOULDER, _Lm.LEFT_WRIST, _Lm.LEFT_HIP, _Lm.LEFT_KNEE, _Lm.LEFT_ANKLE):
        landmarks[index].visibility = 0.1

    visible, missing = mediapipe_utils.check_visibility(landmarks, "romanian_deadlift")

    assert visible is True
    assert missing == []


def test_rdl_front_frames_are_excluded_from_analysis(monkeypatch):
    landmarks = _landmarks()
    processor = SimpleNamespace(
        backend_name="mediapipe",
        reset_state=lambda: None,
        process=lambda frame: (object(), landmarks, landmarks),
    )

    class FrontDetector:
        def __init__(self, **kwargs):
            self.counts = Counter()

        def update(self, _landmarks):
            self.counts.update(["front"])
            return SimpleNamespace(view="front", confidence=0.95)

    monkeypatch.setattr(session_processor, "SUBJECT_READY_MIN_FRAMES", 1)
    monkeypatch.setattr(session_processor, "subject_ready_for_analysis", lambda *_: (True, "ready"))
    monkeypatch.setattr(session_processor.mediapipe_utils, "check_visibility", lambda *_: (True, []))
    monkeypatch.setattr(session_processor.mediapipe_utils, "get_cached_pose_processor", lambda *_: processor)
    monkeypatch.setattr(session_processor, "decode_base64_frame", lambda *_: object())
    monkeypatch.setattr(session_processor, "CameraViewDetector", FrontDetector)

    result = session_processor.analyze_posture_session(
        "romanian_deadlift",
        [SimpleNamespace(frame="unused", timestamp_ms=0)],
        pose_backend="mediapipe",
        camera_view="auto",
    )

    assert result["frame_log"][0]["status"] == "unsupported_camera_view"
    assert result["summary"]["unsupported_view_frames"] == 1
    assert result["summary"]["frames_analyzed"] == 0
    assert "side-view" in result["llm"]["recommendations"]


def _entry(frame_index: int, phase: str, rep_count: int, hip_angle: float) -> dict:
    return {
        "frame_index": frame_index,
        "timestamp_ms": frame_index * 100,
        "status": "ok",
        "phase": phase,
        "rep_count": rep_count,
        "angles": {"hip_angle": hip_angle},
        "feedback": [],
        "problem_feedback": [],
    }


def _landmarks():
    points = [SimpleNamespace(x=0.5, y=0.2, z=0.0, visibility=1.0) for _ in range(33)]
    points[_Lm.NOSE] = SimpleNamespace(x=0.68, y=0.18, z=0.0, visibility=1.0)
    points[_Lm.LEFT_EAR] = SimpleNamespace(x=0.42, y=0.22, z=0.0, visibility=1.0)
    points[_Lm.RIGHT_EAR] = SimpleNamespace(x=0.64, y=0.22, z=0.0, visibility=1.0)
    points[_Lm.LEFT_SHOULDER] = SimpleNamespace(x=0.43, y=0.32, z=0.0, visibility=1.0)
    points[_Lm.RIGHT_SHOULDER] = SimpleNamespace(x=0.62, y=0.32, z=0.0, visibility=1.0)
    points[_Lm.LEFT_WRIST] = SimpleNamespace(x=0.48, y=0.72, z=0.0, visibility=1.0)
    points[_Lm.RIGHT_WRIST] = SimpleNamespace(x=0.58, y=0.72, z=0.0, visibility=1.0)
    points[_Lm.LEFT_HIP] = SimpleNamespace(x=0.45, y=0.52, z=0.0, visibility=1.0)
    points[_Lm.RIGHT_HIP] = SimpleNamespace(x=0.56, y=0.52, z=0.0, visibility=1.0)
    points[_Lm.LEFT_KNEE] = SimpleNamespace(x=0.47, y=0.72, z=0.0, visibility=1.0)
    points[_Lm.RIGHT_KNEE] = SimpleNamespace(x=0.57, y=0.72, z=0.0, visibility=1.0)
    points[_Lm.LEFT_ANKLE] = SimpleNamespace(x=0.48, y=0.92, z=0.0, visibility=1.0)
    points[_Lm.RIGHT_ANKLE] = SimpleNamespace(x=0.58, y=0.92, z=0.0, visibility=1.0)
    return points


class _Lm:
    NOSE = 0
    LEFT_EAR = 7
    RIGHT_EAR = 8
    LEFT_SHOULDER = 11
    RIGHT_SHOULDER = 12
    LEFT_WRIST = 15
    RIGHT_WRIST = 16
    LEFT_HIP = 23
    RIGHT_HIP = 24
    LEFT_KNEE = 25
    RIGHT_KNEE = 26
    LEFT_ANKLE = 27
    RIGHT_ANKLE = 28


class _PoseLandmark(IntEnum):
    NOSE = _Lm.NOSE
    LEFT_EAR = _Lm.LEFT_EAR
    RIGHT_EAR = _Lm.RIGHT_EAR
    LEFT_SHOULDER = _Lm.LEFT_SHOULDER
    RIGHT_SHOULDER = _Lm.RIGHT_SHOULDER
    LEFT_ELBOW = 13
    RIGHT_ELBOW = 14
    LEFT_WRIST = _Lm.LEFT_WRIST
    RIGHT_WRIST = _Lm.RIGHT_WRIST
    LEFT_HIP = _Lm.LEFT_HIP
    RIGHT_HIP = _Lm.RIGHT_HIP
    LEFT_KNEE = _Lm.LEFT_KNEE
    RIGHT_KNEE = _Lm.RIGHT_KNEE
    LEFT_ANKLE = _Lm.LEFT_ANKLE
    RIGHT_ANKLE = _Lm.RIGHT_ANKLE


def _fake_mp_pose():
    return SimpleNamespace(PoseLandmark=_PoseLandmark)
