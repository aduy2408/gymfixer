from __future__ import annotations

import base64
import json
import os
import tempfile
import time
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from typing import Any

import cv2
import numpy as np
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from posture import feedback as feedback_module
from posture import mediapipe_utils
from posture import visualizer
from posture.phase_detector import PhaseDetector


router = APIRouter(prefix="/posture", tags=["posture"])

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
POSTURE_LLM_MAX_LOG_FRAMES = int(os.getenv("POSTURE_LLM_MAX_LOG_FRAMES", "120"))
SUBJECT_READY_MIN_FRAMES = int(os.getenv("POSTURE_SUBJECT_READY_MIN_FRAMES", "3"))
SUBJECT_MIN_BBOX_AREA = float(os.getenv("POSTURE_SUBJECT_MIN_BBOX_AREA", "0.035"))
SUBJECT_MIN_BBOX_WIDTH = float(os.getenv("POSTURE_SUBJECT_MIN_BBOX_WIDTH", "0.12"))
SUBJECT_MIN_BBOX_HEIGHT = float(os.getenv("POSTURE_SUBJECT_MIN_BBOX_HEIGHT", "0.20"))



class SessionFrame(BaseModel):
    frame: str = Field(..., description="Base64-encoded JPEG/PNG frame.")
    timestamp_ms: int | None = Field(
        default=None,
        description="Optional client timestamp for this frame.",
    )


class PostureSessionRequest(BaseModel):
    exercise: str
    frames: list[SessionFrame] = Field(..., min_length=1)
    call_llm: bool = Field(
        default=True,
        description="When true, send the processed posture log to Gemini.",
    )


