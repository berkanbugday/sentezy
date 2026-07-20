"""ffmpeg audio bed — attaches the reel's audio (voice + ducked music + transition SFX)
onto an opaque Remotion render via stream-copy. Engine-agnostic helpers below are copied
verbatim from the former ffmpeg compositor;
the transient duplication is intentional so this module has no dependency on that engine.
"""

from __future__ import annotations

import os
import subprocess

# Slide-transition SFX (real MIT @remotion/sfx sounds), matched per transition type.
_SFX_TRANS_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "sfx", "transitions"))
# Mirror of @sentezy/types BROLL_SFX_MAP — keep in sync.
_BROLL_SFX_MAP = {
    "fade": "swoosh", "slide": "shutter-modern", "wipe": "page-turn", "flip": "whip",
    "clockwipe": "switch", "iris": "swoosh", "zoom": "swoosh", "blur": "swoosh",
    "push": "switch", "zoompunch": "whip", "shake": "whip", "glitch": "switch",
    "whip": "whip", "flash": "shutter-modern",
}

# Transition SFX (whoosh) mix level, 0..1 of full scale.
SFX_VOLUME = 0.30

# B-roll entrance-effect ids (per-clip animations, near-cut) vs. between-clip transitions —
# mirror of @sentezy/types BROLL_EFFECT_META (kind:"entrance") / effects.tsx.
_BROLL_ENTRANCE = frozenset({"zoompunch", "shake", "glitch", "whip", "flash"})


def _transition_lead(transition: str | None) -> float:
    """Seconds the whoosh begins BEFORE a cutaway's boundary — the transition's own duration, so
    the whoosh rises through the slide (which spans [boundary − T, boundary]) and peaks as the
    clip lands. Mirrors the composition's brollTransition timing (0.4s transitions / 0.12s
    entrances) and the web slideSfxCues lead, for audio↔visual parity."""
    return 0.12 if (transition or "") in _BROLL_ENTRANCE else 0.4


def _run(cmd: list[str]) -> None:
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if proc.returncode != 0:
        tail = proc.stderr.decode("utf-8", "replace")[-2000:]
        raise RuntimeError(f"ffmpeg failed ({proc.returncode}):\n{tail}")


def _transition_sfx_path(transition: str | None) -> str | None:
    """The slide-transition sound file matched to a B-roll effect id (BROLL_SFX_MAP),
    or None if that sound isn't bundled. Unknown transitions fall back to whoosh."""
    stem = _BROLL_SFX_MAP.get(transition or "", "swoosh")
    path = os.path.join(_SFX_TRANS_DIR, f"{stem}.wav")
    return path if os.path.isfile(path) else None


def _append_audio_bed(
    fc: list[str],
    *,
    voice_idx: int,
    music_idx: int | None,
    music_volume: float,
    mixins: list[dict],
    voice_offset: float = 0.0,
    total_duration: float | None = None,
) -> list[str]:
    """Append the reel audio bed to `fc` and return the ffmpeg audio `-map` args:
    the avatar voice, optionally sidechain-ducked under a music bed, plus anything mixed in
    on top. Shared by both render engines so they sound identical.

    `mixins` are sounds laid over the bed at a given time — the B-roll transition whooshes,
    and the audio of an uploaded brand intro/outro clip. Each is
    {idx, at, volume, strip_silence}: `idx` is an input index already added to the command,
    `at` is its start in seconds on the FINAL timeline, and `strip_silence` trims leading
    quiet so a whoosh lands exactly on its cut — which must stay off for a brand clip,
    where trimming would slide the clip's audio away from its picture.

    `voice_offset`/`total_duration` carry the brand kit's intro and full reel length. The
    voice is delayed past the intro card and padded out to the full length; because the
    mix uses `duration=first` (keyed on the voice) and the command ends in `-shortest`,
    that padded voice is what lets the music bed play under the outro instead of the whole
    file being truncated back to where the speech stops."""
    # A shifted or padded voice has to go through the filter graph, even when there is no
    # music or SFX — otherwise the raw input would map straight through, undelayed.
    shift = voice_offset > 0 or total_duration is not None
    voice_src = f"[{voice_idx}:a]"
    if shift:
        parts = ["aformat=sample_rates=44100:channel_layouts=stereo"]
        if voice_offset > 0:
            ms = int(round(voice_offset * 1000))
            parts.append(f"adelay={ms}|{ms}")
        if total_duration is not None:
            parts.append(f"apad=whole_dur={total_duration}")
        fc.append(f"[{voice_idx}:a]{','.join(parts)}[vsrc]")
        voice_src = "[vsrc]"

    need_bed = music_idx is not None or bool(mixins)
    if not need_bed:
        return ["-map", voice_src] if shift else ["-map", f"{voice_idx}:a?"]
    if music_idx is not None:
        # Voice is consumed twice (mix + sidechain key) → split it. aformat on both
        # branches: sidechaincompress errors on mismatched rates/layouts.
        fc.append(f"{voice_src}aformat=sample_rates=44100:channel_layouts=stereo,asplit=2[vox][sck]")
        fc.append(f"[{music_idx}:a]aformat=sample_rates=44100:channel_layouts=stereo,volume={music_volume}[mus]")
        # The voice keys a compressor on the music, so the bed dips while speaking.
        fc.append("[mus][sck]sidechaincompress=threshold=0.04:ratio=10:attack=8:release=350:makeup=1[duck]")
        # normalize=0: keep the voice at full level (default amix would halve it).
        fc.append("[vox][duck]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[abed]")
    else:
        fc.append(f"{voice_src}aformat=sample_rates=44100:channel_layouts=stereo[abed]")
    if mixins:
        # Each mixin → level + delay to its start, then mix all into the bed.
        delayed = []
        for k, m in enumerate(mixins):
            ms = max(0, int(round(float(m["at"]) * 1000)))
            vol = m.get("volume", SFX_VOLUME)
            strip = ",silenceremove=start_periods=1:start_threshold=-50dB" if m.get("strip_silence") else ""
            fc.append(
                f"[{m['idx']}:a]aformat=sample_rates=44100:channel_layouts=stereo{strip}"
                f",volume={vol},adelay={ms}|{ms}[wd{k}]"
            )
            delayed.append(f"[wd{k}]")
        fc.append(f"[abed]{''.join(delayed)}amix=inputs={1 + len(delayed)}:duration=first:dropout_transition=0:normalize=0[a]")
        return ["-map", "[a]"]
    return ["-map", "[abed]"]


