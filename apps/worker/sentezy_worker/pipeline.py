from __future__ import annotations

import re
import subprocess
import tempfile

from .audio import mux_audio
from .config import Config
from .db import Db
from .matte import matte_video
from .providers.elevenlabs import ElevenLabs
from .providers.heygen import HeyGen
from .providers.reel_remotion import build_reel_props, render_reel, render_reel_local
from .storage import Storage
from .thumbnail import make_thumbnail

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
    """Download ordered B-roll — images and video clips both from R2 —
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
            storage.download(storage.image_url(ref), dest)
        # `ref` (R2 key) is kept so the Remotion engine can pass a signed URL to the renderer.
        out.append({"path": dest, "kind": kind, "ref": ref, "transition": m.get("transition")})
    return out


def _broll_segments(words: list, media: list[dict]) -> list[dict]:
    """Auto-place B-roll — no manual timeline needed. Keep a short hook at the
    start and a close at the end (avatar over the blurred backdrop, no cutaway),
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
    hook = min(1.6, total * 0.22)   # A-roll intro (see the avatar first)
    close = min(1.4, total * 0.18)  # A-roll outro (CTA on the avatar)
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
            "ref": m.get("ref"),
            "start": mid_start + i * span,
            "end": (mid_start + (i + 1) * span) if i < n - 1 else mid_end,
            "transition": m.get("transition") or "fade",
        }
        for i, m in enumerate(media)
    ]


def _resolve_music(options: dict, storage: Storage, workdir: str) -> str | None:
    track_key = ((options or {}).get("music") or {}).get("trackKey")
    if not track_key:
        return None
    dest = f"{workdir}/music.mp3"
    try:
        storage.download(storage.signed_get_url(track_key), dest)  # music stored in R2 (signed → always fetchable)
    except Exception as e:  # noqa: BLE001 — music is optional; never fail the job over a background bed
        print(f"pipeline: music download failed ({e}); continuing without music")
        return None
    return dest


def _still_avatar_video(photo_path: str, audio_path: str, out_path: str) -> None:
    """Dev-mode avatar A-roll: hold the avatar photo as a still for the audio's
    duration, muxing the voice in. A drop-in for the HeyGen talking video so the matte
    and composite stages run unchanged — no lip-sync, no HeyGen credits."""
    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error",
            "-loop", "1", "-i", photo_path,
            "-i", audio_path,
            # even dims required by yuv420p; -tune stillimage keeps the single frame crisp
            "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-tune", "stillimage", "-r", "25",
            "-c:a", "aac", "-shortest",
            out_path,
        ],
        check=True,
    )


def decide_tone_route(options: dict, script: str, has_llm_key: bool) -> tuple[str, str | None]:
    """How the drawer's "Ses tonu" reaches the TTS call → (route, tone).

    "passthrough"  — no tone set, or the script already carries v3 tags (the wizard's
                     per-sentence emotion pass must win over a blanket leading tag).
    "llm"          — an LLM key is configured; emotion.add_emotion_tags inserts per-sentence tags.
    "leading-tag"  — no LLM key; the tone becomes a single leading v3 tag on the script.
    """
    tone = ((options.get("voice") or {}).get("emotion")) or ""
    already_tagged = bool(re.search(r"\[[a-zA-Z]", script))
    if not tone or already_tagged:
        return ("passthrough", None)
    return ("llm", tone) if has_llm_key else ("leading-tag", tone)


def read_avatar_position(layout: dict) -> str:
    """Where the avatar sits: "left" | "center" | "right".

    Drafts written before 2026-07-19 store avatarLayout("side"|"bottom") + avatarSide
    instead, so map those forward: bottom → center, otherwise the stored side.
    """
    pos = layout.get("avatarPosition")
    if pos in ("left", "center", "right"):
        return pos
    if layout.get("avatarLayout") == "bottom":
        return "center"
    return "left" if layout.get("avatarSide") == "left" else "right"


