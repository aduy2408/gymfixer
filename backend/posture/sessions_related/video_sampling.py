from __future__ import annotations

import base64

import cv2
import numpy as np

from posture.sessions_related.session_models import SessionFrame


def decode_base64_frame(encoded: str):
    if "," in encoded:
        encoded = encoded.split(",", 1)[1]
    try:
        frame_arr = np.frombuffer(base64.b64decode(encoded), dtype=np.uint8)
        return cv2.imdecode(frame_arr, cv2.IMREAD_COLOR)
    except Exception:
        return None


def sample_video_frames(
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
