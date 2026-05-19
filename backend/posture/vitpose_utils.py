from __future__ import annotations

import logging
import os
from types import SimpleNamespace

import cv2
import numpy as np

logger = logging.getLogger("posture.vitpose_utils")


class _LandmarkSmoother:
    def __init__(self, alpha: float | None = None):
        self.alpha = float(os.getenv("VITPOSE_EMA_ALPHA", alpha if alpha is not None else 0.35))
        self._prev: dict[int, tuple[float, float, float]] = {}

    def update(self, landmarks):
        if landmarks is None:
            self._prev.clear()
            return None

        smoothed = []
        for i, lm in enumerate(landmarks):
            x, y, z = float(lm.x), float(lm.y), float(lm.z)
            visibility = float(getattr(lm, "visibility", 1.0))
            if i in self._prev:
                px, py, pz = self._prev[i]
                x = self.alpha * x + (1 - self.alpha) * px
                y = self.alpha * y + (1 - self.alpha) * py
                z = self.alpha * z + (1 - self.alpha) * pz
            self._prev[i] = (x, y, z)
            smoothed.append(SimpleNamespace(x=x, y=y, z=z, visibility=visibility))
        return smoothed


class _NormalizedPoseLandmarks:
    """Small wrapper so existing callers can treat ViTPose output as pose landmarks."""

    _gymfixer_normalized_pose = True

    def __init__(self, landmarks):
        self.landmark = landmarks


class VitPoseProcessor:
    """Optional offline pose backend powered by Hugging Face ViTPose.

    ViTPose predicts COCO-17 body keypoints. We map those keypoints into the
    MediaPipe Pose 33-landmark slots used by the existing angle/rule code.
    Missing MediaPipe-only points are left invisible.
    """

    # COCO keypoint index -> MediaPipe Pose index
    _COCO_TO_MEDIAPIPE = {
        0: 0,    # nose
        1: 2,    # left eye
        2: 5,    # right eye
        3: 7,    # left ear
        4: 8,    # right ear
        5: 11,   # left shoulder
        6: 12,   # right shoulder
        7: 13,   # left elbow
        8: 14,   # right elbow
        9: 15,   # left wrist
        10: 16,  # right wrist
        11: 23,  # left hip
        12: 24,  # right hip
        13: 25,  # left knee
        14: 26,  # right knee
        15: 27,  # left ankle
        16: 28,  # right ankle
    }

    def __init__(self):
        self.model_name = os.getenv("VITPOSE_MODEL", "usyd-community/vitpose-base-simple")
        self.device = os.getenv("VITPOSE_DEVICE", "auto")
        self.keypoint_threshold = float(os.getenv("VITPOSE_KEYPOINT_THRESHOLD", "0.25"))
        self.pose_threshold = float(os.getenv("VITPOSE_POSE_THRESHOLD", "0.25"))
        self.smoother = _LandmarkSmoother()

        try:
            import torch
            from PIL import Image
            from transformers import AutoImageProcessor, VitPoseForPoseEstimation
        except ImportError as exc:
            raise RuntimeError(
                "POSE_BACKEND=vitpose requires optional ViTPose dependencies. "
                "Install them with: pip install -r backend/requirements-vitpose.txt"
            ) from exc

        self._torch = torch
        self._image_cls = Image
        if self.device == "auto":
            self.device = "cuda" if torch.cuda.is_available() else "cpu"

        self.image_processor = AutoImageProcessor.from_pretrained(self.model_name)
        self.model = VitPoseForPoseEstimation.from_pretrained(self.model_name)
        self.model.to(self.device)
        self.model.eval()
        logger.info("ViTPose initialised: model=%s device=%s", self.model_name, self.device)

    def process(self, frame):
        if frame is None:
            self.smoother.update(None)
            return None, None, None

        height, width = frame.shape[:2]
        if height <= 0 or width <= 0:
            self.smoother.update(None)
            return None, None, None

        image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        image = self._image_cls.fromarray(image_rgb)

        # Prototype detector: single-subject videos use the whole frame as the
        # person box. A detector can replace this later without touching rules.
        person_boxes = [[0.0, 0.0, float(width), float(height)]]

        try:
            inputs = self.image_processor(image, boxes=[person_boxes], return_tensors="pt")
            inputs = {name: value.to(self.device) for name, value in inputs.items()}
            with self._torch.no_grad():
                outputs = self.model(**inputs)
            pose_results = self.image_processor.post_process_pose_estimation(
                outputs,
                boxes=[person_boxes],
                threshold=self.pose_threshold,
            )
        except Exception:
            logger.exception("ViTPose inference failed")
            self.smoother.update(None)
            return None, None, None

        raw_landmarks = self._pose_results_to_landmarks(pose_results, width, height)
        if not raw_landmarks:
            self.smoother.update(None)
            return None, None, None

        smoothed_landmarks = self.smoother.update(raw_landmarks)
        return _NormalizedPoseLandmarks(smoothed_landmarks), raw_landmarks, smoothed_landmarks

    def _pose_results_to_landmarks(self, pose_results, width: int, height: int):
        try:
            predictions = pose_results[0] if pose_results else []
        except Exception:
            return None
        if not predictions:
            return None

        best = max(predictions, key=self._prediction_score)
        keypoints = self._to_numpy(best.get("keypoints", []))
        scores = self._to_numpy(
            best.get("scores", best.get("keypoint_scores", np.ones(len(keypoints))))
        )
        if keypoints.shape[0] < 17:
            return None

        landmarks = [
            SimpleNamespace(x=0.0, y=0.0, z=0.0, visibility=0.0)
            for _ in range(33)
        ]
        for coco_idx, mp_idx in self._COCO_TO_MEDIAPIPE.items():
            x_px, y_px = keypoints[coco_idx][:2]
            score = float(scores[coco_idx]) if coco_idx < len(scores) else 1.0
            visibility = score if score >= self.keypoint_threshold else 0.0
            landmarks[mp_idx] = SimpleNamespace(
                x=float(x_px) / float(width),
                y=float(y_px) / float(height),
                z=0.0,
                visibility=visibility,
            )

        return landmarks

    @staticmethod
    def _prediction_score(prediction) -> float:
        if "score" in prediction:
            try:
                return float(prediction["score"])
            except (TypeError, ValueError):
                pass
        scores = prediction.get("scores")
        if scores is None:
            scores = prediction.get("keypoint_scores")
        if scores is None:
            scores = []
        if hasattr(scores, "detach"):
            scores = scores.detach().cpu().numpy()
        scores = np.asarray(scores, dtype=float)
        if len(scores) == 0:
            return 0.0
        return float(np.mean(scores))

    @staticmethod
    def _to_numpy(value):
        if hasattr(value, "detach"):
            value = value.detach().cpu().numpy()
        return np.asarray(value, dtype=float)
