from sentezy_worker.audio import _ffmpeg_audio_cmd


def test_voice_only_maps_copied_video_and_voice():
    cmd = _ffmpeg_audio_cmd(
        video_path="/v.mp4", voice_path="/a.mp3", out_path="/o.mp4",
        music_path=None, music_volume=0.15, broll=[], transition_sfx=False, sfx_cues=[],
    )
    # video is stream-copied, never re-encoded
    assert "-c:v" in cmd and cmd[cmd.index("-c:v") + 1] == "copy"
    # two inputs: the opaque video then the voice
    assert cmd.count("-i") == 2
    assert "/v.mp4" in cmd and "/a.mp3" in cmd
    # voice maps straight through when there is no bed
    assert "-map" in cmd and "0:v" in " ".join(cmd)


def test_music_adds_sidechain_and_faststart():
    cmd = _ffmpeg_audio_cmd(
        video_path="/v.mp4", voice_path="/a.mp3", out_path="/o.mp4",
        music_path="/m.mp3", music_volume=0.2, broll=[], transition_sfx=False, sfx_cues=[],
    )
    fc = cmd[cmd.index("-filter_complex") + 1]
    assert "sidechaincompress" in fc
    assert "+faststart" in " ".join(cmd)
