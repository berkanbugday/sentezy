# Dev/prod env + dev HeyGen bypass + avatar prompt framing

**Date:** 2026-07-15
**Status:** approved

## Goals
1. A dev vs prod environment switch.
2. In dev, skip the HeyGen API entirely and use the selected avatar photo as the avatar.
3. Update avatar-generation prompts so subjects aren't clipped on the left/right in the composited video.

## 1. Environment flag (reuse `NODE_ENV`)
- Worker `config.py`: read `NODE_ENV` (default `production`). `Config` gains `is_dev: bool` where `is_dev = NODE_ENV.lower() in ("development","dev")`. **Unset → prod** (HeyGen still called unless dev is explicit).
- `HEYGEN_API_KEY` becomes required **only in prod** (`required=not is_dev`), so a dev box without the key can run.
- Local: set `NODE_ENV=development` in the repo-root `.env` (the worker container loads it via `env_file`). The API already reads `NODE_ENV`; HeyGen is worker-only, so no API code change.

## 2. Dev HeyGen bypass → static photo through the real pipeline
In `pipeline.process_video`, the HeyGen step becomes conditional on `cfg.is_dev`:
- **prod:** unchanged — `hg.generate → wait_for_url → download` → `avatar.mp4`.
- **dev:** download the avatar's `source_image_id` photo, then `_still_avatar_video(photo, audio, avatar.mp4)` builds a still-image video held for the audio duration with the voice muxed in (one ffmpeg call: `-loop 1 -i photo -i audio -shortest`, `-tune stillimage`, even dims for `yuv420p`).
- Downstream is identical: RVM matte → `avatar.mov` (carries voice) → composite over B-roll → captions/effects. Faithful reel, no lip-sync, no HeyGen credits/wait.

New helper `_still_avatar_video(photo_path, audio_path, out_path)` in `pipeline.py`.

## 3. Avatar prompt framing (`apps/api/src/data/avatars.json`, prompts only)
All 100 avatars share two framing phrases; replace uniformly:
- `upper body (head and shoulders)` → `upper body from mid-chest up, loosely framed with clear space around the subject`
- `single person, centered` → `single person, centered with generous empty margin on BOTH the left and right — the subject occupies only ~55–60% of the frame width, full shoulders visible with clear space to each side edge and never touching or cropped by the frame edges`

Prompts only — regeneration (`generate_avatars.py --force`, spends image-gen credits) is a separate manual step, not run here.

## Files
- `apps/worker/sentezy_worker/config.py`
- `apps/worker/sentezy_worker/pipeline.py`
- `apps/api/src/data/avatars.json`
- Worker image rebuild to ship the pipeline change.

## Verification
- `py_compile` the worker changes.
- Render a dev-mode still avatar video in-container and matte it, to confirm the bypass path produces a valid `avatar.mov`.
- Spot-check a couple updated prompts.
