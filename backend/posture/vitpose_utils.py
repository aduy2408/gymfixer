from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from pathlib import Path
from threading import Lock
from typing import Any
from types import SimpleNamespace

import cv2
import numpy as np

logger = logging.getLogger("posture.vitpose_utils")

BACKEND_DIR = Path(__file__).resolve().parents[1]
DEFAULT_VITPOSE_MODEL_DIR = BACKEND_DIR / "model" / "vitpose"


@dataclass
class _VitPoseRuntime:
    torch: Any
    image_cls: Any
    image_processor: Any
    model: Any
    model_name: str
    device: str
    inference_lock: Lock


_RUNTIME_CACHE: dict[tuple[str, str, str], _VitPoseRuntime] = {}
_RUNTIME_CACHE_LOCK = Lock()


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


def _resolve_device(torch_module, requested_device: str) -> str:
    requested_device = (requested_device or "auto").strip().lower()
    cuda_available = torch_module.cuda.is_available()

    if requested_device == "auto":
        if cuda_available:
            return "cuda"
        logger.warning("ViTPose is falling back to CPU because torch cannot access CUDA.")
        return "cpu"

    if requested_device.startswith("cuda") and not cuda_available:
        raise RuntimeError(
            "VITPOSE_DEVICE is set to CUDA, but torch.cuda.is_available() is false. "
            "Check that the backend process is running in the CUDA-enabled environment "
            "and that the installed torch wheel matches the NVIDIA driver/CUDA stack."
        )

    return requested_device


def _snapshot_is_ready(model_dir: Path) -> bool:
    has_config = (model_dir / "config.json").exists()
    has_processor = (model_dir / "preprocessor_config.json").exists()
    has_weights = any(model_dir.glob("*.safetensors")) or any(model_dir.glob("*.bin"))
    return has_config and has_processor and has_weights


def _resolve_model_source(model_name: str) -> Path | str:
    model_as_path = Path(model_name).expanduser()
    if model_as_path.exists():
        return model_as_path

    model_dir = Path(os.getenv("VITPOSE_MODEL_DIR", str(DEFAULT_VITPOSE_MODEL_DIR))).expanduser()
    if not model_dir.is_absolute():
        model_dir = BACKEND_DIR.parent / model_dir
    if _snapshot_is_ready(model_dir):
        logger.info("Loading ViTPose model from local folder: %s", model_dir)
        return model_dir

    try:
        from huggingface_hub import snapshot_download
    except ImportError as exc:
        raise RuntimeError(
            "ViTPose model is not downloaded yet and huggingface_hub is unavailable. "
            "Install optional dependencies with: pip install -r backend/requirements-vitpose.txt"
        ) from exc

    model_dir.mkdir(parents=True, exist_ok=True)
    logger.info("Downloading ViTPose model %s into %s", model_name, model_dir)
    try:
        snapshot_download(
            repo_id=model_name,
            local_dir=str(model_dir),
            allow_patterns=[
                "config.json",
                "preprocessor_config.json",
                "*.safetensors",
                "*.bin",
                "*.json",
                "*.txt",
            ],
        )
    except Exception as exc:
        raise RuntimeError(
            f"Could not download ViTPose model '{model_name}' into '{model_dir}'. "
            "Check network access or pre-download the model into VITPOSE_MODEL_DIR."
        ) from exc

    if not _snapshot_is_ready(model_dir):
        raise RuntimeError(
            f"Downloaded ViTPose model folder '{model_dir}' is incomplete. "
            "Expected config, preprocessor config, and weight files."
        )
    return model_dir


def get_vitpose_runtime() -> _VitPoseRuntime:
    model_name = os.getenv("VITPOSE_MODEL", "usyd-community/vitpose-base-simple")
    requested_device = os.getenv("VITPOSE_DEVICE", "auto")
    model_source = _resolve_model_source(model_name)
    cache_key = (model_name, requested_device.strip().lower(), str(model_source))

    with _RUNTIME_CACHE_LOCK:
        cached = _RUNTIME_CACHE.get(cache_key)
        if cached is not None:
            return cached

        try:
            import torch
            from PIL import Image
            from transformers import AutoImageProcessor, VitPoseForPoseEstimation
            import transformers
        except ImportError as exc:
            raise RuntimeError(
                "POSE_BACKEND=vitpose requires optional ViTPose dependencies. "
                "Install them with: pip install -r backend/requirements-vitpose.txt"
            ) from exc

        major_version = (getattr(transformers, "__version__", "0").split(".", 1)[0] or "0")
        if major_version.isdigit() and int(major_version) >= 5:
            logger.warning(
                "ViTPose is running with transformers %s. This project is tested with "
                "transformers 4.x; install backend/requirements-vitpose.txt to avoid API drift.",
                transformers.__version__,
            )

        device = _resolve_device(torch, requested_device)
        image_processor = AutoImageProcessor.from_pretrained(model_source)
        model = VitPoseForPoseEstimation.from_pretrained(model_source)
        model.to(device)
        model.eval()

        runtime = _VitPoseRuntime(
            torch=torch,
            image_cls=Image,
            image_processor=image_processor,
            model=model,
            model_name=model_name,
            device=device,
            inference_lock=Lock(),
        )
        _RUNTIME_CACHE[cache_key] = runtime
        logger.info("ViTPose runtime initialised: model=%s device=%s", model_name, device)
        return runtime


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
        self.runtime = get_vitpose_runtime()
        self.model_name = self.runtime.model_name
        self.device = self.runtime.device
        self.keypoint_threshold = float(os.getenv("VITPOSE_KEYPOINT_THRESHOLD", "0.25"))
        self.pose_threshold = float(os.getenv("VITPOSE_POSE_THRESHOLD", "0.25"))
        self.smoother = _LandmarkSmoother()

    def process(self, frame):
        if frame is None:
            self.smoother.update(None)
            return None, None, None

        height, width = frame.shape[:2]
        if height <= 0 or width <= 0:
            self.smoother.update(None)
            return None, None, None

        image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        image = self.runtime.image_cls.fromarray(image_rgb)

        # Prototype detector: single-subject videos use the whole frame as the
        # person box. A detector can replace this later without touching rules.
        person_boxes = [[0.0, 0.0, float(width), float(height)]]

        try:
            inputs = self.runtime.image_processor(image, boxes=[person_boxes], return_tensors="pt")
            inputs = {name: value.to(self.device) for name, value in inputs.items()}
            with self.runtime.inference_lock:
                with self.runtime.torch.inference_mode():
                    outputs = self.runtime.model(**inputs)
            pose_results = self.runtime.image_processor.post_process_pose_estimation(
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
