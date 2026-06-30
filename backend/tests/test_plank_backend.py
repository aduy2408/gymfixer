from types import SimpleNamespace

from posture import mediapipe_utils
from posture.exercises import plank
from posture.exercises.registry import ANGLE_FUNCTIONS, FEEDBACK_FUNCTIONS
from posture.sessions_related.feedback_classifier import problem_feedback


def test_plank_registered_as_supported_exercise():
    assert ANGLE_FUNCTIONS["plank"] is plank.get_angles
    assert FEEDBACK_FUNCTIONS["plank"] is plank.generate_feedback
    assert "plank" in mediapipe_utils.ANGLE_FUNCTIONS


def test_plank_get_angles_straight_body():
    plank.mp_pose = _fake_mp_pose()

    angles = plank.get_angles(_landmarks(hip_y=0.5))

    assert angles["body_angle"] > 170
    assert angles["alignment_angle"] > 170
    assert abs(angles["hip_line_offset"]) < 0.01
    assert 80 <= angles["avg_elbow"] <= 110


def test_plank_get_angles_detects_high_hips():
    plank.mp_pose = _fake_mp_pose()

    angles = plank.get_angles(_landmarks(hip_y=0.43))

    assert angles["hip_line_offset"] > 0.03


def test_plank_get_angles_detects_low_hips():
    plank.mp_pose = _fake_mp_pose()

    angles = plank.get_angles(_landmarks(hip_y=0.57))

    assert angles["hip_line_offset"] < -0.03


def test_plank_get_angles_handles_missing_visibility():
    plank.mp_pose = _fake_mp_pose()
    landmarks = _landmarks(hip_y=0.5)
    landmarks[_Lm.LEFT_HIP].visibility = 0.0
    landmarks[_Lm.RIGHT_HIP].visibility = 0.0

    assert plank.get_angles(landmarks) == {}


def test_plank_visibility_accepts_one_complete_side():
    mediapipe_utils.mp_pose = _fake_mp_pose()
    landmarks = _landmarks(hip_y=0.5)
    for index in [
        _Lm.RIGHT_SHOULDER,
        _Lm.RIGHT_ELBOW,
        _Lm.RIGHT_HIP,
        _Lm.RIGHT_KNEE,
        _Lm.RIGHT_ANKLE,
    ]:
        landmarks[index].visibility = 0.0

    visible, missing = mediapipe_utils.check_visibility(landmarks, "plank")

    assert visible is True
    assert missing == []


def test_plank_feedback_low_back_cue():
    feedback = plank.generate_feedback({"hip_line_offset": -0.05, "body_angle": 175})

    assert any("raise your hips" in item.lower() for item in feedback)
    assert any("sagging" in item.lower() for item in feedback)


def test_plank_feedback_high_back_cue():
    feedback = plank.generate_feedback({"hip_line_offset": 0.17, "body_angle": 175})

    assert any("lower your hips" in item.lower() for item in feedback)


def test_plank_feedback_elbow_stack_cue():
    feedback = plank.generate_feedback(
        {
            "hip_line_offset": 0.0,
            "body_angle": 178,
            "alignment_angle": 178,
            "shoulder_elbow_offset": 0.3,
        }
    )

    assert any("elbows under your shoulders" in item.lower() for item in feedback)


def test_plank_feedback_positive_cue():
    feedback = plank.generate_feedback(
        {
            "hip_line_offset": 0.0,
            "body_angle": 178,
            "alignment_angle": 178,
            "shoulder_elbow_offset": 0.02,
            "avg_elbow": 90,
        }
    )

    assert any("good plank" in item.lower() for item in feedback)


def test_plank_problem_feedback_is_counted_for_session_summary():
    feedback = [
        "Lower your hips — keep your body in one straight line.",
        "Brace your core and keep your shoulders, hips, and knees aligned.",
        "Good plank form — keep your body straight and core braced.",
    ]

    problems = problem_feedback(feedback)

    assert feedback[0] in problems
    assert feedback[1] in problems
    assert feedback[2] not in problems


