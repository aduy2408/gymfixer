from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from authentication.database import init_db
from authentication.routes import router as auth_router
from posture.session_analysis import router as session_analysis_router
from posture.websocket import router as posture_router
import os

app = FastAPI(title="Project1 API")

# CORS settings: allow the frontend dev server and localhost for local testing
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "*"  # Allow all origins for testing purposes; restrict in production
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Include posture websocket router and other routers
app.include_router(posture_router)
app.include_router(session_analysis_router)

# Create tables on startup
@app.on_event("startup")
def on_startup():
    init_db()

# Include auth routes
app.include_router(auth_router)

# ---------------------------------------------------------------------------
# Serve built frontend as static files (single-port deployment)
# ---------------------------------------------------------------------------
# Build the frontend first:
#   cd frontend && npm run build
#
# Then run backend (from project root):
#   uvicorn backend.main:app --host 0.0.0.0 --port 5000
#   OR from backend/ dir:
#   uvicorn main:app --host 0.0.0.0 --port 5000
#
# Expose with one ngrok tunnel:
#   ngrok http 5000

_FRONTEND_DIST = os.getenv(
    "FRONTEND_DIST",
    os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
)
_FRONTEND_DIST = os.path.abspath(_FRONTEND_DIST)

if os.path.isdir(_FRONTEND_DIST):
    # Serve static assets (JS, CSS, images, etc.)
    _assets_dir = os.path.join(_FRONTEND_DIST, "assets")
    if os.path.isdir(_assets_dir):
        app.mount("/assets", StaticFiles(directory=_assets_dir), name="assets")

    # SPA fallback: any unmatched route returns index.html so React Router works
    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        index = os.path.join(_FRONTEND_DIST, "index.html")
        if os.path.isfile(index):
            return FileResponse(index)
        return {"detail": "Frontend not built. Run: cd frontend && npm run build"}
