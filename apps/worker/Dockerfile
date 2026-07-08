# Sentezy worker — Python + ffmpeg (with libass for burned captions).
FROM python:3.12-slim

# ffmpeg from apt includes libass/libfreetype (unlike the local Homebrew build),
# so caption burn-in works in production.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core \
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
