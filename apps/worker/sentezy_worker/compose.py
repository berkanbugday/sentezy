"""ffmpeg reel composition — stdlib only save for fontTools (caption glyph metrics),
so it can be verified independently of Redis/DB/providers.

Builds a 9:16 reel in the cut-out model: the matted avatar (alpha .mov carrying
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

from fontTools.ttLib import TTFont

# Bundled brand fonts (apps/worker/fonts) — handed to libass via `fontsdir` so
# caption burn-in uses General Sans even without a system-wide font install.
_FONTS_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "fonts"))
_SFX_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "sfx"))

# Caption family → bundled font file, for glyph-width measurement (the pill/marker
# kinds draw ASS vector backgrounds that must hug the text). General Sans maps to its
# semibold weight to approximate the `Bold=1` render. Unknown families fall back to it.
_FONT_FILES = {
    "General Sans": "GeneralSans-Semibold.otf", "Anton": "Anton.ttf",
    "Archivo Black": "ArchivoBlack.ttf", "Bebas Neue": "BebasNeue.ttf",
    "Fredoka": "Fredoka.ttf", "Inter": "Inter.ttf", "Kanit": "Kanit.ttf",
    "Montserrat": "Montserrat.ttf", "Oswald": "Oswald.ttf", "Poppins": "Poppins.ttf",
    "Rubik": "Rubik.ttf", "Sora": "Sora.ttf", "Teko": "Teko.ttf",
}
_font_cache: dict[str, tuple] = {}


def _font_metrics(family: str) -> tuple:
    """(cmap, hmtx, libass_units) for a caption family; caches parsed fonts.

    `libass_units` is the design height an ASS Fontsize maps onto — usWinAscent +
    usWinDescent, NOT unitsPerEm. libass scales each glyph so Fontsize spans that
    window height, which for tall fonts (Poppins ≈1762 vs upm 1000) makes the drawn
    glyphs ~1.8× smaller than the naive em. Dividing advance widths by this window
    (not upm) makes _text_width match the pixels libass actually renders — so the
    manual pill layout wraps like the real frame instead of one word per line.
    """
    fname = _FONT_FILES.get(family) or _FONT_FILES["General Sans"]
    if fname not in _font_cache:
        tt = TTFont(os.path.join(_FONTS_DIR, fname), lazy=True)
        upm = tt["head"].unitsPerEm
        os2 = tt["OS/2"] if "OS/2" in tt else None
        units = (os2.usWinAscent + os2.usWinDescent) if os2 else upm
        _font_cache[fname] = (tt.getBestCmap(), tt["hmtx"], units)
    return _font_cache[fname]


def _text_width(family: str, text: str, size_px: float) -> float:
    """Rendered advance-width of `text` at ASS `size_px`, matched to libass's font
    scaling (see _font_metrics). Ignores kerning — absorbed by pill padding."""
    cmap, hmtx, units = _font_metrics(family)
    total = 0
    for ch in text:
        gname = cmap.get(ord(ch)) or cmap.get(ord("?")) or cmap.get(ord(" "))
        if gname is None:
            continue
        total += hmtx[gname][0]
    return total * size_px / units


def _rounded_rect(w: float, h: float, r: float) -> str:
    """ASS `\\p1` drawing path for a w×h rounded rectangle (corner radius r) from (0,0)."""
    r = max(0.0, min(r, w / 2, h / 2))
    k = r * 0.5523  # circle→cubic-bezier control offset
    def n(x: float) -> str:
        return f"{x:.0f}"
    return (
        f"m {n(r)} 0 l {n(w - r)} 0 "
        f"b {n(w - r + k)} 0 {n(w)} {n(r - k)} {n(w)} {n(r)} "
        f"l {n(w)} {n(h - r)} "
        f"b {n(w)} {n(h - r + k)} {n(w - r + k)} {n(h)} {n(w - r)} {n(h)} "
        f"l {n(r)} {n(h)} "
        f"b {n(r - k)} {n(h)} 0 {n(h - r + k)} 0 {n(h - r)} "
        f"l 0 {n(r)} "
        f"b 0 {n(r - k)} {n(r - k)} 0 {n(r)} 0"
    )


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
    # Bubble — every word wears an accent "sticker" (fat accent outline, dark text).
    # CapCut sticker-caption look; distinct from `boxed` (one box around the phrase).
    "bubble":     {"chunk": 3, "scale": 0.046, "min_size": 36, "bold": 1, "outline": 6, "shadow": 0, "kind": "bubble"},
    # Highlight — plain white phrase; the spoken word gets a filled accent marker.
    "highlight":  {"chunk": 4, "scale": 0.048, "min_size": 38, "bold": 1, "outline": 5, "shadow": 0, "kind": "highlight"},
    # Typewriter — words appear one-by-one, cumulative, no dimmed upcoming preview.
    "typewriter": {"chunk": 5, "scale": 0.044, "min_size": 34, "bold": 1, "outline": 5, "shadow": 0, "kind": "typewriter"},
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
    avatar_layout: str = "side",
) -> None:
    """Write an ASS subtitle file in one of the caption styles above. In the "side"
    layout captions sit on the clear side opposite the avatar; in the "bottom"
    layout the avatar is bottom-centred, so captions span the full width, placed
    high over the top-band B-roll (well above the avatar's head)."""
    if style not in _CAPTION_STYLES:
        style = "karaoke"
    spec = _CAPTION_STYLES[style]
    font_size = max(spec["min_size"], int(height * spec["scale"]))
    edge = int(width * 0.06)
    if avatar_layout == "bottom":
        # full-width, top-anchored; margin_v sets how far down into the B-roll band.
        margin_l = margin_r = edge
        alignment = 8
        margin_v = int(height * (0.08 if position == "top" else 0.34))
    else:
        # keep captions off the avatar: reserve the avatar's half horizontally,
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
    # box style paints an opaque backdrop (BorderStyle 3); others use a soft shadow box.
    # bubble/highlight draw their own vector pills (\p) and position via \pos, so they
    # use the plain outline style here.
    accent = _hex_to_ass(color or _HORMOZI_ACCENT)
    border_style = 3 if kind == "box" else 1
    back = "&HA0000000" if kind == "box" else "&H64000000"
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
    # Horizontal band the captions live in — same as the Style margins imply — so the
    # \pos-positioned pills (bubble/highlight) sit where centred text would.
    if avatar_layout == "bottom":
        clear_x0, clear_x1 = edge, width - edge
    else:
        reserve = int(width * 0.50)
        clear_x0, clear_x1 = (edge, width - reserve) if avatar_side == "right" else (reserve, width - edge)
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
        if kind in ("bubble", "highlight"):
            # Manual layout: measure widths, greedy-wrap into the clear band, then draw
            # vector pills (\p, Layer 0) with the text on top (Layer 1) via \pos.
            sp = _text_width(font, " ", font_size)
            wds = [_text_width(font, t, font_size) for t in texts]
            avail = clear_x1 - clear_x0
            cx = (clear_x0 + clear_x1) / 2
            line_idx: list[list[int]] = []
            cur: list[int] = []
            curw = 0.0
            for k, wpx in enumerate(wds):
                add = wpx + (sp if cur else 0)
                if cur and curw + add > avail:
                    line_idx.append(cur)
                    cur, curw, add = [], 0.0, wpx
                cur.append(k)
                curw += add
            if cur:
                line_idx.append(cur)
            line_h = int(font_size * 1.25)
            block_h = len(line_idx) * line_h
            y0 = margin_v if alignment == 8 else height - margin_v - block_h
            geo = []  # per line: (left_x, [word_left_x...], center_y, line_width)
            for li, idxs in enumerate(line_idx):
                lw = sum(wds[k] for k in idxs) + sp * (len(idxs) - 1)
                left = cx - lw / 2
                xs, x = [], left
                for k in idxs:
                    xs.append(x)
                    x += wds[k] + sp
                geo.append((left, xs, y0 + li * line_h + line_h / 2, lw))
            start = _ass_time(chunk[0].start)
            end = _ass_time(chunk[-1].end)

            if kind == "bubble":
                # One accent pill behind the whole phrase (the "fill sentence" look).
                maxlw = max(g[3] for g in geo)
                padx, pady, rad = int(font_size * 0.40), int(font_size * 0.22), int(font_size * 0.34)
                box_w, box_h = maxlw + 2 * padx, block_h + 2 * pady
                box_x, box_y = cx - box_w / 2, y0 - pady
                pill_ov = "{" + f"\\an7\\pos({box_x:.0f},{box_y:.0f})\\1c{accent}&\\bord0\\shad0\\p1" + "}"
                lines.append(f"Dialogue: 0,{start},{end},Cap,,0,0,0,,{pill_ov}{_rounded_rect(box_w, box_h, rad)}" + "{\\p0}")
                for li, idxs in enumerate(line_idx):
                    txt_ov = "{" + f"\\an5\\pos({cx:.0f},{geo[li][2]:.0f})\\1c&H000000&\\bord0\\shad0" + "}"
                    lines.append(f"Dialogue: 1,{start},{end},Cap,,0,0,0,,{txt_ov}" + " ".join(texts[k] for k in idxs))
                continue

            # highlight — white phrase; the spoken word rides a filled accent marker.
            padx, pady, rad = int(font_size * 0.20), int(font_size * 0.14), int(font_size * 0.24)
            mh = font_size + 2 * pady
            for j, w in enumerate(chunk):
                wstart = _ass_time(w.start)
                wend = _ass_time(chunk[j + 1].start if j + 1 < len(chunk) else chunk[-1].end)
                for li, idxs in enumerate(line_idx):
                    if j in idxs:
                        left, xs, cy, lw = geo[li]
                        mx, my = xs[idxs.index(j)] - padx, cy - mh / 2
                        mk_ov = "{" + f"\\an7\\pos({mx:.0f},{my:.0f})\\1c{accent}&\\bord0\\shad0\\p1" + "}"
                        lines.append(f"Dialogue: 0,{wstart},{wend},Cap,,0,0,0,,{mk_ov}{_rounded_rect(wds[j] + 2 * padx, mh, rad)}" + "{\\p0}")
                        break
                for li, idxs in enumerate(line_idx):
                    parts = ["{\\1c&H000000&}" + texts[k] + "{\\1c&HFFFFFF&}" if k == j else texts[k] for k in idxs]
                    txt_ov = "{" + f"\\an5\\pos({cx:.0f},{geo[li][2]:.0f})" + "}"
                    lines.append(f"Dialogue: 1,{wstart},{wend},Cap,,0,0,0,,{txt_ov}" + " ".join(parts))
            continue
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
        if kind == "typewriter":
            # Cumulative reveal: at word j, show words 0..j only (no dimmed preview).
            for j, w in enumerate(chunk):
                start = _ass_time(w.start)
                end = _ass_time(chunk[j + 1].start if j + 1 < len(chunk) else chunk[-1].end)
                lines.append(f"Dialogue: 0,{start},{end},Cap,,0,0,0,,{' '.join(texts[: j + 1])}")
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


# Map the curated Remotion B-roll transition ids (@sentezy/types BROLL_EFFECT_META, `transition`
# kind) → the closest ffmpeg xfade name, so the FALLBACK engine still produces a sensible
# transition. The Remotion engine renders these natively; entrance ids (zoompunch/shake/glitch/
# whip/flash) never reach here — they go through _EFFECTS/_effect_blend.
_BROLL_TO_XFADE = {
    "slide": "slideleft",
    "wipe": "wipeleft",
    "flip": "fade",       # no ffmpeg flip → clean fade
    "clockwipe": "radial",
    "iris": "circleopen",
    "zoom": "zoomin",
    "blur": "fadeblack",
    "push": "slideleft",
}


def _xfade(name: str | None, span_min: float) -> tuple[str, float]:
    """Validate a creator-chosen transition against the allow-list — never interpolate a
    raw value into the filtergraph — and pick a duration. 'cut' → a near-instant fade.
    Curated Remotion ids are mapped to their xfade equivalent first (fallback engine)."""
    if name == "cut":
        return "fade", 0.02
    name = _BROLL_TO_XFADE.get(name or "", name or "")
    t = name if name in _XFADE_TRANSITIONS else "fade"
    return t, min(0.35, max(0.08, span_min * 0.5))


# "Viral"/CapCut-style effects. These are NOT xfade transitions — each is a punchy
# *entrance* filter applied to the incoming B-roll clip (see _entrance_fx), paired with a
# snappy blend (see _effect_blend). Existing xfade names are untouched, so already-chosen
# transitions render exactly as before; only these opt-in names use the new code paths.
_EFFECTS = frozenset({"zoompunch", "shake", "glitch", "whip", "flash"})


def _entrance_fx(name: str | None, width: int, height: int) -> str:
    """Post-filters giving a finished CFR slide (width×height, 30fps) a punchy entrance.
    Returns a chain that starts with ',' — or '' for none. Only fires for _EFFECTS names;
    everything else (all xfade transitions) returns '' and keeps the classic slide."""
    # NB: zoompunch's animated zoom lives in the zoompan stage (crop/scale sizes are
    # evaluated once, not per-frame) — see the slide builder — so no post-filter here.
    if name == "shake":
        # decaying handheld shake (upscale a touch so the jitter never shows an edge)
        return (
            f",scale=w='ceil(iw*1.06)':h='ceil(ih*1.06)',"
            f"crop={width}:{height}:"
            f"x='(iw-ow)/2+10*exp(-3*t)*sin(2*PI*9*t)':"
            f"y='(ih-oh)/2+8*exp(-3*t)*cos(2*PI*8*t)'"
        )
    if name == "glitch":
        # brief chromatic-aberration split + grain at the cut
        return (
            ",rgbashift=rh=7:rv=-3:bh=-7:bv=3:enable='lt(t,0.22)',"
            "noise=alls=16:allf=t:enable='lt(t,0.16)'"
        )
    if name == "whip":
        # short directional blur — reads as a fast whip-pan alongside the slide blend
        return ",gblur=sigma=22:enable='lt(t,0.13)'"
    return ""  # flash has no entrance filter (it's all in the blend)


def _effect_blend(name: str, span_min: float) -> tuple[str, float]:
    """Blend (xfade transition + duration) paired with an _EFFECTS entrance."""
    if name == "flash":
        return "fadewhite", 0.14
    if name == "whip":
        return "slideleft", min(0.22, max(0.10, span_min * 0.5))
    return "fade", 0.03  # zoompunch / shake / glitch → near-cut so the entrance pops


def _sfx_slide_times(broll: list[dict]) -> list[float]:
    """Time (seconds) each transition whoosh should land — the moment each B-roll cutaway
    slides in. Photo 0 eases in at its start; later photos land as their xfade begins."""
    times: list[float] = []
    for k, b in enumerate(broll):
        if k == 0:
            times.append(max(0.0, float(b["start"]) - 0.05))
        else:
            span_prev = max(0.3, float(broll[k - 1]["end"]) - float(broll[k - 1]["start"]))
            span_cur = max(0.3, float(b["end"]) - float(b["start"]))
            _, tdur = _xfade(b.get("transition"), min(span_prev, span_cur))
            times.append(max(0.0, float(b["start"]) - tdur))
    return times


def _append_audio_bed(
    fc: list[str],
    *,
    voice_idx: int,
    music_idx: int | None,
    music_volume: float,
    sfx_input_idxs: list[int],
    sfx_times: list[float],
    sfx_gains: list[float] | None = None,
) -> list[str]:
    """Append the reel audio bed to `fc` and return the ffmpeg audio `-map` args:
    the avatar voice, optionally sidechain-ducked under a music bed, plus a transition
    whoosh mixed in at each cutaway. Shared by both render engines so they sound identical.
    `voice_idx`/`music_idx`/`sfx_input_idxs` are input indices already added to the command."""
    need_bed = music_idx is not None or bool(sfx_input_idxs)
    if not need_bed:
        return ["-map", f"{voice_idx}:a?"]
    if music_idx is not None:
        # Voice is consumed twice (mix + sidechain key) → split it. aformat on both
        # branches: sidechaincompress errors on mismatched rates/layouts.
        fc.append(f"[{voice_idx}:a]aformat=sample_rates=44100:channel_layouts=stereo,asplit=2[vox][sck]")
        fc.append(f"[{music_idx}:a]aformat=sample_rates=44100:channel_layouts=stereo,volume={music_volume}[mus]")
        # The voice keys a compressor on the music, so the bed dips while speaking.
        fc.append("[mus][sck]sidechaincompress=threshold=0.04:ratio=10:attack=8:release=350:makeup=1[duck]")
        # normalize=0: keep the voice at full level (default amix would halve it).
        fc.append("[vox][duck]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[abed]")
    else:
        fc.append(f"[{voice_idx}:a]aformat=sample_rates=44100:channel_layouts=stereo[abed]")
    if sfx_input_idxs:
        # Each SFX file → level + delay to its slide start, then mix all into the bed.
        delayed = []
        for k, in_idx in enumerate(sfx_input_idxs):
            ms = max(0, int(round(sfx_times[k] * 1000)))
            vol = (sfx_gains[k] if sfx_gains is not None and k < len(sfx_gains) else SFX_VOLUME)
            # strip any leading silence so the audible whoosh lands exactly on the slide.
            fc.append(f"[{in_idx}:a]aformat=sample_rates=44100:channel_layouts=stereo,silenceremove=start_periods=1:start_threshold=-50dB,volume={vol},adelay={ms}|{ms}[wd{k}]")
            delayed.append(f"[wd{k}]")
        fc.append(f"[abed]{''.join(delayed)}amix=inputs={1 + len(delayed)}:duration=first:dropout_transition=0:normalize=0[a]")
        return ["-map", "[a]"]
    return ["-map", "[abed]"]


def compose_reel(
    *,
    avatar_cutout_path: str,  # matted alpha .mov (avatar cut-out + voice) from matte.matte_video_to_mov
    out_path: str,
    width: int = 1080,
    height: int = 1920,
    broll: list[dict] | None = None,  # [{"path": str, "start": float, "end": float}] — auto-timed backgrounds
    captions_ass: str | None = None,  # libass ASS path (CAPTION_ENGINE=libass)
    caption_overlay: str | None = None,  # transparent full-frame caption .mov (CAPTION_ENGINE=remotion)
    logo_path: str | None = None,
    music_path: str | None = None,
    music_volume: float = 0.15,
    avatar_side: str = "right",  # which side the avatar is framed to (side layout)
    avatar_layout: str = "side",  # "side" = framed left/right; "bottom" = centred, B-roll in a top band
    avatar_scale: float = 0.48,  # avatar height as a fraction of the frame
    bg_color: str = "0x101319",  # branded background shown wherever B-roll isn't
    transition_sfx: bool = True,  # whoosh SFX at each photo transition
    sfx_cues: list[dict] | None = None,  # AI voice-timed SFX: [{path, time, gain}]
) -> None:
    """Cut-out reel composite: B-roll fills the frame (over a branded background),
    the matted avatar is framed to one side (bottom-anchored, always visible),
    and captions burn on top. The avatar's alpha is used to blend the cut-out
    over whatever is behind — no rectangular PiP edge."""
    broll = broll or []
    dur = _duration(avatar_cutout_path)

    # Transition SFX: one bundled whoosh per photo transition, synced to the slide
    # start (the xfade for photo k runs over [start_k - tdur, start_k]). The files are
    # cycled for variety; photo 0 just eases in at mid_start.
    sfx_files = _transition_sfx_files() if transition_sfx else []
    sfx_times: list[float] = _sfx_slide_times(broll) if (broll and sfx_files) else []

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
    # [1] avatar cut-out (alpha video) + voice audio
    inputs += ["-i", avatar_cutout_path]
    avatar_idx = 1
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

    # AI voice-timed SFX: one input per cue, mixed like the whooshes but at per-cue gain.
    sfx_gains: list[float] = [SFX_VOLUME] * len(sfx_input_idxs)
    for cue in (sfx_cues or []):
        inputs += ["-i", cue["path"]]
        sfx_input_idxs.append(idx)
        sfx_times.append(float(cue["time"]))
        sfx_gains.append(float(cue["gain"]))
        idx += 1

    # [last] Remotion caption overlay — a full-frame transparent (ProRes 4444 alpha) .mov,
    # composited over everything like the avatar cut-out. Added last so no index shifts.
    caption_idx = None
    if caption_overlay:
        inputs += ["-i", caption_overlay]
        caption_idx = idx
        idx += 1

    # ── video filtergraph ──
    fc: list[str] = []
    # In the "bottom" layout the sharp B-roll fills only a top band; the avatar sits
    # bottom-centre with its head overlapping the seam. The blurred base still fills the
    # whole frame (so the area around/below the avatar reads as a soft backdrop).
    broll_h = int(height * 0.58) if avatar_layout == "bottom" else height
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
            # Punchy entrance for how clip k arrives (k=0 just appears with the slideshow
            # fade-in). Effect names get post-filters (shake/glitch/whip) and/or a zoom
            # punch; xfade transitions get '' and render exactly as before.
            tr = broll[k].get("transition") if k > 0 else None
            fx = _entrance_fx(tr, width, broll_h)
            punch = tr == "zoompunch"  # animated zoom overshoot (needs zoompan)
            if broll[k].get("kind") == "video" and not punch:
                # video B-roll: no Ken-Burns (it already moves) — cover-fit to CFR 30fps.
                fc.append(f"[{bi}:v]{cover_broll},fps=30{fx},format=yuv420p[p{k}]")
                continue
            span = _span(broll[k])
            inc = max(0.0004, 0.10 / (span * 30.0))
            # gentle Ken-Burns by default; zoompunch overshoots (~1.30) and eases back over
            # ~0.4s using the output-frame counter `on`.
            zexpr = "if(lt(on,12),1.30-0.025*on,1)" if punch else f"min(zoom+{inc:.5f},1.12)"
            fc.append(
                f"[{bi}:v]{cover_broll},"
                f"zoompan=z='{zexpr}':d=1:"
                f"x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={width}x{broll_h}:fps=30"
                # no setpts here — it marks the stream VFR and xfade requires CFR inputs.
                f"{fx},format=yuv420p[p{k}]"
            )
        # xfade chain — offsets anchored to each photo's real start time so timing holds.
        slide = "[p0]"
        for k in range(1, len(broll_idxs)):
            tr = broll[k].get("transition")
            span_min = min(_span(broll[k - 1]), _span(broll[k]))
            tname, tdur = _effect_blend(tr, span_min) if tr in _EFFECTS else _xfade(tr, span_min)
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
    # avatar cut-out, bottom-anchored; its alpha blends it over the B-roll/background.
    # "side" → framed left/right with a slight edge bleed; "bottom" → centred under the
    # top-band B-roll, head crossing the seam so there's no hard rectangular edge.
    if avatar_layout == "bottom":
        ph = int(height * 0.54)
        px = "(W-w)/2"
    else:
        ph = int(height * avatar_scale)
        px = "-40" if avatar_side == "left" else "W-w+40"
    fc.append(f"[{avatar_idx}:v]scale=-2:{ph}:flags=lanczos,setsar=1[pv]")
    fc.append(f"{last}[pv]overlay=x={px}:y=H-h[pp]")
    last = "[pp]"
    if caption_idx is not None:
        # Remotion path: alpha-composite the transparent caption overlay full-frame. Its own
        # alpha carries the text shape; eof_action=pass lets the reel continue if it ends first.
        fc.append(f"{last}[{caption_idx}:v]overlay=0:0:format=auto:eof_action=pass[cap]")
        last = "[cap]"
    elif captions_ass and has_filter("subtitles"):
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

    # ── audio: avatar voice (+ optional sidechain-ducked music) (+ transition SFX) ──
    audio_map = _append_audio_bed(
        fc,
        voice_idx=avatar_idx,
        music_idx=music_idx,
        music_volume=music_volume,
        sfx_input_idxs=sfx_input_idxs,
        sfx_times=sfx_times,
        sfx_gains=sfx_gains,
    )

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
