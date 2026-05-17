# GymFixer

AI-assisted workout posture analysis. The active product flow is after-session video analysis: upload a squat or bicep-curl video, the backend samples frames, runs MediaPipe pose estimation, computes angles and reps, returns skeleton previews, and optionally calls Gemini for coaching.

## Current Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS, Recharts |
| Backend | FastAPI, SQLAlchemy, SQLite, MediaPipe, OpenCV |
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
│   └── posture/              # Pose analysis, phase detection, feedback
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

Create `backend/.env`:

```env
DATABASE_URL=sqlite:///./backend.db
JWT_SECRET_KEY=change-this-for-real-use

# Optional Gemini coaching
GEMINI_API_KEY=your-key
GEMINI_MODEL=gemini-3-flash-preview
GEMINI_MAX_OUTPUT_TOKENS=1024
POSTURE_LLM_MAX_LOG_FRAMES=60

# Pose/session analysis
POSTURE_SUBJECT_READY_MIN_FRAMES=10
POSTURE_SUBJECT_MIN_BBOX_AREA=0.035
POSTURE_SUBJECT_MIN_BBOX_WIDTH=0.12
POSTURE_SUBJECT_MIN_BBOX_HEIGHT=0.20
MP_MIN_DET_CONF=0.5
MP_MIN_TRACK_CONF=0.5
MP_VIS_THRESHOLD=0.5
```

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
3. Upload a workout video.
4. Choose `squat` or `bicep_curl`.
5. Tune sample FPS, max frames, and preview frame count if needed.
6. Leave `Gemini coaching` off for normal dev usage. Turn it on only when you intentionally want to spend Gemini API quota.
7. Review the analysis page:
   - rep count
   - analyzed frame count
   - angle chart
   - skeleton preview frames
   - per-frame feedback
   - rule-based or Gemini coaching

## API Endpoints

### Auth

```http
POST /auth/register
POST /auth/login
```

### Video Analysis

```http
POST /posture/analyze-video
Content-Type: multipart/form-data
```

Form fields:

```text
exercise=squat | bicep_curl
file=@video.mp4
call_llm=false
sample_fps=8
max_frames=360
include_preview=true
preview_max_frames=24
```

Example:

```bash
curl -X POST http://127.0.0.1:5000/posture/analyze-video \
  -F "exercise=squat" \
  -F "file=@/path/to/squat.mp4" \
  -F "call_llm=false" \
  -F "sample_fps=8" \
  -F "max_frames=360" \
  -F "include_preview=true" \
  -F "preview_max_frames=24"
```

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
- `bicep_curl`

The backend still contains some rules/utilities for other exercises, but the Next dashboard only exposes the two exercises currently supported by the batch video-analysis flow.

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
../p1_env/bin/python -m py_compile posture/session_analysis.py
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
../p1_env/bin/uvicorn main:app --host 0.0.0.0 --port 5000 --reload
```

Run frontend:

```bash
cd frontend
npm run dev
```

## Docker

`docker-compose.yml` builds:

- `frontend`: Next.js app on port `3000`
- `backend`: FastAPI app on port `5000`

The frontend container uses `NEXT_PUBLIC_API_BASE_URL` for backend requests.
