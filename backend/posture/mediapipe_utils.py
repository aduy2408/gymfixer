import cv2
import logging
import os
from threading import Lock

from posture.exercises.common import import_mediapipe

logger = logging.getLogger("posture.mediapipe_utils")


class _LazyMediaPipePose:
    def __getattr__(self, name: str):
        mp = import_mediapipe()
        return getattr(mp.solutions.pose, name)


mp_pose = _LazyMediaPipePose()


# ---------------------------------------------------------------------------
# EMA Landmark Smoother
# ---------------------------------------------------------------------------

class LandmarkSmoother:
    """Exponential Moving Average smoother for MediaPipe landmark coordinates.

    Reduces jitter in pose landmark positions across frames without adding
    significant latency. alpha controls the smoothing strength:
      - Higher alpha (0.6–0.8) → more responsive, less smooth
      - Lower alpha (0.2–0.4)  → smoother, slightly more lag

    Usage:
        smoother = LandmarkSmoother(alpha=0.4)
        smoothed_landmarks = smoother.update(landmarks_list)
    """

    def __init__(self, alpha: float = None):
        self.alpha = float(os.getenv("MP_EMA_ALPHA", alpha if alpha is not None else 0.4))
        self._prev: dict[int, tuple[float, float, float]] = {}

    def update(self, landmarks):
        """Apply EMA to each landmark's (x, y, z) coordinates.

        Returns the same list object with coordinates updated in-place via a
        lightweight wrapper. The original MediaPipe landmark objects are not
        mutable, so we return a list of SimpleNamespace objects instead.
        """
        if landmarks is None:
            self._prev.clear()
            return None

        from types import SimpleNamespace
        smoothed = []
        for i, lm in enumerate(landmarks):
            x, y, z = lm.x, lm.y, lm.z
            vis = getattr(lm, 'visibility', 1.0)
            if i in self._prev:
                px, py, pz = self._prev[i]
                x = self.alpha * x + (1 - self.alpha) * px
                y = self.alpha * y + (1 - self.alpha) * py
                z = self.alpha * z + (1 - self.alpha) * pz
            self._prev[i] = (x, y, z)
            smoothed.append(SimpleNamespace(x=x, y=y, z=z, visibility=vis))
        return smoothed


# ---------------------------------------------------------------------------
# Visibility helpers
# ---------------------------------------------------------------------------

# Minimum visibility score for a keypoint to be considered reliable
_VIS_THRESHOLD = float(os.getenv("MP_VIS_THRESHOLD", "0.5"))

def _critical_kp(exercise: str) -> list[int]:
    pose = mp_pose.PoseLandmark
    return {
        'squat': [
            pose.LEFT_HIP.value,
            pose.RIGHT_HIP.value,
            pose.LEFT_KNEE.value,
            pose.RIGHT_KNEE.value,
            pose.LEFT_ANKLE.value,
            pose.RIGHT_ANKLE.value,
        ],
        'lunge': [
            pose.LEFT_SHOULDER.value,
            pose.RIGHT_SHOULDER.value,
            pose.LEFT_HIP.value,
            pose.RIGHT_HIP.value,
            pose.LEFT_KNEE.value,
            pose.RIGHT_KNEE.value,
            pose.LEFT_ANKLE.value,
            pose.RIGHT_ANKLE.value,
        ],
        'plank': [
            pose.LEFT_SHOULDER.value,
            pose.RIGHT_SHOULDER.value,
            pose.LEFT_ELBOW.value,
            pose.RIGHT_ELBOW.value,
            pose.LEFT_HIP.value,
            pose.RIGHT_HIP.value,
            pose.LEFT_KNEE.value,
            pose.RIGHT_KNEE.value,
            pose.LEFT_ANKLE.value,
            pose.RIGHT_ANKLE.value,
        ],
        'bicep_curl': [
            pose.LEFT_SHOULDER.value,
            pose.RIGHT_SHOULDER.value,
            pose.LEFT_ELBOW.value,
            pose.RIGHT_ELBOW.value,
            pose.LEFT_WRIST.value,
            pose.RIGHT_WRIST.value,
        ],
        'romanian_deadlift': [
            pose.LEFT_SHOULDER.value,
            pose.RIGHT_SHOULDER.value,
            pose.LEFT_HIP.value,
            pose.RIGHT_HIP.value,
            pose.LEFT_KNEE.value,
            pose.RIGHT_KNEE.value,
            pose.LEFT_ANKLE.value,
            pose.RIGHT_ANKLE.value,
            pose.LEFT_WRIST.value,
            pose.RIGHT_WRIST.value,
        ],
        'fly_pec': [
            pose.LEFT_SHOULDER.value,
            pose.RIGHT_SHOULDER.value,
            pose.LEFT_ELBOW.value,
            pose.RIGHT_ELBOW.value,
            pose.LEFT_WRIST.value,
            pose.RIGHT_WRIST.value,
            pose.LEFT_HIP.value,
            pose.RIGHT_HIP.value,
        ],
    }.get(exercise, [])


