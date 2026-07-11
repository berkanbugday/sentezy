from __future__ import annotations

import re
import subprocess
import tempfile

from .compose import build_captions_ass, compose_reel, make_thumbnail
from .config import Config
from .db import Db
from .matte import matte_video_to_mov
from .providers.elevenlabs import ElevenLabs
from .providers.heygen import HeyGen
from .storage import Storage

RATIO_DIMS = {"9:16": (1080, 1920), "1:1": (1080, 1080), "16:9": (1920, 1080)}
# Reverse map (width, height) → HeyGen Avatar IV aspect_ratio label.
ASPECT_FROM_DIMS = {dims: ratio for ratio, dims in RATIO_DIMS.items()}


def _ffprobe_duration(path: str) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
        capture_output=True,
    )
    try:
        return round(float(out.stdout.decode().strip()), 2)
    except ValueError:
        return 0.0


def _resolve_broll_media(options: dict, storage: Storage, workdir: str) -> list[dict]:
    """Download ordered B-roll — images from Cloudflare Images, video clips from R2 —
    returning [{path, kind, transition}]. Prefers the unified `media` list; falls back to
    the legacy `images`+`transitions` (older drafts, images only)."""
    bg = (options or {}).get("background") or {}
    media = bg.get("media")
    if not media:
        ids = bg.get("images") or ([bg["value"]] if bg.get("type") == "image" and bg.get("value") else [])
        trans = bg.get("transitions") or []
        media = [
            {"kind": "image", "ref": rid, "transition": (trans[i] if i < len(trans) else None)}
            for i, rid in enumerate(ids)
        ]
    out: list[dict] = []
    for i, m in enumerate(media):
        ref = m.get("ref")
        if not ref:
            continue
        kind = m.get("kind", "image")
        if kind == "video":
            dest = f"{workdir}/broll{i}.mp4"
            storage.download(storage.signed_get_url(ref, 86400), dest)
        else:
            dest = f"{workdir}/broll{i}.jpg"
            storage.download(storage.cf_image_url(ref), dest)
        out.append({"path": dest, "kind": kind, "transition": m.get("transition")})
    return out


