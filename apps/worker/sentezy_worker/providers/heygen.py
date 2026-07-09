from __future__ import annotations

import time

import httpx

# NOTE: HeyGen API shapes evolve — verify against current docs during Phase 6.
# Flow: upload the presenter photo → talking_photo_id, then generate a video driven
# by the ElevenLabs audio (voice.type = "audio"), poll until completed, return the URL.


class HeyGen:
    API = "https://api.heygen.com"
    UPLOAD = "https://upload.heygen.com"

    def __init__(self, api_key: str, test_mode: bool = False):
        self.key = api_key
        # test_mode → watermarked render that does not spend paid credits (Phase 6 local E2E).
        self.test_mode = test_mode

    def _h(self) -> dict:
        return {"X-Api-Key": self.key}

    def upload_talking_photo(self, image_bytes: bytes, content_type: str = "image/jpeg") -> str:
        r = httpx.post(
            f"{self.UPLOAD}/v1/talking_photo",
            headers={**self._h(), "Content-Type": content_type},
            content=image_bytes,
            timeout=120,
        )
        r.raise_for_status()
        return r.json()["data"]["talking_photo_id"]

    def generate(self, talking_photo_id: str, audio_url: str, width: int, height: int) -> str:
        payload = {
            "video_inputs": [
                {
                    "character": {"type": "talking_photo", "talking_photo_id": talking_photo_id},
                    "voice": {"type": "audio", "audio_url": audio_url},
                }
            ],
            "dimension": {"width": width, "height": height},
            "test": self.test_mode,
        }
        r = httpx.post(
            f"{self.API}/v2/video/generate",
            headers={**self._h(), "Content-Type": "application/json"},
            json=payload,
            timeout=60,
        )
        r.raise_for_status()
        return r.json()["data"]["video_id"]

    def wait_for_url(self, video_id: str, timeout_s: int = 900, interval_s: int = 5) -> str:
        deadline = time.time() + timeout_s
        while time.time() < deadline:
            r = httpx.get(
                f"{self.API}/v1/video_status.get",
                headers=self._h(),
                params={"video_id": video_id},
                timeout=30,
            )
            r.raise_for_status()
            data = r.json()["data"]
            status = data.get("status")
            if status == "completed":
                return data["video_url"]
            if status in ("failed", "error"):
                raise RuntimeError(f"heygen_failed: {data.get('error')}")
            time.sleep(interval_s)
        raise TimeoutError("heygen_timeout")
