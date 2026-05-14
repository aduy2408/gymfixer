import mediapipe as mp
import math
import cv2
import logging
import os

mp_pose = mp.solutions.pose

logger = logging.getLogger("posture.mediapipe_utils")


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

# Critical keypoint indices per exercise (MediaPipe PoseLandmark values)
_CRITICAL_KP = {
    'squat': [
        mp_pose.PoseLandmark.LEFT_HIP.value,
        mp_pose.PoseLandmark.RIGHT_HIP.value,
        mp_pose.PoseLandmark.LEFT_KNEE.value,
        mp_pose.PoseLandmark.RIGHT_KNEE.value,
        mp_pose.PoseLandmark.LEFT_ANKLE.value,
        mp_pose.PoseLandmark.RIGHT_ANKLE.value,
    ],
    'bicep_curl': [
        mp_pose.PoseLandmark.LEFT_SHOULDER.value,
        mp_pose.PoseLandmark.RIGHT_SHOULDER.value,
        mp_pose.PoseLandmark.LEFT_ELBOW.value,
        mp_pose.PoseLandmark.RIGHT_ELBOW.value,
        mp_pose.PoseLandmark.LEFT_WRIST.value,
        mp_pose.PoseLandmark.RIGHT_WRIST.value,
    ],
}


def check_visibility(landmarks, exercise: str) -> tuple[bool, list[str]]:
    """Check whether critical keypoints for an exercise are sufficiently visible.

    Returns:
        (ok, missing_names): ok=True if all critical keypoints pass threshold.
        missing_names contains human-readable names for occluded keypoints.
    """
    if not _person_anchor_visible(landmarks):
        return False, ["face"]

    if exercise == 'bicep_curl':
        visible_sides = []
        missing_by_side = []
        for side, indices in [
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
        ]:
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

    kp_indices = _CRITICAL_KP.get(exercise, [])
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
    """Persistent MediaPipe Pose processor (Heavy model, model_complexity=2).

    Upgraded from the default Lite model to improve accuracy on partial
    occlusions common in gym environments (e.g., weights blocking limbs).

    GPU note: MediaPipe Python on Linux uses CPU by default. The Heavy model
    still improves accuracy significantly over Lite/Full on CPU.

    Usage:
        processor = PoseProcessor()
        pose_landmarks, landmarks, smoothed_landmarks = processor.process(frame)
    """

    def __init__(self, min_detection_confidence=0.5, min_tracking_confidence=0.5,
                 model_complexity=0):
        self.min_detection_confidence = float(os.getenv("MP_MIN_DET_CONF", min_detection_confidence))
        self.min_tracking_confidence = float(os.getenv("MP_MIN_TRACK_CONF", min_tracking_confidence))
        # model_complexity: 0=Lite (~15ms, best FPS), 1=Full, 2=Heavy (~50ms)
        # Lite is preferred here because GPU is not available on Linux pip install;
        # EMA smoothing in this class compensates for Lite's extra jitter.
        # Override via MP_MODEL_COMPLEXITY env var if running on a capable host.
        self.model_complexity = int(os.getenv("MP_MODEL_COMPLEXITY", model_complexity))
        self.pose = mp_pose.Pose(
            static_image_mode=False,
            model_complexity=self.model_complexity,
            smooth_landmarks=True,          # built-in temporal smoothing
            enable_segmentation=False,
            min_detection_confidence=self.min_detection_confidence,
            min_tracking_confidence=self.min_tracking_confidence,
        )
        self.smoother = LandmarkSmoother()
        logger.info(
            f"PoseProcessor initialised: complexity={self.model_complexity}, "
            f"det_conf={self.min_detection_confidence}, "
            f"track_conf={self.min_tracking_confidence}"
        )

    def process(self, frame):
        """Process an OpenCV BGR frame.

        Returns (pose_landmarks, raw_landmarks_list, smoothed_landmarks_list).
        All three may be None if no person detected.
        """
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


# ---------------------------------------------------------------------------
# Angle calculation
# ---------------------------------------------------------------------------

