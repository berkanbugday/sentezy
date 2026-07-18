# SFX library (worker / ffmpeg render)

These `{id}.mp3` files (one per `SFX_META` id) are read by `compose_reel` to bake AI-placed
sound effects into the final video. They mirror `apps/web/public/sfx/` (used by the preview).

**⚠️ Placeholder audio** — synthesized single-tone ffmpeg placeholders. Replace with real,
curated royalty-free SFX before shipping (keep the exact `{id}.mp3` filenames; record source +
license here). Keep this directory in sync with `apps/web/public/sfx/`.

Note: the transition-whoosh SFX used for slide changes are separate — they live in
`apps/worker/sfx/` (`01-whoosh.mp3`, `02-transition.mp3`, `03-swoosh.mp3`), NOT here.
