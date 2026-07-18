from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Word:
    """A transcribed word with absolute timing in seconds (ElevenLabs alignment)."""
    text: str
    start: float
    end: float
