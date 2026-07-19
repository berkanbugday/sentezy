from sentezy_worker.pipeline import read_avatar_position
from sentezy_worker.providers.reel_remotion import build_reel_props
from sentezy_worker.models import Word


def test_legacy_bottom_layout_maps_to_center():
    assert read_avatar_position({"avatarLayout": "bottom", "avatarSide": "left"}) == "center"
    assert read_avatar_position({"avatarLayout": "bottom", "avatarSide": "right"}) == "center"


def test_legacy_side_layout_keeps_its_side():
    assert read_avatar_position({"avatarLayout": "side", "avatarSide": "left"}) == "left"
    assert read_avatar_position({"avatarLayout": "side", "avatarSide": "right"}) == "right"


def test_legacy_avatar_side_right_is_preserved_not_defaulted():
    # Regression: real stored data describing how this video already renders must NOT
    # be swept up by the "left" default below.
    assert read_avatar_position({"avatarSide": "right"}) == "right"


def test_missing_or_malformed_layout_falls_back_to_left():
    assert read_avatar_position({}) == "left"
    assert read_avatar_position({"avatarPosition": "sideways"}) == "left"


def test_explicit_avatar_position_wins_over_legacy_keys():
    assert read_avatar_position({"avatarPosition": "center", "avatarSide": "left"}) == "center"
    assert read_avatar_position({"avatarPosition": "left", "avatarLayout": "bottom"}) == "left"


def test_build_reel_props_emits_avatar_position_only():
    props = build_reel_props(
        [Word(text="merhaba", start=0.0, end=0.4)],
        avatar_url=None,
        broll=[],
        style="karaoke",
        font="General Sans",
        color="#FFD54A",
        avatar_position="center",
        position="top",
        captions=True,
        width=1080,
        height=1920,
        fps=30,
    )
    assert props["avatarPosition"] == "center"
    assert props["position"] == "top"
    assert "layout" not in props
    assert "avatarSide" not in props
