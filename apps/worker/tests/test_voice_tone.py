"""The tone the drawer sets must survive the trip into the TTS call.

pipeline.decide_tone_route reads options.voice.emotion and picks one of three routes:
  - "passthrough": no tone, or the script already carries v3 tags (the per-sentence pass wins)
  - "llm":         an LLM key is available, so emotion.add_emotion_tags does per-sentence tagging
  - "leading-tag": no LLM key, so the tone becomes a single leading v3 tag
"""
from sentezy_worker.pipeline import decide_tone_route

DRAWER_TONES = ("warmly", "excited", "cheerfully", "seriously", "sincerely")


def test_natural_tone_is_a_passthrough():
    assert decide_tone_route({"voice": {"emotion": ""}}, "Merhaba.", True) == ("passthrough", None)
    assert decide_tone_route({}, "Merhaba.", True) == ("passthrough", None)
    assert decide_tone_route({"voice": {}}, "Merhaba.", False) == ("passthrough", None)


def test_tone_with_an_llm_key_goes_through_the_tagging_pass():
    assert decide_tone_route({"voice": {"emotion": "warmly"}}, "Merhaba.", True) == ("llm", "warmly")


def test_tone_without_an_llm_key_becomes_a_single_leading_tag():
    assert decide_tone_route({"voice": {"emotion": "excited"}}, "Merhaba.", False) == ("leading-tag", "excited")


def test_an_already_tagged_script_is_never_re_tagged():
    tagged = "[excited] Merhaba. [warmly] Hoş geldin."
    assert decide_tone_route({"voice": {"emotion": "seriously"}}, tagged, True) == ("passthrough", None)
    assert decide_tone_route({"voice": {"emotion": "seriously"}}, tagged, False) == ("passthrough", None)


def test_a_bracketed_number_is_not_mistaken_for_a_tag():
    assert decide_tone_route({"voice": {"emotion": "warmly"}}, "[1] Merhaba.", False) == ("leading-tag", "warmly")


def test_every_drawer_tone_reaches_the_tts_call():
    for tone in DRAWER_TONES:
        assert decide_tone_route({"voice": {"emotion": tone}}, "Merhaba.", False) == ("leading-tag", tone)
        assert decide_tone_route({"voice": {"emotion": tone}}, "Merhaba.", True) == ("llm", tone)
