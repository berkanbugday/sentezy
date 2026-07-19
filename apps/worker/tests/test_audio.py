from sentezy_worker.audio import _ffmpeg_audio_cmd


def test_voice_only_maps_copied_video_and_voice():
    cmd = _ffmpeg_audio_cmd(
        video_path="/v.mp4", voice_path="/a.mp3", out_path="/o.mp4",
        music_path=None, music_volume=0.15, broll=[], transition_sfx=False,
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
        music_path="/m.mp3", music_volume=0.2, broll=[], transition_sfx=False,
    )
    fc = cmd[cmd.index("-filter_complex") + 1]
    assert "sidechaincompress" in fc
    assert "+faststart" in " ".join(cmd)


def test_music_input_is_looped_so_short_tracks_dont_run_out():
    # Catalog tracks can be much shorter than the ad (e.g. 19s bed under a 40s voice).
    # The preview loops the bed (<Audio loop /> in Reel.tsx); the render must too, or
    # the mix goes silent once the short track ends. `amix ... duration=first` still
    # truncates the looped bed back down to the voice length.
    cmd = _ffmpeg_audio_cmd(
        video_path="/v.mp4", voice_path="/a.mp3", out_path="/o.mp4",
        music_path="/m.mp3", music_volume=0.2, broll=[], transition_sfx=False,
    )
    music_i = cmd.index("/m.mp3")
    assert cmd[music_i - 3:music_i] == ["-stream_loop", "-1", "-i"]


def test_whoosh_timing_skips_clip0_and_leads_by_transition_duration(monkeypatch):
    # isolate timing/index logic from real .wav file existence
    monkeypatch.setattr("sentezy_worker.audio._transition_sfx_path", lambda t: "/lib/w.wav")
    broll = [
        {"start": 0.5, "end": 1.5, "transition": "fade"},
        {"start": 2.0, "end": 3.0, "transition": "slide"},  # transition → 0.4s lead
        {"start": 4.0, "end": 5.0, "transition": "whip"},   # entrance → 0.12s lead
    ]
    cmd = _ffmpeg_audio_cmd(
        video_path="/v.mp4", voice_path="/a.mp3", out_path="/o.mp4",
        music_path=None, music_volume=0.15, broll=broll, transition_sfx=True,
    )
    fc = cmd[cmd.index("-filter_complex") + 1]
    # clip 0 has no transition → no whoosh.
    # clip 1 (slide, 0.4s lead): 2.0-0.4=1.6s ; clip 2 (whip=entrance, 0.12s lead): 4.0-0.12=3.88s
    assert "adelay=1600|1600" in fc
    assert "adelay=3880|3880" in fc
    # inputs: video + voice + 2 whooshes (clip 0 skipped)
    assert cmd.count("-i") == 4
    # whoosh mixed at SFX_VOLUME
    assert "volume=0.3" in fc
