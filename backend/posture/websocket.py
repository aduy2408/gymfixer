from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import cv2
import numpy as np
import base64
import json
import time
import os
import logging
import traceback

from posture import mediapipe_utils, visualizer, feedback as feedback_module
from posture.phase_detector import PhaseDetector

router = APIRouter()

logger = logging.getLogger("posture.websocket")
VERBOSE = os.getenv("VERBOSE_LOGGING", "false").lower() in ("1", "true", "yes")
if VERBOSE:
    logging.basicConfig(level=logging.DEBUG)

# Throttle / resize defaults (tunable via env)
# Keep server-side frames compact because skeleton images are returned over the
# same WebSocket, often through a tunnel.
WS_TARGET_FPS  = float(os.getenv("WS_TARGET_FPS", "30"))
FRAME_MAX_WIDTH = int(os.getenv("FRAME_MAX_WIDTH", "480"))
ENABLE_SKELETON = os.getenv("ENABLE_SKELETON", "true").lower() in ("1", "true", "yes")


def _resize_for_processing(frame, max_width=FRAME_MAX_WIDTH):
    if frame is None:
        return None
    h, w = frame.shape[:2]
    if w <= max_width:
        return frame
    scale = max_width / float(w)
    return cv2.resize(frame, (int(w * scale), int(h * scale)))


