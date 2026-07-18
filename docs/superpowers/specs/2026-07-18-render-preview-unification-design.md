# Render ≡ Preview: unify on one Remotion composition

**Date:** 2026-07-18
**Status:** Approved (design), pending spec review → implementation plan
**Owner:** Berkan

## Goal

The finished reel must be **pixel-identical to the in-app preview**, the render pipeline must have **one code path**, and all dead/duplicated compositing code must be **deleted**. Division of labour:

- **Remotion** renders the entire visual — B-roll + transitions + avatar + captions — as one **opaque H.264**.
- **ffmpeg** does everything else — the audio bed (voice + ducked music + SFX), the mux, and the thumbnail.

This was chosen over a "Remotion overlays + ffmpeg composites the avatar" split because a single composition rendered by both the browser `<Player>` (preview) and `renderMedia` (actual) makes the two **identical by construction**, with the fewest moving parts.

## Current state (what exists today)

- **Preview** — the "Önizle" button in `MediaComposer` opens `composer/SfxPreviewModal.tsx`, which renders `packages/remotion/src/preview/ReelPreview.tsx` in a `@remotion/player` `<Player>`: full-frame B-roll slideshow with real Remotion transitions + avatar still `<Img>` + `CaptionOverlay` + `SfxTrack` audio. This is preview-only (`index.ts` note: "never registered in Root.tsx").
- **Actual** — `apps/worker/sentezy_worker/compose.py` (`compose_reel`, 790 lines of ffmpeg) composites: matted avatar over B-roll with **ffmpeg xfade** transitions (`_xfade`/`_BROLL_TO_XFADE`/`_EFFECTS`), captions via **libass ASS** (`build_captions_ass`, default) *or* a separate Remotion transparent caption overlay (`CAPTION_ENGINE=remotion`), plus music/SFX/logo.
- **Divergence today:** transitions (Remotion presentations vs ffmpeg xfade approximations) and captions (Remotion vs libass) differ between preview and actual. B-roll timing models also differ (preview = even full-duration slideshow; worker = hook/cutaways/close).
- **Caption renderer** — `infra/cloudflare/caption-renderer/` exposes `POST /render` → composition `CaptionOverlay` → **ProRes 4444 alpha** `.mov` overlay, uploaded to R2 or streamed inline. Worker client: `providers/captions_remotion.py`.

## Decisions (locked)

1. **Render split:** one Remotion pass renders the whole visual (incl. avatar via `OffthreadVideo`) → opaque H.264; ffmpeg does audio + mux + thumbnail only.
2. **Fallback:** none. The old ffmpeg compositor is **deleted**. A renderer outage surfaces a clear error and relies on the existing Redis retry — no divergent second engine.
3. **B-roll timing:** **avatar hook → B-roll cutaways → avatar CTA close** (the ad structure the worker already used). The preview is updated to render exactly this.

## Architecture

```
             ┌─────────────────── packages/remotion ───────────────────┐
             │  reel/Reel.tsx  (ONE composition, calculateMetadata)     │
             │    ├ BrollLayer   (hook→cutaways→close + transitions)    │
             │    ├ AvatarLayer  (Img in browser / OffthreadVideo in    │
             │    │               render — branch on src type)          │
             │    ├ CaptionOverlay                                       │
             │    └ SfxTrack      (previewAudio prop: audible in Player, │
             │                     silent in render)                     │
             └──────────────┬───────────────────────┬───────────────────┘
                            │                        │
         web <Player>  (preview)            renderMedia (renderer)
         SfxPreviewModal                    codec h264, opaque
                                                     │  reels/{id}.mp4
                                                     ▼
                                       ffmpeg mux_audio  (voice + ducked
                                       music + transition/AI SFX) + thumbnail
                                                     │
                                                     ▼  videos/{id}.mp4
```

### Component: `Reel` composition (`packages/remotion/src/reel/`)

**Responsibility:** the complete reel visual, identical in the browser and the renderer.

- `Reel.tsx` — composition component. Props (`ReelProps`):
  `{ words, avatarUrl, broll: [{url, kind, transition}], captionStyle: {styleId, font, color}, layout, position, avatarSide, captions, previewAudio, sfxCues, width, height, fps }`.
  Media are URLs: local `blob:`/`data:`/signed R2 in the browser; signed R2 GET in the renderer.
