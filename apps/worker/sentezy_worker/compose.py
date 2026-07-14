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
_SFX_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "sfx"))


def _transition_sfx_files() -> list[str]:
    """Bundled transition sound effects (sfx/*.mp3…), sorted — cycled across the
    photo transitions for variety. Empty list when the directory is missing."""
    if not os.path.isdir(_SFX_DIR):
        return []
    return sorted(
        os.path.join(_SFX_DIR, f)
        for f in os.listdir(_SFX_DIR)
        if f.lower().endswith((".mp3", ".wav", ".m4a", ".ogg", ".aac"))
    )


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


# Common Turkish/English function words — skipped when picking a phrase's accent keyword.
_STOPWORDS = {
    "ve", "ile", "bir", "bu", "şu", "o", "da", "de", "ki", "mi", "mı", "mu", "mü", "için",
    "ama", "çok", "en", "gibi", "ya", "ne", "her", "daha", "kadar", "sonra", "artık",
    "the", "a", "an", "to", "of", "is", "are", "and", "or", "in", "on", "it", "you", "your",
}


def _keyword_index(chunk: list["Word"]) -> int:
    """Pick the phrase's semantic keyword — the longest non-stopword — to accent-colour
    (a CapCut/UGC look where one important word pops per phrase). Falls back to the longest."""
    best_i, best_len, fallback_i, fallback_len = -1, -1, 0, -1
    for i, w in enumerate(chunk):
        t = w.text.strip(".,!?…:;\"'()").lower()
        if len(t) > fallback_len:
            fallback_len, fallback_i = len(t), i
        if t in _STOPWORDS:
            continue
        if len(t) > best_len:
            best_len, best_i = len(t), i
    return best_i if best_i >= 0 else fallback_i


# Per-style caption specs (viral UGC reference looks):
#   karaoke — word-by-word \k sweep, dimmed→bright (the current premium style)
#   hormozi — big, uppercase, 2-word chunks, the spoken word pops in an accent colour
#   clean   — whole short phrase, plain white, no sweep
# `kind` drives how each chunk is rendered:
#   karaoke — word-by-word \k sweep (dim → bright)
#   wordpop — whole chunk stays white, the spoken word pops in the accent colour
#             (upper=UPPERCASE, pop=scale-bounce on the active word — TikTok/Beast feel)
#   phrase  — plain short phrase, no per-word emphasis
#   box     — phrase inside an opaque box (CapCut "bubble")
_CAPTION_STYLES = {
    "karaoke": {"chunk": 3, "scale": 0.045, "min_size": 36, "bold": 1, "outline": 5, "shadow": 0, "kind": "karaoke"},
    "hormozi": {"chunk": 2, "scale": 0.062, "min_size": 48, "bold": 1, "outline": 7, "shadow": 2, "kind": "wordpop", "upper": True},
    "clean":   {"chunk": 5, "scale": 0.042, "min_size": 34, "bold": 0, "outline": 4, "shadow": 0, "kind": "phrase"},
    # TikTok auto-caption look — word-by-word, active word pops in the accent colour.
    "tiktok":  {"chunk": 3, "scale": 0.050, "min_size": 40, "bold": 1, "outline": 6, "shadow": 1, "kind": "wordpop", "pop": True},
    # MrBeast — huge uppercase, 1–2 words, punchy scale pop.
    "beast":   {"chunk": 2, "scale": 0.078, "min_size": 56, "bold": 1, "outline": 9, "shadow": 2, "kind": "wordpop", "upper": True, "pop": True},
    # CapCut "bubble" — short phrase inside an opaque rounded box.
    "boxed":   {"chunk": 4, "scale": 0.044, "min_size": 34, "bold": 1, "outline": 8, "shadow": 0, "kind": "box"},
    # Keyword accent — whole phrase white, the one important word stays in the accent
    # colour the whole phrase, and the spoken word gives a subtle scale pop (UGC/CapCut).
    "keyword": {"chunk": 4, "scale": 0.050, "min_size": 40, "bold": 1, "outline": 6, "shadow": 1, "kind": "keyword"},
}
_HORMOZI_ACCENT = "#FFD54A"  # default highlight — the reference yellow

