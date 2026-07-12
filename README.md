# GymFixer

AI-assisted workout posture analysis. The active product flow is after-session video analysis: upload a short squat, lunge, bicep-curl, or Romanian-deadlift video, the backend samples frames, runs the selected pose backend, computes angles and reps, groups detected errors by rep, and optionally calls Gemini for coaching.

## Current Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS, Recharts |
| Backend | FastAPI, SQLAlchemy, PostgreSQL, Alembic, MediaPipe, optional ViTPose, OpenCV |
| Auth | Email/password registration and login, JWT token generation |
| LLM coaching | Gemini API, disabled by default in dev |

## Repository Layout

```text
gymfixer/
├── frontend/                 # Main frontend: Next.js app
│   ├── src/app/              # App Router pages
│   ├── src/components/       # Dashboard nav and UI pieces
│   ├── src/lib/api.ts        # Frontend API client for FastAPI
│   └── package.json
├── backend/                  # FastAPI backend
│   ├── main.py               # App setup, CORS, routers
│   ├── authentication/       # Register/login/JWT/database code
│   └── posture/              # Pose processing + session analysis
│       └── exercises/        # Per-exercise angles, feedback, phase detectors
├── package.json              # Root helper scripts
├── LLM.md                    # Technical notes for posture + Gemini flow
└── RUNNING.md                # Older run notes; prefer this README for current flow
```

The old Vite frontend has been removed. `frontend/` is now the former `web/` Next app and is the only supported frontend.

## Quick Start

Use two terminals.

**Terminal 1: backend**

```bash
cd /mnt/data/gymfixer/backend
../p1_env/bin/uvicorn main:app --host 0.0.0.0 --port 5000 --reload
```

**Terminal 2: frontend**

```bash
cd /mnt/data/gymfixer/frontend
npm run dev
```

Open:

```text
http://localhost:3000
```

The frontend talks to the backend at `http://localhost:5000` by default. You can override this with:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
```

## Setup

### Backend

```bash
python -m venv p1_env
source p1_env/bin/activate
pip install -r backend/requirements.txt
```

`DATABASE_URL` must point to PostgreSQL. Runtime schema creation is handled by
Alembic migrations, not SQLite or startup table creation.

### PostgreSQL Setup

Use a local PostgreSQL database for development. The examples below create a
database named `gymfixer` and use the default `postgres` superuser.

#### Linux

Ubuntu/Debian:

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl enable --now postgresql
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'postgres123';"
sudo -u postgres createdb gymfixer
```

Arch Linux:

```bash
sudo pacman -S postgresql
sudo -iu postgres initdb -D /var/lib/postgres/data
sudo systemctl enable --now postgresql
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'postgres123';"
sudo -u postgres createdb gymfixer
```

If the database already exists, `createdb gymfixer` may fail with
`database already exists`; that is fine.

#### Windows

1. Install PostgreSQL for Windows.
2. During install, set and remember the password for the `postgres` user.
3. Open **SQL Shell (psql)** or **pgAdmin**.
4. Connect with user `postgres`.
5. Create the app database:

```sql
CREATE DATABASE gymfixer;
```

For local development, a simple password such as `postgres123` avoids URL
encoding issues. If your password contains special characters like `@`, `#`,
`/`, or `:`, URL-encode it before putting it in `DATABASE_URL`.

Then use this local connection string in `backend/.env`:

```env
DATABASE_URL=postgresql+psycopg://postgres:postgres123@localhost:5432/gymfixer
```

Optional offline-quality ViTPose backend:

```bash
pip install -r backend/requirements-vitpose.txt
```

ViTPose is optional because it installs a heavier PyTorch/Transformers stack. The normal backend still runs with `requirements.txt` only.

Create `backend/.env`:

```env
DATABASE_URL=postgresql+psycopg://postgres:postgres123@localhost:5432/gymfixer
JWT_SECRET_KEY=change-this-for-real-use

# Optional Gemini coaching
GEMINI_API_KEY=your-key
GEMINI_MODEL=gemini-3-flash-preview
GEMINI_MAX_OUTPUT_TOKENS=3000
POSTURE_LLM_MAX_LOG_FRAMES=60

# PayOS Pay Premium (59,000 VND for one month by default)
FRONTEND_URL=http://localhost:3000
BACKEND_PUBLIC_URL=http://localhost:5000
PAYOS_CLIENT_ID=your-payos-client-id
PAYOS_API_KEY=your-payos-api-key
PAYOS_CHECKSUM_KEY=your-payos-checksum-key

# Optional PayOS sandbox test amount.
# Use a public tunnel for BACKEND_PUBLIC_URL if PayOS needs to call local return/webhook URLs.
PREMIUM_AMOUNT_VND=5000
# BACKEND_PUBLIC_URL=https://<ngrok-domain>

# Pose/session analysis
POSE_BACKEND=mediapipe
POSTURE_SUBJECT_READY_MIN_FRAMES=10
POSTURE_SUBJECT_MIN_BBOX_AREA=0.035
POSTURE_SUBJECT_MIN_BBOX_WIDTH=0.12
POSTURE_SUBJECT_MIN_BBOX_HEIGHT=0.20
MP_MIN_DET_CONF=0.5
MP_MIN_TRACK_CONF=0.5
MP_VIS_THRESHOLD=0.5

# Optional when POSE_BACKEND=vitpose
VITPOSE_MODEL=usyd-community/vitpose-base-simple
VITPOSE_DEVICE=auto
VITPOSE_KEYPOINT_THRESHOLD=0.25
VITPOSE_POSE_THRESHOLD=0.25
VITPOSE_EMA_ALPHA=0.35
```

