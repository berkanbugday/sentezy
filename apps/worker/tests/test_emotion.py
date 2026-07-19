"""The emotion pass may only re-time a script, never rewrite it. `words_only` is the
invariant that enforces that: whatever the LLM returns, the spoken words (and their count)
must survive so the ElevenLabs word alignment still matches the caption timing."""

from sentezy_worker.emotion import words_only

SCRIPT = "Bu ürünü denedim ve gerçekten şaşırdım. Fiyatı da 3.5 kat uygun."


def _accepts(annotated: str) -> bool:
    return words_only(annotated) == words_only(SCRIPT)


def test_plain_script_matches_itself():
    assert _accepts(SCRIPT)


def test_accepts_tags_and_ellipses():
    assert _accepts(
        "[curious] Bu ürünü denedim… [excited] ve gerçekten şaşırdım! Fiyatı da 3.5 kat uygun."
    )


def test_accepts_multi_word_tag():
    assert _accepts("[starts laughing] Bu ürünü denedim ve gerçekten şaşırdım. Fiyatı da 3.5 kat uygun.")


def test_rejects_standalone_ellipsis():
    # A lone "…" becomes its own whitespace token, shifting every later word index.
    assert not _accepts("Bu ürünü denedim … ve gerçekten şaşırdım. Fiyatı da 3.5 kat uygun.")


def test_rejects_paraphrase():
    assert not _accepts("Bu ürünü denedim ve cidden şaşırdım. Fiyatı da 3.5 kat uygun.")


def test_rejects_dropped_word():
    assert not _accepts("Bu ürünü denedim ve şaşırdım. Fiyatı da 3.5 kat uygun.")


def test_rejects_capitalisation_change():
    # CAPS would render as shouted words in captions — out of scope for this pass.
    assert not _accepts("Bu ürünü denedim ve GERÇEKTEN şaşırdım. Fiyatı da 3.5 kat uygun.")


def test_rejects_interior_punctuation_change():
    # Only edge punctuation is normalised, so "3.5" cannot silently become "35".
    assert not _accepts("Bu ürünü denedim ve gerçekten şaşırdım. Fiyatı da 35 kat uygun.")
