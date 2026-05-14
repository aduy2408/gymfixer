# LLM.md - Gym Posture Correction System

Technical notes for the current session-analysis implementation.

## 1. Current Product Flow

The frontend is now focused on after-session video analysis instead of live webcam feedback.

```text
Browser
  -> select exercise: squat | bicep_curl
  -> upload video
  -> POST /posture/analyze-video multipart/form-data

Backend
  -> sample video frames with OpenCV
  -> run MediaPipe Pose
  -> apply subject-ready gate
  -> apply exercise visibility gate
  -> compute angles
  -> update phase detector and rep count
  -> generate rule feedback
  -> send analyzed-frame log to Gemini
  -> return summary + LLM coaching + skeleton preview frames
```

The old WebSocket path still exists in backend code, but the active frontend Dashboard no longer uses live realtime posture detection.

## 2. Main Endpoints

### `POST /posture/analyze-video`

Multipart upload endpoint for normal video files.

Form fields:

```text
exercise=squat | bicep_curl
file=@video.mp4
call_llm=true | false
sample_fps=8
max_frames=360
include_preview=true | false
preview_max_frames=24
```

Example:

```bash
curl -X POST http://127.0.0.1:5000/posture/analyze-video \
  -F "exercise=bicep_curl" \
  -F "file=@/path/to/curl.mp4" \
  -F "call_llm=true" \
  -F "sample_fps=8" \
  -F "max_frames=360" \
  -F "include_preview=true" \
  -F "preview_max_frames=24"
```

Response includes:

```json
{
  "exercise": "bicep_curl",
  "summary": {
    "frames_received": 341,
    "frames_analyzed": 59,
    "waiting_for_subject_frames": 36,
    "rep_count": 1,
    "phase_counts": {},
    "top_feedback": {},
    "angle_stats": {},
    "processing_ms": 8000
  },
  "llm": {
    "enabled": true,
    "model": "gemini-3-flash-preview",
    "recommendations": "...",
    "error": null
  },
  "frame_log": [],
  "preview_frames": []
}
```

### `POST /posture/analyze-session`

JSON endpoint for clients that already captured frame images.

```json
{
  "exercise": "squat",
  "call_llm": true,
  "frames": [
    { "frame": "<base64-jpeg>", "timestamp_ms": 0 },
    { "frame": "<base64-jpeg>", "timestamp_ms": 100 }
  ]
}
```

## 3. Pose Estimation

MediaPipe Pose is the current pose backend.

- Default model complexity is `0` (Lite) for CPU speed.
- Use `MP_MODEL_COMPLEXITY=2` to try Heavy if CPU latency is acceptable.
- MediaPipe Python on Linux does not use CUDA through the normal pip package.
- YOLO pose is a future backend candidate, mainly because it can provide person bbox/confidence and CUDA acceleration via PyTorch.

Relevant config:

```env
MP_MODEL_COMPLEXITY=0
MP_MIN_DET_CONF=0.5
MP_MIN_TRACK_CONF=0.5
MP_EMA_ALPHA=0.4
MP_VIS_THRESHOLD=0.5
```

## 4. Subject-Ready Gate

MediaPipe can hallucinate body landmarks when the user is not fully in frame. To prevent false `ok` frames and fake phases, session analysis now gates frames before phase detection.

A frame must pass:

- enough face anchor visibility (`NOSE`/eyes/ears)
- enough visible body keypoints
- body bbox large enough in normalized image coordinates
- exercise-specific working-limb visibility
- `POSTURE_SUBJECT_READY_MIN_FRAMES` consecutive ready frames

Frames that fail this gate are logged as:

```text
waiting_for_subject
```

They do not update phase, rep count, angle stats, or LLM coaching.

Config:

```env
POSTURE_SUBJECT_READY_MIN_FRAMES=3
POSTURE_SUBJECT_MIN_BBOX_AREA=0.035
POSTURE_SUBJECT_MIN_BBOX_WIDTH=0.12
POSTURE_SUBJECT_MIN_BBOX_HEIGHT=0.20
```

If early walk-in frames still leak into analysis, increase `POSTURE_SUBJECT_READY_MIN_FRAMES` or bbox thresholds. If valid frames are rejected too aggressively, lower them.

## 5. Visibility Gate

After the subject-ready gate, exercise-specific visibility is checked.

| Exercise | Required visibility |
|---|---|
| squat | hips, knees, ankles |
| bicep_curl | at least one complete arm side: shoulder, elbow, wrist |

Bicep curls support one-arm videos. If both arms are visible, both are used. If only one arm is visible, analysis uses that arm.

## 6. Angle Extraction

### Squat

