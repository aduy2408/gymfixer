# LLM.md — Gym Posture Correction System: Findings & Architecture

> Summary of technical findings, design decisions, and improvement directions
> for the **An Automated System for Gym Exercise Posture Correction Using Computer Vision** project.

---

## 1. System Architecture

### Overall Design: Server-Side Processing, Client-Side Camera

```
┌─────────────────────────────────────┐        ┌─────────────────────────────────────────┐
│           CLIENT (Browser)          │        │         SERVER (Host Machine)            │
│                                     │        │                                         │
│  Webcam → capture frame (JPEG)      │──────▶│  WebSocket /ws/posture                  │
│                                     │  WS   │  ├── MediaPipe Heavy (model_complexity=2)│
│  Receive JSON response:             │◀──────│  ├── EMA Landmark Smoother              │
│  {                                  │       │  ├── Visibility Gate                    │
│    feedback: [...],                 │       │  ├── Angle Extractor                    │
│    phase: "BOTTOM",                 │       │  ├── Phase Detector (state machine)      │
│    rep_count: 5,                    │       │  └── Feedback Generator (phase-aware)   │
│    visibility_ok: true,             │       │                                         │
│    skeleton_frame: "<b64-jpeg>"     │       │  All compute runs here.                 │
│  }                                  │       │  Camera never touches the server.       │
└─────────────────────────────────────┘        └─────────────────────────────────────────┘
```

**Why server-side?**
- Pose estimation models are heavy (MediaPipe Heavy ~30MB, runs on server CPU/GPU)
- Client devices (phones, laptops) have variable compute — offloading to server = consistent latency
- Server can scale (GPU, multi-worker) without requiring the user to have capable hardware
- Privacy note: raw frames travel over WebSocket; use WSS (TLS) in production

**Frame transport:**
- **Binary mode** (preferred): client sends raw JPEG bytes → lower CPU overhead (~30% less than base64)
- **Base64 mode** (legacy fallback): client sends `{"frame": "<base64>", "exercise": "squat"}`

---

## 2. Pose Estimation: MediaPipe Heavy

### Why MediaPipe over YOLOv8?

| Aspect | MediaPipe Lite (old) | MediaPipe Heavy (current) | YOLOv8n-pose |
|--------|----------------------|--------------------------|--------------|
| Model complexity | 0 | 2 | — |
| Keypoints | 33 | 33 | 17 (COCO) |
| Accuracy (partial occlusion) | Low | High | Medium-High |
| Inference speed (CPU) | ~15ms | ~50ms | ~35ms |
| GPU (Linux) | CPU only | CPU only | CUDA via PyTorch |
| Install size | ~100MB | ~100MB | ~200MB + PyTorch |
| Named landmarks | ✅ | ✅ | ❌ (remap needed) |

**Decision:** MediaPipe **Lite** (`model_complexity=0`) is used as the default — not because of accuracy, but because MediaPipe Python on Linux has **no CUDA support** (GPU accel is OpenGL ES / Metal, unavailable via pip on Linux). Heavy model would run at ~50ms/frame (CPU-only), capping throughput at ~18 FPS. Lite runs at ~15ms/frame, allowing a comfortable **30 FPS** target — better for smooth phase detection and rep counting.

Jitter from the Lite model is compensated by the EMA smoother (`α=0.4`) and the median-filter angle buffer inside the phase detector.

To use a heavier model on a GPU-capable host (e.g., with MediaPipe built from source), set `MP_MODEL_COMPLEXITY=2` in `.env`.

---

## 3. EMA Landmark Smoothing

**Problem:** Raw MediaPipe output jitters frame-to-frame (±3–5° in angles) causing noisy feedback.

**Solution:** Exponential Moving Average (EMA) applied to each landmark's (x, y, z):
```
smoothed[t] = α × raw[t] + (1 − α) × smoothed[t−1]
```
- `α = 0.4` (configurable via `MP_EMA_ALPHA` env var)
- MediaPipe's own `smooth_landmarks=True` is also enabled (complementary)
- Additionally, a **median filter** (window=4) on the computed angle values inside the phase detector suppresses outlier spikes before state transitions

**Effect:** Angle jitter reduced from ~5° to ~1–2°, preventing spurious phase transitions.

---

## 4. Visibility Gating

**Problem:** Feedback was generated even when critical joints were occluded (e.g., camera angle cutting off ankles), leading to incorrect angle calculations.

**Solution:** Before computing angles, check visibility scores of *critical keypoints per exercise*:

| Exercise | Critical Keypoints |
|----------|--------------------|
| squat | hips, knees, ankles |
| bicep_curl | shoulders, elbows, wrists |

If any critical keypoint has `visibility < 0.5`, return a targeted warning instead of feedback:
> `"Move into frame — can't see: left ankle, right ankle."`

---

## 5. Phase Detection State Machines

### Why phase detection?

Static threshold checks fire on every frame regardless of context:
- "Bend your knees more" fires when the user is standing between reps
- No rep counting possible without knowing movement direction

### Squat State Machine

```
            avg_knee > 150°            avg_knee > 150°
               ┌──────────────────────────────────────┐
               │                              rep++    │
        STANDING → DESCENDING → BOTTOM → ASCENDING → STANDING
                  knee↓≤110°   knee↑≥110°
```