After PostgreSQL and `backend/.env` are ready, run migrations:

```bash
cd backend
../p1_env/bin/alembic upgrade head
../p1_env/bin/alembic current
```

Verify the app can connect:

```bash
../p1_env/bin/python -c "from authentication.database import engine; c=engine.connect(); print(c.exec_driver_sql('select 1').scalar()); c.close()"
```

Verify tables exist:

```bash
psql -U postgres -h localhost -d gymfixer -c "\dt"
```

Expected tables include `users`, `workout_sessions`, `analysis_results`,
`usage_events`, `billing_subscriptions`, `payment_methods`, `payments`, and
`alembic_version`.

Recent migrations add `analysis_results.rep_breakdown_json`, which stores
per-rep analysis summaries used by the report UI and history views.

### Choosing a Pose Backend

Default MediaPipe run:

```bash
cd /mnt/data/gymfixer/backend
POSE_BACKEND=mediapipe ../p1_env/bin/uvicorn main:app --host 0.0.0.0 --port 5000 --reload
```

ViTPose experiment:

```bash
cd /mnt/data/gymfixer/backend
../p1_env/bin/pip install -r requirements-vitpose.txt
POSE_BACKEND=vitpose VITPOSE_DEVICE=auto ../p1_env/bin/uvicorn main:app --host 0.0.0.0 --port 5000 --reload
```

Use the frontend normally after the backend starts. The Dashboard no longer
shows a pose-backend selector; it sends the configured/default backend
internally. The analysis response still includes `pose_backend` at the top level
and inside `summary`, so you can confirm which backend processed the video
while debugging.

Current ViTPose notes:

- It is intended for offline uploaded videos, not the old realtime WebSocket path.
- It maps ViTPose COCO-17 body keypoints into the existing MediaPipe-style landmark slots.
- It currently uses the whole frame as the person box, so single-person, well-framed videos are expected.
- It does not provide MediaPipe's detailed hand landmarks or `z` depth estimate.
- If install was interrupted, rerun the `pip install -r backend/requirements-vitpose.txt` command.

### Frontend

```bash
cd frontend
npm install
```

## Root Scripts

From repo root:

```bash
npm start
```

This runs backend and frontend concurrently.

Useful scripts:

```bash
npm run backend
npm run frontend
npm run build:frontend
npm run install:all
```

## Product Flow

1. Register or log in.
2. Open the dashboard.
3. Upload a workout video. Video analysis requires the JWT from login/register.
4. Choose `squat`, `lunge`, `bicep_curl`, or `romanian_deadlift`. Romanian deadlifts require a full-body side view with both hands visible.
5. Use videos around 15-30 seconds. Longer videos require more processing time. Sample FPS, camera view, pose backend, max frame, and mistake-frame limits are handled internally.
6. Leave `Gemini coaching` off for normal dev usage. Turn it on only when you intentionally want to spend Gemini API quota.
7. Review the analysis page:
   - rep count
   - video duration
   - issue count
   - errors detected by rep
   - representative correction frame for each displayed issue
   - rule-based or Gemini coaching
8. Open `History` from the dashboard sidebar to revisit previous sessions.

Romanian deadlift analysis is MediaPipe-first and side-view only. Its rounded-back cue is inferred from shoulder, hip, and head alignment because pose landmarks do not measure spinal curvature directly; treat it as a coaching prompt, not a diagnosis.

## API Endpoints

### Premium Billing

Premium costs `59,000 VND` for one month by default. Set `PREMIUM_AMOUNT_VND=5000`
in sandbox to create a small PayOS test payment. Users can buy another month at any time;
the new period is added after their current expiry date.

```http
POST /billing/payos/start
GET  /billing/payos/return
GET  /billing/payos/cancel
POST /billing/payos/webhook
```

Checkout requires a Bearer token. Configure PayOS credentials in `backend/.env`.
Use a public `BACKEND_PUBLIC_URL` when testing return/webhook callbacks from
PayOS against a local backend.