def analyze_posture_session(
    exercise: str,
    encoded_frames: list[SessionFrame],
    *,
    call_llm: bool = True,
    include_preview: bool = False,
    preview_max_frames: int = 24,
) -> dict[str, Any]:
    """Process a full exercise session, then ask Gemini for coaching advice.

    This is the slower, higher-quality path compared with the real-time
    WebSocket. It runs MediaPipe on every supplied frame, records posture state,
    aggregates recurring issues, and sends a compact structured log to Gemini.
    """
    if exercise not in mediapipe_utils.ANGLE_FUNCTIONS:
        supported = ", ".join(sorted(mediapipe_utils.ANGLE_FUNCTIONS))
        raise ValueError(f"Unsupported exercise '{exercise}'. Supported: {supported}")

    pose_processor = mediapipe_utils.PoseProcessor()
    phase_detector = PhaseDetector(exercise)
    started_at = time.time()

    frame_log: list[dict[str, Any]] = []
    issue_counts: Counter[str] = Counter()
    phase_counts: Counter[str] = Counter()
    visibility_failures: Counter[str] = Counter()
    angle_values: dict[str, list[float]] = defaultdict(list)
    rep_count = 0
    preview_frames: list[dict[str, Any]] = []
    preview_stride = max(1, len(encoded_frames) // max(1, preview_max_frames))
    subject_ready_streak = 0


    for index, session_frame in enumerate(encoded_frames):
        frame = _decode_base64_frame(session_frame.frame)
        if frame is None:
            entry = {
                "frame_index": index,
                "timestamp_ms": session_frame.timestamp_ms,
                "status": "decode_error",
                "feedback": ["Frame could not be decoded."],
            }
            frame_log.append(entry)
            issue_counts.update(entry["feedback"])
            _maybe_add_preview_frame(
                preview_frames,
                frame=frame,
                pose_landmarks=None,
                entry=entry,
                include_preview=include_preview,
                preview_max_frames=preview_max_frames,
                preview_stride=preview_stride,
            )
            continue

        pose_landmarks, _raw_landmarks, smoothed_landmarks = pose_processor.process(frame)
        if not pose_landmarks or not smoothed_landmarks:
            entry = {
                "frame_index": index,
                "timestamp_ms": session_frame.timestamp_ms,
                "status": "no_pose",
                "feedback": ["No person detected."],
            }
            frame_log.append(entry)
            issue_counts.update(entry["feedback"])
            continue

        subject_ready, subject_reason = _subject_ready_for_analysis(
            smoothed_landmarks,
            exercise,
        )
        if subject_ready:
            subject_ready_streak += 1
        else:
            subject_ready_streak = 0

        if not subject_ready or subject_ready_streak < SUBJECT_READY_MIN_FRAMES:
            if subject_ready:
                feedback = [
                    f"Hold still - starting analysis in "
                    f"{SUBJECT_READY_MIN_FRAMES - subject_ready_streak} frames."
                ]
            else:
                feedback = [f"Move fully into frame - {subject_reason}."]
                visibility_failures.update([subject_reason])
            entry = {
                "frame_index": index,
                "timestamp_ms": session_frame.timestamp_ms,
                "status": "waiting_for_subject",
                "visibility_ok": False,
                "feedback": feedback,
            }
            frame_log.append(entry)
            _maybe_add_preview_frame(
                preview_frames,
                frame=frame,
                pose_landmarks=pose_landmarks,
                entry=entry,
                include_preview=include_preview,
                preview_max_frames=preview_max_frames,
                preview_stride=preview_stride,
                force=not subject_ready,
            )
            continue

        visibility_ok, missing_keypoints = mediapipe_utils.check_visibility(
            smoothed_landmarks,
            exercise,
        )
        if not visibility_ok:
            feedback = [f"Move into frame - can't see: {', '.join(missing_keypoints)}."]
            visibility_failures.update(missing_keypoints)
            entry = {
                "frame_index": index,
                "timestamp_ms": session_frame.timestamp_ms,
                "status": "visibility_failed",
                "visibility_ok": False,
                "missing_keypoints": missing_keypoints,
                "feedback": feedback,
            }
            frame_log.append(entry)
            issue_counts.update(feedback)
            _maybe_add_preview_frame(
                preview_frames,
                frame=frame,
                pose_landmarks=pose_landmarks,
                entry=entry,
                include_preview=include_preview,
                preview_max_frames=preview_max_frames,
                preview_stride=preview_stride,
                force=True,
            )
            continue

        angles = mediapipe_utils.get_angles_for_exercise(exercise, smoothed_landmarks)
        phase, rep_count = phase_detector.update(angles)
        feedback = feedback_module.generate_feedback(exercise, angles, phase=phase)

        for name, value in angles.items():
            angle_values[name].append(float(value))
        if phase:
            phase_counts.update([phase])
        issue_counts.update(feedback)

        entry = {
            "frame_index": index,
            "timestamp_ms": session_frame.timestamp_ms,
            "status": "ok",
            "visibility_ok": True,
            "phase": phase,
            "rep_count": rep_count,
            "angles": _round_angles(angles),
            "feedback": feedback,
        }
        frame_log.append(entry)
        _maybe_add_preview_frame(
            preview_frames,
            frame=frame,
            pose_landmarks=pose_landmarks,
            entry=entry,
            include_preview=include_preview,
            preview_max_frames=preview_max_frames,
            preview_stride=preview_stride,
        )

    summary = _build_session_summary(
        exercise=exercise,
        frame_count=len(encoded_frames),
        frame_log=frame_log,
        issue_counts=issue_counts,
        phase_counts=phase_counts,
        visibility_failures=visibility_failures,
        angle_values=angle_values,
        rep_count=rep_count,
        elapsed_ms=int((time.time() - started_at) * 1000),
    )

    llm = {
        "enabled": False,
        "model": GEMINI_MODEL,
        "recommendations": _local_recommendations(summary),
        "error": None,
    }
    if call_llm:
        prompt = build_gemini_posture_prompt(summary, frame_log)
        try:
            llm["enabled"] = True
            llm["recommendations"] = call_gemini_posture_coach(prompt)
        except RuntimeError as exc:
            llm["enabled"] = False
            llm["error"] = str(exc)

    return {
        "exercise": exercise,
        "summary": summary,
        "llm": llm,
        "frame_log": frame_log,
        "preview_frames": preview_frames,
    }


@router.post("/analyze-session")
async def analyze_session(request: PostureSessionRequest):
    """Batch posture analysis endpoint for after-session coaching.

    The frontend should record frames locally during the set, then post them
    here when the user finishes. The user waits longer, but the LLM receives a
    complete movement log instead of a single frame.
    """
    try:
        return analyze_posture_session(
            request.exercise,
            request.frames,
            call_llm=request.call_llm,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/analyze-video")
async def analyze_video(
    exercise: str = Form(...),
    file: UploadFile = File(...),
    call_llm: bool = Form(True),
    sample_fps: float = Form(8.0),
    max_frames: int = Form(360),
    include_preview: bool = Form(True),
    preview_max_frames: int = Form(24),
):
    """Analyze an uploaded exercise video by sampling frames from it.

    This is a convenience wrapper around the existing batch session analyzer.
    It accepts a normal video upload, extracts JPEG frames with OpenCV, then
    feeds those frames through the same MediaPipe + phase detector path.
    """
    if sample_fps <= 0:
        raise HTTPException(status_code=400, detail="sample_fps must be greater than 0.")
    if max_frames <= 0:
        raise HTTPException(status_code=400, detail="max_frames must be greater than 0.")
    if preview_max_frames <= 0:
        raise HTTPException(status_code=400, detail="preview_max_frames must be greater than 0.")

    suffix = os.path.splitext(file.filename or "")[1] or ".mp4"
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_path = temp_file.name
            while chunk := await file.read(1024 * 1024):
                temp_file.write(chunk)

        frames = _sample_video_frames(
            temp_path,
            sample_fps=sample_fps,
            max_frames=max_frames,
        )
        if not frames:
            raise HTTPException(
                status_code=400,
                detail="No readable frames were found in the uploaded video.",
            )

        return analyze_posture_session(
            exercise,
            frames,
            call_llm=call_llm,
            include_preview=include_preview,
            preview_max_frames=preview_max_frames,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        await file.close()
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)


def build_gemini_posture_prompt(
    summary: dict[str, Any],
    frame_log: list[dict[str, Any]],
) -> str:
    coaching_log = [entry for entry in frame_log if entry.get("status") == "ok"]
    log_for_llm = coaching_log or frame_log
    summary_for_llm = _summary_for_llm(summary, coaching_log)
    phase_segments = _build_phase_segments(log_for_llm)
    compact_log = _compact_log_for_llm(
        log_for_llm,
        max_frames=POSTURE_LLM_MAX_LOG_FRAMES,
    )

    return (
        "You are a strength and conditioning coach reviewing a computer-vision "
        "posture log. Give practical recommendations based only on analyzed "
        "exercise frames. The provided log has already removed setup/walk-in "
        "frames where the subject was not ready. Do not call the session "
        "fragmented because of missing setup frames. Do not discuss camera angle, "
        "visibility, waiting frames, no-pose frames, or data quality unless "
        "there are zero analyzed_frames. Do not diagnose injuries.\n\n"
        "Return detailed Markdown with these sections:\n"
        "1. Overall assessment - explain rep count, phase quality, and main pattern.\n"
        "2. Main form issues - explain why each issue was detected using phases, angles, or repeated feedback counts.\n"
        "3. Corrective cues - give practical short cues the user can apply immediately.\n"
        "4. What to change next set - give concrete changes for the next set.\n"
        "5. Notes from the analyzed frames - mention important phase/rep observations only from ok frames.\n\n"
        f"Session summary JSON:\n{json.dumps(summary_for_llm, ensure_ascii=False)}\n\n"
        "Phase segments JSON, analyzed frames only:\n"
        f"{json.dumps(phase_segments, ensure_ascii=False)}\n\n"
        f"Important analyzed frame samples JSON, capped at {POSTURE_LLM_MAX_LOG_FRAMES} frames:\n"
        f"{json.dumps(compact_log, ensure_ascii=False)}"
    )



def _summary_for_llm(
    summary: dict[str, Any],
    coaching_log: list[dict[str, Any]],
) -> dict[str, Any]:
    top_feedback = summary.get("top_feedback", {})
    return {
        "exercise": summary.get("exercise"),
        "analyzed_frames": len(coaching_log),
        "rep_count": summary.get("rep_count", 0),
        "phase_counts": summary.get("phase_counts", {}),
        "top_form_feedback": top_feedback,
        "angle_stats": summary.get("angle_stats", {}),
        "processing_ms": summary.get("processing_ms"),
        "note": (
            "This summary intentionally contains only frames that passed the "
            "subject-ready gate. Setup/walk-in/waiting/no-pose frames are "
            "excluded from coaching."
        ),
    }

def call_gemini_posture_coach(prompt: str) -> str:
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured.")

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.3,
            "topP": 0.9,
            "maxOutputTokens": 3000,
        },
    }
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Gemini request failed: HTTP {exc.code} {details}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Gemini request failed: {exc.reason}") from exc

    try:
        parts = result["candidates"][0]["content"]["parts"]
        return "\n".join(part.get("text", "") for part in parts).strip()
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError("Gemini response did not contain text output.") from exc



