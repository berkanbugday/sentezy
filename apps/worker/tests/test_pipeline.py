from sentezy_worker.pipeline import _resolve_music


class _FailingStorage:
    """Stand-in for Storage whose download always raises, e.g. a deleted R2 object
    or a transient signed-URL failure."""

    def signed_get_url(self, key, expires=3600):
        return f"https://example.invalid/{key}"

    def download(self, url, dest):
        raise RuntimeError("boom: 404 from R2")


class _OkStorage:
    def signed_get_url(self, key, expires=3600):
        return f"https://example.invalid/{key}"

    def download(self, url, dest):
        with open(dest, "wb") as f:
            f.write(b"fake-mp3-bytes")


def test_resolve_music_returns_none_when_no_track_selected():
    assert _resolve_music({}, _FailingStorage(), "/tmp") is None


def test_resolve_music_swallows_download_failure_and_returns_none(tmp_path):
    # A track can be selected in the DB/catalog after its R2 object was removed
    # (scripts/add-music.mjs --remove deletes R2 before the seed prunes the row), or a
    # signed URL can transiently fail. Either way this must never kill the render job —
    # the video should still render without music, same as any other optional element.
    options = {"music": {"trackKey": "music/gone.mp3"}}
    result = _resolve_music(options, _FailingStorage(), str(tmp_path))
    assert result is None


def test_resolve_music_returns_path_on_success(tmp_path):
    options = {"music": {"trackKey": "music/ok.mp3"}}
    result = _resolve_music(options, _OkStorage(), str(tmp_path))
    assert result == f"{tmp_path}/music.mp3"
