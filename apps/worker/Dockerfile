# Sentezy worker — Python + ffmpeg (with libass for burned captions).
FROM python:3.12-slim

# ffmpeg from apt includes libass/libfreetype (unlike the local Homebrew build),
# so caption burn-in works in production.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core fontconfig \
    && rm -rf /var/lib/apt/lists/*

# uv for fast, reproducible installs
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Install deps first (better layer caching). package = false → only deps are installed.
COPY pyproject.toml uv.lock* ./
RUN uv sync --no-dev

COPY . .

# Brand fonts (General Sans, ITF Free Font License — see fonts/LICENSE-FFL.txt)
# installed system-wide so libass finds them for caption burn-in.
RUN mkdir -p /usr/share/fonts/opentype/general-sans \
    && cp fonts/*.otf /usr/share/fonts/opentype/general-sans/ \
    && fc-cache -f

ENV PYTHONUNBUFFERED=1
CMD ["uv", "run", "--no-dev", "python", "-m", "sentezy_worker.main"]
