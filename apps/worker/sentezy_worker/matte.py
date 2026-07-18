"""AI background removal (matting) for the avatar.

Uses RobustVideoMatting (mobilenetv3 ONNX, via onnxruntime — no torch) to cut the
avatar out of their green-screen backdrop so the reel can composite them over
B-roll. Works on a still (for the avatar picker thumbnail) and on the HeyGen A-roll
video (for the reel), with a green-spill removal pass so hair edges stay neutral.

Provider-independent and stdlib-friendly: frames move through ffmpeg pipes.
"""

from __future__ import annotations

import os
import subprocess

import httpx
import numpy as np
import onnxruntime as ort

_MODEL_URL = "https://github.com/PeterL1n/RobustVideoMatting/releases/download/v1.0.0/rvm_mobilenetv3_fp32.onnx"
_session: ort.InferenceSession | None = None


def _model_path() -> str:
    """Locate the RVM model; download it on first use (git-ignored, not committed)."""
    env = os.environ.get("RVM_MODEL_PATH")
    if env and os.path.exists(env):
        return env
    root = os.path.dirname(os.path.dirname(__file__))  # apps/worker
    path = os.path.join(root, ".models", "rvm_mobilenetv3_fp32.onnx")
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with httpx.stream("GET", _MODEL_URL, timeout=300, follow_redirects=True) as r:
            r.raise_for_status()
            with open(path, "wb") as f:
                for chunk in r.iter_bytes():
                    f.write(chunk)
    return path


def _sess() -> ort.InferenceSession:
    global _session
    if _session is None:
        _session = ort.InferenceSession(_model_path(), providers=["CPUExecutionProvider"])
    return _session


def _despill(fgr: np.ndarray) -> np.ndarray:
    """Remove green spill: pull the green channel down to (r+b)/2 where it spikes."""
    rb = (fgr[..., 0] + fgr[..., 2]) / 2
    fgr[..., 1] = np.minimum(fgr[..., 1], rb)
    return fgr


def _zero_rec() -> list[np.ndarray]:
    return [np.zeros([1, 1, 1, 1], np.float32) for _ in range(4)]


def _run(rgb: np.ndarray, rec: list[np.ndarray], dsr: np.ndarray):
    """One frame → (fgr HWC float[0,1], pha HW float[0,1], new recurrent state)."""
    src = (rgb.astype(np.float32) / 255.0).transpose(2, 0, 1)[None]
    fgr, pha, *rec = _sess().run(
        [], {"src": src, "r1i": rec[0], "r2i": rec[1], "r3i": rec[2], "r4i": rec[3], "downsample_ratio": dsr}
    )
    return _despill(fgr[0].transpose(1, 2, 0)), pha[0, 0], list(rec)


def _probe(path: str) -> tuple[int, int, float]:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height,r_frame_rate", "-of", "csv=p=0", path],
        capture_output=True, text=True, check=True).stdout.strip().split(",")
    w, h, rate = int(out[0]), int(out[1]), out[2]
    num, den = (rate.split("/") + ["1"])[:2]
    fps = float(num) / float(den or 1)
    return w, h, fps


def _downsample_ratio(h: int) -> np.ndarray:
    # RVM guidance: ~0.25 for 1080p-class; a touch higher for smaller frames.
    return np.array([0.25 if h >= 1440 else 0.375], np.float32)


def matte_image_to_png(in_path: str, out_path: str) -> None:
    """Cut a person out of a still and write a straight-alpha RGBA PNG (picker thumbnail)."""
    w, h, _ = _probe(in_path)
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", in_path, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        capture_output=True, check=True).stdout
    rgb = np.frombuffer(raw, np.uint8).reshape(h, w, 3)
    fgr, pha, _ = _run(rgb, _zero_rec(), _downsample_ratio(h))
    rgba = np.dstack([np.clip(fgr, 0, 1) * 255, np.clip(pha, 0, 1) * 255]).astype(np.uint8)
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgba",
         "-s", f"{w}x{h}", "-i", "-", "-frames:v", "1", out_path],
        input=rgba.tobytes(), check=True)


def matte_video(in_path: str, out_path: str) -> None:
    """Cut the avatar out of the A-roll → a VIDEO-ONLY WebM VP9 clip with alpha (yuva420p).

    Streams frames through ffmpeg pipes, matting each with recurrent state for temporal
    stability. WebM/VP9-alpha keeps the cutout ~130× smaller than ProRes 4444 (≈5MB vs
    ≈670MB), so shipping it to the Remotion renderer is a ~2s upload + a fast OffthreadVideo
    decode — the ProRes cutout was a ~5min upload and starved the renderer into a font-load
    timeout. No audio is embedded: the reel's voice is muxed separately downstream
    (`audio.mux_audio` takes the voice from the TTS mp3), and the renderer decodes the cutout
    with a muted `OffthreadVideo`. Muxing the source audio with `-shortest` also broke matting
    whenever the source audio was shorter than its video (the encoder stopped early → BrokenPipe
    on the next frame write), so it is intentionally omitted.
    """
    w, h, fps = _probe(in_path)
    dsr = _downsample_ratio(h)
    frame_bytes = w * h * 3

    dec = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-i", in_path, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        stdout=subprocess.PIPE)
    enc = subprocess.Popen(
        ["ffmpeg", "-y", "-v", "error",
         "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{w}x{h}", "-r", f"{fps:.6f}", "-i", "pipe:0",
         "-map", "0:v",
         "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "1500k",
         "-deadline", "good", "-cpu-used", "4", out_path],
        stdin=subprocess.PIPE)

    rec = _zero_rec()
    assert dec.stdout and enc.stdin
    try:
        while True:
            buf = dec.stdout.read(frame_bytes)
            if len(buf) < frame_bytes:
                break
            rgb = np.frombuffer(buf, np.uint8).reshape(h, w, 3)
            fgr, pha, rec = _run(rgb, rec, dsr)
            rgba = np.dstack([np.clip(fgr, 0, 1) * 255, np.clip(pha, 0, 1) * 255]).astype(np.uint8)
            enc.stdin.write(rgba.tobytes())
    finally:
        if enc.stdin:
            enc.stdin.close()
        dec.wait()
        if enc.wait() != 0:
            raise RuntimeError("matte encode failed")
