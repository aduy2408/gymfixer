# Backend - Python FastAPI application with NVIDIA CUDA 12.6 support
FROM nvidia/cuda:12.6.3-cudnn-runtime-ubuntu22.04

# Avoid prompt during installations
ENV DEBIAN_FRONTEND=noninteractive

WORKDIR /app

# Install Python 3.10 and system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.10 \
    python3.10-dev \
    python3-pip \
    python3-setuptools \
    build-essential \
    libpq-dev \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    libportaudio2 \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set python3.10 as default python
RUN update-alternatives --install /usr/bin/python python /usr/bin/python3.10 1 \
    && update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.10 1

# Upgrade pip
RUN python3 -m pip install --upgrade pip

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir \
    torch==2.6.0 \
    torchvision==0.21.0 \
    --index-url https://download.pytorch.org/whl/cu126
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the ViTPose model to keep the container ready for offline inference
RUN python -c "from huggingface_hub import snapshot_download; \
snapshot_download(repo_id='usyd-community/vitpose-base-simple', local_dir='model/vitpose', \
allow_patterns=['config.json', 'preprocessor_config.json', '*.safetensors', '*.bin', '*.json', '*.txt'])"


# Copy application code
COPY . .

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:5000/docs || exit 1

# Run with uvicorn â€” workers=1 keeps the MediaPipe singleton in one process
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5000", "--workers", "1"]
