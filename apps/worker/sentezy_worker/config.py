from __future__ import annotations

import os
from dataclasses import dataclass


def _get(key: str, default: str | None = None, *, required: bool = False) -> str | None:
    value = os.environ.get(key, default)
    if required and not value:
        raise RuntimeError(f"Missing required env var: {key}")
    return value


@dataclass(frozen=True)
class Config:
    database_url: str
    redis_url: str
    # Cloudflare account id is shared by R2 + Images
    cf_account_id: str
    r2_access_key_id: str
    r2_secret_access_key: str
    r2_bucket: str
    r2_public_url: str | None
    cf_images_api_token: str
    cf_images_account_hash: str
    elevenlabs_api_key: str
    heygen_api_key: str


def load_config() -> Config:
    return Config(
        database_url=_get("SUPABASE_DB_URL", required=True),  # type: ignore[arg-type]
        redis_url=_get("REDIS_URL", "redis://localhost:6379"),  # type: ignore[arg-type]
        cf_account_id=_get("R2_ACCOUNT_ID", required=True),  # type: ignore[arg-type]
        r2_access_key_id=_get("R2_ACCESS_KEY_ID", required=True),  # type: ignore[arg-type]
        r2_secret_access_key=_get("R2_SECRET_ACCESS_KEY", required=True),  # type: ignore[arg-type]
        r2_bucket=_get("R2_BUCKET", "sentezy-media"),  # type: ignore[arg-type]
        r2_public_url=_get("R2_PUBLIC_URL"),
        cf_images_api_token=_get("CF_IMAGES_API_TOKEN", required=True),  # type: ignore[arg-type]
        cf_images_account_hash=_get("CF_IMAGES_ACCOUNT_HASH", required=True),  # type: ignore[arg-type]
        elevenlabs_api_key=_get("ELEVENLABS_API_KEY", required=True),  # type: ignore[arg-type]
        heygen_api_key=_get("HEYGEN_API_KEY", required=True),  # type: ignore[arg-type]
    )