def _safe_angle(a, b, c):
    """Calculate angle at vertex b formed by rays b→a and b→c.

    Returns degrees or None on invalid inputs.
    """
    try:
        ba_x = a.x - b.x
        ba_y = a.y - b.y
        bc_x = c.x - b.x
        bc_y = c.y - b.y

        denom = math.hypot(ba_x, ba_y) * math.hypot(bc_x, bc_y)
        if denom == 0:
            return None
        cosine_angle = (ba_x * bc_x + ba_y * bc_y) / denom
        cosine_angle = max(min(cosine_angle, 1.0), -1.0)
        return math.degrees(math.acos(cosine_angle))
    except Exception:
        logger.exception("Error calculating angle")
        return None


def _has_enough_landmarks(landmarks):
    return bool(landmarks) and len(landmarks) >= 33


def _landmarks_visible(landmarks, indices) -> bool:
    if not _has_enough_landmarks(landmarks):
        return False
    for idx in indices:
        try:
            if getattr(landmarks[idx], 'visibility', 1.0) < _VIS_THRESHOLD:
                return False
        except (IndexError, ValueError):
            return False
    return True


def _person_anchor_visible(landmarks) -> bool:
    if not _has_enough_landmarks(landmarks):
        return False
    try:
        nose = landmarks[mp_pose.PoseLandmark.NOSE.value]
        return getattr(nose, 'visibility', 0.0) >= _VIS_THRESHOLD
    except (IndexError, ValueError):
        return False


# ---------------------------------------------------------------------------
# Per-exercise angle extraction (use smoothed landmarks where available)
# ---------------------------------------------------------------------------

def get_squat_angles(landmarks):
    """Right/left knee and hip angles for squat analysis."""
    angles = {}
    if not _has_enough_landmarks(landmarks):
        return angles

    for side, hip, knee, ankle, shoulder in [
        ('right',
         mp_pose.PoseLandmark.RIGHT_HIP.value,
         mp_pose.PoseLandmark.RIGHT_KNEE.value,
         mp_pose.PoseLandmark.RIGHT_ANKLE.value,
         mp_pose.PoseLandmark.RIGHT_SHOULDER.value),
        ('left',
         mp_pose.PoseLandmark.LEFT_HIP.value,
         mp_pose.PoseLandmark.LEFT_KNEE.value,
         mp_pose.PoseLandmark.LEFT_ANKLE.value,
         mp_pose.PoseLandmark.LEFT_SHOULDER.value),
    ]:
        val = _safe_angle(landmarks[hip], landmarks[knee], landmarks[ankle])
        if val is not None:
            angles[f'{side}_knee'] = val
        val = _safe_angle(landmarks[shoulder], landmarks[hip], landmarks[knee])
        if val is not None:
            angles[f'{side}_hip'] = val

    # Knee valgus: lateral deviation. Positive = knees caving in (valgus).
    # Computed in normalised image space; meaningful for front-facing camera.
    try:
        lk = landmarks[mp_pose.PoseLandmark.LEFT_KNEE.value]
        rk = landmarks[mp_pose.PoseLandmark.RIGHT_KNEE.value]
        la = landmarks[mp_pose.PoseLandmark.LEFT_ANKLE.value]
        ra = landmarks[mp_pose.PoseLandmark.RIGHT_ANKLE.value]
        # Positive when knees are *closer* together than ankles (caving in)
        knee_width = abs(lk.x - rk.x)
        ankle_width = abs(la.x - ra.x)
        if ankle_width > 0:
            angles['knee_valgus_ratio'] = knee_width / ankle_width  # <1 = valgus
    except Exception:
        pass

    return angles