def _broll_segments(words: list, media: list[dict]) -> list[dict]:
    """Auto-place B-roll — no manual timeline needed. Keep a short hook at the
    start and a close at the end (presenter over the blurred backdrop, no cutaway),
    and fill the middle with EVERY uploaded clip/image, evenly spaced. So anyone can
    make a B-roll reel by just uploading media, and all of it gets used. Each item
    carries its kind (image|video) and creator-chosen incoming transition."""
    if not words or not media:
        return []
    t0 = words[0].start
    t1 = words[-1].end
    total = t1 - t0
    if total <= 0.1:
        return []
    n = len(media)
    hook = min(1.6, total * 0.22)   # A-roll intro (see the presenter first)
    close = min(1.4, total * 0.18)  # A-roll outro (CTA on the presenter)
    mid_start = t0 + hook
    mid_end = t1 - close
    if mid_end - mid_start < 0.6:    # very short script — just keep a tiny hook
        mid_start = t0 + min(0.5, total * 0.15)
        mid_end = t1
    span = (mid_end - mid_start) / n
    return [
        {
            "path": m["path"],
            "kind": m.get("kind", "image"),
            "start": mid_start + i * span,
            "end": (mid_start + (i + 1) * span) if i < n - 1 else mid_end,
            "transition": m.get("transition") or "fade",
        }
        for i, m in enumerate(media)
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
    storage.download(storage.signed_get_url(track_key), dest)  # music stored in R2 (signed → always fetchable)
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
    tone = ((options.get("voice") or {}).get("emotion")) or ""
    script = video["script"]
    emotion_tag: str | None = None
    # If the wizard's "add emotion" pass already annotated the script with v3 tags, use it
    # as-is — don't re-tag or prepend a leading tag (captions still strip the tags later).
    already_tagged = bool(re.search(r"\[[a-zA-Z]", script))
    if tone and not already_tagged:
        if cfg.openrouter_api_key or cfg.anthropic_api_key:
            # LLM pass: insert per-sentence v3 audio tags matching the tone (OpenRouter/free
            # preferred, Anthropic fallback; falls back to the plain script on any failure).
            # Tags are stripped from captions later.
            from .emotion import add_emotion_tags
            script = add_emotion_tags(
                script, tone,
                openrouter_key=cfg.openrouter_api_key, openrouter_model=cfg.openrouter_model,
                anthropic_key=cfg.anthropic_api_key,
            )
        else:
            emotion_tag = tone  # no LLM key → a single leading tag sets the tone
    words = el.tts_with_timestamps(script, voice["elevenlabs_voice_id"], audio_path, emotion_tag=emotion_tag)
    audio_key = f"audio/{video_id}.mp3"
    storage.upload_r2(audio_path, audio_key, "audio/mpeg")
    audio_url = storage.signed_get_url(audio_key, 86400)  # HeyGen must fetch this; R2_PUBLIC_URL is the S3 endpoint, not public

    # 2) HeyGen Avatar IV — audio-driven talking video straight from the presenter
    #    photo (no talking-photo upload step; Avatar IV takes the image URL directly).
    db.set_stage(video_id, "avatar", 35)
    image_url = storage.cf_image_url(presenter["source_image_id"])
    aspect_ratio = ASPECT_FROM_DIMS.get((width, height), "9:16")
    heygen_video_id = hg.generate(image_url, audio_url, aspect_ratio)
    heygen_url = hg.wait_for_url(heygen_video_id)
    avatar_path = f"{workdir}/avatar.mp4"
    storage.download(heygen_url, avatar_path)

    # 2b) Matte the presenter out of the green screen → alpha clip (keeps the voice),
    #     so the reel composites the cut-out presenter over the B-roll.
    db.set_stage(video_id, "avatar", 55)
    presenter_path = f"{workdir}/presenter.mov"
    matte_video_to_mov(avatar_path, presenter_path)

    # 3) Compose reel — B-roll fills the frame, presenter framed to one side.
    db.set_stage(video_id, "compose", 70)
    layout = options.get("layout") or {}
    avatar_side = layout.get("avatarSide", "right")
    presenter_pos = layout.get("presenterLayout", "side")
    caps = options.get("captions", True)
    if isinstance(caps, bool):  # legacy drafts store captions as a plain boolean
        caps = {"enabled": caps}
    caps_path = f"{workdir}/caps.ass"
    build_captions_ass(
        words, caps_path, width=width, height=height,
        avatar_side=avatar_side, position=layout.get("captionPosition", "bottom"),
        style=caps.get("style", "karaoke"),
        font=caps.get("font") or "General Sans",
        color=caps.get("color"),
        presenter_pos=presenter_pos,
    )
    reel_path = f"{workdir}/reel.mp4"
    broll_media = _resolve_broll_media(options, storage, workdir)
    effects = options.get("effects") or {}
    compose_reel(
        presenter_path=presenter_path,
        out_path=reel_path,
        width=width,
        height=height,
        broll=_broll_segments(words, broll_media),
        transition_sfx=effects.get("transitionSfx", True),
        captions_ass=caps_path if caps.get("enabled", True) else None,
        logo_path=_resolve_logo(options, storage, workdir),
        music_path=_resolve_music(options, storage, workdir),
        music_volume=float((options.get("music") or {}).get("volume", 0.15)),
        avatar_side=avatar_side,
        presenter_pos=presenter_pos,
    )

    # 4) Thumbnail + upload
    db.set_stage(video_id, "thumbnail", 88)
    thumb_path = f"{workdir}/thumb.jpg"
    make_thumbnail(reel_path, thumb_path)
    out_key = f"videos/{video_id}.mp4"
    storage.upload_r2(reel_path, out_key, "video/mp4")
    thumb_image_id = storage.upload_cf_image(thumb_path)

    db.set_ready(video_id, out_key, thumb_image_id, _ffprobe_duration(reel_path))
