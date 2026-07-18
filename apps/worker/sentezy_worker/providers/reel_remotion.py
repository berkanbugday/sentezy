# apps/worker/sentezy_worker/providers/reel_remotion.py
from __future__ import annotations

import json
import os
import pathlib
import subprocess

import httpx

from ..models import Word

# Remotion reel renderer. Two backends, same opaque H.264 output of the @sentezy/remotion `Reel`
# composition (avatar + B-roll + transitions + captions):
#   • render_reel        — POST to the renderer service (prod; needs REEL_RENDERER_URL)
#   • render_reel_local  — shell to the Remotion CLI (dev; Node on the host)


def build_reel_props(
    words: list[Word],
    *,
    avatar_url: str | None,
    broll: list[dict],
    style: str,
    font: str,
    color: str | None,
    layout: str,
    position: str,
    avatar_side: str,
    captions: bool,
    width: int,
    height: int,
    fps: int,
) -> dict:
    """The Reel composition inputProps (JSON-safe). broll items: {url, kind, transition}."""
    return {
        "words": [{"text": w.text, "start": w.start, "end": w.end} for w in words],
        "avatarUrl": avatar_url,
        "broll": [{"url": b["url"], "kind": b.get("kind", "image"), "transition": b.get("transition") or "fade"} for b in broll],
        "captionStyle": {"styleId": style, "font": font or "General Sans", "color": color or "#FFD54A"},
        "layout": layout,
        "position": position,
        "avatarSide": avatar_side,
        "captions": captions,
        "previewAudio": False,
        "sfxCues": [],
        "width": width,
        "height": height,
        "fps": fps,
    }


def render_reel(renderer_url: str, storage, props: dict, *, job_id: str, dest: str, timeout: float = 600.0) -> str:
    """Render via the renderer service → write the opaque mp4 to `dest`. Raises on failure."""
    payload = {"jobId": job_id, **props}
    with httpx.stream("POST", renderer_url.rstrip("/") + "/render-reel", json=payload, timeout=timeout) as r:
        r.raise_for_status()
        if r.headers.get("content-type", "").startswith("application/json"):
            r.read()
            reel_key = r.json()["reelKey"]  # R2 key → signed GET
            storage.download(storage.signed_get_url(reel_key), dest)
        else:
            with open(dest, "wb") as f:
                for chunk in r.iter_bytes():
                    f.write(chunk)
    return dest


def _project_dir() -> pathlib.Path:
    env = os.environ.get("REMOTION_PROJECT_DIR")
    if env:
        return pathlib.Path(env)
    for parent in pathlib.Path(__file__).resolve().parents:
        cand = parent / "packages" / "remotion"
        if cand.exists():
            return cand
    return pathlib.Path("packages/remotion")


def _remotion_bin(project_dir: pathlib.Path) -> list[str]:
    for base in (project_dir, *project_dir.resolve().parents):
        cand = base / "node_modules" / ".bin" / "remotion"
        if cand.exists():
            return [str(cand)]
    return ["npx", "--no-install", "remotion"]


def render_reel_local(props: dict, *, dest: str, workdir: str, timeout: float = 600.0) -> str:
    """Render with the local Remotion CLI (needs Node on the host). Opaque H.264."""
    project_dir = _project_dir()
    entry = os.environ.get("REMOTION_ENTRY", "src/remotion-entry.ts")
    props_path = os.path.join(workdir, "reel-props.json")
    with open(props_path, "w", encoding="utf-8") as f:
        json.dump(props, f)
    cmd = [
        *_remotion_bin(project_dir), "render", entry, "Reel", dest,
        "--codec=h264", f"--props={props_path}", "--log=error",
    ]
    subprocess.run(cmd, cwd=str(project_dir), check=True, timeout=timeout)
    return dest
