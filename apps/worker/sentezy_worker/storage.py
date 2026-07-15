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
        """Public CDN URL if configured, else a signed GET URL. NOTE: while R2_PUBLIC_URL
        points at the S3 endpoint (not a public domain), this is NOT fetchable by external
        providers — use signed_get_url for anything HeyGen/third parties must download."""
        if self.cfg.r2_public_url:
            return f"{self.cfg.r2_public_url.rstrip('/')}/{key}"
        return self.signed_get_url(key, expires)

    def signed_get_url(self, key: str, expires: int = 3600) -> str:
        """Presigned GET URL — always fetchable regardless of public-URL config."""
        return self.s3.generate_presigned_url(
            "get_object", Params={"Bucket": self.cfg.r2_bucket, "Key": key}, ExpiresIn=expires
        )

    def image_url(self, key: str, expires: int = 86400) -> str:
        """Signed GET URL for an image stored in R2 (avatars, presenters, B-roll photos).
        Long-lived by default so external providers (HeyGen) can fetch it."""
        return self.signed_get_url(key, expires)

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
