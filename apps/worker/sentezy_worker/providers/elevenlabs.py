from __future__ import annotations

import base64

import httpx

from ..models import Word

# Eleven v3 — the most expressive model (audio tags + emotional delivery), supports
# Turkish, and (verified) works with the with-timestamps endpoint. Lower stability =
# more emotional/creative; higher = flatter. Emotion flows into the HeyGen Avatar IV
# face too, since Avatar IV is audio-driven.
_MODEL = "eleven_v3"
_VOICE_SETTINGS = {"stability": 0.4, "similarity_boost": 0.8, "style": 0.35, "use_speaker_boost": True}


def _chars_to_words(alignment: dict) -> list[Word]:
    """Turn ElevenLabs character-level alignment into word-level timings. v3 audio tags
    like ``[excited]`` appear in the alignment but aren't spoken — skip them so they
    never become caption words (and the spoken words keep their real timings)."""
    chars: list[str] = alignment.get("characters", [])
    starts: list[float] = alignment.get("character_start_times_seconds", [])
    ends: list[float] = alignment.get("character_end_times_seconds", [])
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
        self.key = api_key

    def tts_with_timestamps(
        self, text: str, voice_id: str, out_audio_path: str, *, emotion_tag: str | None = None
    ) -> list[Word]:
        # An optional leading audio tag (e.g. "warmly", "excited") sets the emotional
        # tone; v3 reads bracketed tags as delivery cues (stripped from captions above).
        body = f"[{emotion_tag}] {text}" if emotion_tag else text
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps"
        r = httpx.post(
            url,
            headers={"xi-api-key": self.key, "Content-Type": "application/json"},
            json={
                "text": body,
                "model_id": _MODEL,
                "output_format": "mp3_44100_128",
                "voice_settings": _VOICE_SETTINGS,
            },
            timeout=180,
        )
        r.raise_for_status()
        data = r.json()
        with open(out_audio_path, "wb") as f:
            f.write(base64.b64decode(data["audio_base64"]))
        alignment = data.get("normalized_alignment") or data.get("alignment") or {}
        return _chars_to_words(alignment)