### Auth

```http
POST /auth/register
POST /auth/login
```

### Video Analysis

```http
POST /posture/analyze-video
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

Form fields:

```text
exercise=squat | lunge | bicep_curl | romanian_deadlift
camera_view=auto | side | front | three_quarter
pose_backend=mediapipe | vitpose
file=@video.mp4
call_llm=false
sample_fps=8
max_frames=360
include_preview=true
preview_max_frames=24
```

The current frontend sends `camera_view=auto`, `pose_backend`, `sample_fps`,
`max_frames`, `include_preview`, and `preview_max_frames` internally. Users do
not configure these controls in the dashboard.

Example:

```bash
curl -X POST http://127.0.0.1:5000/posture/analyze-video \
  -H "Authorization: Bearer $TOKEN" \
  -F "exercise=squat" \
  -F "camera_view=auto" \
  -F "pose_backend=mediapipe" \
  -F "file=@/path/to/squat.mp4" \
  -F "call_llm=false" \
  -F "sample_fps=8" \
  -F "max_frames=360" \
  -F "include_preview=true" \
  -F "preview_max_frames=24"
```

To compare pose backends, run the same upload twice with the same form fields, changing only `pose_backend`:

```bash
-F "pose_backend=mediapipe"  # baseline
-F "pose_backend=vitpose"    # optional quality experiment
```

Compare `rep_count`, `phase_counts`, `top_feedback`, `angle_stats`, `rep_breakdown`, and the errors detected by rep.

Successful video analysis returns the normal analysis payload plus `session_id`
and `analysis_id`. The backend persists summary/statistics and
`rep_breakdown_json` in PostgreSQL; uploaded videos, preview images, and full
frame logs are not stored in the database. The report UI only shows a form
issue when it has a representative skeleton frame; text-only issues are hidden.

### User History and Analytics

```http
GET /me
GET /workouts
GET /workouts/{session_id}
GET /analytics/summary
Authorization: Bearer <access_token>
```

`/analytics/summary` returns completed-session statistics such as total sessions,
total reps, sessions/reps by exercise, rep-level issues grouped by exercise, LLM
run count, and recent completed sessions. The frontend intentionally hides
quality and average processing metrics because they are not reliable product
scores yet.

The Next frontend also includes `/dashboard/history`, which calls `GET /workouts`
and links each saved session back to `/dashboard/analysis/{session_id}`.

### Frame Session Analysis

```http
POST /posture/analyze-session
Content-Type: application/json
```

For clients that already captured frames locally.

### WebSocket

```text
WS /ws/posture
```

The backend still includes the realtime WebSocket posture endpoint, but the current Next frontend does not use it.

## Gemini Behavior

Gemini is disabled by default:

- backend request models default `call_llm=false`
- `/posture/analyze-video` defaults `call_llm=false`
- frontend dashboard checkbox defaults off

When Gemini is enabled, backend sends a compact posture log to Gemini. If the Gemini API key has no quota, the request fails clearly instead of silently falling back. Keep it off during normal development unless you are explicitly testing LLM coaching.

## Supported Analysis

The active session-analysis flow supports:

- `squat`
- `lunge`
- `bicep_curl`

The backend still contains some rules/utilities for other exercises, but the Next dashboard only exposes the exercises currently supported by the batch video-analysis flow.

Implementation notes:

- `backend/posture/mediapipe_utils.py` owns pose backend processing and visibility gates.
- `backend/posture/exercises/<exercise>.py` owns each exercise's angle extraction, feedback rules, and phase detector when available.
- `backend/posture/session_analysis.py` owns the FastAPI routes; helper modules for frame processing, preview frames, summaries, Gemini coaching, and persistence live under `backend/posture/sessions_related/`.
- `backend/posture/feedback.py` and `backend/posture/phase_detector.py` are compatibility facades over the exercise registry.
- Bicep curl rep counting is tracked per arm, so a visible non-working arm no longer suppresses reps from the working arm.

## Development Checks

Frontend:

```bash
cd frontend
npm run lint
npm run build
```

Backend syntax check:

```bash
cd backend
../p1_env/bin/python -m py_compile posture/*.py posture/exercises/*.py
```

## Common Commands

Kill local dev servers:

```bash
lsof -ti :3000 | xargs -r kill
lsof -ti :5000 | xargs -r kill
```

Run backend:

```bash
cd backend
../p1_env/bin/alembic upgrade head
../p1_env/bin/uvicorn main:app --host 0.0.0.0 --port 5000 --reload
```

Run frontend:

```bash
cd frontend
npm run dev
```

## Docker

Docker is currently out of scope for the active local/production database flow. Prefer the Postgres + Alembic setup above.
