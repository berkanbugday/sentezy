"""LLM pass that annotates a Turkish voiceover script with ElevenLabs v3 audio tags
for richer, per-sentence emotional delivery. Inserts tags like [excited]/[warmly]/[sighs]
at natural points — WITHOUT changing any spoken words (a strict word-preservation guard
falls back to the original script otherwise). The tags are stripped from captions later
by providers.elevenlabs._chars_to_words.

Provider is pluggable: OpenRouter (free models, OpenAI-compatible, preferred) or Anthropic
(Claude). Whichever key is configured is used; none → the script is returned unchanged.
"""

from __future__ import annotations

import re
import time

import httpx

# Default free OpenRouter model — multimodal, strong multilingual instruction following, $0.
# Override with OPENROUTER_MODEL. The word-preservation guard below protects against a weak model.
DEFAULT_OPENROUTER_MODEL = "google/gemma-4-31b-it:free"

# The v3 audio tags the model may insert.
_ALLOWED_TAGS = [
    "excited", "warmly", "cheerfully", "happily", "seriously", "sincerely", "calmly",
    "curiously", "sadly", "nervously", "sarcastic", "whispers", "laughs", "sighs", "gasps",
]

# Wizard emotion value → a short natural-language tone description for the prompt.
_TONE_DESC = {
    "warmly": "warm, friendly and inviting",
    "excited": "energetic, exciting and enthusiastic",
    "cheerfully": "upbeat, cheerful and positive",
    "seriously": "serious, confident and authoritative",
    "sincerely": "sincere, heartfelt and genuine",
}

_SYSTEM = (
    "You annotate a Turkish voiceover script with ElevenLabs v3 audio tags so the delivery "
    "sounds expressive and human, sentence by sentence.\n"
    "STRICT RULES:\n"
    "1. Output ONLY the annotated script text — no preamble, no explanation, no quotes.\n"
    "2. Do NOT change, translate, reorder, add, or remove ANY of the original words. "
    "Insert bracketed tags only. Every original word must remain, in the same order.\n"
    "3. Keep all original punctuation exactly.\n"
    "4. Use tags sparingly and naturally — about one per sentence at most; fewer is fine.\n"
    "5. Only use tags from this set: {tags}.\n"
    "6. Shape the emotional arc to the requested overall tone."
)


def _prompt(script: str, tone: str) -> tuple[str, str]:
    tags = ", ".join(f"[{t}]" for t in _ALLOWED_TAGS)
    tone_desc = _TONE_DESC.get(tone, tone or "natural, engaging and human")
    return _SYSTEM.format(tags=tags), f"Overall tone: {tone_desc}\n\nScript:\n{script}"


def _openrouter(system: str, user: str, api_key: str, model: str) -> str:
    # Free models often 429 ("temporarily rate-limited upstream") or hit transient 5xx —
    # retry those with backoff. A non-429 4xx (bad key/model/body) is terminal.
    for delay in (0, 1.5, 3.5):
        if delay:
            time.sleep(delay)
        r = httpx.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://sentezy.app",
                "X-Title": "Sentezy",
            },
            json={
                "model": model,
                "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
                "temperature": 0.6,
                "max_tokens": 4000,
            },
            timeout=90,
        )
        if r.status_code == 429 or r.status_code >= 500:
            continue  # transient → retry
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]
    r.raise_for_status()  # exhausted retries — surface the last error (caught by add_emotion_tags)
    return r.json()["choices"][0]["message"]["content"]


def _anthropic(system: str, user: str, api_key: str, model: str) -> str:
    from anthropic import Anthropic  # lazy — only needed on the Anthropic path

    msg = Anthropic(api_key=api_key).messages.create(
        model=model,
        max_tokens=8000,
        output_config={"effort": "low"},
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    return "".join(b.text for b in msg.content if b.type == "text")


def _strip_tags(text: str) -> str:
    return re.sub(r"\[[^\]]*\]", " ", text)


def add_emotion_tags(
    script: str,
    tone: str,
    *,
    openrouter_key: str | None = None,
    openrouter_model: str = DEFAULT_OPENROUTER_MODEL,
    anthropic_key: str | None = None,
    anthropic_model: str = "claude-opus-4-8",
) -> str:
    """Return the script with v3 audio tags inserted for emotional delivery. Prefers the
    free OpenRouter provider, falls back to Anthropic; returns the original script on any
    error, empty output, or if the model altered the words (guarding against paraphrase)."""
    if not script.strip():
        return script
    system, user = _prompt(script, tone)

    def _guard_ok(out: str) -> bool:
        # Accept only if the model actually inserted a tag (weak models just echo the script
        # back — that is NOT emotion added) AND preserved every original word (no paraphrase).
        return (
            bool(out)
            and bool(re.search(r"\[[a-zA-Z]+\]", out))
            and _strip_tags(out).split() == script.split()
        )

    if openrouter_key:
        # Try each model in the chain (comma-separated) until one answers and passes the
        # guard. Different free models route to different providers with independent rate
        # limits, so if one is 429-saturated the next usually works.
        for model in (m.strip() for m in openrouter_model.split(",") if m.strip()):
            try:
                out = (_openrouter(system, user, openrouter_key, model) or "").strip()
            except Exception:  # noqa: BLE001 — never let emotion tagging break a render
                continue
            if _guard_ok(out):
                return out
        return script

    if anthropic_key:
        try:
            out = (_anthropic(system, user, anthropic_key, anthropic_model) or "").strip()
        except Exception:  # noqa: BLE001
            return script
        return out if _guard_ok(out) else script

    return script
