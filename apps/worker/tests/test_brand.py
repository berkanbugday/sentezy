"""Brand kit: the Python mirror of packages/remotion/src/brand/timing.ts, and the audio
offset that keeps the voiceover aligned once an intro is prepended."""

from sentezy_worker.audio import _ffmpeg_audio_cmd
from sentezy_worker.providers.reel_remotion import brand_props, reel_segments

FPS = 30
WORDS = [{"start": 0.0, "end": 0.5}, {"start": 4.5, "end": 5.0}]


def _legacy_duration(words, fps):
    """The rule the reel used before branding existed. Unbranded videos must still match."""
    last_end = words[-1]["end"] if words else 5
    import math

    return max(1, math.ceil((last_end + 0.3) * fps))


# ── reel_segments: must agree with brand/timing.test.ts case for case ───────────────


def test_no_brand_matches_the_old_duration_exactly():
    s = reel_segments(WORDS, None, FPS)
    assert s["introFrames"] == 0
    assert s["outroFrames"] == 0
    assert s["bodyFrames"] == _legacy_duration(WORDS, FPS)
    assert s["totalFrames"] == _legacy_duration(WORDS, FPS)


def test_watermark_only_does_not_move_a_frame():
    brand = {"intro": None, "outro": None, "watermark": True}
    assert reel_segments(WORDS, brand, FPS) == reel_segments(WORDS, None, FPS)


def test_cards_bracket_the_body_without_changing_it():
    brand = {"intro": {"kind": "card"}, "outro": {"kind": "card"}}
    s = reel_segments(WORDS, brand, FPS)
    # Same numbers the TS test asserts: 1.5s and 2s at 30fps.
    assert s["introFrames"] == 45
    assert s["outroFrames"] == 60
    assert s["bodyFrames"] == _legacy_duration(WORDS, FPS)
    assert s["totalFrames"] == 45 + _legacy_duration(WORDS, FPS) + 60


def test_ends_are_independent():
    intro_only = reel_segments(WORDS, {"intro": {"kind": "card"}, "outro": None}, FPS)
    assert intro_only["introFrames"] == 45 and intro_only["outroFrames"] == 0
    outro_only = reel_segments(WORDS, {"intro": None, "outro": {"kind": "card"}}, FPS)
    assert outro_only["introFrames"] == 0 and outro_only["outroFrames"] == 60


def test_clip_overrides_the_card_length():
    brand = {
        "intro": {"kind": "clip", "url": "https://r2/i.mp4", "durationInFrames": 72},
        "outro": {"kind": "card"},
    }
    s = reel_segments(WORDS, brand, FPS)
    assert s["introFrames"] == 72
    assert s["totalFrames"] == 72 + _legacy_duration(WORDS, FPS) + 60


def test_empty_words_keep_the_five_second_fallback():
    s = reel_segments([], {"intro": {"kind": "card"}}, FPS)
    assert s["bodyFrames"] == _legacy_duration([], FPS)
    assert s["totalFrames"] == 45 + _legacy_duration([], FPS)


def test_segments_are_non_negative_integers_that_sum_to_total():
    for brand in (None, {"intro": {"kind": "card"}, "outro": {"kind": "card"}}):
        s = reel_segments(WORDS, brand, FPS)
        for v in s.values():
            assert isinstance(v, int) and v >= 0
        assert s["totalFrames"] == s["introFrames"] + s["bodyFrames"] + s["outroFrames"]


# ── brand_props: options.branding → the composition's ReelBrand ─────────────────────


class _FakeStorage:
    def signed_get_url(self, key, ttl=86400):
        return f"https://signed/{key}"

    def image_url(self, key):
        return f"https://img/{key}"


def test_branding_off_yields_no_brand():
    assert brand_props({}, _FakeStorage(), FPS) is None
    assert brand_props({"branding": {"intro": False, "outro": False, "watermark": False}}, _FakeStorage(), FPS) is None


def test_branding_without_a_kit_yields_no_brand():
    # Toggles on but nothing ever applied — there is nothing to render.
    opts = {"branding": {"intro": True, "outro": True, "kit": None}}
    assert brand_props(opts, _FakeStorage(), FPS) is None


def test_kit_is_signed_and_mapped():
    opts = {
        "branding": {
            "intro": True,
            "outro": True,
            "watermark": True,
            "kit": {
                "brandName": "Sentezy",
                "handle": "@sentezy",
                "logoImageId": "brand/logo.png",
                "color": "#FF5A1F",
                "font": "Poppins",
                "outroCta": "Hemen dene",
                "introClip": None,
                "outroClip": None,
            },
        }
    }
    b = brand_props(opts, _FakeStorage(), FPS)
    assert b["intro"] == {"kind": "card"}
    assert b["outro"] == {"kind": "card"}
    assert b["watermark"] is True
    assert b["logoUrl"] == "https://signed/brand/logo.png"
    assert b["brandName"] == "Sentezy"
    assert b["cta"] == "Hemen dene"
    assert b["color"] == "#FF5A1F"


def test_a_disabled_end_is_none_even_when_the_kit_has_a_clip():
    opts = {
        "branding": {
            "intro": False,
            "outro": True,
            "kit": {"outroClip": {"ref": "brand/o.mp4", "ms": 2400}},
        }
    }
    b = brand_props(opts, _FakeStorage(), FPS)
    assert b["intro"] is None
    # 2400ms @30fps = 72 frames
    assert b["outro"] == {"kind": "clip", "url": "https://signed/brand/o.mp4", "durationInFrames": 72}


