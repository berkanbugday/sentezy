"""ffmpeg reel composition — stdlib only (no third-party deps), so it can be
verified independently of Redis/DB/providers.

Builds a 9:16 reel: background (solid color or image) + the presenter clip (which
already carries the ElevenLabs voice audio from HeyGen), burned word-synced captions,
optional logo overlay and ducked music bed. Also extracts a poster thumbnail.
"""

from __future__ import annotations

import subprocess
from dataclasses import dataclass


@dataclass
class Word:
    text: str
    start: float  # seconds
    end: float


def _run(cmd: list[str]) -> None:
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if proc.returncode != 0:
        tail = proc.stderr.decode("utf-8", "replace")[-2000:]
        raise RuntimeError(f"ffmpeg failed ({proc.returncode}):\n{tail}")


_FILTERS: set[str] | None = None


def has_filter(name: str) -> bool:
    """Whether this ffmpeg build exposes a given filter (e.g. 'subtitles' needs libass)."""
    global _FILTERS
    if _FILTERS is None:
        out = subprocess.run(["ffmpeg", "-hide_banner", "-filters"], capture_output=True)
        _FILTERS = {
            line.split()[1]
            for line in out.stdout.decode("utf-8", "replace").splitlines()
            if len(line.split()) >= 2 and line.startswith(" ")
        }
    return name in _FILTERS


def _ass_time(t: float) -> str:
    cs = max(0, int(round(t * 100)))
    h, cs = divmod(cs, 360000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def _hex_to_ass(color: str) -> str:
    """#RRGGBB -> ASS &HBBGGRR& (ASS is BGR)."""
    c = color.lstrip("#")
    if len(c) != 6:
        c = "FFFFFF"
    r, g, b = c[0:2], c[2:4], c[4:6]
    return f"&H00{b}{g}{r}".upper()


def build_captions_ass(
    words: list[Word],
    path: str,
    *,
    width: int = 1080,
    height: int = 1920,
    per_chunk: int = 3,
    accent: str = "#7C86E8",
) -> None:
    """Write an ASS subtitle file grouping words into short caption chunks."""
    font_size = max(36, int(height * 0.045))
    margin_v = int(height * 0.16)
    primary = "&H00FFFFFF"  # white
    outline = "&H00000000"  # black
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {height}
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV
Style: Cap,General Sans,{font_size},{primary},{outline},&H64000000,1,1,4,0,2,60,60,{margin_v}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    lines: list[str] = []
    for i in range(0, len(words), per_chunk):
        chunk = words[i : i + per_chunk]
        if not chunk:
            continue
        start = _ass_time(chunk[0].start)
        end = _ass_time(chunk[-1].end)
        text = " ".join(w.text for w in chunk).replace("\n", " ")
        lines.append(f"Dialogue: 0,{start},{end},Cap,,0,0,0,,{text}")
    with open(path, "w", encoding="utf-8") as f:
        f.write(header + "\n".join(lines) + "\n")
    _ = _hex_to_ass(accent)  # reserved for a future highlight style


def compose_reel(
    *,
    avatar_path: str,
    out_path: str,
    width: int = 1080,
    height: int = 1920,
    background: dict | None = None,  # {"type": "color"|"image", "value": hex, "paths": [str, ...]}
    captions_ass: str | None = None,
    logo_path: str | None = None,
    music_path: str | None = None,
    music_volume: float = 0.15,
    duration: float | None = None,  # video length; splits a multi-image slideshow evenly
) -> None:
    background = background or {"type": "color", "value": "#0B0B0D"}

    inputs: list[str] = ["-i", avatar_path]  # [0] presenter clip (+ its voice audio)
    idx = 1

    # [1..] background — a color, one image, or several images as a slideshow
    bg_paths = background.get("paths") if background.get("type") == "image" else None
    if bg_paths:
        seg = (duration / len(bg_paths)) if (duration and len(bg_paths) > 1) else None
        for p in bg_paths:
            inputs += (["-loop", "1", "-t", f"{seg:.3f}", "-i", p] if seg else ["-loop", "1", "-i", p])
        bg_idxs = list(range(idx, idx + len(bg_paths)))
        idx += len(bg_paths)
    else:
        color = (background.get("value") or "#0B0B0D").lstrip("#")
        inputs += ["-f", "lavfi", "-i", f"color=c=0x{color}:s={width}x{height}:r=30"]
        bg_idxs = [idx]
        idx += 1

    logo_idx = None
    if logo_path:
        inputs += ["-loop", "1", "-i", logo_path]
        logo_idx = idx
        idx += 1

    music_idx = None
    if music_path:
        inputs += ["-i", music_path]
        music_idx = idx
        idx += 1

    # ── video filtergraph ──
    fc: list[str] = []
    _sc = f"scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},setsar=1"
    if len(bg_idxs) > 1:
        # scale/crop each image, then concat into a slideshow that spans the clip
        for k, bi in enumerate(bg_idxs):
            fc.append(f"[{bi}:v]{_sc},fps=30[bgi{k}]")
        fc.append("".join(f"[bgi{k}]" for k in range(len(bg_idxs))) + f"concat=n={len(bg_idxs)}:v=1:a=0[bg]")
    else:
        fc.append(f"[{bg_idxs[0]}:v]{_sc}[bg]")
    # presenter scaled to ~90% width, centered
    fc.append(f"[0:v]scale={int(width*0.92)}:-2[av]")
    fc.append("[bg][av]overlay=(W-w)/2:(H-h)/2[v1]")
    last = "[v1]"
    if captions_ass and has_filter("subtitles"):
        esc = captions_ass.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")
        fc.append(f"{last}subtitles={esc}[v2]")
        last = "[v2]"
    elif captions_ass:
        # ffmpeg built without libass (e.g. local dev) — skip burn-in; Docker image has it.
        print("compose: 'subtitles' filter unavailable (no libass) — skipping captions")
    if logo_idx is not None:
        fc.append(f"[{logo_idx}:v]scale=160:-1[logo]")
        fc.append(f"{last}[logo]overlay=W-w-48:48[v3]")
        last = "[v3]"

    # ── audio ──
    audio_map: list[str]
    if music_idx is not None:
        fc.append(f"[{music_idx}:a]volume={music_volume}[mus]")
        fc.append("[0:a][mus]amix=inputs=2:duration=first:dropout_transition=0[a]")
        audio_map = ["-map", "[a]"]
    else:
        audio_map = ["-map", "0:a?"]

    cmd = [
        "ffmpeg", "-y", *inputs,
        "-filter_complex", ";".join(fc),
        "-map", last,
        *audio_map,
        "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k",
        "-shortest", "-movflags", "+faststart",
        out_path,
    ]
    _run(cmd)


def make_thumbnail(video_path: str, out_path: str, *, at: str = "00:00:01") -> None:
    _run(["ffmpeg", "-y", "-ss", at, "-i", video_path, "-frames:v", "1", "-q:v", "3", out_path])
