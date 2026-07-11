# apps/worker (Python)

Redis Streams consumer that renders reels. Not part of the pnpm workspace (managed with **uv**).

## Pipeline (`sentezy_worker/pipeline.py`)

1. **TTS** — ElevenLabs `with-timestamps` → audio (mp3) + word timings → upload to R2.
2. **Avatar** — upload presenter photo to HeyGen (once → `heygen_talking_photo_id`), generate an
   audio-driven talking-photo video, poll, download; then matte the green screen off
   (`matte.py`, RobustVideoMatting) → alpha presenter clip carrying the voice.
3. **Compose** — ffmpeg: blurred-B-roll (or branded color) backdrop → auto-timed full-frame
   B-roll cutaways (crossfade + Ken-Burns) → presenter cut-out framed to one side → burned
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
