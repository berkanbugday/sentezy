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
    avatar_side: str = "right",
    position: str = "bottom",
) -> None:
    """Write an ASS subtitle file with word-by-word karaoke highlighting: each
    word pops from a dimmed white to bright white the moment it's spoken (the
    premium reels caption style), grouped into short chunks. Captions sit on the
    clear side (opposite the presenter), at the top or bottom."""
    font_size = max(36, int(height * 0.045))
    # keep captions off the presenter: reserve the presenter's half horizontally,
    # so the text centres in the clear half.
    reserve = int(width * 0.50)
    edge = int(width * 0.06)
    margin_l, margin_r = (edge, reserve) if avatar_side == "right" else (reserve, edge)
    alignment = 8 if position == "top" else 2  # 8 = top-centre, 2 = bottom-centre
    margin_v = int(height * (0.10 if position == "top" else 0.12))
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
Style: Cap,General Sans,{font_size},{primary},{secondary},{outline},{back},1,0,0,0,100,100,0,0,1,5,0,{alignment},{margin_l},{margin_r},{margin_v},1

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


def _duration(path: str) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
        capture_output=True, text=True, check=True).stdout.strip()
    return float(out or 0.0)


def compose_reel(
    *,
    presenter_path: str,  # matted alpha .mov (presenter cut-out + voice) from matte.matte_video_to_mov
    out_path: str,
    width: int = 1080,
    height: int = 1920,
    broll: list[dict] | None = None,  # [{"path": str, "start": float, "end": float}] — auto-timed backgrounds
    captions_ass: str | None = None,
    logo_path: str | None = None,
    music_path: str | None = None,
    music_volume: float = 0.15,
    avatar_side: str = "right",  # which side the presenter is framed to
    presenter_scale: float = 0.66,  # presenter height as a fraction of the frame
    bg_color: str = "0x101319",  # branded background shown wherever B-roll isn't
) -> None:
    """Cut-out reel composite: B-roll fills the frame (over a branded background),
    the matted presenter is framed to one side (bottom-anchored, always visible),
    and captions burn on top. The presenter's alpha is used to blend the cut-out
    over whatever is behind — no rectangular PiP edge."""
    broll = broll or []
    dur = _duration(presenter_path)

    # [0] branded background base (shown during hook/close, or if no B-roll uploaded)
    inputs: list[str] = ["-f", "lavfi", "-i", f"color=c={bg_color}:s={width}x{height}:r=30:d={dur:.3f}"]
    # [1] presenter cut-out (alpha video) + voice audio
    inputs += ["-i", presenter_path]
    presenter_idx = 1
    idx = 2

    # [2..] B-roll stills — looped so a frame exists across their window.
    broll_idxs: list[int] = []
    for b in broll:
        d = max(0.3, float(b["end"]) - float(b["start"]))
        inputs += ["-loop", "1", "-t", f"{d:.3f}", "-i", b["path"]]
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
    fc.append(f"[0:v]setsar=1,fps=30[base]")
    last = "[base]"
    # B-roll fills the frame behind the presenter — gated to its window, crossfaded
    # (alpha) and slowly pushed in (Ken-Burns) so it feels produced.
    for k, bi in enumerate(broll_idxs):
        b = broll[k]
        st = float(b["start"])
        en = float(b["end"])
        d = max(0.3, en - st)
        fd = min(0.22, max(0.05, d / 3))
        inc = max(0.0004, 0.10 / (d * 30.0))
        fc.append(
            f"[{bi}:v]{cover},"
            f"zoompan=z='min(zoom+{inc:.5f},1.12)':d=1:"
            f"x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={width}x{height}:fps=30,"
            f"format=yuva420p,"
            f"fade=t=in:st=0:d={fd:.3f}:alpha=1,"
            f"fade=t=out:st={d - fd:.3f}:d={fd:.3f}:alpha=1,"
            f"setpts=PTS-STARTPTS+{st:.3f}/TB[brl{k}]"
        )
        fc.append(f"{last}[brl{k}]overlay=0:0:enable='between(t,{st:.3f},{en:.3f})'[bv{k}]")
        last = f"[bv{k}]"
    # presenter cut-out, scaled and framed to one side, bottom-anchored; its alpha
    # blends it over the B-roll/background.
    ph = int(height * presenter_scale)
    px = "-40" if avatar_side == "left" else "W-w+40"  # slight bleed off the chosen edge
    fc.append(f"[{presenter_idx}:v]scale=-2:{ph}:flags=lanczos,setsar=1[pv]")
    fc.append(f"{last}[pv]overlay=x={px}:y=H-h[pp]")
    last = "[pp]"
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

    # ── audio: presenter voice (+ optional ducked music) ──
    audio_map: list[str]
    if music_idx is not None:
        fc.append(f"[{music_idx}:a]volume={music_volume}[mus]")
        fc.append(f"[{presenter_idx}:a][mus]amix=inputs=2:duration=first:dropout_transition=0[a]")
        audio_map = ["-map", "[a]"]
    else:
        audio_map = ["-map", f"{presenter_idx}:a?"]

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