Angle buffers: **median of last 4 frames** before transition check.

| Phase | Feedback focus |
|-------|---------------|
| DESCENDING | Back angle, knee valgus |
| BOTTOM | Depth check, knee valgus, spine neutral |
| ASCENDING | Valgus, chest up |
| STANDING | Rep celebration, brace cue |

### Bicep Curl State Machine

```
             avg_elbow > 150°              avg_elbow > 150°
               ┌────────────────────────────────────────────┐
               │                                   rep++    │
        EXTENDED → CURLING → CONTRACTED → LOWERING → EXTENDED
                  elbow↓≤60°  elbow↑≥60°
```

| Phase | Feedback focus |
|-------|---------------|
| CURLING | Elbow drift (swinging) |
| CONTRACTED | Full contraction squeeze |
| LOWERING | Eccentric control, no drift |
| EXTENDED | Full extension check |

**Elbow drift detection:** computed as `|elbow.z − shoulder.z| / shoulder_width`. Positive drift = upper arm swinging forward for momentum.

### Knee Valgus Detection (Squat)

```
valgus_ratio = knee_width / ankle_width
```
- `< 0.80` → knees caving in → "Push your knees out"
- Computed in image-space x-coordinates; meaningful for front-facing camera only
- May give false positives for side/angled camera; could gate by camera angle in future

---

## 6. WebSocket Response Schema

Every frame response includes:
```json
{
  "feedback":      ["string cue 1", "string cue 2"],
  "phase":         "BOTTOM" | "DESCENDING" | "ASCENDING" | "STANDING"
                   | "EXTENDED" | "CURLING" | "CONTRACTED" | "LOWERING"
                   | null,
  "rep_count":     5,
  "visibility_ok": true,
  "skeleton_binary": true,
  "skeleton_frame": null
}
```

---

## 7. Future Improvements

### 7.1 LLM-Powered Coaching Feedback

Replace hardcoded string cues with an LLM that receives structured context:

```python
prompt = f"""
You are a professional strength and conditioning coach.
Exercise: {exercise}
Current phase: {phase}
Rep number: {rep_count}
Angles: knee={avg_knee:.0f}°, hip={avg_hip:.0f}°
Issues detected: {', '.join(rule_violations) or 'none'}

Give one concise coaching cue (max 12 words). Be encouraging but specific.
"""
```

**Candidates:**
- **Gemini Flash / GPT-4o-mini**: low latency (~200ms), cost-effective per-frame is not feasible but per-rep is fine
- **Local LLM (Ollama + Llama 3)**: zero cost, ~500ms on CPU, runs entirely on the host machine
- **Trigger**: call LLM once per completed rep (on rep_count increment), not every frame

**Implemented batch option:** `POST /posture/analyze-session`

This endpoint is the slower, after-session path. The frontend can record frames
during a set, then send them together:

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

The backend runs the same MediaPipe + phase detector + feedback rules over the
whole set, stores a per-frame posture log, aggregates repeated issues, and sends
a compact log to Gemini. Configure:

```bash
GEMINI_API_KEY=your-key
GEMINI_MODEL=gemini-1.5-flash
POSTURE_LLM_MAX_LOG_FRAMES=120
```

If `GEMINI_API_KEY` is not set or the Gemini request fails, the endpoint still
returns a rule-based summary so the feature remains usable in local development.

### 7.2 Rep Tempo Analysis

Track timestamps of each phase transition to compute:
- **Eccentric duration** (time in DESCENDING / LOWERING)
- **Concentric duration** (time in ASCENDING / CURLING)
- Alert if eccentric < 1s (too fast, reduced muscle activation)

### 7.3 Multi-Camera / Depth Camera

- Side-view camera would enable accurate torso lean measurement for squats/deadlifts
- RGB-D (Intel RealSense / Kinect) would make valgus and elbow drift detection 3D-accurate instead of image-space estimates

### 7.4 Per-User Baseline Calibration

First 5 reps → compute personal baseline angles → adaptive thresholds instead of universal fixed values. Accounts for individual anatomy (hip mobility, limb proportions).

### 7.5 Exercise Auto-Detection

Use a sequence classifier (e.g., 1D CNN on angle time-series) to detect which exercise the user is performing, removing the need for manual exercise selection.

### 7.6 YOLOv8 as Object Detector (not pose)

Use YOLOv8 to detect gym equipment (barbell, dumbbell) to:
- Confirm exercise (barbell = squat/deadlift, dumbbells = curls)
- Detect if weight is being held (affects center of gravity cues)

---

## 8. Known Limitations

| Limitation | Impact | Mitigation |
|-----------|--------|-----------|
| Camera angle sensitivity | Valgus/drift metrics only valid for frontal camera | Document in UI |
| MediaPipe no CUDA on Linux | ~50ms/frame on CPU Heavy model | Acceptable at 18 FPS target |
| Phase thresholds are universal | Short/tall users may need different thresholds | Future: per-user calibration |
| No temporal context in LLM cues | Each cue is stateless | Future: per-rep LLM call |
| z-coordinate in MediaPipe is estimated | Elbow drift via z is an approximation | Warn in docs |