# Transition SFX (whoosh) mix level, 0..1 of full scale.
SFX_VOLUME = 0.20


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
    presenter_pos: str = "side",
) -> None:
    """Write an ASS subtitle file in one of the caption styles above. In the "side"
    layout captions sit on the clear side opposite the presenter; in the "bottom"
    layout the presenter is bottom-centred, so captions span the full width, placed
    high over the top-band B-roll (well above the presenter's head)."""
    if style not in _CAPTION_STYLES:
        style = "karaoke"
    spec = _CAPTION_STYLES[style]
    font_size = max(spec["min_size"], int(height * spec["scale"]))
    edge = int(width * 0.06)
    if presenter_pos == "bottom":
        # full-width, top-anchored; margin_v sets how far down into the B-roll band.
        margin_l = margin_r = edge
        alignment = 8
        margin_v = int(height * (0.08 if position == "top" else 0.34))
    else:
        # keep captions off the presenter: reserve the presenter's half horizontally,
        # so the text centres in the clear half.
        reserve = int(width * 0.50)
        margin_l, margin_r = (edge, reserve) if avatar_side == "right" else (reserve, edge)
        alignment = 8 if position == "top" else 2  # 8 = top-centre, 2 = bottom-centre
        if position == "top":
            margin_v = int(height * 0.10)
        else:
            # hormozi rides higher off the bottom edge (chunky text placement, per refs)
            margin_v = int(height * (0.18 if style == "hormozi" else 0.12))
    kind = spec.get("kind", "karaoke")
    white = "&H00FFFFFF"
    primary = _hex_to_ass(color) if (style == "karaoke" and color) else white
    secondary = "&H70FFFFFF"  # karaoke: upcoming word — dimmed white (0x70 alpha)
    outline = "&H00000000"    # black outline
    # box styles paint an opaque backdrop (BorderStyle 3); others use a soft shadow box.
    border_style = 3 if kind == "box" else 1
    back = "&HA0000000" if kind == "box" else "&H64000000"
    accent = _hex_to_ass(color or _HORMOZI_ACCENT)
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {height}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,{font},{font_size},{primary},{secondary},{outline},{back},{spec["bold"]},0,0,0,100,100,0,0,{border_style},{spec["outline"]},{spec["shadow"]},{alignment},{margin_l},{margin_r},{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    per_chunk = spec["chunk"]
    upper = spec.get("upper", False)
    do_pop = spec.get("pop", False)
    lines: list[str] = []
    for i in range(0, len(words), per_chunk):
        chunk = words[i : i + per_chunk]
        if not chunk:
            continue
        texts = [w.text.replace(chr(10), " ") for w in chunk]
        if upper:
            texts = [_tr_upper(t) for t in texts]
        if kind == "wordpop":
            # One Dialogue event per word window: the chunk stays white, the spoken
            # word pops in the accent colour (and scales up briefly when `pop`).
            for j, w in enumerate(chunk):
                start = _ass_time(w.start)
                end = _ass_time(chunk[j + 1].start if j + 1 < len(chunk) else chunk[-1].end)
                on = f"\\c{accent}&" + ("\\fscx120\\fscy120\\t(0,90,\\fscx100\\fscy100)" if do_pop else "")
                off = f"\\c{white}&" + ("\\fscx100\\fscy100" if do_pop else "")
                parts = [f"{{{on}}}{t}{{{off}}}" if k == j else t for k, t in enumerate(texts)]
                lines.append(f"Dialogue: 0,{start},{end},Cap,,0,0,0,,{' '.join(parts)}")
            continue
        if kind == "keyword":
            # The semantic keyword stays accent-coloured across the whole phrase; every
            # word carries an explicit colour/scale (no state bleed); the spoken word pops.
            ki = _keyword_index(chunk)
            for j, w in enumerate(chunk):
                start = _ass_time(w.start)
                end = _ass_time(chunk[j + 1].start if j + 1 < len(chunk) else chunk[-1].end)
                parts = []
                for k, t in enumerate(texts):
                    col = accent if k == ki else white
                    if k == j:
                        tag = f"\\c{col}&\\fscx115\\fscy115\\t(0,90,\\fscx100\\fscy100)"
                    else:
                        tag = f"\\c{col}&\\fscx100\\fscy100"
                    parts.append(f"{{{tag}}}{t}")
                lines.append(f"Dialogue: 0,{start},{end},Cap,,0,0,0,,{' '.join(parts)}")
            continue
        start = _ass_time(chunk[0].start)
        end = _ass_time(chunk[-1].end)
        if kind in ("phrase", "box"):
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
    avatar_side: str = "right",  # which side the presenter is framed to (side layout)
    presenter_pos: str = "side",  # "side" = framed left/right; "bottom" = centred, B-roll in a top band
    presenter_scale: float = 0.66,  # presenter height as a fraction of the frame
    bg_color: str = "0x101319",  # branded background shown wherever B-roll isn't
    transition_sfx: bool = True,  # whoosh SFX at each photo transition
) -> None:
    """Cut-out reel composite: B-roll fills the frame (over a branded background),
    the matted presenter is framed to one side (bottom-anchored, always visible),
    and captions burn on top. The presenter's alpha is used to blend the cut-out
    over whatever is behind — no rectangular PiP edge."""
    broll = broll or []
    dur = _duration(presenter_path)

    # Transition SFX: one bundled whoosh per photo transition, synced to the slide
    # start (the xfade for photo k runs over [start_k - tdur, start_k]). The files are
    # cycled for variety; photo 0 just eases in at mid_start.
    sfx_files = _transition_sfx_files() if transition_sfx else []
    sfx_times: list[float] = []
    if broll and sfx_files:
        for k, b in enumerate(broll):
            if k == 0:
                sfx_times.append(max(0.0, float(b["start"]) - 0.05))
            else:
                span_prev = max(0.3, float(broll[k - 1]["end"]) - float(broll[k - 1]["start"]))
                span_cur = max(0.3, float(b["end"]) - float(b["start"]))
                _, tdur = _xfade(b.get("transition"), min(span_prev, span_cur))
                sfx_times.append(max(0.0, float(b["start"]) - tdur))

    # [0] backdrop base — shown during the A-roll hook/close (and wherever B-roll isn't).
    # With B-roll: a blurred, darkened take on the first image (warm UGC look);
    # without: the flat branded color.
    if broll:
        # first B-roll item backs the blurred backdrop — loop a still, or stream-loop a clip.
        if broll[0].get("kind") == "video":
            inputs: list[str] = ["-stream_loop", "-1", "-t", f"{dur:.3f}", "-i", str(broll[0]["path"])]
        else:
            inputs = ["-loop", "1", "-t", f"{dur:.3f}", "-i", str(broll[0]["path"])]
    else:
        inputs = ["-f", "lavfi", "-i", f"color=c={bg_color}:s={width}x{height}:r=30:d={dur:.3f}"]
    # [1] presenter cut-out (alpha video) + voice audio
    inputs += ["-i", presenter_path]
    presenter_idx = 1
    idx = 2

    # [2..] B-roll stills — looped so a frame exists across their window.
    broll_idxs: list[int] = []
    for b in broll:
        # cover each item's window (+ a little overlap so xfade has footage). Stills loop a
        # single frame; video clips stream-loop to fill the window (their audio is ignored).
        d = max(0.3, float(b["end"]) - float(b["start"])) + 0.6
        if b.get("kind") == "video":
            inputs += ["-stream_loop", "-1", "-t", f"{d:.3f}", "-i", b["path"]]
        else:
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

    # [n..] transition SFX — one input per photo transition, cycling the bundled files
    # for variety, delayed to its slide in the audio section.
    sfx_input_idxs: list[int] = []
    for k in range(len(sfx_times)):
        inputs += ["-i", sfx_files[k % len(sfx_files)]]
        sfx_input_idxs.append(idx)
        idx += 1

    # ── video filtergraph ──
    fc: list[str] = []
    # In the "bottom" layout the sharp B-roll fills only a top band; the presenter sits
    # bottom-centre with its head overlapping the seam. The blurred base still fills the
    # whole frame (so the area around/below the presenter reads as a soft backdrop).
    broll_h = int(height * 0.58) if presenter_pos == "bottom" else height
    cover_full = f"scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},setsar=1,fps=30"
    cover_broll = f"scale={width}:{broll_h}:force_original_aspect_ratio=increase,crop={width}:{broll_h},setsar=1,fps=30"
    if broll:
        fc.append(f"[0:v]{cover_full},boxblur=20:2,eq=brightness=-0.25[base]")
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
            if broll[k].get("kind") == "video":
                # video B-roll: no Ken-Burns (it already moves) — cover-fit to CFR 30fps.
                fc.append(f"[{bi}:v]{cover_broll},fps=30,format=yuv420p[p{k}]")
                continue
            span = _span(broll[k])
            inc = max(0.0004, 0.10 / (span * 30.0))
            fc.append(
                f"[{bi}:v]{cover_broll},"
                f"zoompan=z='min(zoom+{inc:.5f},1.12)':d=1:"
                f"x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={width}x{broll_h}:fps=30,"
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
    # presenter cut-out, bottom-anchored; its alpha blends it over the B-roll/background.
    # "side" → framed left/right with a slight edge bleed; "bottom" → centred under the
    # top-band B-roll, head crossing the seam so there's no hard rectangular edge.
    if presenter_pos == "bottom":
        ph = int(height * 0.54)
        px = "(W-w)/2"
    else:
        ph = int(height * presenter_scale)
        px = "-40" if avatar_side == "left" else "W-w+40"
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

    # ── audio: presenter voice (+ optional sidechain-ducked music) (+ transition SFX) ──
    audio_map: list[str]
    need_bed = music_idx is not None or bool(sfx_input_idxs)
    if not need_bed:
        audio_map = ["-map", f"{presenter_idx}:a?"]
    else:
        # Build the voice(+music) bed, then mix in a bundled whoosh at each transition.
        if music_idx is not None:
            # Voice is consumed twice (mix + sidechain key) → split it. aformat on both
            # branches: sidechaincompress errors on mismatched rates/layouts.
            fc.append(f"[{presenter_idx}:a]aformat=sample_rates=44100:channel_layouts=stereo,asplit=2[vox][sck]")
            fc.append(f"[{music_idx}:a]aformat=sample_rates=44100:channel_layouts=stereo,volume={music_volume}[mus]")
            # The voice keys a compressor on the music, so the bed dips while speaking.
            fc.append("[mus][sck]sidechaincompress=threshold=0.04:ratio=10:attack=8:release=350:makeup=1[duck]")
            # normalize=0: keep the voice at full level (default amix would halve it).
            fc.append("[vox][duck]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[abed]")
        else:
            fc.append(f"[{presenter_idx}:a]aformat=sample_rates=44100:channel_layouts=stereo[abed]")
        if sfx_input_idxs:
            # Each SFX file → level + delay to its slide start, then mix all into the bed.
            delayed = []
            for k, in_idx in enumerate(sfx_input_idxs):
                ms = max(0, int(round(sfx_times[k] * 1000)))
                # strip any leading silence so the audible whoosh lands exactly on the slide.
                fc.append(f"[{in_idx}:a]aformat=sample_rates=44100:channel_layouts=stereo,silenceremove=start_periods=1:start_threshold=-50dB,volume={SFX_VOLUME},adelay={ms}|{ms}[wd{k}]")
                delayed.append(f"[wd{k}]")
            fc.append(f"[abed]{''.join(delayed)}amix=inputs={1 + len(delayed)}:duration=first:dropout_transition=0:normalize=0[a]")
            audio_map = ["-map", "[a]"]
        else:
            audio_map = ["-map", "[abed]"]

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
