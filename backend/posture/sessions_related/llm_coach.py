from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from collections import Counter
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

from posture.sessions_related.feedback_classifier import problem_feedback


load_dotenv(Path(__file__).resolve().parents[1] / ".env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")
GEMINI_MAX_OUTPUT_TOKENS = int(os.getenv("GEMINI_MAX_OUTPUT_TOKENS", "3000"))
POSTURE_LLM_MAX_LOG_FRAMES = int(os.getenv("POSTURE_LLM_MAX_LOG_FRAMES", "120"))


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


def call_gemini_posture_coach(prompt: str) -> dict[str, Any]:
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
            "maxOutputTokens": GEMINI_MAX_OUTPUT_TOKENS,
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
        candidate = result["candidates"][0]
        parts = candidate["content"]["parts"]
        recommendations = "\n".join(part.get("text", "") for part in parts).strip()
        return {
            "recommendations": recommendations,
            "finish_reason": candidate.get("finishReason"),
            "usage_metadata": result.get("usageMetadata"),
        }
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError("Gemini response did not contain text output.") from exc


def _summary_for_llm(
    summary: dict[str, Any],
    coaching_log: list[dict[str, Any]],
) -> dict[str, Any]:
    top_feedback = summary.get("top_feedback", {})
    return {
        "exercise": summary.get("exercise"),
        "camera_view": summary.get("camera_view", "side"),
        "pose_backend": summary.get("pose_backend", "mediapipe"),
        "analyzed_frames": len(coaching_log),
        "rep_count": summary.get("rep_count", 0),
        "rep_breakdown": summary.get("rep_breakdown", []),
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


def _compact_log_for_llm(
    frame_log: list[dict[str, Any]],
    *,
    max_frames: int,
) -> list[dict[str, Any]]:
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

        if problem_feedback(feedback):
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


def _frame_log_entry_for_prompt(entry: dict[str, Any]) -> dict[str, Any]:
    return {
        "i": entry["frame_index"],
        "t": entry.get("timestamp_ms"),
        "status": entry.get("status"),
        "camera_view": entry.get("camera_view"),
        "phase": entry.get("phase"),
        "rep": entry.get("rep_count"),
        "angles": entry.get("angles"),
        "feedback": entry.get("feedback"),
    }
