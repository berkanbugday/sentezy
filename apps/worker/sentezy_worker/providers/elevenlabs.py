from __future__ import annotations

import base64

from elevenlabs import VoiceSettings
from elevenlabs.client import ElevenLabs as ElevenLabsClient
from elevenlabs.types import CharacterAlignmentResponseModel

from ..models import Word

# Eleven v3 — the most expressive model (audio tags + emotional delivery), supports
# Turkish, and (verified) works with the with-timestamps endpoint. Emotion flows into the
# HeyGen Avatar IV face too, since Avatar IV is audio-driven.
_MODEL = "eleven_v3"

# v3 takes stability as one of three discrete modes; anything else is rounded to the
# nearest. Creative = the most emotional/tag-responsive (docs warn it is also the most
# prone to hallucination). Natural/Robust are here so the trade-off is one edit away.
STABILITY_CREATIVE, STABILITY_NATURAL, STABILITY_ROBUST = 0.0, 0.5, 1.0

# ONLY stability and style apply to v3 — the docs state similarity and speaker boost are
# not available for this model, and recommend keeping style at 0 at all times (non-zero
# style also costs latency). Sending the others would be silently ignored at best.
_VOICE_SETTINGS = VoiceSettings(stability=STABILITY_CREATIVE, style=0.0)


def _chars_to_words(alignment: CharacterAlignmentResponseModel | None) -> list[Word]:
    """Turn ElevenLabs character-level alignment into word-level timings. v3 audio tags
    like ``[excited]`` appear in the alignment but aren't spoken — skip them so they
    never become caption words (and the spoken words keep their real timings)."""
    if alignment is None:
        return []
    chars: list[str] = alignment.characters
    starts: list[float] = alignment.character_start_times_seconds
    ends: list[float] = alignment.character_end_times_seconds
    words: list[Word] = []
    cur = ""
    w_start: float | None = None
    w_end = 0.0
    in_tag = False
    for i, ch in enumerate(chars):
        if not in_tag and ch == "[":
            if cur:
                words.append(Word(cur, w_start or 0.0, w_end))
                cur = ""
                w_start = None
            in_tag = True
            continue
        if in_tag:
            if ch == "]":
                in_tag = False
            continue
        if ch.isspace():
            if cur:
                words.append(Word(cur, w_start or 0.0, w_end))
                cur = ""
                w_start = None
            continue
        if w_start is None:
            w_start = starts[i] if i < len(starts) else w_end
        cur += ch
        w_end = ends[i] if i < len(ends) else w_end
    if cur:
        words.append(Word(cur, w_start or 0.0, w_end))
    return words


class ElevenLabs:
    def __init__(self, api_key: str):
        self.client = ElevenLabsClient(api_key=api_key, timeout=180)

    def tts_with_timestamps(
        self, text: str, voice_id: str, out_audio_path: str, *, emotion_tag: str | None = None
    ) -> list[Word]:
        # An optional leading audio tag (e.g. "warmly", "excited") sets the emotional
        # tone; v3 reads bracketed tags as delivery cues (stripped from captions above).
        body = f"[{emotion_tag}] {text}" if emotion_tag else text
        res = self.client.text_to_speech.convert_with_timestamps(
            voice_id,
            text=body,
            model_id=_MODEL,
            output_format="mp3_44100_128",
            voice_settings=_VOICE_SETTINGS,
        )
        with open(out_audio_path, "wb") as f:
            f.write(base64.b64decode(res.audio_base_64))
        return _chars_to_words(res.normalized_alignment or res.alignment)
