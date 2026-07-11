"""ffmpeg reel composition — stdlib only (no third-party deps), so it can be
verified independently of Redis/DB/providers.

Builds a 9:16 reel in the cut-out model: the matted presenter (alpha .mov carrying
the ElevenLabs voice) is framed to one side over auto-timed full-frame B-roll
cutaways (crossfade + Ken-Burns); a blurred first B-roll image backs the A-roll
hook/close beats. Word-synced captions (karaoke / hormozi / clean styles) burn on
top, plus an optional logo and a sidechain-ducked music bed. Also extracts a
poster thumbnail.
"""

from __future__ import annotations

import os
import subprocess
from dataclasses import dataclass

# Bundled brand fonts (apps/worker/fonts) — handed to libass via `fontsdir` so
# caption burn-in uses General Sans even without a system-wide font install.
_FONTS_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "fonts"))


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


def _hex_to_ass(hex_color: str) -> str:
    """'#RRGGBB' → ASS '&H00BBGGRR' (ASS colours are BGR)."""
    r, g, b = hex_color[1:3], hex_color[3:5], hex_color[5:7]
    return f"&H00{b}{g}{r}".upper()


def _tr_upper(text: str) -> str:
    """Turkish-aware uppercase: i→İ and ı→I (plain .upper() breaks dotted/dotless i)."""
    return text.translate(str.maketrans("iı", "İI")).upper()


# Per-style caption specs (viral UGC reference looks):
#   karaoke — word-by-word \k sweep, dimmed→bright (the current premium style)
#   hormozi — big, uppercase, 2-word chunks, the spoken word pops in an accent colour
#   clean   — whole short phrase, plain white, no sweep
_CAPTION_STYLES = {
    "karaoke": {"chunk": 3, "scale": 0.045, "min_size": 36, "bold": 1, "outline": 5, "shadow": 0},
    "hormozi": {"chunk": 2, "scale": 0.062, "min_size": 48, "bold": 1, "outline": 7, "shadow": 2},
    "clean": {"chunk": 5, "scale": 0.042, "min_size": 34, "bold": 0, "outline": 4, "shadow": 0},
}
_HORMOZI_ACCENT = "#FFD54A"  # default highlight — the reference yellow


def build_captions_ass(
    words: list[Word],
    path: str,
    *,
    width: int = 1080,
    height: int = 1920,
    avatar_side: str = "right",
    position: str = "bottom",
    style: str = "karaoke",
    font: str = "General Sans",
    color: str | None = None,
) -> None:
    """Write an ASS subtitle file in one of the caption styles above. Captions sit
    on the clear side (opposite the presenter), at the top or bottom."""
    if style not in _CAPTION_STYLES:
        style = "karaoke"
    spec = _CAPTION_STYLES[style]
    font_size = max(spec["min_size"], int(height * spec["scale"]))
    # keep captions off the presenter: reserve the presenter's half horizontally,
    # so the text centres in the clear half.
    reserve = int(width * 0.50)
    edge = int(width * 0.06)
    margin_l, margin_r = (edge, reserve) if avatar_side == "right" else (reserve, edge)
    alignment = 8 if position == "top" else 2  # 8 = top-centre, 2 = bottom-centre
    if position == "top":
        margin_v = int(height * 0.10)
    else:
        # hormozi rides higher off the bottom edge (chunky text placement, per refs)
        margin_v = int(height * (0.18 if style == "hormozi" else 0.12))
    white = "&H00FFFFFF"
    primary = _hex_to_ass(color) if (style == "karaoke" and color) else white
    secondary = "&H70FFFFFF"  # karaoke: upcoming word — dimmed white (0x70 alpha)
    outline = "&H00000000"    # black outline
    back = "&H64000000"
    accent = _hex_to_ass(color or _HORMOZI_ACCENT)
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {height}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,{font},{font_size},{primary},{secondary},{outline},{back},{spec["bold"]},0,0,0,100,100,0,0,1,{spec["outline"]},{spec["shadow"]},{alignment},{margin_l},{margin_r},{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    per_chunk = spec["chunk"]
    lines: list[str] = []
    for i in range(0, len(words), per_chunk):
        chunk = words[i : i + per_chunk]
        if not chunk:
            continue
        texts = [w.text.replace(chr(10), " ") for w in chunk]
        if style == "hormozi":
            texts = [_tr_upper(t) for t in texts]
            # One Dialogue event per word window: the whole chunk stays visible
            # white, the word being spoken pops in the accent colour.
            for j, w in enumerate(chunk):
                start = _ass_time(w.start)
                end = _ass_time(chunk[j + 1].start if j + 1 < len(chunk) else chunk[-1].end)
                parts = [
                    f"{{\\c{accent}&}}{t}{{\\c{white}&}}" if k == j else t
                    for k, t in enumerate(texts)
                ]
                lines.append(f"Dialogue: 0,{start},{end},Cap,,0,0,0,,{' '.join(parts)}")
            continue
        start = _ass_time(chunk[0].start)
        end = _ass_time(chunk[-1].end)
        if style == "clean":
            lines.append(f"Dialogue: 0,{start},{end},Cap,,0,0,0,,{' '.join(texts)}")
            continue
        # karaoke: \k<centiseconds> per word → the highlight sweeps at each word boundary.
        parts = []
        for j, w in enumerate(chunk):
            nxt = chunk[j + 1].start if j + 1 < len(chunk) else w.end
            k_cs = max(1, int(round((nxt - w.start) * 100)))
            parts.append(f"{{\\k{k_cs}}}{texts[j]} ")
        lines.append(f"Dialogue: 0,{start},{end},Cap,,0,0,0,,{''.join(parts).rstrip()}")
    with open(path, "w", encoding="utf-8") as f:
        f.write(header + "\n".join(lines) + "\n")


def _duration(path: str) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
        capture_output=True, text=True, check=True).stdout.strip()
    return float(out or 0.0)