def _subject_ready_for_analysis(landmarks, exercise: str) -> tuple[bool, str]:
    """Reject setup/walk-in frames before phase detection.

    MediaPipe can hallucinate plausible arm landmarks on partial people or
    background objects. This gate requires a real subject anchor and enough
    body extent before any frame can update phase/rep state.
    """
    if not landmarks or len(landmarks) < 33:
        return False, "no subject detected"

    vis_threshold = float(os.getenv("MP_VIS_THRESHOLD", "0.5"))

    def visible(idx: int) -> bool:
        try:
            return getattr(landmarks[idx], "visibility", 0.0) >= vis_threshold
        except (IndexError, ValueError):
            return False

    pose = mediapipe_utils.mp_pose.PoseLandmark
    face_indices = [
        pose.NOSE.value,
        pose.LEFT_EYE.value,
        pose.RIGHT_EYE.value,
        pose.LEFT_EAR.value,
        pose.RIGHT_EAR.value,
    ]
    if sum(1 for idx in face_indices if visible(idx)) < 2:
        return False, "face is not visible yet"

    visible_points = [lm for lm in landmarks if getattr(lm, "visibility", 0.0) >= vis_threshold]
    if len(visible_points) < 8:
        return False, "not enough body keypoints are visible"

    xs = [float(lm.x) for lm in visible_points]
    ys = [float(lm.y) for lm in visible_points]
    bbox_width = max(xs) - min(xs)
    bbox_height = max(ys) - min(ys)
    bbox_area = bbox_width * bbox_height
    if bbox_width < SUBJECT_MIN_BBOX_WIDTH or bbox_height < SUBJECT_MIN_BBOX_HEIGHT:
        return False, "body is too small or only partly in frame"
    if bbox_area < SUBJECT_MIN_BBOX_AREA:
        return False, "body is too small in frame"

    if exercise == "bicep_curl":
        side_sets = [
            [pose.LEFT_SHOULDER.value, pose.LEFT_ELBOW.value, pose.LEFT_WRIST.value],
            [pose.RIGHT_SHOULDER.value, pose.RIGHT_ELBOW.value, pose.RIGHT_WRIST.value],
        ]
        if not any(all(visible(idx) for idx in side) for side in side_sets):
            return False, "working arm is not fully visible"

    return True, "subject ready"