# ── audio: the offset that keeps the voiceover aligned ─────────────────────────────


def test_no_offset_leaves_the_command_as_it_was():
    plain = _ffmpeg_audio_cmd(
        video_path="/v.mp4", voice_path="/a.mp3", out_path="/o.mp4",
        music_path=None, music_volume=0.15, broll=[], transition_sfx=False,
    )
    assert "-filter_complex" not in plain  # voice maps straight through, as before


def test_intro_offset_delays_the_voice_and_pads_to_the_full_length():
    # 45-frame intro @30fps = 1.5s; total reel 8.8s.
    cmd = _ffmpeg_audio_cmd(
        video_path="/v.mp4", voice_path="/a.mp3", out_path="/o.mp4",
        music_path=None, music_volume=0.15, broll=[], transition_sfx=False,
        voice_offset=1.5, total_duration=8.8,
    )
    fc = cmd[cmd.index("-filter_complex") + 1]
    # The voiceover must start when the BODY starts, not under the intro card.
    assert "adelay=1500|1500" in fc
    # Padded to the full reel so `-shortest` does not cut the outro off.
    assert "apad=whole_dur=8.8" in fc
    assert "-shortest" in cmd


def test_music_bed_still_runs_under_the_outro():
    # amix uses duration=first, keyed on the voice — so the voice must be padded to the
    # full length or the bed would stop when the speech does, killing the outro.
    cmd = _ffmpeg_audio_cmd(
        video_path="/v.mp4", voice_path="/a.mp3", out_path="/o.mp4",
        music_path="/m.mp3", music_volume=0.2, broll=[], transition_sfx=False,
        voice_offset=1.5, total_duration=8.8,
    )
    fc = cmd[cmd.index("-filter_complex") + 1]
    assert "apad=whole_dur=8.8" in fc
    assert "sidechaincompress" in fc
    # The padded voice, not the raw input, is what feeds the mix and the sidechain key.
    assert "[vsrc]" in fc


def test_sfx_times_shift_by_the_intro_offset(monkeypatch):
    monkeypatch.setattr("sentezy_worker.audio._transition_sfx_path", lambda t: "/lib/w.wav")
    broll = [
        {"start": 0.5, "end": 1.5, "transition": "fade"},
        {"start": 2.0, "end": 3.0, "transition": "slide"},  # 0.4s lead → 1.6s, +1.5 offset
    ]
    cmd = _ffmpeg_audio_cmd(
        video_path="/v.mp4", voice_path="/a.mp3", out_path="/o.mp4",
        music_path=None, music_volume=0.15, broll=broll, transition_sfx=True,
        voice_offset=1.5, total_duration=8.8,
    )
    fc = cmd[cmd.index("-filter_complex") + 1]
    # Without the shift this would still be 1600 and the whoosh would fire during the
    # intro card, a transition-duration before the cutaway it belongs to.
    assert "adelay=3100|3100" in fc


# ── Uploaded clip audio ────────────────────────────────────────────────────────────


def test_clip_audio_is_mixed_at_its_position_without_silence_trimming():
    # Intro clip at 0s, outro clip at intro+body. Trimming leading silence — which the
    # whooshes do want — would slide a clip's sound away from its own picture.
    cmd = _ffmpeg_audio_cmd(
        video_path="/v.mp4", voice_path="/a.mp3", out_path="/o.mp4",
        music_path=None, music_volume=0.15, broll=[], transition_sfx=False,
        voice_offset=2.4, total_duration=10.0,
        clip_audio=[{"path": "/intro.mp4", "at": 0.0}, {"path": "/outro.mp4", "at": 7.5}],
    )
    fc = cmd[cmd.index("-filter_complex") + 1]
    assert "/intro.mp4" in cmd and "/outro.mp4" in cmd
    assert "adelay=0|0" in fc
    assert "adelay=7500|7500" in fc
    # Full level, and NOT silence-trimmed.
    assert "volume=1.0" in fc
    assert "silenceremove" not in fc


def test_whooshes_keep_their_silence_trim_alongside_clip_audio(monkeypatch):
    monkeypatch.setattr("sentezy_worker.audio._transition_sfx_path", lambda t: "/lib/w.wav")
    cmd = _ffmpeg_audio_cmd(
        video_path="/v.mp4", voice_path="/a.mp3", out_path="/o.mp4",
        music_path=None, music_volume=0.15,
        broll=[{"start": 0.5, "transition": "fade"}, {"start": 2.0, "transition": "slide"}],
        transition_sfx=True,
        clip_audio=[{"path": "/intro.mp4", "at": 0.0}],
    )
    fc = cmd[cmd.index("-filter_complex") + 1]
    # The whoosh is trimmed; the clip is not. Both are in the same mix.
    assert "silenceremove" in fc
    assert "volume=0.3" in fc and "volume=1.0" in fc
    assert "amix=inputs=3" in fc  # bed + whoosh + clip


def test_no_clip_audio_leaves_the_command_untouched():
    without = _ffmpeg_audio_cmd(
        video_path="/v.mp4", voice_path="/a.mp3", out_path="/o.mp4",
        music_path=None, music_volume=0.15, broll=[], transition_sfx=False,
    )
    explicit_empty = _ffmpeg_audio_cmd(
        video_path="/v.mp4", voice_path="/a.mp3", out_path="/o.mp4",
        music_path=None, music_volume=0.15, broll=[], transition_sfx=False,
        clip_audio=[],
    )
    assert without == explicit_empty
    assert "-filter_complex" not in without