- `AvatarLayer.tsx` — renders `<Img>` when `avatarUrl` is an image (`data:`/`blob:`/image extension) and `<OffthreadVideo transparent>` when it is a video matte (`.mov`/`.webm`/http video). Bottom-anchored; side/bottom framing; scale/anchor constants live here and are the single source of avatar framing for both contexts.
- `BrollLayer.tsx` — the hook→cutaways→close structure: a short avatar-only hook, B-roll cutaways filling the middle joined by their chosen `brollTransition`, an avatar-only CTA close. Full-duration blurred backdrop behind the hook/close.
- `timing.ts` — deterministic hook/mid/close + per-clip window math from `words` + `broll` length. Pure, shared, so preview and render place every clip on the same frame.
- `SfxTrack` (moved from `preview/`) — mounted inside `Reel`, gated by `previewAudio`. In the render `previewAudio=false` → no audio in the composition (the render is opaque + silent; ffmpeg supplies audio).

**Registration:** `Root.tsx` registers `Reel` (with `calculateMetadata` deriving `durationInFrames` from `words`, using the existing `durationFromWords`). The standalone `CaptionOverlay` composition is removed (its only render consumer, `/render`, is deleted); the `CaptionOverlay` **component** stays, used inside `Reel` and by the web caption-picker tile.

**Deleted:** `preview/ReelPreview.tsx` (superseded).

### Component: renderer (`infra/cloudflare/reel-renderer/`, renamed from `caption-renderer`)

**Responsibility:** run `renderMedia` for composition `Reel` → opaque H.264.

- `container/server.mjs` — replace `POST /render` with **`POST /render-reel`**: `selectComposition({id:"Reel"})` → `renderMedia({ codec:"h264", imageFormat:"jpeg", outputLocation })` (opaque; no ProRes/alpha/PNG). Deliver to R2 `reels/{jobId}.mp4` (prod) or stream inline (local), via the existing `deliver()` helper (`keyField:"reelKey"`, `contentType:"video/mp4"`). Warm-bundle reuse unchanged.
- `src/index.ts` (CF Worker) — relay `/render-reel`.
- Rename the service in `wrangler.jsonc`, the `infra/docker-compose.yml` service, and worker env accordingly. (Pre-prod, so the rename is safe.)

### Component: worker audio (`apps/worker/sentezy_worker/audio.py`, new)

**Responsibility:** build the final audio and mux it onto the opaque render.

- Keeps (moved from `compose.py`): `_append_audio_bed`, `_sfx_slide_times`, `_transition_sfx_path`, `_BROLL_SFX_MAP`, `SFX_VOLUME`, `Word`.
- **New `mux_audio(video_path, voice_path, out_path, *, width, height, music_path, music_volume, broll, transition_sfx, sfx_cues)`** — inputs = the opaque render (`-c:v copy`, no re-encode) + voice + music + SFX; reuses `_append_audio_bed` to produce voice + sidechain-ducked music + transition/AI SFX; `-movflags +faststart`.

### Component: worker thumbnail (`apps/worker/sentezy_worker/thumbnail.py`, new)

- `make_thumbnail(video_path, out_path, at="00:00:01")` (moved verbatim from `compose.py`).

### Component: worker render provider (`apps/worker/sentezy_worker/providers/reel_remotion.py`, new — replaces `captions_remotion.py`)

- `render_reel(renderer_url, storage, props, *, job_id, dest)` — POST `/render-reel`; handles JSON `{reelKey}` (download signed) or inline mp4 bytes.
- `render_reel_local(props, *, dest, workdir)` — shell `remotion render <entry> Reel <dest> --codec=h264 --props=…` for dev without a deployed renderer.
- Deletes `captions_remotion.py`.

### Component: `pipeline.py`

Replace the compose step (steps 3–4) with:

1. `matte_video_to_mov(avatar_path, cutout.mov)` (unchanged).
2. Upload cutout → R2 `cutouts/{video_id}.mov`; `signed_get_url`.
3. Resolve B-roll (existing `_resolve_broll_media`), sign each `ref`.
4. Build `ReelProps` (avatarUrl = signed cutout, broll = signed urls + kind + transition, captionStyle/layout/position/avatarSide from options, `captions`, dims, fps=30).
5. `render_reel` (HTTP if `reel_renderer_url` else `render_reel_local`) → opaque `reel_video.mp4`.
6. `mux_audio(reel_video, voice=audio_path, …, broll=segments, sfx_cues=resolved)` → `reel.mp4`.
7. `make_thumbnail` + upload (unchanged).

Delete: all caption-engine branching, `build_captions_ass` call, `compose_reel` call, `caption_overlay`/`captions_ass` handling.

### Component: `config.py`

