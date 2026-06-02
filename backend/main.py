from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from authentication.database import init_db
from authentication.routes import router as auth_router
from posture.session_analysis import router as session_analysis_router
from posture.websocket import router as posture_router
from plan_routes import router as plan_router
from workout_routes import router as workout_router
import os

ENVIRONMENT = os.getenv("ENVIRONMENT", "development").strip().lower()
IS_PRODUCTION = ENVIRONMENT == "production"

app = FastAPI(
    title="GymFixer API",
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
)

DEFAULT_DEV_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
]

configured_origins = os.getenv("FRONTEND_ORIGINS") or os.getenv("FRONTEND_ORIGIN")
origins = (
    [origin.strip() for origin in configured_origins.split(",") if origin.strip()]
    if configured_origins
    else DEFAULT_DEV_ORIGINS
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1024)


@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)
    if "X-Content-Type-Options" not in response.headers:
        response.headers["X-Content-Type-Options"] = "nosniff"
    if "X-Frame-Options" not in response.headers:
        response.headers["X-Frame-Options"] = "DENY"
    if "Referrer-Policy" not in response.headers:
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if IS_PRODUCTION and "Strict-Transport-Security" not in response.headers:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


@app.get("/health", include_in_schema=False)
def health():
    return {"status": "ok"}


@app.options("/{full_path:path}", include_in_schema=False)
def options_handler(full_path: str):
    return Response(status_code=204)


# Include posture websocket router and other routers
app.include_router(posture_router)
app.include_router(session_analysis_router)

# Import SQLAlchemy models on startup. Schema changes are handled by Alembic.
@app.on_event("startup")
def on_startup():
    init_db()

# Include auth routes
app.include_router(auth_router)
app.include_router(workout_router)
app.include_router(plan_router)

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