def get_lunge_angles(landmarks):
    """Knee, hip, and torso angles for lunge."""
    angles = {}
    if not _has_enough_landmarks(landmarks):
        return angles

    for side, hip, knee, ankle, shoulder in [
        ('right',
         mp_pose.PoseLandmark.RIGHT_HIP.value,
         mp_pose.PoseLandmark.RIGHT_KNEE.value,
         mp_pose.PoseLandmark.RIGHT_ANKLE.value,
         mp_pose.PoseLandmark.RIGHT_SHOULDER.value),
        ('left',
         mp_pose.PoseLandmark.LEFT_HIP.value,
         mp_pose.PoseLandmark.LEFT_KNEE.value,
         mp_pose.PoseLandmark.LEFT_ANKLE.value,
         mp_pose.PoseLandmark.LEFT_SHOULDER.value),
    ]:
        val = _safe_angle(landmarks[hip], landmarks[knee], landmarks[ankle])
        if val is not None:
            angles[f'{side}_knee'] = val
        val = _safe_angle(landmarks[shoulder], landmarks[hip], landmarks[knee])
        if val is not None:
            angles[f'{side}_hip'] = val

    r_torso = _safe_angle(
        landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value],
        landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value],
        landmarks[mp_pose.PoseLandmark.RIGHT_ANKLE.value]
    ) or 180.0
    l_torso = _safe_angle(
        landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value],
        landmarks[mp_pose.PoseLandmark.LEFT_HIP.value],
        landmarks[mp_pose.PoseLandmark.LEFT_ANKLE.value]
    ) or 180.0
    angles['torso_angle'] = (r_torso + l_torso) / 2.0
    return angles


def get_deadlift_angles(landmarks):
    """Hip, back, and knee angles for deadlift."""
    angles = {}
    if not _has_enough_landmarks(landmarks):
        return angles

    for side, sh, hip, knee, ankle in [
        ('right',
         mp_pose.PoseLandmark.RIGHT_SHOULDER.value,
         mp_pose.PoseLandmark.RIGHT_HIP.value,
         mp_pose.PoseLandmark.RIGHT_KNEE.value,
         mp_pose.PoseLandmark.RIGHT_ANKLE.value),
        ('left',
         mp_pose.PoseLandmark.LEFT_SHOULDER.value,
         mp_pose.PoseLandmark.LEFT_HIP.value,
         mp_pose.PoseLandmark.LEFT_KNEE.value,
         mp_pose.PoseLandmark.LEFT_ANKLE.value),
    ]:
        val = _safe_angle(landmarks[sh], landmarks[hip], landmarks[knee])
        if val is not None:
            angles[f'{side}_hip'] = val
        val = _safe_angle(landmarks[sh], landmarks[hip], landmarks[ankle])
        if val is not None:
            angles[f'{side}_back'] = val
        val = _safe_angle(landmarks[hip], landmarks[knee], landmarks[ankle])
        if val is not None:
            angles[f'{side}_knee'] = val
    return angles


def get_pushup_angles(landmarks):
    """Elbow and body alignment angles for push-up."""
    angles = {}
    if not _has_enough_landmarks(landmarks):
        return angles

    for side, sh, el, wr, hip, ankle in [
        ('right',
         mp_pose.PoseLandmark.RIGHT_SHOULDER.value,
         mp_pose.PoseLandmark.RIGHT_ELBOW.value,
         mp_pose.PoseLandmark.RIGHT_WRIST.value,
         mp_pose.PoseLandmark.RIGHT_HIP.value,
         mp_pose.PoseLandmark.RIGHT_ANKLE.value),
        ('left',
         mp_pose.PoseLandmark.LEFT_SHOULDER.value,
         mp_pose.PoseLandmark.LEFT_ELBOW.value,
         mp_pose.PoseLandmark.LEFT_WRIST.value,
         mp_pose.PoseLandmark.LEFT_HIP.value,
         mp_pose.PoseLandmark.LEFT_ANKLE.value),
    ]:
        val = _safe_angle(landmarks[sh], landmarks[el], landmarks[wr])
        if val is not None:
            angles[f'{side}_elbow'] = val

    r_body = _safe_angle(
        landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value],
        landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value],
        landmarks[mp_pose.PoseLandmark.RIGHT_ANKLE.value]
    ) or 180.0
    l_body = _safe_angle(
        landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value],
        landmarks[mp_pose.PoseLandmark.LEFT_HIP.value],
        landmarks[mp_pose.PoseLandmark.LEFT_ANKLE.value]
    ) or 180.0
    angles['body_angle'] = (r_body + l_body) / 2.0
    return angles