def _decode_base64_frame(encoded: str):
    if "," in encoded:
        encoded = encoded.split(",", 1)[1]
    try:
        frame_arr = np.frombuffer(base64.b64decode(encoded), dtype=np.uint8)
        return cv2.imdecode(frame_arr, cv2.IMREAD_COLOR)
    except Exception:
        return None


def _maybe_add_preview_frame(
    preview_frames: list[dict[str, Any]],
    *,
    frame,
    pose_landmarks,
    entry: dict[str, Any],
    include_preview: bool,
    preview_max_frames: int,
    preview_stride: int,
    force: bool = False,
) -> None:
    if not include_preview or frame is None or len(preview_frames) >= preview_max_frames:
        return

    frame_index = int(entry.get("frame_index", 0))
    if not force and frame_index % preview_stride != 0:
        return

    skeleton_bytes = visualizer.draw_skeleton_bytes(
        frame,
        pose_landmarks=pose_landmarks,
        draw=pose_landmarks is not None,
    )
    height, width = frame.shape[:2]
    preview_frames.append(
        {
            "frame_index": frame_index,
            "timestamp_ms": entry.get("timestamp_ms"),
            "width": width,
            "height": height,
            "status": entry.get("status"),
            "phase": entry.get("phase"),
            "rep_count": entry.get("rep_count"),
            "feedback": entry.get("feedback"),
            "image": (
                "data:image/jpeg;base64,"
                + base64.b64encode(skeleton_bytes).decode("ascii")
            ),
        }
    )


