# Backend - Python FastAPI application
# NOTE: Must use Debian-based image (not Alpine).
#   MediaPipe requires glibc; Alpine uses musl which causes import crashes.
#   OpenCV also needs libGL/libglib2 system libraries.
FROM python:3.11-slim

WORKDIR /app

# System deps required by MediaPipe + OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/docs')" || exit 1

# Run with uvicorn — workers=1 keeps the MediaPipe singleton in one process
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5000", "--workers", "1"]
