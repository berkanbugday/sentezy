from __future__ import annotations

import base64

import httpx

from ..compose import Word


def _chars_to_words(alignment: dict) -> list[Word]:
    """Turn ElevenLabs character-level alignment into word-level timings."""
    chars: list[str] = alignment.get("characters", [])
    starts: list[float] = alignment.get("character_start_times_seconds", [])
    ends: list[float] = alignment.get("character_end_times_seconds", [])
    words: list[Word] = []
    cur = ""
    w_start: float | None = None
    w_end = 0.0
    for i, ch in enumerate(chars):
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

    def tts_with_timestamps(self, text: str, voice_id: str, out_audio_path: str) -> list[Word]:
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps"
        r = httpx.post(
            url,
            headers={"xi-api-key": self.key, "Content-Type": "application/json"},
            json={
                "text": text,
                "model_id": "eleven_multilingual_v2",
                "output_format": "mp3_44100_128",
            },
            timeout=180,
        )
        r.raise_for_status()
        data = r.json()
        with open(out_audio_path, "wb") as f:
            f.write(base64.b64decode(data["audio_base64"]))
        alignment = data.get("normalized_alignment") or data.get("alignment") or {}
        return _chars_to_words(alignment)
