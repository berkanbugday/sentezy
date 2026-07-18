# SFX asset licenses

Placeholder assets only — the full 16-effect royalty-free library (with per-file source +
license attribution) is sourced in a later task (see `SFX_META` in `@sentezy/types` for the
target id list).

Current files are synthetic sine-tone placeholders generated locally with ffmpeg purely to
exercise the `sfxSrc()` / `resolvePreviewSfx()` import and runtime path during development.
They are not sourced from any third party and carry no license restrictions, but they are NOT
final production audio and must be replaced.

- `whoosh.mp3` — `ffmpeg -f lavfi -i "sine=frequency=800:duration=0.25" -q:a 9 whoosh.mp3`
- `cash.mp3` — `ffmpeg -f lavfi -i "sine=frequency=400:duration=0.3" -q:a 9 cash.mp3`
