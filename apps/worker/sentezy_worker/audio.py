"""ffmpeg audio bed — attaches the reel's audio (voice + ducked music + transition/AI SFX)
onto an opaque Remotion render via stream-copy. Engine-agnostic helpers below are copied
verbatim from `compose.py` (the ffmpeg-composited engine, deleted wholesale in Task 15);
the transient duplication is intentional so this module has no dependency on that engine.
"""

from __future__ import annotations

import os
import subprocess

# Slide-transition SFX (real MIT @remotion/sfx sounds), matched per transition type.
_SFX_TRANS_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "sfx", "transitions"))
# Mirror of @sentezy/types BROLL_SFX_MAP — keep in sync.
_BROLL_SFX_MAP = {
    "fade": "whoosh", "slide": "whoosh", "wipe": "page-turn", "flip": "whip",
    "clockwipe": "switch", "iris": "whoosh", "zoom": "whoosh", "blur": "whoosh",
    "push": "switch", "zoompunch": "whip", "shake": "whip", "glitch": "switch",
    "whip": "whip", "flash": "shutter-modern",
}

# Transition SFX (whoosh) mix level, 0..1 of full scale.
SFX_VOLUME = 0.20

# Lead time (seconds) each transition whoosh lands before its cutaway's absolute start —
# the same placement the web preview uses (slideSfxCues), for audio parity. Does NOT use
# the deleted ffmpeg `_xfade` (Remotion owns transitions now); the lead is a fixed constant.
SFX_TRANSITION_LEAD = 0.2


def _run(cmd: list[str]) -> None:
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if proc.returncode != 0:
        tail = proc.stderr.decode("utf-8", "replace")[-2000:]
        raise RuntimeError(f"ffmpeg failed ({proc.returncode}):\n{tail}")


def _transition_sfx_path(transition: str | None) -> str | None:
    """The slide-transition sound file matched to a B-roll effect id (BROLL_SFX_MAP),
    or None if that sound isn't bundled. Unknown transitions fall back to whoosh."""
    stem = _BROLL_SFX_MAP.get(transition or "", "whoosh")
    path = os.path.join(_SFX_TRANS_DIR, f"{stem}.wav")
    return path if os.path.isfile(path) else None


def _append_audio_bed(
    fc: list[str],
    *,
    voice_idx: int,
    music_idx: int | None,
    music_volume: float,
    sfx_input_idxs: list[int],
    sfx_times: list[float],
    sfx_gains: list[float] | None = None,
) -> list[str]:
    """Append the reel audio bed to `fc` and return the ffmpeg audio `-map` args:
    the avatar voice, optionally sidechain-ducked under a music bed, plus a transition
    whoosh mixed in at each cutaway. Shared by both render engines so they sound identical.
    `voice_idx`/`music_idx`/`sfx_input_idxs` are input indices already added to the command."""
    need_bed = music_idx is not None or bool(sfx_input_idxs)
    if not need_bed:
        return ["-map", f"{voice_idx}:a?"]
    if music_idx is not None:
        # Voice is consumed twice (mix + sidechain key) → split it. aformat on both
        # branches: sidechaincompress errors on mismatched rates/layouts.
        fc.append(f"[{voice_idx}:a]aformat=sample_rates=44100:channel_layouts=stereo,asplit=2[vox][sck]")
        fc.append(f"[{music_idx}:a]aformat=sample_rates=44100:channel_layouts=stereo,volume={music_volume}[mus]")
        # The voice keys a compressor on the music, so the bed dips while speaking.
        fc.append("[mus][sck]sidechaincompress=threshold=0.04:ratio=10:attack=8:release=350:makeup=1[duck]")
        # normalize=0: keep the voice at full level (default amix would halve it).
        fc.append("[vox][duck]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[abed]")
    else:
        fc.append(f"[{voice_idx}:a]aformat=sample_rates=44100:channel_layouts=stereo[abed]")
    if sfx_input_idxs:
        # Each SFX file → level + delay to its slide start, then mix all into the bed.
        delayed = []
        for k, in_idx in enumerate(sfx_input_idxs):
            ms = max(0, int(round(sfx_times[k] * 1000)))
            vol = (sfx_gains[k] if sfx_gains is not None and k < len(sfx_gains) else SFX_VOLUME)
            # strip any leading silence so the audible whoosh lands exactly on the slide.
            fc.append(f"[{in_idx}:a]aformat=sample_rates=44100:channel_layouts=stereo,silenceremove=start_periods=1:start_threshold=-50dB,volume={vol},adelay={ms}|{ms}[wd{k}]")
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
    sfx_cues: list[dict],
) -> list[str]:
    """Build the ffmpeg argv that stream-copies the opaque render's video and attaches the
    reel audio bed (voice + ducked music + transition/AI SFX). Pure — no process spawned."""
    # [0] opaque video (video copied), [1] avatar voice.
    inputs: list[str] = ["-i", video_path, "-i", voice_path]
    voice_idx = 1
    idx = 2

    music_idx = None
    if music_path:
        inputs += ["-i", music_path]
        music_idx = idx
        idx += 1

    # transition whooshes: one per B-roll cutaway that slides in (clips 1..N-1). Clip 0
    # appears without a transition (the backdrop is already shown), so it gets none. Each
    # whoosh lands SFX_TRANSITION_LEAD seconds before its cutaway's absolute start — the same
    # placement the web preview uses (slideSfxCues), for audio parity. NOTE: does NOT use the
    # deleted ffmpeg `_xfade` (Remotion owns transitions now); the lead is a fixed constant.
    sfx_times: list[float] = []
    sfx_files: list[str] = []
    if transition_sfx:
        for k in range(1, len(broll)):
            _p = _transition_sfx_path(broll[k].get("transition"))
            if _p:
                sfx_files.append(_p)
                sfx_times.append(max(0.0, float(broll[k]["start"]) - SFX_TRANSITION_LEAD))

    sfx_input_idxs: list[int] = []
    for f in sfx_files:
        inputs += ["-i", f]
        sfx_input_idxs.append(idx)
        idx += 1

    # AI voice-timed SFX: one input per cue, mixed at per-cue gain.
    sfx_gains: list[float] = [SFX_VOLUME] * len(sfx_input_idxs)
    for cue in (sfx_cues or []):
        inputs += ["-i", cue["path"]]
        sfx_input_idxs.append(idx)
        sfx_times.append(float(cue["time"]))
        sfx_gains.append(float(cue["gain"]))
        idx += 1

    fc: list[str] = []
    audio_map = _append_audio_bed(
        fc,
        voice_idx=voice_idx,
        music_idx=music_idx,
        music_volume=music_volume,
        sfx_input_idxs=sfx_input_idxs,
        sfx_times=sfx_times,
        sfx_gains=sfx_gains,
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
    sfx_cues: list[dict] | None = None,
) -> None:
    """Attach the reel's audio bed to the opaque Remotion render (video stream-copied)."""
    _run(_ffmpeg_audio_cmd(
        video_path=video_path, voice_path=voice_path, out_path=out_path,
        music_path=music_path, music_volume=music_volume,
        broll=broll or [], transition_sfx=transition_sfx, sfx_cues=sfx_cues or [],
    ))
