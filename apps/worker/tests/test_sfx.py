from sentezy_worker.models import Word
from sentezy_worker.sfx import tokenize_script, resolve_sfx_cues


def test_tokenize_matches_ts_contract():
    assert tokenize_script("[excited] Bu  hafta   indirim!") == ["Bu", "hafta", "indirim!"]
    assert tokenize_script("") == []


def _words(n):
    return [Word(text=str(i), start=float(i), end=float(i) + 0.5) for i in range(n)]


def test_resolve_one_to_one_when_counts_match(monkeypatch):
    monkeypatch.setattr("sentezy_worker.sfx.sfx_file", lambda sid: f"/lib/{sid}.mp3")
    tokens = ["a", "b", "c", "d"]
    words = _words(4)
    cues = [{"sfxId": "cash", "wordIndex": 2, "gain": 0.7}]
    out = resolve_sfx_cues(cues, words, tokens)
    assert out == [{"path": "/lib/cash.mp3", "time": 2.0, "gain": 0.7}]


def test_resolve_proportional_when_counts_differ(monkeypatch):
    monkeypatch.setattr("sentezy_worker.sfx.sfx_file", lambda sid: f"/lib/{sid}.mp3")
    tokens = ["a", "b", "c", "d"]      # 4 canonical tokens
    words = _words(8)                  # 8 real TTS words
    cues = [{"sfxId": "ding", "wordIndex": 3, "gain": 0.6}]
    out = resolve_sfx_cues(cues, words, tokens)
    # 3/4 * (8-1) = 5.25 -> round 5 -> words[5].start == 5.0
    assert out == [{"path": "/lib/ding.mp3", "time": 5.0, "gain": 0.6}]


def test_missing_file_skips_cue(monkeypatch):
    monkeypatch.setattr("sentezy_worker.sfx.sfx_file", lambda sid: None)
    out = resolve_sfx_cues([{"sfxId": "cash", "wordIndex": 0, "gain": 0.7}], _words(2), ["a", "b"])
    assert out == []


def test_sfx_file_rejects_path_traversal():
    from sentezy_worker.sfx import sfx_file
    assert sfx_file("../../../etc/passwd") is None
    assert sfx_file("foo/bar") is None
    assert sfx_file("a.b") is None
