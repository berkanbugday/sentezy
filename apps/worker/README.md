# apps/worker (Python)

Redis Streams consumer that renders reels. Not part of the pnpm workspace (managed with **uv**).

## Pipeline (`sentezy_worker/pipeline.py`)

1. **TTS** — ElevenLabs `with-timestamps` → audio (mp3) + word timings → upload to R2.
2. **Avatar** — HeyGen **Avatar IV** (v3 `/v3/videos` image-to-video): the avatar photo URL +
   the ElevenLabs audio URL drive a photorealistic talking video; poll, download; then matte the
   green screen off (`matte.py`, RobustVideoMatting) → alpha avatar clip carrying the voice.
   Avatar IV has **no test mode** — every render spends real HeyGen credits (~$4/min).
3. **Compose** — ffmpeg: blurred-B-roll (or branded color) backdrop → auto-timed full-frame
   B-roll cutaways (crossfade + Ken-Burns) → avatar cut-out framed to one side → burned
   captions (karaoke/hormozi/clean ASS from word timings) → optional logo + sidechain-ducked
   music. (`compose.py`)
4. **Thumbnail** — poster frame → Cloudflare Images.
5. Upload reel → R2, thumbnail → Cloudflare Images, mark `videos.status = ready`.

Progress/status is written to Postgres at each stage (`db.py`); the web app watches via Supabase Realtime.

## Run locally

```bash
uv sync
# needs Redis (see infra/docker-compose in Phase 6) + the root .env
uv run python -m sentezy_worker.main
```

## Notes

- **Captions need libass.** The Docker image installs an ffmpeg that has it; `compose.py` auto-skips
  caption burn-in when the `subtitles` filter is unavailable (e.g. some local ffmpeg builds).
- HeyGen API shapes (`providers/heygen.py`) should be re-verified against current docs during Phase 6.
- Queue stream/group (`sentezy:videos` / `worker`) must match `packages/types` on the API side.
