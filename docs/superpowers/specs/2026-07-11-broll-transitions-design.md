# Per-photo B-roll transitions

## Context
The rendered reels are functional but flat — the only transition between B-roll photos is a hardcoded
alpha dissolve. To move toward "viral reels" quality, the creator should be able to choose the transition
effect for each photo, from the full catalog of effects ffmpeg can do. This is step 1 of a step-by-step
polish pass.

## Current behaviour
- `pipeline._broll_segments` places photos **back-to-back** in the middle window (`[mid_start, mid_end]`),
  avatar-over-blur only at the hook/close. So photos are effectively a continuous slideshow.
- `compose.compose_reel` overlays each photo independently onto the base with `zoompan` (Ken-Burns) +
  alpha `fade` in/out, gated to its time window. No `xfade`; only a dissolve.

## Design

### Worker — rebuild the middle slideshow with `xfade`
Because photos are adjacent, replace the per-photo alpha-overlay loop with an **`xfade` chain**, which
exposes ffmpeg's full named-transition catalog.
- Per photo: `cover` → `zoompan` (Ken-Burns, kept) → loop to length `L = span + d`.
- Join consecutive photos: `xfade=transition=<T_i>:duration=d:offset=k*span`, where `T_i` is **the incoming
  photo's chosen transition** (so "per-photo" = how each photo enters). Photo #0 has no predecessor → it
  just fades in from the base.
- Overlay the finished slideshow onto the base during `[mid_start, mid_end]` with a short alpha fade at the
  slideshow's outer edges (enter from / exit to the A-roll); avatar overlaid on top as today.
- Timing: `d = min(0.35, span*0.5)`; clip length `L = span + d`; xfade `offset_k = k*span`. Net slideshow
  length ≈ `n*span (+d)`, trimmed to the window — total video length unchanged.
- **Hard "cut"** = `xfade=transition=fade:duration≈0.02` (near-instant).

### Security — whitelist transitions
The transition string is interpolated into the filtergraph, so the worker MUST validate each value against
a known allow-list of xfade names (+ our synthetic `cut`); unknown → fall back to `fade`. Never pass a raw
user string into `xfade=transition=`.

### Data flow
- Web `bgImages: {id,url,transition}`; a new form field `backgroundTransitions: string[]` aligned to
  `backgroundImageIds` order.
- `buildOptions` → `options.background.transitions: string[]` (aligned to `images`).
- Resume reads `options.background.transitions` back into `bgImages`.
- Worker: `_resolve_broll_images` returns paths in order; `_broll_segments` attaches `transition` per
  segment (default `"fade"` when missing/short script); `compose_reel` applies it.

### Web UI — SetupStep B-roll list
Each uploaded photo thumbnail gains a compact **transition `<select>`** (default *Crossfade*). Options are
the full catalog, grouped with `<optgroup>` for scannability: Basic (Crossfade, Cut, Fade to black/white),
Slides, Wipes, Smooth, Shapes, Slices, Effects (dissolve, pixelize, radial, zoomin, …). Values are the
exact xfade names; `cut` is synthetic.

## Files
- `apps/worker/sentezy_worker/compose.py` — xfade slideshow + transition allow-list.
- `apps/worker/sentezy_worker/pipeline.py` — thread `transitions` into `_broll_segments` / `compose_reel`.
- `apps/web/src/lib/schemas.ts` — add `backgroundTransitions`.
- `apps/web/src/components/WizardSteps.tsx` — per-photo transition `<select>` in SetupStep; shared
  `TRANSITIONS` catalog.
- `apps/web/src/components/CreateWizard.tsx` — `BgImage.transition`, `syncBgImages`, `buildOptions`, resume.

## Verification
- Worker: `python -m py_compile` both files; a standalone ffmpeg smoke test building a 3-photo xfade chain
  with a couple of transitions (slideleft, circleopen) → confirms the graph runs and `xfade` exists in the
  Docker ffmpeg (`has_filter("xfade")`).
- Web: `tsc --noEmit`; the SetupStep shows a transition dropdown per photo, persists via autosave, and
  resumes.
- End-to-end: rebuild the worker, generate a reel with 2–3 photos each set to a different transition, and
  confirm the transitions appear (paid HeyGen render — do when ready).