# Creator-selectable B-roll transitions. Kept to xfade names present in the worker's
# ffmpeg (Debian ffmpeg 5.x) so a render never fails on an unknown transition. The
# synthetic "cut" maps to a near-instant fade. Anything not here falls back to "fade".
_XFADE_TRANSITIONS = frozenset({
    "fade", "fadeblack", "fadewhite", "fadegrays", "distance", "dissolve", "pixelize", "radial", "zoomin",
    "wipeleft", "wiperight", "wipeup", "wipedown", "wipetl", "wipetr", "wipebl", "wipebr",
    "slideleft", "slideright", "slideup", "slidedown",
    "smoothleft", "smoothright", "smoothup", "smoothdown",
    "circleopen", "circleclose", "circlecrop", "rectcrop",
    "horzopen", "horzclose", "vertopen", "vertclose",
    "diagbl", "diagbr", "diagtl", "diagtr",
    "hlslice", "hrslice", "vuslice", "vdslice",
    "squeezev", "squeezeh",
})


def _xfade(name: str | None, span_min: float) -> tuple[str, float]:
    """Validate a creator-chosen transition against the allow-list — never interpolate a
    raw value into the filtergraph — and pick a duration. 'cut' → a near-instant fade."""
    if name == "cut":
        return "fade", 0.02
    t = name if name in _XFADE_TRANSITIONS else "fade"
    return t, min(0.35, max(0.08, span_min * 0.5))


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

    # [0] backdrop base — shown during the A-roll hook/close (and wherever B-roll isn't).
    # With B-roll: a blurred, darkened take on the first image (warm UGC look);
    # without: the flat branded color.
    if broll:
        inputs: list[str] = ["-loop", "1", "-t", f"{dur:.3f}", "-i", str(broll[0]["path"])]
    else:
        inputs = ["-f", "lavfi", "-i", f"color=c={bg_color}:s={width}x{height}:r=30:d={dur:.3f}"]
    # [1] presenter cut-out (alpha video) + voice audio
    inputs += ["-i", presenter_path]
    presenter_idx = 1
    idx = 2

    # [2..] B-roll stills — looped so a frame exists across their window.
    broll_idxs: list[int] = []
    for b in broll:
        # loop each still a bit longer than its window so xfade has overlap footage.
        d = max(0.3, float(b["end"]) - float(b["start"])) + 0.6
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
    if broll:
        fc.append(f"[0:v]{cover},boxblur=20:2,eq=brightness=-0.25[base]")
    else:
        fc.append("[0:v]setsar=1,fps=30[base]")
    last = "[base]"
    # B-roll slideshow: each photo gets a Ken-Burns push-in, and consecutive photos are
    # joined by the creator-chosen xfade transition. The finished slideshow is overlaid
    # onto the base for the mid window, easing in/out of the A-roll hook/close.
    if broll:
        mid_start = float(broll[0]["start"])
        mid_end = float(broll[-1]["end"])

        def _span(b: dict) -> float:
            return max(0.3, float(b["end"]) - float(b["start"]))

        for k, bi in enumerate(broll_idxs):
            span = _span(broll[k])
            inc = max(0.0004, 0.10 / (span * 30.0))
            fc.append(
                f"[{bi}:v]{cover},"
                f"zoompan=z='min(zoom+{inc:.5f},1.12)':d=1:"
                f"x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={width}x{height}:fps=30,"
                # no setpts here — it marks the stream VFR and xfade requires CFR inputs.
                f"format=yuv420p[p{k}]"
            )
        # xfade chain — offsets anchored to each photo's real start time so timing holds.
        slide = "[p0]"
        for k in range(1, len(broll_idxs)):
            tname, tdur = _xfade(broll[k].get("transition"), min(_span(broll[k - 1]), _span(broll[k])))
            off = max(0.0, (float(broll[k]["start"]) - mid_start) - tdur)
            fc.append(f"{slide}[p{k}]xfade=transition={tname}:duration={tdur:.3f}:offset={off:.3f}[x{k}]")
            slide = f"[x{k}]"
        # ease the whole slideshow in/out (alpha) and place it at the mid window.
        slen = max(0.3, mid_end - mid_start)
        ef = min(0.25, slen / 4)
        fc.append(
            f"{slide}format=yuva420p,"
            f"fade=t=in:st=0:d={ef:.3f}:alpha=1,"
            f"fade=t=out:st={slen - ef:.3f}:d={ef:.3f}:alpha=1,"
            f"setpts=PTS-STARTPTS+{mid_start:.3f}/TB[slide]"
        )
        fc.append(f"{last}[slide]overlay=0:0:enable='between(t,{mid_start:.3f},{mid_end:.3f})'[bv]")
        last = "[bv]"
    # presenter cut-out, scaled and framed to one side, bottom-anchored; its alpha
    # blends it over the B-roll/background.
    ph = int(height * presenter_scale)
    px = "-40" if avatar_side == "left" else "W-w+40"  # slight bleed off the chosen edge
    fc.append(f"[{presenter_idx}:v]scale=-2:{ph}:flags=lanczos,setsar=1[pv]")
    fc.append(f"{last}[pv]overlay=x={px}:y=H-h[pp]")
    last = "[pp]"
    if captions_ass and has_filter("subtitles"):
        def _esc(p: str) -> str:
            return p.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")
        if os.path.isdir(_FONTS_DIR):
            fc.append(f"{last}subtitles=filename={_esc(captions_ass)}:fontsdir={_esc(_FONTS_DIR)}[cap]")
        else:
            fc.append(f"{last}subtitles={_esc(captions_ass)}[cap]")
        last = "[cap]"
    elif captions_ass:
        # ffmpeg built without libass (e.g. local dev) — skip burn-in; Docker image has it.
        print("compose: 'subtitles' filter unavailable (no libass) — skipping captions")
    if logo_idx is not None:
        fc.append(f"[{logo_idx}:v]scale=160:-1[logo]")
        fc.append(f"{last}[logo]overlay=W-w-48:48[logov]")
        last = "[logov]"

    # ── audio: presenter voice (+ optional sidechain-ducked music) ──
    audio_map: list[str]
    if music_idx is not None:
        # Voice is consumed twice (mix + sidechain key) → split it. aformat on both
        # branches: sidechaincompress errors on mismatched rates/layouts.
        fc.append(f"[{presenter_idx}:a]aformat=sample_rates=44100:channel_layouts=stereo,asplit=2[vox][sck]")
        fc.append(f"[{music_idx}:a]aformat=sample_rates=44100:channel_layouts=stereo,volume={music_volume}[mus]")
        # The voice keys a compressor on the music, so the bed dips while speaking
        # and breathes back in pauses.
        fc.append("[mus][sck]sidechaincompress=threshold=0.04:ratio=10:attack=8:release=350:makeup=1[duck]")
        # normalize=0: keep the voice at full level (default amix would halve it).
        fc.append("[vox][duck]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[a]")
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
