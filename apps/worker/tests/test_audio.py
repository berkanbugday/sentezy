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


def test_whoosh_timing_skips_clip0_and_leads_by_0_2(monkeypatch):
    # isolate timing/index logic from real .wav file existence
    monkeypatch.setattr("sentezy_worker.audio._transition_sfx_path", lambda t: "/lib/w.wav")
    broll = [
        {"start": 0.5, "end": 1.5, "transition": "fade"},
        {"start": 2.0, "end": 3.0, "transition": "slide"},
        {"start": 4.0, "end": 5.0, "transition": "wipe"},
    ]
    cmd = _ffmpeg_audio_cmd(
        video_path="/v.mp4", voice_path="/a.mp3", out_path="/o.mp4",
        music_path=None, music_volume=0.15, broll=broll, transition_sfx=True, sfx_cues=[],
    )
    fc = cmd[cmd.index("-filter_complex") + 1]
    # clip 0 has no transition → no whoosh; clips 1,2 lead their start by 0.2s (1.8s, 3.8s)
    assert "adelay=1800|1800" in fc
    assert "adelay=3800|3800" in fc
    # inputs: video + voice + 2 whooshes (clip 0 skipped)
    assert cmd.count("-i") == 4


def test_ai_sfx_cue_passes_time_and_gain(monkeypatch):
    cmd = _ffmpeg_audio_cmd(
        video_path="/v.mp4", voice_path="/a.mp3", out_path="/o.mp4",
        music_path=None, music_volume=0.15, broll=[], transition_sfx=False,
        sfx_cues=[{"path": "/lib/cash.mp3", "time": 1.5, "gain": 0.3}],
    )
    fc = cmd[cmd.index("-filter_complex") + 1]
    assert "/lib/cash.mp3" in cmd
    assert "adelay=1500|1500" in fc  # cue at its own time
    assert "volume=0.3" in fc        # cue at its own gain (not the 0.2 whoosh default)
