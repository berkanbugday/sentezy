#!/usr/bin/env python3
"""Generate portraits for the avatar catalog and upload them to Cloudflare Images.

Reads apps/api/src/data/avatars.json, and for every avatar whose `imageId` is still
empty: renders the stored `prompt` with an image model, uploads the result to
Cloudflare Images, and writes the new id back into the JSON (after each one, so an
interrupted run resumes cleanly).

Provider is pluggable via env — set whichever key you have:
    AVATAR_IMAGE_PROVIDER=openai    OPENAI_API_KEY=...        (gpt-image-1)
    AVATAR_IMAGE_PROVIDER=replicate REPLICATE_API_TOKEN=...   (FLUX 1.1 pro)
Cloudflare (same account as the app):
    R2_ACCOUNT_ID=...   CF_IMAGES_API_TOKEN=...

Examples:
    # cheap test: generate the first 3 pending avatars only
    python apps/worker/scripts/generate_avatars.py --limit 3
    # everything still pending
    python apps/worker/scripts/generate_avatars.py
    # specific avatars, re-generating even if they already have an image
    python apps/worker/scripts/generate_avatars.py --only can,elif --force
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import tempfile
import time

import httpx

# import the shared matting module (apps/worker on the path)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from sentezy_worker import matte  # noqa: E402

CATALOG = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "..", "api", "src", "data", "avatars.json")
)


# ── image providers → PNG bytes ──────────────────────────────────────────────
def gen_openai(prompt: str) -> bytes:
    key = os.environ["OPENAI_API_KEY"]
    quality = os.environ.get("AVATAR_IMAGE_QUALITY", "high")  # high = premium faces; medium/low = cheaper
    r = httpx.post(
        "https://api.openai.com/v1/images/generations",
        headers={"Authorization": f"Bearer {key}"},
        json={"model": "gpt-image-1", "prompt": prompt, "size": "1024x1536", "quality": quality, "n": 1},
        timeout=300,
    )
    r.raise_for_status()
    return base64.b64decode(r.json()["data"][0]["b64_json"])


def gen_replicate(prompt: str) -> bytes:
    key = os.environ["REPLICATE_API_TOKEN"]
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    r = httpx.post(
        "https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro/predictions",
        headers={**headers, "Prefer": "wait"},
        json={"input": {"prompt": prompt, "aspect_ratio": "2:3", "output_format": "png", "safety_tolerance": 2}},
        timeout=180,
    )
    r.raise_for_status()
    pred = r.json()
    # `Prefer: wait` usually returns it finished; poll otherwise.
    while pred["status"] not in ("succeeded", "failed", "canceled"):
        time.sleep(2)
        pred = httpx.get(pred["urls"]["get"], headers=headers, timeout=60).json()
    if pred["status"] != "succeeded":
        raise RuntimeError(f"replicate prediction {pred['status']}: {pred.get('error')}")
    out = pred["output"]
    url = out[0] if isinstance(out, list) else out
    img = httpx.get(url, timeout=120, follow_redirects=True)
    img.raise_for_status()
    return img.content


PROVIDERS = {"openai": gen_openai, "replicate": gen_replicate}


def upload_cf_image(png: bytes, account_id: str, token: str, name: str) -> str:
    """Upload PNG bytes to Cloudflare Images, return the image id (mirrors Storage.upload_cf_image)."""
    r = httpx.post(
        f"https://api.cloudflare.com/client/v4/accounts/{account_id}/images/v1",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": (f"{name}.png", png, "image/png")},
        timeout=60,
    )
    r.raise_for_status()
    return r.json()["result"]["id"]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="max avatars to generate (0 = all pending)")
    ap.add_argument("--only", default="", help="comma-separated slugs to generate")
    ap.add_argument("--force", action="store_true", help="re-generate even if imageId is already set")
    args = ap.parse_args()

    provider = os.environ.get("AVATAR_IMAGE_PROVIDER", "openai")
    if provider not in PROVIDERS:
        sys.exit(f"unknown AVATAR_IMAGE_PROVIDER={provider!r} (expected: {', '.join(PROVIDERS)})")
    generate = PROVIDERS[provider]
    account_id = os.environ.get("R2_ACCOUNT_ID") or os.environ["CF_ACCOUNT_ID"]
    cf_token = os.environ["CF_IMAGES_API_TOKEN"]

    with open(CATALOG, encoding="utf-8") as f:
        data = json.load(f)
    avatars = data["avatars"]

    only = {s.strip() for s in args.only.split(",") if s.strip()}
    todo = [
        a for a in avatars
        if (args.force or not a["imageId"]) and (not only or a["slug"] in only)
    ]
    if args.limit:
        todo = todo[: args.limit]
    if not todo:
        print("nothing to generate — all selected avatars already have images.")
        return

    print(f"provider={provider} · generating {len(todo)} avatar(s)…")
    for i, a in enumerate(todo, 1):
        print(f"[{i}/{len(todo)}] {a['name']} ({a['sectorLabel']}) …", end=" ", flush=True)
        try:
            png = generate(a["prompt"])  # green-screen source
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
                tmp.write(png)
                green_path = tmp.name
            # source (fed to HeyGen) keeps the green screen
            a["imageId"] = upload_cf_image(png, account_id, cf_token, a["slug"])
            # matted transparent thumbnail for the picker (never shows green)
            try:
                cut_path = green_path + ".cut.png"
                matte.matte_image_to_png(green_path, cut_path)
                with open(cut_path, "rb") as f:
                    a["displayImageId"] = upload_cf_image(f.read(), account_id, cf_token, a["slug"] + "-cut")
                os.unlink(cut_path)
            except Exception as e:  # noqa: BLE001 — non-fatal; picker falls back to the source
                print(f"(thumb skipped: {e})", end=" ")
            os.unlink(green_path)
            # persist after each success so an interrupted run resumes cleanly
            with open(CATALOG, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                f.write("\n")
            print(f"ok → {a['imageId']}")
        except Exception as e:  # noqa: BLE001 — keep going; failures stay pending for a retry
            print(f"FAILED: {e}")

    ready = sum(1 for a in avatars if a["imageId"])
    print(f"done — {ready}/{len(avatars)} avatars now have images.")


if __name__ == "__main__":
    main()