def process_video(video_id: str, cfg: Config, db: Db, storage: Storage, el: ElevenLabs, hg: HeyGen) -> None:
    video = db.get_video(video_id)
    if not video:
        raise RuntimeError(f"video_not_found: {video_id}")
    if video["status"] == "ready":
        return

    # Avatar is OPTIONAL — a faceless reel (no avatar) is B-roll + captions + voice only.
    avatar = db.get_avatar(video["avatar_id"]) if video.get("avatar_id") else None
    voice = db.get_voice(video["voice_id"])
    if not voice:
        raise RuntimeError("missing_voice")

    width, height = RATIO_DIMS.get(video["aspect_ratio"], (1080, 1920))
    options = video.get("options") or {}
    workdir = tempfile.mkdtemp(prefix=f"sentezy-{video_id}-")

    # 1) TTS (audio + word timings)
    db.set_stage(video_id, "tts", 10)
    audio_path = f"{workdir}/audio.mp3"
    script = video["script"]
    emotion_tag: str | None = None
    has_llm_key = bool(cfg.openrouter_api_key or cfg.anthropic_api_key)
    route, tone = decide_tone_route(options, script, has_llm_key)
    if route == "llm":
        # LLM pass: insert per-sentence v3 audio tags matching the tone (OpenRouter/free
        # preferred, Anthropic fallback; falls back to the plain script on any failure).
        # Tags are stripped from captions later.
        from .emotion import add_emotion_tags
        script = add_emotion_tags(
            script, tone,
            openrouter_key=cfg.openrouter_api_key, openrouter_model=cfg.openrouter_model,
            anthropic_key=cfg.anthropic_api_key,
        )
    elif route == "leading-tag":
        emotion_tag = tone  # no LLM key → a single leading tag sets the tone
    words = el.tts_with_timestamps(script, voice["elevenlabs_voice_id"], audio_path, emotion_tag=emotion_tag)
    audio_key = f"audio/{video_id}.mp3"
    storage.upload_r2(audio_path, audio_key, "audio/mpeg")
    audio_url = storage.signed_get_url(audio_key, 86400)  # HeyGen must fetch this; R2_PUBLIC_URL is the S3 endpoint, not public

    # 2) Avatar A-roll (skipped for faceless reels). Prod: HeyGen Avatar IV turns the avatar
    #    photo + audio into a talking video (Avatar IV takes the image URL directly). Dev
    #    (NODE_ENV=development): skip HeyGen — hold the avatar photo as a still for the audio's
    #    length. Then 2b) matte it to a video-only WebM cutout the renderer composites over B-roll.
    avatar_cutout_path: str | None = None
    if avatar:
        db.set_stage(video_id, "avatar", 35)
        image_url = storage.image_url(avatar["source_image_id"])
        avatar_path = f"{workdir}/avatar.mp4"
        if cfg.is_dev:
            photo_path = f"{workdir}/avatar_src.png"
            storage.download(image_url, photo_path)
            _still_avatar_video(photo_path, audio_path, avatar_path)
        else:
            aspect_ratio = ASPECT_FROM_DIMS.get((width, height), "9:16")
            heygen_video_id = hg.generate(image_url, audio_url, aspect_ratio)
            heygen_url = hg.wait_for_url(heygen_video_id)
            storage.download(heygen_url, avatar_path)

        db.set_stage(video_id, "avatar", 55)
        avatar_cutout_path = f"{workdir}/avatar_cutout.webm"
        matte_video(avatar_path, avatar_cutout_path)

    # 3) Render the reel — ONE Remotion composition (avatar + B-roll + transitions + captions)
    #    → opaque H.264. Identical to the in-app <Player> preview by construction.
    db.set_stage(video_id, "compose", 70)
    layout = options.get("layout") or {}
    avatar_position = read_avatar_position(layout)
    caps = options.get("captions", True)
    if isinstance(caps, bool):  # legacy drafts store captions as a plain boolean
        caps = {"enabled": caps}
    captions_on = caps.get("enabled", True)
    cap_style = caps.get("style", "karaoke")
    cap_font = caps.get("font") or "General Sans"
    cap_color = caps.get("color")
    cap_position = layout.get("captionPosition", "bottom")

    broll_media = _resolve_broll_media(options, storage, workdir)
    segments = _broll_segments(words, broll_media)  # used for SFX slide timing (audio parity)

    # Upload the matted avatar (if any) so the renderer can fetch it (signed R2 GET), then sign
    # B-roll. Faceless reels have no cutout → avatar_url stays None (the Reel fills with B-roll).
    avatar_signed = None
    if avatar_cutout_path:
        cutout_key = f"cutouts/{video_id}.webm"
        storage.upload_r2(avatar_cutout_path, cutout_key, "video/webm")
        avatar_signed = storage.signed_get_url(cutout_key, 86400)
    broll_props = [
        {"url": storage.signed_get_url(b["ref"], 86400) if b.get("kind") == "video" else storage.image_url(b["ref"]),
         "kind": b.get("kind", "image"), "transition": b.get("transition")}
        for b in broll_media if b.get("ref")
    ]

    props = build_reel_props(
        words, avatar_url=avatar_signed, broll=broll_props,
        style=cap_style, font=cap_font, color=cap_color,
        avatar_position=avatar_position, position=cap_position,
        captions=captions_on, width=width, height=height, fps=30,
    )
    reel_video = f"{workdir}/reel_video.mp4"
    if cfg.reel_renderer_url:
        render_reel(cfg.reel_renderer_url, storage, props, job_id=video_id, dest=reel_video)
    else:
        render_reel_local(props, dest=reel_video, workdir=workdir)

    # 3b) Audio bed: voice + ducked music + transition SFX (ffmpeg; video stream-copied).
    effects = options.get("effects") or {}
    transition_sfx = effects.get("transitionSfx", True)
    music_path = _resolve_music(options, storage, workdir)
    music_volume = float((options.get("music") or {}).get("volume", 0.15))

    reel_path = f"{workdir}/reel.mp4"
    mux_audio(
        reel_video, audio_path, reel_path,
        music_path=music_path, music_volume=music_volume,
        broll=segments, transition_sfx=transition_sfx,
    )

    # 4) Thumbnail + upload
    db.set_stage(video_id, "thumbnail", 88)
    thumb_path = f"{workdir}/thumb.jpg"
    make_thumbnail(reel_path, thumb_path)
    out_key = f"videos/{video_id}.mp4"
    storage.upload_r2(reel_path, out_key, "video/mp4")
    thumb_key = f"thumbnails/{video_id}.jpg"
    storage.upload_r2(thumb_path, thumb_key, "image/jpeg")

    db.set_ready(video_id, out_key, thumb_key, _ffprobe_duration(reel_path))

    # Free intermediate R2 artifacts — only the final video + thumbnail are kept. The TTS audio,
    # the matted avatar cutout, and the renderer's opaque reel were needed only during rendering.
    for key in (audio_key, f"cutouts/{video_id}.webm", f"reels/{video_id}.mp4"):
        try:
            storage.delete_r2(key)
        except Exception as e:  # noqa: BLE001 — cleanup is best-effort, never fail a finished job
            print(f"pipeline: R2 cleanup failed for {key} ({e})")