def check_visibility(landmarks, exercise: str) -> tuple[bool, list[str]]:
    """Check whether critical keypoints for an exercise are sufficiently visible.

    Returns:
        (ok, missing_names): ok=True if all critical keypoints pass threshold.
        missing_names contains human-readable names for occluded keypoints.
    """
    if not _person_anchor_visible(landmarks):
        return False, ["face"]

    if exercise == 'plank':
        side_sets = [
            [
                mp_pose.PoseLandmark.LEFT_SHOULDER.value,
                mp_pose.PoseLandmark.LEFT_ELBOW.value,
                mp_pose.PoseLandmark.LEFT_HIP.value,
                mp_pose.PoseLandmark.LEFT_KNEE.value,
                mp_pose.PoseLandmark.LEFT_ANKLE.value,
            ],
            [
                mp_pose.PoseLandmark.RIGHT_SHOULDER.value,
                mp_pose.PoseLandmark.RIGHT_ELBOW.value,
                mp_pose.PoseLandmark.RIGHT_HIP.value,
                mp_pose.PoseLandmark.RIGHT_KNEE.value,
                mp_pose.PoseLandmark.RIGHT_ANKLE.value,
            ],
        ]
        missing = []
        for indices in side_sets:
            side_missing = []
            for idx in indices:
                try:
                    vis = getattr(landmarks[idx], 'visibility', 1.0)
                    if vis < _VIS_THRESHOLD:
                        side_missing.append(mp_pose.PoseLandmark(idx).name.lower().replace('_', ' '))
                except (IndexError, ValueError):
                    side_missing.append(f"landmark_{idx}")
            if not side_missing:
                return True, []
            missing.extend(side_missing)
        return False, missing

    if exercise in {'bicep_curl', 'romanian_deadlift', 'fly_pec'}:
        visible_sides = []
        missing_by_side = []
        if exercise == 'bicep_curl':
            side_specs = [
                ("left", [
                    mp_pose.PoseLandmark.LEFT_SHOULDER.value,
                    mp_pose.PoseLandmark.LEFT_ELBOW.value,
                    mp_pose.PoseLandmark.LEFT_WRIST.value,
                ]),
                ("right", [
                    mp_pose.PoseLandmark.RIGHT_SHOULDER.value,
                    mp_pose.PoseLandmark.RIGHT_ELBOW.value,
                    mp_pose.PoseLandmark.RIGHT_WRIST.value,
                ]),
            ]
        elif exercise == 'fly_pec':
            side_specs = [
                ("left", [
                    mp_pose.PoseLandmark.LEFT_SHOULDER.value,
                    mp_pose.PoseLandmark.LEFT_ELBOW.value,
                    mp_pose.PoseLandmark.LEFT_WRIST.value,
                    mp_pose.PoseLandmark.LEFT_HIP.value,
                ]),
                ("right", [
                    mp_pose.PoseLandmark.RIGHT_SHOULDER.value,
                    mp_pose.PoseLandmark.RIGHT_ELBOW.value,
                    mp_pose.PoseLandmark.RIGHT_WRIST.value,
                    mp_pose.PoseLandmark.RIGHT_HIP.value,
                ]),
            ]
        else:
            side_specs = [
                ("left", [
                    mp_pose.PoseLandmark.LEFT_SHOULDER.value,
                    mp_pose.PoseLandmark.LEFT_HIP.value,
                    mp_pose.PoseLandmark.LEFT_KNEE.value,
                ]),
                ("right", [
                    mp_pose.PoseLandmark.RIGHT_SHOULDER.value,
                    mp_pose.PoseLandmark.RIGHT_HIP.value,
                    mp_pose.PoseLandmark.RIGHT_KNEE.value,
                ]),
            ]
        for side, indices in side_specs:
            missing = []
            for idx in indices:
                try:
                    vis = getattr(landmarks[idx], 'visibility', 1.0)
                    if vis < _VIS_THRESHOLD:
                        missing.append(mp_pose.PoseLandmark(idx).name.lower().replace('_', ' '))
                except (IndexError, ValueError):
                    missing.append(f"landmark_{idx}")
            if missing:
                missing_by_side.extend(missing)
            else:
                visible_sides.append(side)

        if visible_sides:
            return True, []
        return False, missing_by_side

    kp_indices = _critical_kp(exercise)
    if not kp_indices or not landmarks:
        return True, []

    missing = []
    for idx in kp_indices:
        try:
            vis = getattr(landmarks[idx], 'visibility', 1.0)
            if vis < _VIS_THRESHOLD:
                missing.append(mp_pose.PoseLandmark(idx).name.lower().replace('_', ' '))
        except (IndexError, ValueError):
            missing.append(f"landmark_{idx}")
    return len(missing) == 0, missing


# ---------------------------------------------------------------------------
# PoseProcessor
# ---------------------------------------------------------------------------