def _sample_video_frames(
    video_path: str,
    *,
    sample_fps: float,
    max_frames: int,
) -> list[SessionFrame]:
    capture = cv2.VideoCapture(video_path)
    if not capture.isOpened():
        return []

    source_fps = capture.get(cv2.CAP_PROP_FPS) or 0
    frame_interval = 1
    if source_fps > 0:
        frame_interval = max(1, round(source_fps / sample_fps))

    frames: list[SessionFrame] = []
    frame_index = 0
    try:
        while len(frames) < max_frames:
            ok, frame = capture.read()
            if not ok:
                break

            if frame_index % frame_interval == 0:
                timestamp_ms = int(capture.get(cv2.CAP_PROP_POS_MSEC) or 0)
                encoded_ok, encoded_frame = cv2.imencode(
                    ".jpg",
                    frame,
                    [int(cv2.IMWRITE_JPEG_QUALITY), 85],
                )
                if encoded_ok:
                    frames.append(
                        SessionFrame(
                            frame=base64.b64encode(encoded_frame).decode("ascii"),
                            timestamp_ms=timestamp_ms,
                        )
                    )

            frame_index += 1
    finally:
        capture.release()

    return frames


def _round_angles(angles: dict[str, float]) -> dict[str, float]:
    return {name: round(float(value), 2) for name, value in angles.items()}


