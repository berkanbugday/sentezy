from __future__ import annotations

import json
import os
import pathlib
import subprocess

import httpx

from ..compose import Word

# Remotion caption renderer. Two backends, same output — a transparent ProRes 4444 alpha .mov
# of the @sentezy/remotion CaptionOverlay composition, which compose_reel overlays like the
# matted avatar:
#   • render_caption_overlay        — POST to the Cloudflare Worker (prod; needs CAPTION_RENDERER_URL)
#   • render_caption_overlay_local  — shell out to the Remotion CLI (dev; Node on the host)
# The pipeline picks local when no CAPTION_RENDERER_URL is set, so preview == video without any
# cloud deploy.

def _project_dir() -> pathlib.Path:
    """Locate the packages/remotion project (only used by the local renderer). Computed lazily —
    in Docker the worker lives at /app and the local path doesn't exist, but the HTTP path is used."""
    env = os.environ.get("REMOTION_PROJECT_DIR")
    if env:
        return pathlib.Path(env)
    for parent in pathlib.Path(__file__).resolve().parents:
        cand = parent / "packages" / "remotion"
        if cand.exists():
            return cand
    return pathlib.Path("packages/remotion")


def _props(words, style, font, color, width, height, fps, layout, position, avatar_side) -> dict:
    return {
        "words": [{"text": w.text, "start": w.start, "end": w.end} for w in words],
        "styleId": style,
        "font": font or "General Sans",
        # The composition treats color as the accent; default to the reference yellow.
        "color": color or "#FFD54A",
        "width": width,
        "height": height,
        "fps": fps,
        "layout": layout,
        "position": position,
        "avatarSide": avatar_side,
    }


def render_caption_overlay(
    renderer_url: str,
    storage,
    words: list[Word],
    *,
    job_id: str,
    style: str,
    font: str,
    color: str | None,
    width: int,
    height: int,
    fps: int,
    layout: str,
    position: str,
    avatar_side: str,
    dest: str,
    timeout: float = 240.0,
) -> str:
    """Render the overlay via the renderer service and write it to `dest`. Raises on failure.

    Handles both response shapes: a JSON `{overlayKey}` (renderer uploaded to R2 → we download
    it) or the .mov streamed inline (local docker renderer without R2 → we save the bytes)."""
    payload = {"jobId": job_id, **_props(words, style, font, color, width, height, fps, layout, position, avatar_side)}
    with httpx.stream("POST", renderer_url.rstrip("/") + "/render", json=payload, timeout=timeout) as r:
        r.raise_for_status()
        if r.headers.get("content-type", "").startswith("application/json"):
            r.read()
            overlay_key = r.json()["overlayKey"]  # R2 keys are server-only → signed GET
            storage.download(storage.signed_get_url(overlay_key), dest)
        else:
            with open(dest, "wb") as f:
                for chunk in r.iter_bytes():
                    f.write(chunk)
    return dest


def _remotion_bin(project_dir: pathlib.Path) -> list[str]:
    """Locate the Remotion CLI — a node_modules/.bin/remotion at or above the project dir, else npx."""
    for base in (project_dir, *project_dir.resolve().parents):
        cand = base / "node_modules" / ".bin" / "remotion"
        if cand.exists():
            return [str(cand)]
    return ["npx", "--no-install", "remotion"]


def render_caption_overlay_local(
    words: list[Word],
    *,
    style: str,
    font: str,
    color: str | None,
    width: int,
    height: int,
    fps: int,
    layout: str,
    position: str,
    avatar_side: str,
    dest: str,
    workdir: str,
    timeout: float = 300.0,
) -> str:
    """Render the overlay with the local Remotion CLI (needs Node on the host). Returns `dest`.

    Produces a transparent ProRes 4444 alpha .mov — proResProfile 4444 AND yuva444p10le are both
    required for the alpha channel (profile alone emits opaque 422)."""
    project_dir = _project_dir()
    entry = os.environ.get("REMOTION_ENTRY", "src/remotion-entry.ts")
    props_path = os.path.join(workdir, "caption-props.json")
    with open(props_path, "w", encoding="utf-8") as f:
        json.dump(_props(words, style, font, color, width, height, fps, layout, position, avatar_side), f)

    cmd = [
        *_remotion_bin(project_dir), "render", entry, "CaptionOverlay", dest,
        "--codec=prores", "--prores-profile=4444", "--pixel-format=yuva444p10le",
        f"--props={props_path}", "--log=error",
    ]
    subprocess.run(cmd, cwd=str(project_dir), check=True, timeout=timeout)
    return dest