Computed values include:

- `left_knee`, `right_knee`
- `left_hip`, `right_hip`
- `knee_valgus_ratio`

Valgus is image-space only and is most meaningful with a front-facing camera.

### Bicep Curl

Computed values include:

- `left_elbow`, `right_elbow` when visible
- `left_elbow_drift`, `right_elbow_drift` when visible

Elbow drift currently uses MediaPipe `z` as an approximate depth signal, normalized by shoulder width. This is useful but not physically exact.

## 7. Phase Detection

Phase detection uses median angle buffers to reduce frame jitter.

### Squat phases

```text
STANDING -> DESCENDING -> BOTTOM -> ASCENDING -> STANDING
```

Rep count increments when the user returns from `ASCENDING` to `STANDING`.

### Bicep curl phases

```text
EXTENDED -> CURLING -> CONTRACTED -> LOWERING -> EXTENDED
```

Rep count increments when the user returns from `LOWERING` to `EXTENDED`.

Mid-range direction is inferred from angle deltas:

- elbow angle decreasing means `CURLING`
- elbow angle increasing means `LOWERING`
- knee angle decreasing means `DESCENDING`
- knee angle increasing means `ASCENDING`

This avoids sticking in `LOWERING` or `ASCENDING` solely because of the previous phase.

## 8. Skeleton Preview

`/posture/analyze-video` can return preview frames with skeleton overlays.

Frontend options:

```text
Skeleton preview: on/off
Preview frames: default 24
```

Each preview item includes:

```json
{
  "frame_index": 207,
  "timestamp_ms": 12345,
  "width": 576,
  "height": 1024,
  "status": "ok",
  "phase": "LOWERING",
  "rep_count": 1,
  "feedback": ["..."],
  "image": "data:image/jpeg;base64,..."
}
```

The frontend displays preview images with `object-contain`, so vertical videos are not cropped.

## 9. LLM Coaching

Gemini is called only after the session has been processed.

Important behavior:

- The LLM receives only `status == "ok"` analyzed frames.
- Setup/walk-in/no-pose/waiting frames are excluded from the coaching prompt.
- This prevents the model from calling a session fragmented just because the user walked into frame.
- UI/debug still shows `waiting_for_subject_frames` separately.

Prompt sections requested from Gemini:

1. Overall assessment
2. Main form issues
3. Corrective cues
4. What to change next set
5. Notes from the analyzed frames

Config:

```env
GEMINI_API_KEY=your-key
GEMINI_MODEL=gemini-3-flash-preview
POSTURE_LLM_MAX_LOG_FRAMES=300
```

The Gemini request currently sets `maxOutputTokens` in `backend/posture/session_analysis.py`.

## 10. Frontend State

The Dashboard has been simplified to session analysis only.

Kept:

- exercise selector
- upload video panel
- sample FPS / max frames controls
- Gemini toggle
- skeleton preview toggle
- result metrics: reps, usable frames, waiting frames, total frames, processing time
- top feedback and LLM coaching

Removed from Dashboard:

- live camera feed
- live WebSocket connection status
- Start/Stop realtime session buttons
- live realtime feedback panel

## 11. Future Improvements

### YOLO Pose Backend

Add a pluggable backend instead of duplicating the whole session-analysis pipeline:

```text
backend/posture/pose_backends/
  base.py
  mediapipe_backend.py
  yolo_backend.py
```

The common session pipeline should stay shared:

```text
pose backend -> normalized landmarks/person box -> gates -> angles -> phase -> feedback -> LLM
```

YOLO pose advantages:

- CUDA support through PyTorch
- person bbox and confidence
- better rejection of background/partial-person frames

Tradeoffs:

- YOLOv8 pose uses 17 COCO keypoints, while MediaPipe has 33
- no MediaPipe-style `z` depth estimate
- heavier dependency stack (`torch`, `ultralytics`, CUDA setup)

### Rep Tempo

Use timestamps of phase transitions to compute eccentric/concentric duration.

### Calibration

Use first few valid reps to tune thresholds per user and camera setup.

## 12. Known Limitations

| Limitation | Impact | Current mitigation |
|---|---|---|
| MediaPipe hallucination on partial subjects | False phases before user is ready | Subject-ready gate + ready-frame streak |
| Camera angle sensitivity | Valgus/drift can be noisy | Skeleton preview + visibility gate |
| MediaPipe `z` is estimated | Elbow drift is approximate | Treat as coaching cue, not precise measurement |
| Universal phase thresholds | Some bodies/reps may misclassify | Future calibration |
| CPU-only MediaPipe on Linux | Heavy model is slower | Lite default, optional Heavy |
