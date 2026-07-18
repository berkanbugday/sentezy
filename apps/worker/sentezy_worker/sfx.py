from __future__ import annotations

import os
import re

from .compose import Word

_SFX_LIB_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "sfx", "library"))
_TAG_RE = re.compile(r"\[[a-zA-Z][^\]]*\]")


def tokenize_script(script: str) -> list[str]:
    """Canonical tokenization — MUST match @sentezy/types tokenizeScript:
    strip [emotion] tags, split on whitespace, drop empties."""
    stripped = _TAG_RE.sub(" ", script).strip()
    return [t for t in re.split(r"\s+", stripped) if t]


def sfx_file(sfx_id: str) -> str | None:
    """Absolute path to the bundled {id}.mp3, or None if not present."""
    path = os.path.join(_SFX_LIB_DIR, f"{sfx_id}.mp3")
    return path if os.path.isfile(path) else None


def resolve_sfx_cues(cues: list[dict], words: list[Word], tokens: list[str]) -> list[dict]:
    """Map word-anchored cues to concrete audio: [{path, time, gain}].

    time = start of the ElevenLabs word aligned to cue.wordIndex. 1:1 by index when the
    canonical token count equals the TTS word count (the norm — emotion tagging preserves
    words); otherwise proportional. Cues with no bundled file are skipped."""
    if not cues or not words or not tokens:
        return []
    n_tok = len(tokens)
    n_word = len(words)
    out: list[dict] = []
    for cue in cues:
        idx = int(cue.get("wordIndex", -1))
        if idx < 0 or idx >= n_tok:
            continue
        path = sfx_file(str(cue.get("sfxId", "")))
        if not path:
            continue
        if n_tok == n_word:
            w = words[idx]
        else:
            w = words[min(n_word - 1, max(0, round(idx / n_tok * (n_word - 1))))]
        gain = float(cue.get("gain", 0.7))
        out.append({"path": path, "time": float(w.start), "gain": max(0.0, min(1.0, gain))})
    return out