class PoseProcessor:
    """Persistent pose processor facade.

    Default backend is MediaPipe Pose. Set POSE_BACKEND=vitpose to use the
    optional offline ViTPose backend while preserving the existing landmark
    format expected by visibility gates, angle extraction, and feedback rules.

    Usage:
        processor = PoseProcessor()
        pose_landmarks, landmarks, smoothed_landmarks = processor.process(frame)
    """

    def __init__(
        self,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
        model_complexity=0,
        backend_name: str | None = None,
    ):
        self.backend_name = (backend_name or os.getenv("POSE_BACKEND", "mediapipe")).strip().lower()
        self._delegate = None
        if self.backend_name == "vitpose":
            from posture.vitpose_utils import VitPoseProcessor

            self._delegate = VitPoseProcessor()
            return

        self.backend_name = "mediapipe"
        self.min_detection_confidence = float(os.getenv("MP_MIN_DET_CONF", min_detection_confidence))
        self.min_tracking_confidence = float(os.getenv("MP_MIN_TRACK_CONF", min_tracking_confidence))
        # model_complexity: 0=Lite (~15ms, best FPS), 1=Full, 2=Heavy (~50ms)
        # Lite is preferred here because GPU is not available on Linux pip install;
        # EMA smoothing in this class compensates for Lite's extra jitter.
        # Override via MP_MODEL_COMPLEXITY env var if running on a capable host.
        self.model_complexity = int(os.getenv("MP_MODEL_COMPLEXITY", model_complexity))
        self.pose = self._create_pose()
        self.smoother = LandmarkSmoother()
        logger.info(
            f"PoseProcessor initialised: complexity={self.model_complexity}, "
            f"det_conf={self.min_detection_confidence}, "
            f"track_conf={self.min_tracking_confidence}"
        )

    def _create_pose(self):
        self.pose = mp_pose.Pose(
            static_image_mode=False,
            model_complexity=self.model_complexity,
            smooth_landmarks=True,          # built-in temporal smoothing
            enable_segmentation=False,
            min_detection_confidence=self.min_detection_confidence,
            min_tracking_confidence=self.min_tracking_confidence,
        )
        return self.pose

    def reset_state(self):
        if self._delegate is not None:
            smoother = getattr(self._delegate, "smoother", None)
            if smoother is not None:
                smoother.update(None)
            return
        self.smoother.update(None)
        try:
            self.pose.close()
        except Exception:
            logger.exception("Error closing MediaPipe Pose graph during reset")
        self.pose = self._create_pose()

    def process(self, frame):
        """Process an OpenCV BGR frame.

        Returns (pose_landmarks, raw_landmarks_list, smoothed_landmarks_list).
        All three may be None if no person detected.
        """
        if self._delegate is not None:
            return self._delegate.process(frame)

        if frame is None:
            return None, None, None
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.pose.process(frame_rgb)
        if results.pose_landmarks:
            raw = results.pose_landmarks.landmark
            smoothed = self.smoother.update(raw)
            return results.pose_landmarks, raw, smoothed
        self.smoother.update(None)   # reset smoother on lost detection
        return None, None, None


def _has_enough_landmarks(landmarks):
    return bool(landmarks) and len(landmarks) >= 33


def _person_anchor_visible(landmarks) -> bool:
    if not _has_enough_landmarks(landmarks):
        return False
    try:
        nose = landmarks[mp_pose.PoseLandmark.NOSE.value]
        return getattr(nose, 'visibility', 0.0) >= _VIS_THRESHOLD
    except (IndexError, ValueError):
        return False


# ---------------------------------------------------------------------------
# Exercise-specific angle extraction
# ---------------------------------------------------------------------------

from posture.exercises.common import set_visibility_threshold
from posture.exercises.registry import ANGLE_FUNCTIONS


set_visibility_threshold(_VIS_THRESHOLD)


def get_angles_for_exercise(exercise, landmarks):
    """Return angles dict for the given exercise. Returns {} on unknown exercise."""
    fn = ANGLE_FUNCTIONS.get(exercise)
    if not fn:
        return {}
    return fn(landmarks)


# ---------------------------------------------------------------------------
# Default singleton reused by the WebSocket handler
# ---------------------------------------------------------------------------

DEFAULT_POSE_PROCESSOR = None
_POSE_PROCESSORS_BY_BACKEND: dict[str, PoseProcessor] = {}
_POSE_PROCESSORS_LOCK = Lock()


def get_default_pose_processor() -> PoseProcessor:
    global DEFAULT_POSE_PROCESSOR
    if DEFAULT_POSE_PROCESSOR is None:
        DEFAULT_POSE_PROCESSOR = PoseProcessor()
    return DEFAULT_POSE_PROCESSOR


def get_cached_pose_processor(backend_name: str | None = None) -> PoseProcessor:
    cache_key = (backend_name or os.getenv("POSE_BACKEND", "mediapipe")).strip().lower()
    if cache_key == "mp":
        cache_key = "mediapipe"
    with _POSE_PROCESSORS_LOCK:
        processor = _POSE_PROCESSORS_BY_BACKEND.get(cache_key)
        if processor is None:
            processor = PoseProcessor(backend_name=cache_key)
            _POSE_PROCESSORS_BY_BACKEND[cache_key] = processor
        return processor
