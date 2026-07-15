# R2-only image storage + drop HeyGen test mode

**Date:** 2026-07-15
**Status:** approved

## Part A — Remove HeyGen test mode
- `providers/heygen.py`: drop the `test_mode` ctor param, `self.test_mode`, and any `test`/`caption` flag it set in the request body.
- `config.py`: remove `heygen_test_mode` field + its `load_config` line; drop `HEYGEN_TEST_MODE`. Remove `_bool` helper if it becomes unused.
- `main.py`: `HeyGen(cfg.heygen_api_key)`.

## Part B — Cloudflare Images → R2 (images alongside video/audio)
Delivery is via **signed GET URLs** (R2 is not a public bucket — same pattern videos/audio already use). Image refs stored in the DB/options become **R2 keys** instead of CF Images IDs (columns are opaque `String`, so no DB migration).

### Upload contract (client → R2 presigned PUT)
- API `/backgrounds/upload`: presigned R2 PUT, key `images/{uuid}`, returns `{ id: key, uploadURL, imageUrl: signedDownloadUrl(key) }`.
- API presenter upload (`POST /presenters` new-photo path): same R2 presigned PUT (key `presenters/{uuid}`).
- Web `useUploadBackground`: switch from CF's `POST FormData` to **`PUT` raw file** with `Content-Type` (mirror `useUploadBackgroundVideo`).

### Delivery (API returns signed URLs)
- `routes/presenters.ts` `/avatars` + `/presenters`: `imageUrl(id)` → `await signedDownloadUrl(key)` (async map via `Promise.all`).
- `routes/videos.ts`: B-roll image delivery `imageUrl(ref)` → `signedDownloadUrl(ref)`.
- Delete `lib/cloudflareImages.ts`; remove `CF_IMAGES_API_TOKEN` / `CF_IMAGES_ACCOUNT_HASH` from `env.ts`. Keep `R2_ACCOUNT_ID` (R2 needs it).

### Worker
- `storage.py`: drop `cf_image_url` + `upload_cf_image`; image delivery = `signed_get_url(key)`; image upload = `upload_r2(path, key, ct)`.
- `pipeline.py`: `source_image_id` and B-roll image refs are R2 keys → `storage.signed_get_url(...)`.
- `config.py`: remove `cf_images_api_token` / `cf_images_account_hash` (keep `cf_account_id` = R2 account id).
- `scripts/generate_avatars.py` + `scripts/build_avatar_catalog.py`: upload generated portraits + matted thumbnails to R2 (`avatars/{uuid}`), write R2 keys into `avatars.json`.

### Web
- Delete `lib/images.ts` (`cfImageUrl` is dead) + `NEXT_PUBLIC_CF_IMAGES_HASH`.

### Existing avatars (forward-only)
- Blank the 4 populated `imageId`/`displayImageId` in `avatars.json` → all pending. Regenerate to R2 later via `generate_avatars.py` (with the new framing prompts).

## Files
Worker: `providers/heygen.py`, `config.py`, `main.py`, `storage.py`, `pipeline.py`, `scripts/generate_avatars.py`, `scripts/build_avatar_catalog.py`.
API: `env.ts`, `lib/cloudflareImages.ts` (delete), `routes/backgrounds.ts`, `routes/presenters.ts`, `routes/videos.ts`.
Web: `lib/images.ts` (delete), `lib/queries.ts`.
Data: `apps/api/src/data/avatars.json`.

## Verification
- `pnpm --filter @sentezy/api build` + `--filter @sentezy/web build` clean; worker `py_compile`.
- Grep shows zero remaining `cloudflareImages` / `cf_image` / `imagedelivery` / `CF_IMAGES` / `test_mode` references.
- Rebuild worker image.
