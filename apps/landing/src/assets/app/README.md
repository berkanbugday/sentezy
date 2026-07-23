# App screenshots for the studio blocks

Drop PNGs here and the matching block appears on the landing page's `#platform` section on the
next build. Nothing else to change — `src/data/shots.ts` globs this directory and keeps only the
blocks whose screenshot exists, and `Nav`/`Footer` show the `#platform` link only when at least
one does.

| Filename | What to capture |
|---|---|
| `composer.png` | The media composer with an avatar and a voice selected |
| `captions.png` | The caption style picker, open |
| `brand-kit.png` | `/brand-kit`, with a logo and colors set |

**The filename is the key** — it must match `studio.blocks[].key` in `src/data/copy.ts` exactly.
A typo silently drops the block rather than erroring.

How to capture:
- 1440x900 viewport, 2x device pixel ratio (Chrome DevTools device toolbar, or a Retina screen).
- Crop to the white inset content panel — no OS chrome, no browser bar, no sidebar cut in half.
- Save as PNG. `astro:assets` downscales and emits WebP, so a heavy source file is fine.

This directory is `src/assets/`, **not** `public/`. Astro serves `public/` byte-for-byte; a 2x
1440x900 PNG there would ship several megabytes to every visitor.
