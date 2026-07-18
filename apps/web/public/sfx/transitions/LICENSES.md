# Slide-transition sound effects

Real sounds from the **[@remotion/sfx](https://www.remotion.dev/docs/sfx/)** library
(remotion.media), **MIT-licensed, normalized to -3dB peak, no attribution required**.
Downloaded verbatim from `https://remotion.media/{stem}.wav`.

Files (stems referenced by `BROLL_SFX_MAP` in `@sentezy/types`):
- `whoosh.wav` — fade / slide / iris / zoom / blur
- `whip.wav` — flip / whip / zoompunch / shake
- `page-turn.wav` — wipe
- `switch.wav` — clockwipe / push / glitch
- `shutter-modern.wav` — flash

Mirrored in `apps/worker/sfx/transitions/` for the ffmpeg render. Keep the two in sync.
These are distinct from the AI voice-timed SFX in `apps/web/public/sfx/` (still placeholders).
