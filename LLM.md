# LLM.md - Gym Posture Correction System

Technical notes for the current session-analysis implementation.

The old Vite frontend has been removed. The active frontend is the Next.js app in `frontend/`.

## 1. Current Product Flow

The frontend is now focused on after-session video analysis instead of live webcam feedback.

```text
Browser
  -> register/login and store JWT
  -> select exercise: squat | bicep_curl
  -> upload video
  -> POST /posture/analyze-video multipart/form-data with Bearer token

Backend
  -> create workout_sessions row with status=processing
  -> sample video frames with OpenCV
  -> run selected pose backend (MediaPipe by default, optional ViTPose)
  -> apply subject-ready gate
  -> apply exercise visibility gate
  -> compute angles
  -> update phase detector and rep count
  -> generate rule feedback
  -> optionally send analyzed-frame log to Gemini
  -> persist summary/statistics to PostgreSQL
  -> mark workout_sessions row completed or failed
  -> return summary + rule/LLM coaching + distinct mistake frames
```

The old WebSocket path still exists in backend code, but the active `frontend/` Dashboard no longer uses live realtime posture detection.

## 2. Main Endpoints

### `POST /posture/analyze-video`

Authenticated multipart upload endpoint for normal video files. It requires:

```http
Authorization: Bearer <access_token>
```

Form fields:

```text
exercise=squat | bicep_curl
camera_view=side | front | three_quarter
pose_backend=mediapipe | vitpose
file=@video.mp4
call_llm=true | false
sample_fps=8
max_frames=360
include_preview=true | false
preview_max_frames=24
```

The active frontend hides `max_frames`, `include_preview`, and
`preview_max_frames`; it sends internal defaults for short clips around 20
seconds.

Example:

```bash
curl -X POST http://127.0.0.1:5000/posture/analyze-video \
  -H "Authorization: Bearer $TOKEN" \
  -F "exercise=bicep_curl" \
  -F "camera_view=side" \
  -F "pose_backend=mediapipe" \
  -F "file=@/path/to/curl.mp4" \
  -F "call_llm=false" \
  -F "sample_fps=8" \
  -F "max_frames=360" \
  -F "include_preview=true" \
  -F "preview_max_frames=24"
```

Response includes:

```json
{
  "session_id": 42,
  "analysis_id": 42,
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
    "enabled": false,
    "model": "gemini-3-flash-preview",
    "recommendations": "Gemini was not used, so this is a rule-based summary...",
    "error": null
  },
  "frame_log": [],
  "preview_frames": []
}
```

Persistence behavior:

- `workout_sessions` stores request/session metadata and status.
- `analysis_results` stores summary/statistics, top feedback, angle stats, quality, and LLM metadata.
- `usage_events` stores register/login/analysis lifecycle events.
- The database does not store uploaded videos, base64 preview images, or full frame logs in v1.

### User History and Analytics

All endpoints below require `Authorization: Bearer <access_token>`.

```http
GET /me
GET /workouts
GET /workouts/{session_id}
GET /analytics/summary
```

`/analytics/summary` returns:

```json
{
  "total_sessions": 4,
  "total_reps": 38,
  "sessions_by_exercise": { "squat": 3, "bicep_curl": 1 },
  "reps_by_exercise": { "squat": 30, "bicep_curl": 8 },
  "avg_quality_ratio": 0.86,
  "avg_processing_ms": 7420,
  "top_feedback": {},
  "llm_enabled_count": 1,
  "recent_sessions": []
}
```

### `POST /posture/analyze-session`

JSON endpoint for clients that already captured frame images.

```json
{
  "exercise": "squat",
  "pose_backend": "mediapipe",
  "call_llm": false,
  "frames": [
    { "frame": "<base64-jpeg>", "timestamp_ms": 0 },
    { "frame": "<base64-jpeg>", "timestamp_ms": 100 }
  ]
}
```

## 3. Pose Estimation

The backend now has a small pose-backend switch:

```env
POSE_BACKEND=mediapipe | vitpose
```

`mediapipe` remains the default and is the stable path. `vitpose` is an optional offline-quality experiment for uploaded videos.

### MediaPipe backend

- Default model complexity is `0` (Lite) for CPU speed.
- Use `MP_MODEL_COMPLEXITY=2` to try Heavy if CPU latency is acceptable.
- MediaPipe Python on Linux does not use CUDA through the normal pip package.
- MediaPipe returns 33 landmarks, including extra hand/foot/face points used by some current rules.

Config:

```env
POSE_BACKEND=mediapipe
MP_MODEL_COMPLEXITY=0
MP_MIN_DET_CONF=0.5
MP_MIN_TRACK_CONF=0.5
MP_EMA_ALPHA=0.4
MP_VIS_THRESHOLD=0.5
```

### ViTPose backend

`backend/posture/vitpose_utils.py` adds an optional `VitPoseProcessor` using Hugging Face `VitPoseForPoseEstimation`.

Current behavior:

- The ViTPose backend predicts COCO-17 body keypoints.
- Those 17 keypoints are mapped into the existing MediaPipe-style 33-landmark slots so the current gates, angle extraction, phase detector, skeleton preview, and feedback rules can be reused.
- Missing MediaPipe-only landmarks are marked invisible.
- The prototype uses the whole frame as the single-person box. This is fine for controlled single-person videos, but a detector/crop stage should be added for loose framing or multiple people.
- ViTPose has no MediaPipe-style `z` depth. Any rule using `z` should be treated as less informative under ViTPose.

Install optional dependencies:

```bash
cd backend
../p1_env/bin/pip install -r requirements-vitpose.txt
```

Run backend with ViTPose:

