from __future__ import annotations

import time

import httpx

# HeyGen Avatar IV — v3 image-to-video: a single photo + audio drives a
# photorealistic talking video. Docs: https://developers.heygen.com/image-to-video
# Flow: POST /v3/videos with the presenter image URL + ElevenLabs audio URL →
# video_id, then poll GET /v3/videos/{id} until completed.
# NOTE: v3 Avatar IV has no test/sandbox mode — every render spends real credits.


class HeyGen:
    API = "https://api.heygen.com"

    def __init__(self, api_key: str):
        self.key = api_key

    def _h(self) -> dict:
        return {"x-api-key": self.key, "Content-Type": "application/json"}

    def generate(
        self,
        image_url: str,
        audio_url: str,
        aspect_ratio: str,
        resolution: str = "1080p",
        title: str = "Sentezy reel",
    ) -> str:
        payload = {
            "type": "image",
            "image": {"type": "url", "url": image_url},
            "audio_url": audio_url,
            "title": title,
            "resolution": resolution,
            "aspect_ratio": aspect_ratio,
        }
        r = httpx.post(f"{self.API}/v3/videos", headers=self._h(), json=payload, timeout=60)
        r.raise_for_status()
        return r.json()["data"]["video_id"]

    def wait_for_url(self, video_id: str, timeout_s: int = 900, interval_s: int = 5) -> str:
        deadline = time.time() + timeout_s
        while time.time() < deadline:
            r = httpx.get(
                f"{self.API}/v3/videos/{video_id}",
                headers={"x-api-key": self.key},
                timeout=30,
            )
            r.raise_for_status()
            body = r.json()
            data = body.get("data", body)  # v3 wraps results under `data`
            status = data.get("status")
            if status == "completed":
                url = data.get("video_url") or (data.get("video") or {}).get("url")
                if not url:
                    raise RuntimeError(f"heygen_completed_no_url: {body}")
                return url
            if status in ("failed", "error"):
                raise RuntimeError(f"heygen_failed: {data.get('error') or data}")
            time.sleep(interval_s)
        raise TimeoutError("heygen_timeout")
