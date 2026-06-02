from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel, Field


load_dotenv(Path(__file__).resolve().parents[1] / ".env")


def normalise_camera_view(camera_view: str | None) -> str:
    value = (camera_view or "side").strip().lower().replace("-", "_")
    aliases = {
        "45": "three_quarter",
        "45_degree": "three_quarter",
        "three_quarter": "three_quarter",
        "quarter": "three_quarter",
        "front": "front",
        "side": "side",
        "auto": "auto",
        "detect": "auto",
        "detected": "auto",
    }
    return aliases.get(value, "side")


def normalise_pose_backend(pose_backend: str | None) -> str:
    value = (pose_backend or os.getenv("POSE_BACKEND", "mediapipe")).strip().lower()
    aliases = {
        "mp": "mediapipe",
        "mediapipe": "mediapipe",
        "vit": "vitpose",
        "vitpose": "vitpose",
    }
    if value not in aliases:
        supported = ", ".join(sorted(set(aliases.values())))
        raise ValueError(f"Unsupported pose_backend '{pose_backend}'. Supported: {supported}")
    return aliases[value]


class SessionFrame(BaseModel):
    frame: str = Field(..., description="Base64-encoded JPEG/PNG frame.")
    timestamp_ms: int | None = Field(
        default=None,
        description="Optional client timestamp for this frame.",
    )


class PostureSessionRequest(BaseModel):
    exercise: str
    camera_view: str = Field(
        default="auto",
        description="Camera angle for view-dependent rules: auto, side, front, or three_quarter.",
    )
    pose_backend: str | None = Field(
        default=None,
        description="Optional pose backend override: mediapipe or vitpose.",
    )
    frames: list[SessionFrame] = Field(..., min_length=1)
    call_llm: bool = Field(
        default=False,
        description="When true, send the processed posture log to Gemini.",
    )
