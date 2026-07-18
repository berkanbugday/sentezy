# Sentezy worker — Python + ffmpeg (audio-bed mux, avatar matting pipes, thumbnail).
FROM python:3.12-slim

# ffmpeg for the audio bed mux, the avatar matting pipes, and thumbnail extraction.
# (Caption/visual rendering is done by the Remotion reel-renderer, not here — no libass/fonts.)
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# uv for fast, reproducible installs
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Install deps first (better layer caching). package = false → only deps are installed.
COPY pyproject.toml uv.lock* ./
RUN uv sync --no-dev

COPY . .

ENV PYTHONUNBUFFERED=1
CMD ["uv", "run", "--no-dev", "python", "-m", "sentezy_worker.main"]
