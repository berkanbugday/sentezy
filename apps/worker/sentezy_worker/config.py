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
    # Cloudflare account id — used for the R2 S3 endpoint.
    cf_account_id: str
    r2_access_key_id: str
    r2_secret_access_key: str
    r2_bucket: str
    r2_public_url: str | None
    elevenlabs_api_key: str
    heygen_api_key: str
    # Optional — enables the per-sentence emotion-tagging LLM pass (emotion.py).
    # OpenRouter (free models) is preferred; Anthropic is the fallback provider.
    openrouter_api_key: str | None
    openrouter_model: str
    anthropic_api_key: str | None
    # Dev vs prod (from NODE_ENV). In dev the pipeline skips HeyGen entirely and holds
    # the avatar photo as a still, so local runs need no HeyGen key or credits.
    is_dev: bool


def load_config() -> Config:
    # Default to prod so a missing NODE_ENV never silently disables HeyGen.
    is_dev = (_get("NODE_ENV", "production") or "production").strip().lower() in ("development", "dev")
    return Config(
        database_url=_get("SUPABASE_DB_URL", required=True),  # type: ignore[arg-type]
        redis_url=_get("REDIS_URL", "redis://localhost:6379"),  # type: ignore[arg-type]
        cf_account_id=_get("R2_ACCOUNT_ID", required=True),  # type: ignore[arg-type]
        r2_access_key_id=_get("R2_ACCESS_KEY_ID", required=True),  # type: ignore[arg-type]
        r2_secret_access_key=_get("R2_SECRET_ACCESS_KEY", required=True),  # type: ignore[arg-type]
        r2_bucket=_get("R2_BUCKET", "sentezy-media"),  # type: ignore[arg-type]
        r2_public_url=_get("R2_PUBLIC_URL"),
        elevenlabs_api_key=_get("ELEVENLABS_API_KEY", required=True),  # type: ignore[arg-type]
        heygen_api_key=_get("HEYGEN_API_KEY", "", required=not is_dev),  # type: ignore[arg-type]  # unused in dev (photo bypass)
        openrouter_api_key=_get("OPENROUTER_API_KEY"),
        openrouter_model=_get("OPENROUTER_MODEL", "google/gemma-4-31b-it:free"),  # type: ignore[arg-type]
        anthropic_api_key=_get("ANTHROPIC_API_KEY"),
        is_dev=is_dev,
    )