def _landmarks(hip_y: float):
    landmarks = [SimpleNamespace(x=0.0, y=0.0, z=0.0, visibility=1.0) for _ in range(33)]
    for side_offset, indices in [
        (-0.02, _Side(_Lm.LEFT_SHOULDER, _Lm.LEFT_ELBOW, _Lm.LEFT_WRIST, _Lm.LEFT_HIP, _Lm.LEFT_KNEE, _Lm.LEFT_ANKLE)),
        (0.02, _Side(_Lm.RIGHT_SHOULDER, _Lm.RIGHT_ELBOW, _Lm.RIGHT_WRIST, _Lm.RIGHT_HIP, _Lm.RIGHT_KNEE, _Lm.RIGHT_ANKLE)),
    ]:
        landmarks[indices.shoulder] = SimpleNamespace(x=0.20, y=0.50 + side_offset, z=0.0, visibility=1.0)
        landmarks[indices.elbow] = SimpleNamespace(x=0.20, y=0.62 + side_offset, z=0.0, visibility=1.0)
        landmarks[indices.wrist] = SimpleNamespace(x=0.32, y=0.62 + side_offset, z=0.0, visibility=1.0)
        landmarks[indices.hip] = SimpleNamespace(x=0.50, y=hip_y + side_offset, z=0.0, visibility=1.0)
        landmarks[indices.knee] = SimpleNamespace(x=0.65, y=0.50 + side_offset, z=0.0, visibility=1.0)
        landmarks[indices.ankle] = SimpleNamespace(x=0.80, y=0.50 + side_offset, z=0.0, visibility=1.0)
    return landmarks


class _Side:
    def __init__(self, shoulder, elbow, wrist, hip, knee, ankle):
        self.shoulder = shoulder
        self.elbow = elbow
        self.wrist = wrist
        self.hip = hip
        self.knee = knee
        self.ankle = ankle


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
    LEFT_KNEE = 25
    RIGHT_KNEE = 26
    LEFT_ANKLE = 27
    RIGHT_ANKLE = 28


def _fake_mp_pose():
    names = {
        _Lm.NOSE: "NOSE",
        _Lm.LEFT_SHOULDER: "LEFT_SHOULDER",
        _Lm.RIGHT_SHOULDER: "RIGHT_SHOULDER",
        _Lm.LEFT_ELBOW: "LEFT_ELBOW",
        _Lm.RIGHT_ELBOW: "RIGHT_ELBOW",
        _Lm.LEFT_WRIST: "LEFT_WRIST",
        _Lm.RIGHT_WRIST: "RIGHT_WRIST",
        _Lm.LEFT_HIP: "LEFT_HIP",
        _Lm.RIGHT_HIP: "RIGHT_HIP",
        _Lm.LEFT_KNEE: "LEFT_KNEE",
        _Lm.RIGHT_KNEE: "RIGHT_KNEE",
        _Lm.LEFT_ANKLE: "LEFT_ANKLE",
        _Lm.RIGHT_ANKLE: "RIGHT_ANKLE",
    }

    class _PoseLandmark:
        NOSE = SimpleNamespace(value=_Lm.NOSE)
        LEFT_SHOULDER = SimpleNamespace(value=_Lm.LEFT_SHOULDER)
        RIGHT_SHOULDER = SimpleNamespace(value=_Lm.RIGHT_SHOULDER)
        LEFT_ELBOW = SimpleNamespace(value=_Lm.LEFT_ELBOW)
        RIGHT_ELBOW = SimpleNamespace(value=_Lm.RIGHT_ELBOW)
        LEFT_WRIST = SimpleNamespace(value=_Lm.LEFT_WRIST)
        RIGHT_WRIST = SimpleNamespace(value=_Lm.RIGHT_WRIST)
        LEFT_HIP = SimpleNamespace(value=_Lm.LEFT_HIP)
        RIGHT_HIP = SimpleNamespace(value=_Lm.RIGHT_HIP)
        LEFT_KNEE = SimpleNamespace(value=_Lm.LEFT_KNEE)
        RIGHT_KNEE = SimpleNamespace(value=_Lm.RIGHT_KNEE)
        LEFT_ANKLE = SimpleNamespace(value=_Lm.LEFT_ANKLE)
        RIGHT_ANKLE = SimpleNamespace(value=_Lm.RIGHT_ANKLE)

        def __new__(cls, value):
            return SimpleNamespace(name=names.get(value, f"LANDMARK_{value}"))

    return SimpleNamespace(PoseLandmark=_PoseLandmark)
