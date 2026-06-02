from types import SimpleNamespace

from posture.camera_view import CameraViewDetector, estimate_camera_view


def test_estimates_front_view_from_wide_symmetric_landmarks():
    estimate = estimate_camera_view(_landmarks(width=0.32, visibility_right=0.95))

    assert estimate.view == "front"
    assert estimate.confidence > 0.4


def test_estimates_side_view_from_collapsed_asymmetric_landmarks():
    estimate = estimate_camera_view(_landmarks(width=0.05, visibility_right=0.55))

    assert estimate.view == "side"
    assert estimate.confidence > 0.3


def test_detector_can_follow_view_change_over_time():
    detector = CameraViewDetector(window_size=3)

    for _ in range(3):
        detector.update(_landmarks(width=0.05, visibility_right=0.55))
    assert detector.smoothed().view == "side"

    for _ in range(3):
        detector.update(_landmarks(width=0.32, visibility_right=0.95))
    assert detector.smoothed().view == "front"


def _landmarks(*, width: float, visibility_right: float):
    left_x = 0.5 - width / 2
    right_x = 0.5 + width / 2
    landmarks = [SimpleNamespace(x=0.5, y=0.5, z=0.0, visibility=1.0) for _ in range(33)]
    landmarks[11] = SimpleNamespace(x=left_x, y=0.2, z=0.0, visibility=0.95)
    landmarks[12] = SimpleNamespace(x=right_x, y=0.2, z=0.2, visibility=visibility_right)
    landmarks[23] = SimpleNamespace(x=left_x + 0.02, y=0.55, z=0.0, visibility=0.95)
    landmarks[24] = SimpleNamespace(x=right_x - 0.02, y=0.55, z=0.2, visibility=visibility_right)
    landmarks[25] = SimpleNamespace(x=left_x + 0.03, y=0.75, z=0.0, visibility=0.95)
    landmarks[26] = SimpleNamespace(x=right_x - 0.03, y=0.75, z=0.2, visibility=visibility_right)
    landmarks[27] = SimpleNamespace(x=left_x + 0.04, y=0.95, z=0.0, visibility=0.95)
    landmarks[28] = SimpleNamespace(x=right_x - 0.04, y=0.95, z=0.2, visibility=visibility_right)
    return landmarks