- Delete `caption_engine`.
- Rename `caption_renderer_url` → `reel_renderer_url` (env `REEL_RENDERER_URL`; local CLI when unset).

## Deletions (dead-code sweep, scoped to the pipeline)

- `compose.py` → reduced to nothing after the two extractions; **file removed**. Gone: `build_captions_ass`, `_font_metrics`, `_text_width`, `_rounded_rect`, `_CAPTION_STYLES`, `_HORMOZI_ACCENT`, `_keyword_index`, `_hex_to_ass`, `_ass_time`, `_tr_upper`, `_STOPWORDS`, `_FONT_FILES`/`_font_cache`/`_FONTS_DIR`, `has_filter`/`_FILTERS`, `_XFADE_TRANSITIONS`, `_BROLL_TO_XFADE`, `_xfade`, `_EFFECTS`, `_entrance_fx`, `_effect_blend`, `_duration`, `compose_reel`.
- `apps/worker/fonts/` — libass-only; fonts now live in the Remotion bundle. Removed.
- `fontTools` dependency — removed from `pyproject.toml` (only `compose.py` used it).
- `providers/captions_remotion.py` — removed.
- `packages/remotion/src/preview/ReelPreview.tsx` — removed; `preview/SfxTrack.tsx` moved under `reel/`.
- Renderer `POST /render` (caption overlay) and the standalone `CaptionOverlay` composition — removed.
- Stale exports in `packages/remotion/src/index.ts` (`ReelPreview`, `PreviewBrollItem`, `ReelPreviewProps`) — replaced by `Reel`/`ReelProps`.

## Audio parity (explicit requirement)

Visual identity is guaranteed by construction. Audio is built by ffmpeg (`mux_audio`) and played in the preview by `SfxTrack`, so parity is a **requirement, not a guarantee**:

- Both derive from the **same resolved cue set**: transition whooshes at the same slide times (`_sfx_slide_times` / `BROLL_SFX_MAP`) **and** the same AI SFX cues (`resolve_sfx_cues`), at the same gains.
- The web already fetches AI cues on preview open so the modal matches the render; this spec adds transition-whoosh parity so `SfxTrack` and `mux_audio` play the identical set.
- Music ducking (sidechain params) is the single implementation in `_append_audio_bed`; the preview may approximate music but must not diverge in SFX placement.

## Web changes (`apps/web`)

- `SfxPreviewModal` and any other preview mount: `<Player component={Reel}>` with `ReelProps` (replaces `ReelPreview`/`ReelPreviewProps`).
- Preview passes the same inputs the worker sends: avatar still image, B-roll (url+kind+transition), caption style/font/color, layout/position/avatarSide, `captions`, resolved SFX cues, `previewAudio:true`.
- No new preview surface; the existing "Önizle" modal *is* the identical-to-render preview.

## Testing / verification

- **remotion**: `tsc --noEmit`; CLI `remotion render … Reel …` (opaque h264) produces a valid 1080×1920 mp4; CLI stills confirm hook/cutaway/close beats + transitions + captions.
- **renderer**: local docker `POST /render-reel` returns a valid opaque mp4 (avatar composited over B-roll, captions on top).
- **worker**: `py_compile` + `ruff`; `mux_audio` on the opaque render produces valid h264+aac with voice + ducked music + SFX; unit test for audio-bed `-map` args retained (`tests/test_sfx.py`).
- **web**: `tsc --noEmit` + `next build`; the "Önizle" modal renders `Reel` in the browser (verify in a real browser — headless Chrome doesn't reliably paint `<Player>`).
- **end-to-end parity**: one job through the stack; eyeball the finished mp4 against the modal — same transitions, captions, layout, timing; same SFX placement. (ElevenLabs-credit-gated; Berkan's manual step.)

## Out of scope

- Ad templates / motion-graphic primitives (TitleCard/CTACard/Sticker/Badge/Countdown) — not in the current committed code; not rebuilt here.
- Any repo-wide refactor beyond the render pipeline and its immediate surface.
- HeyGen/ElevenLabs/emotion/matte logic — unchanged.

## Risks

- **Renderer latency/availability** — single path means an outage fails the job (mitigated by clear status + Redis retry; acceptable per decision 2).
- **`OffthreadVideo transparent` on the ProRes-4444 matte** — proven in a prior spike; re-verify on the current renderer build.
- **Audio parity drift** — the one non-by-construction seam; pinned by the audio-parity requirement and an e2e eyeball check.
- **Renderer commercial licence** — Remotion needs a licence at 4+ people; arrange before prod (unchanged from prior notes).
