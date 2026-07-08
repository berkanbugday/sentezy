from __future__ import annotations

import boto3
import httpx

from .config import Config


class Storage:
    def __init__(self, cfg: Config):
        self.cfg = cfg
        self.s3 = boto3.client(
            "s3",
            endpoint_url=f"https://{cfg.cf_account_id}.r2.cloudflarestorage.com",
            aws_access_key_id=cfg.r2_access_key_id,
            aws_secret_access_key=cfg.r2_secret_access_key,
            region_name="auto",
        )

    # ── R2 (audio/video) ──
    def upload_r2(self, local_path: str, key: str, content_type: str) -> str:
        self.s3.upload_file(local_path, self.cfg.r2_bucket, key, ExtraArgs={"ContentType": content_type})
        return key

    def r2_url(self, key: str, expires: int = 86400) -> str:
        """Public CDN URL if configured, else a signed GET URL (used to hand audio to HeyGen)."""
        if self.cfg.r2_public_url:
            return f"{self.cfg.r2_public_url.rstrip('/')}/{key}"
        return self.s3.generate_presigned_url(
            "get_object", Params={"Bucket": self.cfg.r2_bucket, "Key": key}, ExpiresIn=expires
        )

    # ── Cloudflare Images ──
    def cf_image_url(self, image_id: str, variant: str = "public") -> str:
        return f"https://imagedelivery.net/{self.cfg.cf_images_account_hash}/{image_id}/{variant}"

    def upload_cf_image(self, local_path: str) -> str:
        url = f"https://api.cloudflare.com/client/v4/accounts/{self.cfg.cf_account_id}/images/v1"
        with open(local_path, "rb") as f:
            r = httpx.post(
                url,
                headers={"Authorization": f"Bearer {self.cfg.cf_images_api_token}"},
                files={"file": (local_path.rsplit("/", 1)[-1], f)},
                timeout=60,
            )
        r.raise_for_status()
        return r.json()["result"]["id"]

    # ── generic download ──
    def download(self, url: str, dest: str) -> None:
        with httpx.stream("GET", url, timeout=180, follow_redirects=True) as r:
            r.raise_for_status()
            with open(dest, "wb") as f:
                for chunk in r.iter_bytes():
                    f.write(chunk)

    def download_bytes(self, url: str) -> bytes:
        r = httpx.get(url, timeout=120, follow_redirects=True)
        r.raise_for_status()
        return r.content