def _ffmpeg_audio_cmd(
    *,
    video_path: str,
    voice_path: str,
    out_path: str,
    music_path: str | None,
    music_volume: float,
    broll: list[dict],
    transition_sfx: bool,
    voice_offset: float = 0.0,
    total_duration: float | None = None,
    clip_audio: list[dict] | None = None,
) -> list[str]:
    """Build the ffmpeg argv that stream-copies the opaque render's video and attaches the
    reel audio bed (voice + ducked music + transition SFX). Pure — no process spawned.

    `voice_offset` is the brand intro's length: everything on the word clock (the voice and
    the B-roll whooshes) sits that much later in the finished file.

    `clip_audio` is [{path, at}] for uploaded brand intro/outro clips. The Remotion render
    is silent by design, so a clip's own soundtrack has to be re-attached here or the
    intro would play in dead silence."""
    # [0] opaque video (video copied), [1] avatar voice.
    inputs: list[str] = ["-i", video_path, "-i", voice_path]
    voice_idx = 1
    idx = 2

    music_idx = None
    if music_path:
        # Loop the bed indefinitely — most catalog tracks are shorter than a full ad.
        # `amix ... duration=first` (below) truncates the mix back to the voice length,
        # so this only prevents the bed from running out early; nothing else changes.
        # Matches the preview, where <Audio loop /> plays the bed continuously (Reel.tsx).
        inputs += ["-stream_loop", "-1", "-i", music_path]
        music_idx = idx
        idx += 1

    # transition whooshes: one per B-roll cutaway that slides in (clips 1..N-1). Clip 0
    # appears without a transition (the backdrop is already shown), so it gets none. Each
    # whoosh BEGINS one transition-duration before its cutaway's boundary (see _transition_lead),
    # so it rises through the visible slide — matching the web preview (slideSfxCues) and the
    # composition's brollTransition placement.
    sfx_times: list[float] = []
    sfx_files: list[str] = []
    if transition_sfx:
        for k in range(1, len(broll)):
            _p = _transition_sfx_path(broll[k].get("transition"))
            if _p:
                sfx_files.append(_p)
                # Clamp to 0 on the word clock BEFORE the offset, then shift: the whoosh
                # belongs to the body, so an intro moves it later by exactly the intro.
                sfx_times.append(
                    max(0.0, float(broll[k]["start"]) - _transition_lead(broll[k].get("transition")))
                    + voice_offset
                )

    mixins: list[dict] = []
    for k, f in enumerate(sfx_files):
        inputs += ["-i", f]
        # strip_silence: trim leading quiet so the audible whoosh lands on the slide.
        mixins.append({"idx": idx, "at": sfx_times[k], "volume": SFX_VOLUME, "strip_silence": True})
        idx += 1

    # A brand clip's own audio, at full level and NOT silence-trimmed — trimming would
    # slide the sound away from the clip's picture.
    for c in clip_audio or []:
        inputs += ["-i", c["path"]]
        mixins.append({"idx": idx, "at": float(c["at"]), "volume": 1.0, "strip_silence": False})
        idx += 1

    fc: list[str] = []
    audio_map = _append_audio_bed(
        fc,
        voice_idx=voice_idx,
        music_idx=music_idx,
        music_volume=music_volume,
        mixins=mixins,
        voice_offset=voice_offset,
        total_duration=total_duration,
    )

    cmd = ["ffmpeg", "-y", *inputs]
    if fc:
        cmd += ["-filter_complex", ";".join(fc)]
    cmd += [
        "-map", "0:v",
        *audio_map,
        "-c:v", "copy",
        "-c:a", "aac", "-b:a", "128k",
        "-shortest", "-movflags", "+faststart",
        out_path,
    ]
    return cmd


def mux_audio(
    video_path: str,
    voice_path: str,
    out_path: str,
    *,
    music_path: str | None = None,
    music_volume: float = 0.15,
    broll: list[dict] | None = None,
    transition_sfx: bool = True,
    voice_offset: float = 0.0,
    total_duration: float | None = None,
    clip_audio: list[dict] | None = None,
) -> None:
    """Attach the reel's audio bed to the opaque Remotion render (video stream-copied)."""
    _run(_ffmpeg_audio_cmd(
        video_path=video_path, voice_path=voice_path, out_path=out_path,
        music_path=music_path, music_volume=music_volume,
        broll=broll or [], transition_sfx=transition_sfx,
        voice_offset=voice_offset, total_duration=total_duration,
        clip_audio=clip_audio,
    ))