@router.websocket("/ws/posture")
async def posture_ws(websocket: WebSocket):
    """WebSocket endpoint for real-time posture analysis.

    Architecture (server-side processing):
      - Camera lives on the client (browser/mobile).
      - Client captures frames and streams them to this server via WebSocket.
      - All pose estimation and analysis runs here on the host machine.
      - Server sends back JSON feedback + annotated skeleton frame.

    Protocol:
      TEXT  – JSON with optional keys:
                { "frame": "<base64-jpeg>", "exercise": "squat" }  (legacy)
                { "type": "meta", "exercise": "squat", "skeleton": true }
      BINARY – raw JPEG bytes (preferred; lower overhead than base64)

    Response JSON schema:
      {
        "feedback":        ["string", ...],
        "phase":           "STANDING" | "DESCENDING" | "BOTTOM" | "ASCENDING"
                           | "EXTENDED" | "CURLING" | "CONTRACTED" | "LOWERING"
                           | null,
        "rep_count":       <int>,
        "visibility_ok":   <bool>,
        "skeleton_binary": <bool>     # true when skeleton follows as next binary msg
        | "skeleton_frame": "<base64>" | null
      }
    """
    await websocket.accept()
    logger.info("WebSocket connection accepted")

    # Reuse the module-level singleton to avoid re-loading the Heavy model per connection
    pose_processor = getattr(mediapipe_utils, "DEFAULT_POSE_PROCESSOR", None) \
        or mediapipe_utils.PoseProcessor()

    # --- Per-session state ---
    exercise: str | None = None
    phase_detector: PhaseDetector | None = None
    last_processed: float = 0.0
    last_feedback: list[str] = ["No frames processed yet."]
    last_phase: str | None = None
    last_rep_count: int = 0
    last_skeleton: bytes | None = None
    client_prefers_binary: bool = False
    skeleton_enabled: bool = ENABLE_SKELETON

    def _reset_detector(new_exercise: str):
        nonlocal phase_detector
        if new_exercise in ("squat", "bicep_curl"):
            phase_detector = PhaseDetector(new_exercise)
        else:
            phase_detector = None
        logger.info(f"Phase detector initialised for: {new_exercise}")

    try:
        while True:
            msg = await websocket.receive()

            frame = None
            received_binary = False

            # ------------------------------------------------------------------
            # Parse incoming message
            # ------------------------------------------------------------------
            if "text" in msg and msg.get("text"):
                try:
                    data = json.loads(msg["text"])
                except Exception:
                    logger.exception("Invalid JSON on websocket")
                    await websocket.send_json({"error": "invalid json"})
                    continue

                # Exercise change
                if "exercise" in data:
                    new_ex = data["exercise"]
                    if new_ex != exercise:
                        logger.info(f"Exercise changed: {exercise} → {new_ex}")
                        exercise = new_ex
                        _reset_detector(exercise)

                # Meta-control message
                if data.get("type") == "meta":
                    new_ex = data.get("exercise", exercise)
                    if new_ex != exercise:
                        exercise = new_ex
                        _reset_detector(exercise)
                    skeleton_enabled = data.get("skeleton", skeleton_enabled)
                    if data.get("verbose") is not None and data["verbose"]:
                        logger.setLevel(logging.DEBUG)
                    logger.info(f"Meta ACK: exercise={exercise}, skeleton={skeleton_enabled}")
                    await websocket.send_json({"meta_ack": True})
                    continue

                # Legacy base64 frame
                frame_b64 = data.get("frame")
                if frame_b64:
                    try:
                        frame_arr = np.frombuffer(base64.b64decode(frame_b64), dtype=np.uint8)
                        frame = cv2.imdecode(frame_arr, cv2.IMREAD_COLOR)
                    except Exception:
                        logger.exception("Error decoding base64 frame")
                        await websocket.send_json({"error": "frame decode error"})
                        continue

            elif "bytes" in msg and msg.get("bytes"):
                # Raw binary JPEG (preferred path — less CPU overhead)
                received_binary = True
                client_prefers_binary = True
                try:
                    frame_arr = np.frombuffer(msg["bytes"], dtype=np.uint8)
                    frame = cv2.imdecode(frame_arr, cv2.IMREAD_COLOR)
                except Exception:
                    logger.exception("Error decoding binary frame")
                    await websocket.send_json({"error": "frame decode error"})
                    continue
            else:
                logger.debug("Empty or unsupported websocket message")
                continue

            # ------------------------------------------------------------------
            # FPS throttling — return cached results if too soon
            # ------------------------------------------------------------------
            now = time.time()
            elapsed = now - last_processed
            min_interval = 1.0 / WS_TARGET_FPS if WS_TARGET_FPS > 0 else 0

            if elapsed < min_interval:
                logger.debug(f"Throttled frame; elapsed={elapsed:.4f}s")
                await _send_response(
                    websocket, client_prefers_binary,
                    last_feedback, last_phase, last_rep_count,
                    True, last_skeleton, skeleton_enabled
                )
                continue

            # ------------------------------------------------------------------
            # Resize for inference
            # ------------------------------------------------------------------
            proc_frame = _resize_for_processing(frame)

            # ------------------------------------------------------------------
            # MediaPipe Heavy pose estimation
            # ------------------------------------------------------------------
            try:
                t0 = time.time()
                pose_landmarks, raw_landmarks, smoothed_landmarks = pose_processor.process(proc_frame)
                logger.debug(f"MediaPipe inference: {(time.time()-t0)*1000:.1f}ms | "
                             f"detected={'yes' if pose_landmarks else 'no'}")
            except Exception:
                logger.exception("MediaPipe processing error")
                pose_landmarks = raw_landmarks = smoothed_landmarks = None

            # ------------------------------------------------------------------
            # Analysis
            # ------------------------------------------------------------------
            feedback: list[str] = ["No person detected. Please make sure you are in frame."]
            phase_str: str | None = None
            rep_count: int = last_rep_count
            visibility_ok: bool = True

            if pose_landmarks and smoothed_landmarks:
                if not exercise:
                    feedback = ["No exercise selected. Please choose an exercise in the UI."]
                else:
                    # Visibility gate — check critical keypoints before analysis
                    visibility_ok, missing_kp = mediapipe_utils.check_visibility(
                        smoothed_landmarks, exercise
                    )
                    if not visibility_ok:
                        feedback = [
                            f"Move into frame — can't see: {', '.join(missing_kp)}."
                        ]
                    else:
                        # Use smoothed landmarks for angle computation
                        angles = mediapipe_utils.get_angles_for_exercise(exercise, smoothed_landmarks)
                        logger.debug(f"Angles [{exercise}]: {angles}")

                        if not angles:
                            feedback = ["Please get fully into the frame."]
                        else:
                            # Phase detection (squat / bicep_curl only)
                            if phase_detector is not None:
                                phase_str, rep_count = phase_detector.update(angles)
                                logger.debug(f"Phase: {phase_str} | Reps: {rep_count}")

                            # Phase-aware feedback
                            feedback = feedback_module.generate_feedback(
                                exercise, angles, phase=phase_str
                            )

            # ------------------------------------------------------------------
            # Skeleton annotation
            # ------------------------------------------------------------------
            skeleton_bytes: bytes | None = None
            try:
                skeleton_bytes = visualizer.draw_skeleton_bytes(
                    proc_frame,
                    pose_landmarks=pose_landmarks,
                    landmarks_list=raw_landmarks,
                    draw=skeleton_enabled,
                )
            except Exception:
                logger.exception("Error drawing skeleton")
                skeleton_bytes = visualizer.draw_skeleton_bytes(proc_frame, draw=False)

            # Cache and timestamp
            last_processed = now
            last_feedback   = feedback
            last_phase      = phase_str
            last_rep_count  = rep_count
            last_skeleton   = skeleton_bytes

            # ------------------------------------------------------------------
            # Send response
            # ------------------------------------------------------------------
            try:
                await _send_response(
                    websocket, client_prefers_binary,
                    feedback, phase_str, rep_count,
                    visibility_ok, skeleton_bytes, skeleton_enabled
                )
                logger.info(f"→ phase={phase_str} reps={rep_count} "
                            f"vis_ok={visibility_ok} feedback={feedback}")
            except Exception:
                logger.exception("Error sending websocket response")

    except WebSocketDisconnect:
        logger.info("Client disconnected")
    except Exception:
        logger.exception("Unhandled error in websocket loop")


# ---------------------------------------------------------------------------
# Helper: unified response sender
# ---------------------------------------------------------------------------

async def _send_response(
    websocket: WebSocket,
    prefer_binary: bool,
    feedback: list[str],
    phase: str | None,
    rep_count: int,
    visibility_ok: bool,
    skeleton_bytes: bytes | None,
    skeleton_enabled: bool,
):
    """Send feedback JSON + optional skeleton frame to the client."""
    payload = {
        "feedback":      feedback,
        "phase":         phase,
        "rep_count":     rep_count,
        "visibility_ok": visibility_ok,
    }

    if prefer_binary:
        payload["skeleton_binary"] = skeleton_bytes is not None and skeleton_enabled
        await websocket.send_json(payload)
        if skeleton_bytes is not None and skeleton_enabled:
            await websocket.send_bytes(skeleton_bytes)
    else:
        sk_b64 = None
        if skeleton_bytes is not None and skeleton_enabled:
            sk_b64 = visualizer.bytes_to_base64_jpeg(skeleton_bytes)
        payload["skeleton_frame"] = sk_b64
        await websocket.send_json(payload)
