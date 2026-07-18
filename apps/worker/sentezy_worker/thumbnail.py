# apps/worker/sentezy_worker/thumbnail.py
from __future__ import annotations

import subprocess


def _run(cmd: list[str]) -> None:
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg failed ({proc.returncode}):\n{proc.stderr.decode('utf-8', 'replace')[-2000:]}")


def make_thumbnail(video_path: str, out_path: str, *, at: str = "00:00:01") -> None:
    """Grab a poster frame from the finished reel."""
    _run(["ffmpeg", "-y", "-ss", at, "-i", video_path, "-frames:v", "1", "-q:v", "3", out_path])