def _compact_log_for_llm(
    frame_log: list[dict[str, Any]],
    *,
    max_frames: int,
) -> list[dict[str, Any]]:
    """Keep frames that explain movement quality, not every idle sample.

    MediaPipe still processes the full session. This only reduces the prompt:
    transitions, bottom/contracted positions, visibility failures, and repeated
    issue frames are more useful to Gemini than long runs of standing frames.
    """
    if max_frames <= 0:
        return []

    idle_phases = {"STANDING", "EXTENDED"}
    priority_indices: set[int] = set()
    non_idle_indices: list[int] = []
    idle_indices: list[int] = []

    previous_phase = None
    previous_rep = None
    for idx, entry in enumerate(frame_log):
        status = entry.get("status")
        phase = entry.get("phase")
        rep = entry.get("rep_count")
        feedback = entry.get("feedback") or []

        if status != "ok":
            priority_indices.add(idx)
            continue

        if phase != previous_phase or rep != previous_rep:
            priority_indices.add(idx)

        if _has_problem_feedback(feedback):
            priority_indices.add(idx)

        if phase in idle_phases:
            idle_indices.append(idx)
        else:
            non_idle_indices.append(idx)

        previous_phase = phase
        previous_rep = rep

    selected = set(_evenly_sample(sorted(priority_indices), max_frames // 2))
    remaining = max_frames - len(selected)
    if remaining > 0:
        selected.update(_evenly_sample(non_idle_indices, remaining))

    remaining = max_frames - len(selected)
    if remaining > 0:
        # Keep only a few idle frames so Gemini knows the start/end posture,
        # without spending the prompt on repeated standing samples.
        idle_budget = min(remaining, max(2, max_frames // 10))
        selected.update(_evenly_sample(idle_indices, idle_budget))

    return [_frame_log_entry_for_prompt(frame_log[idx]) for idx in sorted(selected)]


def _build_phase_segments(frame_log: list[dict[str, Any]]) -> list[dict[str, Any]]:
    segments: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None

    for entry in frame_log:
        key = (entry.get("status"), entry.get("phase"), entry.get("rep_count"))
        if current is None or current["_key"] != key:
            if current is not None:
                current.pop("_key", None)
                segments.append(current)
            current = {
                "_key": key,
                "status": entry.get("status"),
                "phase": entry.get("phase"),
                "rep": entry.get("rep_count"),
                "start_frame": entry.get("frame_index"),
                "end_frame": entry.get("frame_index"),
                "start_ms": entry.get("timestamp_ms"),
                "end_ms": entry.get("timestamp_ms"),
                "frame_count": 1,
                "feedback_counts": Counter(entry.get("feedback") or []),
            }
        else:
            current["end_frame"] = entry.get("frame_index")
            current["end_ms"] = entry.get("timestamp_ms")
            current["frame_count"] += 1
            current["feedback_counts"].update(entry.get("feedback") or [])

    if current is not None:
        current.pop("_key", None)
        segments.append(current)

    for segment in segments:
        segment["feedback_counts"] = dict(segment["feedback_counts"].most_common(5))
    return segments


def _evenly_sample(indices: list[int], limit: int) -> list[int]:
    if limit <= 0 or not indices:
        return []
    if len(indices) <= limit:
        return indices
    if limit == 1:
        return [indices[len(indices) // 2]]
    step = (len(indices) - 1) / float(limit - 1)
    return [indices[round(i * step)] for i in range(limit)]


def _has_problem_feedback(feedback: list[str]) -> bool:
    positive_words = ("good", "great", "nice", "excellent", "strong")
    for item in feedback:
        lower = item.lower()
        if not any(word in lower for word in positive_words):
            return True
    return False


def _frame_log_entry_for_prompt(entry: dict[str, Any]) -> dict[str, Any]:
    return {
        "i": entry["frame_index"],
        "t": entry.get("timestamp_ms"),
        "status": entry.get("status"),
        "phase": entry.get("phase"),
        "rep": entry.get("rep_count"),
        "angles": entry.get("angles"),
        "feedback": entry.get("feedback"),
    }


def _build_session_summary(
    *,
    exercise: str,
    frame_count: int,
    frame_log: list[dict[str, Any]],
    issue_counts: Counter[str],
    phase_counts: Counter[str],
    visibility_failures: Counter[str],
    angle_values: dict[str, list[float]],
    rep_count: int,
    elapsed_ms: int,
) -> dict[str, Any]:
    ok_frames = sum(1 for entry in frame_log if entry.get("status") == "ok")
    no_pose_frames = sum(1 for entry in frame_log if entry.get("status") == "no_pose")
    visibility_failed_frames = sum(
        1 for entry in frame_log if entry.get("status") == "visibility_failed"
    )
    waiting_for_subject_frames = sum(
        1 for entry in frame_log if entry.get("status") == "waiting_for_subject"
    )
    decode_errors = sum(1 for entry in frame_log if entry.get("status") == "decode_error")

    angle_stats = {}
    for name, values in angle_values.items():
        if not values:
            continue
        angle_stats[name] = {
            "min": round(min(values), 2),
            "max": round(max(values), 2),
            "avg": round(sum(values) / len(values), 2),
        }

    return {
        "exercise": exercise,
        "frames_received": frame_count,
        "frames_analyzed": ok_frames,
        "analysis_quality": _build_analysis_quality(frame_log),
        "no_pose_frames": no_pose_frames,
        "visibility_failed_frames": visibility_failed_frames,
        "waiting_for_subject_frames": waiting_for_subject_frames,
        "decode_errors": decode_errors,
        "rep_count": rep_count,
        "phase_counts": dict(phase_counts),
        "top_feedback": dict(issue_counts.most_common(8)),
        "visibility_failures": dict(visibility_failures.most_common()),
        "angle_stats": angle_stats,
        "processing_ms": elapsed_ms,
        "llm_log_frame_limit": POSTURE_LLM_MAX_LOG_FRAMES,
    }


def _build_analysis_quality(frame_log: list[dict[str, Any]]) -> dict[str, Any]:
    ok_indices = [
        entry["frame_index"]
        for entry in frame_log
        if entry.get("status") == "ok"
    ]
    if not ok_indices:
        return {
            "usable_frames": 0,
            "active_window_frames": 0,
            "active_window_usable_ratio": 0.0,
            "note": "No usable pose frames were detected.",
        }

    first_ok = min(ok_indices)
    last_ok = max(ok_indices)
    active_window = [
        entry
        for entry in frame_log
        if first_ok <= entry.get("frame_index", -1) <= last_ok
    ]
    active_window_frames = len(active_window)
    active_ok_frames = sum(1 for entry in active_window if entry.get("status") == "ok")
    active_ratio = active_ok_frames / active_window_frames if active_window_frames else 0.0

    return {
        "usable_frames": len(ok_indices),
        "first_usable_frame": first_ok,
        "last_usable_frame": last_ok,
        "active_window_frames": active_window_frames,
        "active_window_usable_ratio": round(active_ratio, 3),
        "setup_frames_before_subject_visible": first_ok,
        "frames_after_last_usable_pose": max(0, len(frame_log) - last_ok - 1),
        "note": (
            "Use active_window_usable_ratio to judge camera reliability. "
            "Frames before first_usable_frame are often setup/walk-in frames and "
            "should not be treated as form-analysis failure."
        ),
    }


def _local_recommendations(summary: dict[str, Any]) -> str:
    top_feedback = list(summary.get("top_feedback", {}).keys())
    if not top_feedback:
        return "No reliable posture issues were detected in the submitted frames."

    cues = "\n".join(f"- {item}" for item in top_feedback[:5])
    return (
        "Gemini was not used, so this is a rule-based summary.\n\n"
        f"Detected reps: {summary.get('rep_count', 0)}\n\n"
        "Most repeated coaching cues:\n"
        f"{cues}"
    )
