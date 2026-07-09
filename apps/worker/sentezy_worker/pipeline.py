from __future__ import annotations

import subprocess
import tempfile

from .compose import build_captions_ass, compose_reel, make_thumbnail
from .config import Config
from .db import Db
from .providers.elevenlabs import ElevenLabs
from .providers.heygen import HeyGen
from .storage import Storage

RATIO_DIMS = {"9:16": (1080, 1920), "1:1": (1080, 1080), "16:9": (1920, 1080)}


def _ffprobe_duration(path: str) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
        capture_output=True,
    )
    try:
        return round(float(out.stdout.decode().strip()), 2)
    except ValueError:
        return 0.0


def _resolve_broll_images(options: dict, storage: Storage, workdir: str) -> list[str]:
    """Download the user's uploaded images (used as B-roll cutaways)."""
    bg = (options or {}).get("background") or {}
    ids = bg.get("images") or ([bg["value"]] if bg.get("type") == "image" and bg.get("value") else [])
    paths: list[str] = []
    for i, image_id in enumerate(ids):
        dest = f"{workdir}/broll{i}.jpg"
        storage.download(storage.cf_image_url(image_id), dest)
        paths.append(dest)
    return paths


def _broll_segments(words: list, image_paths: list[str]) -> list[dict]:
    """Auto-place B-roll — no manual timeline needed. Keep a short A-roll hook at
    the start and an A-roll close at the end, and fill the middle with EVERY
    uploaded image, evenly spaced. So anyone can make a B-roll reel by just
    uploading images, and all of them get used."""
    if not words or not image_paths:
        return []
    t0 = words[0].start
    t1 = words[-1].end
    total = t1 - t0
    if total <= 0.1:
        return []
    n = len(image_paths)
    hook = min(1.6, total * 0.22)   # A-roll intro (see the presenter first)
    close = min(1.4, total * 0.18)  # A-roll outro (CTA on the presenter)
    mid_start = t0 + hook
    mid_end = t1 - close
    if mid_end - mid_start < 0.6:    # very short script — just keep a tiny hook
        mid_start = t0 + min(0.5, total * 0.15)
        mid_end = t1
    span = (mid_end - mid_start) / n
    return [
        {"path": p, "start": mid_start + i * span, "end": (mid_start + (i + 1) * span) if i < n - 1 else mid_end}
        for i, p in enumerate(image_paths)
    ]


def _resolve_logo(options: dict, storage: Storage, workdir: str) -> str | None:
    logo_id = ((options or {}).get("branding") or {}).get("logoImageId")
    if not logo_id:
        return None
    dest = f"{workdir}/logo.png"
    storage.download(storage.cf_image_url(logo_id), dest)
    return dest


def _resolve_music(options: dict, storage: Storage, workdir: str) -> str | None:
    track_key = ((options or {}).get("music") or {}).get("trackKey")
    if not track_key:
        return None
    dest = f"{workdir}/music.mp3"
    storage.download(storage.r2_url(track_key), dest)  # music stored in R2
    return dest


def process_video(video_id: str, cfg: Config, db: Db, storage: Storage, el: ElevenLabs, hg: HeyGen) -> None:
    video = db.get_video(video_id)
    if not video:
        raise RuntimeError(f"video_not_found: {video_id}")
    if video["status"] == "ready":
        return

    presenter = db.get_presenter(video["presenter_id"])
    voice = db.get_voice(video["voice_id"])
    if not presenter or not voice:
        raise RuntimeError("missing_presenter_or_voice")

    width, height = RATIO_DIMS.get(video["aspect_ratio"], (1080, 1920))
    options = video.get("options") or {}
    workdir = tempfile.mkdtemp(prefix=f"sentezy-{video_id}-")

    # 1) TTS (audio + word timings)
    db.set_stage(video_id, "tts", 10)
    audio_path = f"{workdir}/audio.mp3"
    words = el.tts_with_timestamps(video["script"], voice["elevenlabs_voice_id"], audio_path)
    audio_key = f"audio/{video_id}.mp3"
    storage.upload_r2(audio_path, audio_key, "audio/mpeg")
    audio_url = storage.r2_url(audio_key)

    # 2) HeyGen talking photo (audio-driven)
    db.set_stage(video_id, "avatar", 35)
    talking_photo_id = presenter.get("heygen_talking_photo_id")
    if not talking_photo_id:
        img = storage.download_bytes(storage.cf_image_url(presenter["source_image_id"]))
        talking_photo_id = hg.upload_talking_photo(img)
        db.set_presenter_heygen(presenter["id"], talking_photo_id)
    heygen_video_id = hg.generate(talking_photo_id, audio_url, width, height)
    heygen_url = hg.wait_for_url(heygen_video_id)
    avatar_path = f"{workdir}/avatar.mp4"
    storage.download(heygen_url, avatar_path)

    # 3) Compose reel
    db.set_stage(video_id, "compose", 70)
    caps_path = f"{workdir}/caps.ass"
    build_captions_ass(words, caps_path, width=width, height=height)
    reel_path = f"{workdir}/reel.mp4"
    broll_paths = _resolve_broll_images(options, storage, workdir)
    compose_reel(
        avatar_path=avatar_path,
        out_path=reel_path,
        width=width,
        height=height,
        broll=_broll_segments(words, broll_paths),
        captions_ass=caps_path if options.get("captions", True) else None,
        logo_path=_resolve_logo(options, storage, workdir),
        music_path=_resolve_music(options, storage, workdir),
        music_volume=float((options.get("music") or {}).get("volume", 0.15)),
    )

    # 4) Thumbnail + upload
    db.set_stage(video_id, "thumbnail", 88)
    thumb_path = f"{workdir}/thumb.jpg"
    make_thumbnail(reel_path, thumb_path)
    out_key = f"videos/{video_id}.mp4"
    storage.upload_r2(reel_path, out_key, "video/mp4")
    thumb_image_id = storage.upload_cf_image(thumb_path)

    db.set_ready(video_id, out_key, thumb_image_id, _ffprobe_duration(reel_path))