def get_shoulder_press_angles(landmarks):
    """Elbow and shoulder abduction angles for overhead press."""
    angles = {}
    if not _has_enough_landmarks(landmarks):
        return angles

    for side, sh, el, wr, hip in [
        ('right',
         mp_pose.PoseLandmark.RIGHT_SHOULDER.value,
         mp_pose.PoseLandmark.RIGHT_ELBOW.value,
         mp_pose.PoseLandmark.RIGHT_WRIST.value,
         mp_pose.PoseLandmark.RIGHT_HIP.value),
        ('left',
         mp_pose.PoseLandmark.LEFT_SHOULDER.value,
         mp_pose.PoseLandmark.LEFT_ELBOW.value,
         mp_pose.PoseLandmark.LEFT_WRIST.value,
         mp_pose.PoseLandmark.LEFT_HIP.value),
    ]:
        val = _safe_angle(landmarks[sh], landmarks[el], landmarks[wr])
        if val is not None:
            angles[f'{side}_elbow'] = val
        val = _safe_angle(landmarks[el], landmarks[sh], landmarks[hip])
        if val is not None:
            angles[f'{side}_shoulder_abd'] = val
    return angles


def get_bicep_curl_angles(landmarks):
    """Elbow angles for bicep curl.

    Also computes elbow_drift: how far the elbow has moved away from the torso
    (shoulder-to-elbow x-offset normalised by shoulder width). A large positive
    drift indicates the upper arm is swinging forward for momentum.
    """
    angles = {}
    if not _has_enough_landmarks(landmarks):
        return angles

    for side, sh, el, wr in [
        ('right',
         mp_pose.PoseLandmark.RIGHT_SHOULDER.value,
         mp_pose.PoseLandmark.RIGHT_ELBOW.value,
         mp_pose.PoseLandmark.RIGHT_WRIST.value),
        ('left',
         mp_pose.PoseLandmark.LEFT_SHOULDER.value,
         mp_pose.PoseLandmark.LEFT_ELBOW.value,
         mp_pose.PoseLandmark.LEFT_WRIST.value),
    ]:
        if not _landmarks_visible(landmarks, [sh, el, wr]):
            continue
        val = _safe_angle(landmarks[sh], landmarks[el], landmarks[wr])
        if val is not None:
            angles[f'{side}_elbow'] = val

    # Elbow drift: forward swing of elbow during curl
    try:
        lsh = landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value]
        rsh = landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value]
        lel = landmarks[mp_pose.PoseLandmark.LEFT_ELBOW.value]
        rel = landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value]
        shoulder_width = abs(lsh.x - rsh.x) or 0.001
        # How far each elbow has moved forward (y-axis in image ≈ vertical,
        # z-axis in MediaPipe ≈ depth; use z for forward lean)
        if _landmarks_visible(landmarks, [
            mp_pose.PoseLandmark.RIGHT_SHOULDER.value,
            mp_pose.PoseLandmark.RIGHT_ELBOW.value,
        ]):
            angles['right_elbow_drift'] = abs(rel.z - rsh.z) / shoulder_width
        if _landmarks_visible(landmarks, [
            mp_pose.PoseLandmark.LEFT_SHOULDER.value,
            mp_pose.PoseLandmark.LEFT_ELBOW.value,
        ]):
            angles['left_elbow_drift'] = abs(lel.z - lsh.z) / shoulder_width
    except Exception:
        pass

    return angles


# ---------------------------------------------------------------------------
# Dispatch table
# ---------------------------------------------------------------------------

ANGLE_FUNCTIONS = {
    'squat': get_squat_angles,
    'lunge': get_lunge_angles,
    'deadlift': get_deadlift_angles,
    'pushup': get_pushup_angles,
    'shoulder_press': get_shoulder_press_angles,
    'bicep_curl': get_bicep_curl_angles,
}


def get_angles_for_exercise(exercise, landmarks):
    """Return angles dict for the given exercise. Returns {} on unknown exercise."""
    fn = ANGLE_FUNCTIONS.get(exercise)
    if not fn:
        return {}
    return fn(landmarks)


# ---------------------------------------------------------------------------
# Default singleton reused by the WebSocket handler
# ---------------------------------------------------------------------------

DEFAULT_POSE_PROCESSOR = PoseProcessor()