```bash
cd backend
POSE_BACKEND=vitpose VITPOSE_DEVICE=auto \
  ../p1_env/bin/uvicorn main:app --host 0.0.0.0 --port 5000 --reload
```

Then use the same `/posture/analyze-video` endpoint as normal. The frontend can also send `pose_backend=vitpose` per request. Responses include:

```json
{
  "pose_backend": "vitpose",
  "summary": {
    "pose_backend": "vitpose"
  }
}
```

Config:

```env
POSE_BACKEND=vitpose
VITPOSE_MODEL=usyd-community/vitpose-base-simple
VITPOSE_DEVICE=auto
VITPOSE_KEYPOINT_THRESHOLD=0.25
VITPOSE_POSE_THRESHOLD=0.25
VITPOSE_EMA_ALPHA=0.35
```

Recommended comparison workflow:

```bash
# Baseline request
-F "pose_backend=mediapipe"

# Quality experiment request
-F "pose_backend=vitpose"
```

Upload the same video with the same `sample_fps`, `camera_view`, and internal frame limits, then compare `pose_backend`, `frames_analyzed`, `phase_counts`, `rep_count`, `top_feedback`, `angle_stats`, and mistake-frame quality.

## 4. Subject-Ready Gate

Pose backends can hallucinate body landmarks when the user is not fully in frame. To prevent false `ok` frames and fake phases, session analysis gates frames before phase detection.

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
- `torso_lean` when at least one shoulder/hip side is visible
- `elbow_flare_angle`, `wrist_angle`, and `shoulder_elevation_ratio` when the needed side keypoints are visible

Elbow drift combines image-space shoulder/elbow offset and any available `z` offset, normalized by visible torso length when possible and upper-arm length as a fallback. Under MediaPipe, `z` is approximate; under ViTPose, `z` is currently `0.0`, so elbow drift is mainly image-space.
Torso lean is the image-space angle between the shoulder-to-hip segment and vertical. It helps catch cheat curls where the user leans through the back for momentum while the arm keypoints are still visible.
Supination is intentionally not detected because the current pose backends do not expose reliable forearm rotation/hand orientation for this use case.

Config:

```env
POSTURE_CURL_ELBOW_DRIFT_THRESH=0.40
POSTURE_CURL_TORSO_LEAN_THRESH=14.0
POSTURE_CURL_TOP_ROM_THRESH=80.0
POSTURE_CURL_BOTTOM_ROM_THRESH=150.0
POSTURE_CURL_WRIST_FLEXION_THRESH=150.0
POSTURE_CURL_ELBOW_FLARE_THRESH=32.0
POSTURE_CURL_SHOULDER_ELEVATION_THRESH=0.38
```

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

## 8. Key Correction Frames

`/posture/analyze-video` can return mistake frames with skeleton overlays. The
selector prioritizes spaced-apart frames that introduce different problem
feedback. It is intended to show distinct correction moments, not every repeated
bad frame.

Frontend options:

```text
Mistake frames: enabled internally
Mistake frame cap: default 12
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
  "preview_reason": "new_issue",
  "image": "data:image/jpeg;base64,..."
}
```

The frontend displays mistake-frame images with `object-contain`, so vertical videos are not cropped.

## 9. LLM Coaching

Gemini is called only after the session has been processed, and only when `call_llm=true`.

Current dev defaults:

- `PostureSessionRequest.call_llm = false`
- `/posture/analyze-video` form default `call_llm = false`
- frontend dashboard checkbox `Gemini coaching` starts unchecked

This avoids spending Gemini quota during normal dev uploads. Turn the checkbox on only when intentionally testing LLM coaching.

Important behavior:

- The LLM receives only `status == "ok"` analyzed frames.
- Setup/walk-in/no-pose/waiting frames are excluded from the coaching prompt.
- This prevents the model from calling a session fragmented just because the user walked into frame.
- UI/debug still shows `waiting_for_subject_frames` separately.
- If Gemini quota is exceeded or the API request fails, the backend now fails clearly when `call_llm=true`; it does not silently fallback.

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
GEMINI_MAX_OUTPUT_TOKENS=1024
POSTURE_LLM_MAX_LOG_FRAMES=60
```

`GEMINI_MAX_OUTPUT_TOKENS` controls Gemini `generationConfig.maxOutputTokens`. `POSTURE_LLM_MAX_LOG_FRAMES` controls how many important analyzed frame samples are included in the prompt.

## 10. Frontend State

The active frontend is `frontend/`, a Next.js app. The Dashboard has been simplified to session analysis only.

Kept:

- exercise selector
- upload video panel
- sample FPS / max frames controls
- Gemini toggle
- automatic mistake-frame selection
- result metrics: reps, analyzed frames, quality, processing time
- angle chart from analyzed frame log
- mistake frames returned by backend
- per-mistake-frame feedback
- form-issue summary and all-feedback summary
- rule-based or Gemini coaching

Removed from Dashboard:

- live camera feed
- live WebSocket connection status
- Start/Stop realtime session buttons
- live realtime feedback panel

Dev commands:

```bash
cd backend
../p1_env/bin/uvicorn main:app --host 0.0.0.0 --port 5000 --reload

cd frontend
npm run dev
```

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
| Pose backend hallucination on partial subjects | False phases before user is ready | Subject-ready gate + ready-frame streak |
| Camera angle sensitivity | Valgus/drift can be noisy | Mistake frames + visibility gate |
| Depth is backend-dependent | Elbow drift is approximate; ViTPose currently has no `z` depth | Treat as coaching cue, not precise measurement |
| Universal phase thresholds | Some bodies/reps may misclassify | Future calibration |
| Backend performance varies | MediaPipe is light; ViTPose is heavier but can use PyTorch/CUDA | Use `POSE_BACKEND` per experiment |
