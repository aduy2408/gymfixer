from posture.exercises import lunge
from posture.phase_detector import PhaseDetector
from posture.rep_breakdown import INCOMPLETE_LUNGE_REP_ISSUE, build_rep_breakdown


def _update_many(detector: PhaseDetector, values: list[float]) -> tuple[str | None, int]:
    phase = None
    reps = 0
    for value in values:
        phase, reps = detector.update({"front_knee": value, "min_knee": value})
    return phase, reps


def test_lunge_counts_full_rep():
    detector = PhaseDetector("lunge")

    phase, reps = _update_many(
        detector,
        [170, 170, 170, 170, 145, 138, 130, 118, 110, 105, 110, 125, 135, 145, 165, 168, 170, 170],
    )

    assert phase == "STANDING"
    assert reps == 1


def test_lunge_shallow_attempt_does_not_count_rep():
    detector = PhaseDetector("lunge")

    phase, reps = _update_many(
        detector,
        [170, 170, 170, 170, 145, 140, 136, 134, 136, 142, 165, 168, 170, 170],
    )

    assert phase == "STANDING"
    assert reps == 0


def test_lunge_rep_breakdown_marks_incomplete_attempt():
    reps = build_rep_breakdown(
        [
            _entry(1, "DESCENDING", 0, 145),
            _entry(2, "ASCENDING", 0, 136),
            _entry(3, "STANDING", 0, 165),
        ],
        exercise="lunge",
        total_reps=0,
    )

    assert len(reps) == 1
    assert reps[0]["completed"] is False
    assert INCOMPLETE_LUNGE_REP_ISSUE in reps[0]["issues"]


def test_lunge_rep_breakdown_marks_mid_rep_session_end_incomplete():
    reps = build_rep_breakdown(
        [
            _entry(1, "DESCENDING", 0, 145),
            _entry(2, "BOTTOM", 0, 112),
        ],
        exercise="lunge",
        total_reps=0,
    )

    assert len(reps) == 1
    assert reps[0]["completed"] is False
    assert INCOMPLETE_LUNGE_REP_ISSUE in reps[0]["issues"]


def test_lunge_feedback_shallow_bottom():
    feedback = lunge.generate_feedback(
        {"front_knee": 140, "rear_knee": 100},
        phase="BOTTOM",
        camera_view="front",
    )

    assert any("go deeper" in item.lower() for item in feedback)


def test_lunge_feedback_too_deep_and_torso_lean():
    feedback = lunge.generate_feedback(
        {"front_knee": 50, "rear_knee": 55, "torso_lean": 35},
        phase="BOTTOM",
        camera_view="side",
    )

    assert any("too low" in item.lower() for item in feedback)
    assert any("torso upright" in item.lower() for item in feedback)


def test_lunge_feedback_knee_over_toe_side_view_only():
    side_feedback = lunge.generate_feedback(
        {"front_knee": 100, "front_knee_over_toe_ratio": 0.6},
        phase="BOTTOM",
        camera_view="side",
    )
    front_feedback = lunge.generate_feedback(
        {"front_knee": 100, "front_knee_over_toe_ratio": 0.6},
        phase="BOTTOM",
        camera_view="front",
    )

    assert any("past your toes" in item.lower() for item in side_feedback)
    assert not any("past your toes" in item.lower() for item in front_feedback)


def _entry(frame_index: int, phase: str, rep_count: int, front_knee: float) -> dict:
    return {
        "frame_index": frame_index,
        "timestamp_ms": frame_index * 100,
        "status": "ok",
        "phase": phase,
        "rep_count": rep_count,
        "angles": {"front_knee": front_knee},
        "feedback": [],
        "problem_feedback": [],
    }
