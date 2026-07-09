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


def build_captions_ass(
    words: list[Word],
    path: str,
    *,
    width: int = 1080,
    height: int = 1920,
    per_chunk: int = 3,
) -> None:
    """Write an ASS subtitle file with word-by-word karaoke highlighting: each
    word pops from a dimmed white to bright white the moment it's spoken (the
    premium reels caption style), grouped into short chunks."""
    font_size = max(40, int(height * 0.048))
    margin_v = int(height * 0.16)
    primary = "&H00FFFFFF"    # spoken/active word — bright white
    secondary = "&H70FFFFFF"  # upcoming word — dimmed white (0x70 alpha)
    outline = "&H00000000"    # black outline
    back = "&H64000000"
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {height}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,General Sans,{font_size},{primary},{secondary},{outline},{back},1,0,0,0,100,100,0,0,1,5,0,2,80,80,{margin_v},1

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
        # \k<centiseconds> per word → the highlight sweeps at each word boundary.
        parts: list[str] = []
        for j, w in enumerate(chunk):
            nxt = chunk[j + 1].start if j + 1 < len(chunk) else w.end
            k_cs = max(1, int(round((nxt - w.start) * 100)))
            parts.append(f"{{\\k{k_cs}}}{w.text.replace(chr(10), ' ')} ")
        text = "".join(parts).rstrip()
        lines.append(f"Dialogue: 0,{start},{end},Cap,,0,0,0,,{text}")
    with open(path, "w", encoding="utf-8") as f:
        f.write(header + "\n".join(lines) + "\n")


def compose_reel(
    *,
    avatar_path: str,
    out_path: str,
    width: int = 1080,
    height: int = 1920,
    broll: list[dict] | None = None,  # [{"path": str, "start": float, "end": float}] — auto-timed cutaways
    captions_ass: str | None = None,
    logo_path: str | None = None,
    music_path: str | None = None,
    music_volume: float = 0.15,
) -> None:
    """A-roll / B-roll composite: the presenter fills the frame (A-roll); each
    B-roll image cuts in full-screen over its time window while the voice keeps
    playing; captions burn on top so a cutaway never hides them."""
    broll = broll or []

    inputs: list[str] = ["-i", avatar_path]  # [0] A-roll: presenter clip + its voice audio
    idx = 1

    # [1..] B-roll stills — looped so a frame exists at every timestamp; the
    # overlay's `enable` window decides when each is shown.
    broll_idxs: list[int] = []
    for b in broll:
        dur = max(0.3, float(b["end"]) - float(b["start"]))
        inputs += ["-loop", "1", "-t", f"{dur:.3f}", "-i", b["path"]]
        broll_idxs.append(idx)
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
    cover = f"scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},setsar=1,fps=30"
    # A-roll base: presenter filled to the frame
    fc.append(f"[0:v]{cover}[base]")
    last = "[base]"
    # B-roll cutaways over the base — each gated to its [start, end] window and
    # crossfaded in/out (alpha) so the cut feels produced, not abrupt.
    for k, bi in enumerate(broll_idxs):
        b = broll[k]
        st = float(b["start"])
        en = float(b["end"])
        dur = max(0.3, en - st)
        fd = min(0.22, max(0.05, dur / 3))  # crossfade duration
        inc = max(0.0004, 0.10 / (dur * 30.0))  # slow Ken-Burns push-in (~10% over the window)
        fc.append(
            f"[{bi}:v]{cover},"
            f"zoompan=z='min(zoom+{inc:.5f},1.12)':d=1:"
            f"x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={width}x{height}:fps=30,"
            f"format=yuva420p,"
            f"fade=t=in:st=0:d={fd:.3f}:alpha=1,"
            f"fade=t=out:st={dur - fd:.3f}:d={fd:.3f}:alpha=1,"
            f"setpts=PTS-STARTPTS+{st:.3f}/TB[brl{k}]"
        )
        fc.append(f"{last}[brl{k}]overlay=0:0:enable='between(t,{st:.3f},{en:.3f})'[bv{k}]")
        last = f"[bv{k}]"
    if captions_ass and has_filter("subtitles"):
        esc = captions_ass.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")
        fc.append(f"{last}subtitles={esc}[cap]")
        last = "[cap]"
    elif captions_ass:
        # ffmpeg built without libass (e.g. local dev) — skip burn-in; Docker image has it.
        print("compose: 'subtitles' filter unavailable (no libass) — skipping captions")
    if logo_idx is not None:
        fc.append(f"[{logo_idx}:v]scale=160:-1[logo]")
        fc.append(f"{last}[logo]overlay=W-w-48:48[logov]")
        last = "[logov]"

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
