# apps/worker/sentezy_worker/providers/reel_remotion.py
from __future__ import annotations

import json
import math
import os
import pathlib
import subprocess

import httpx

from ..models import Word

# Remotion reel renderer. Two backends, same opaque H.264 output of the @sentezy/remotion `Reel`
# composition (avatar + B-roll + transitions + captions):
#   • render_reel        — POST to the renderer service (prod; needs REEL_RENDERER_URL)
#   • render_reel_local  — shell to the Remotion CLI (dev; Node on the host)


# ── Brand kit ────────────────────────────────────────────────────────────────────────
# MIRROR OF packages/remotion/src/brand/timing.ts. These two must return the same numbers
# for the same input: the composition uses the TS version to lay out its <Sequence>s, and
# this one decides how far to delay the voiceover and how long to pad it. If they drift,
# the audio slides out of sync with the picture. tests/test_brand.py pins them together.

CARD_INTRO_SECONDS = 1.5
CARD_OUTRO_SECONDS = 2.0


def _body_frames(words: list, fps: int) -> int:
    """Last word's end + a 0.3s tail — unchanged from before branding existed."""
    if words:
        last = words[-1]
        last_end = last["end"] if isinstance(last, dict) else last.end
    else:
        last_end = 5
    return max(1, math.ceil((last_end + 0.3) * fps))


def _end_frames(end: dict | None, card_seconds: float, fps: int) -> int:
    if not end:
        return 0
    if end.get("kind") == "clip":
        return max(1, round(end.get("durationInFrames", 0)))
    return round(card_seconds * fps)


def reel_segments(words: list, brand: dict | None, fps: int) -> dict:
    """Where the reel's parts sit, in frames. See the mirror note above."""
    intro = _end_frames((brand or {}).get("intro"), CARD_INTRO_SECONDS, fps)
    outro = _end_frames((brand or {}).get("outro"), CARD_OUTRO_SECONDS, fps)
    body = _body_frames(words, fps)
    return {
        "introFrames": intro,
        "bodyFrames": body,
        "outroFrames": outro,
        "totalFrames": intro + body + outro,
    }


def brand_props(options: dict, storage, fps: int) -> dict | None:
    """`options.branding` → the composition's ReelBrand, with R2 keys signed and clip
    durations converted to frames. Returns None when there is nothing to render, so an
    unbranded video takes exactly the code path it did before this feature."""
    branding = options.get("branding") or {}
    kit = branding.get("kit")
    if not kit:
        # Toggles with no snapshot mean branding was never applied (or this is an old
        # draft carrying the vestigial placeholder). Nothing to draw.
        return None

    want_intro = bool(branding.get("intro"))
    want_outro = bool(branding.get("outro"))
    watermark = bool(branding.get("watermark"))
    if not (want_intro or want_outro or watermark):
        return None

    def end(enabled: bool, clip: dict | None) -> dict | None:
        if not enabled:
            return None
        if clip and clip.get("ref") and clip.get("ms"):
            return {
                "kind": "clip",
                "url": storage.signed_get_url(clip["ref"], 86400),
                "durationInFrames": max(1, round(clip["ms"] / 1000 * fps)),
                # How the user framed it in the 9:16 crop. Passed through verbatim; the
                # composition clamps it (normalizeCrop), so a bad value frames the media
                # oddly rather than failing the render.
                "crop": clip.get("crop"),
            }
        return {"kind": "card"}

    logo_key = kit.get("logoImageId")
    return {
        "intro": end(want_intro, kit.get("introClip")),
        "outro": end(want_outro, kit.get("outroClip")),
        "watermark": watermark,
        "logoUrl": storage.signed_get_url(logo_key, 86400) if logo_key else None,
        "brandName": kit.get("brandName"),
        "handle": kit.get("handle"),
        "cta": kit.get("outroCta"),
        "color": kit.get("color") or "#0A0A0B",
        "font": kit.get("font") or "General Sans",
    }


def build_reel_props(
    words: list[Word],
    *,
    avatar_url: str | None,
    broll: list[dict],
    style: str,
    font: str,
    color: str | None,
    avatar_position: str,
    position: str,
    captions: bool,
    width: int,
    height: int,
    fps: int,
    brand: dict | None = None,
) -> dict:
    """The Reel composition inputProps (JSON-safe). broll items: {url, kind, transition}."""
    return {
        "words": [{"text": w.text, "start": w.start, "end": w.end} for w in words],
        "avatarUrl": avatar_url,
        "broll": [{"url": b["url"], "kind": b.get("kind", "image"), "transition": b.get("transition") or "fade"} for b in broll],
        "captionStyle": {"styleId": style, "font": font or "General Sans", "color": color or "#FFD54A"},
        "avatarPosition": avatar_position,
        "position": position,
        "captions": captions,
        "previewAudio": False,
        "sfxCues": [],
        "musicUrl": None,   # the bed is muxed by ffmpeg after the render, not baked in
        "musicVolume": 0,
        "brand": brand,
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
