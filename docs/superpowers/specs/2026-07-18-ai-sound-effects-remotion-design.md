# AI Sound Effects, rendered by Remotion — Design

**Date:** 2026-07-18
**Status:** Approved (design), pending implementation plan

## Summary

An AI reads the video script and places **sound effects** at meaningful moments — some
anchored to specific spoken words ("voice-timed"), some to B-roll slide transitions
("slide-synced"). A **free OpenRouter model** chooses the effects from a curated,
bundled SFX library. **Remotion** renders those effects — in both the in-app **preview**
(so the user hears them before generating) and the **final video**. The preview and the
final render use the **same Remotion composition**, so what you preview is what you get.

**Render split (decided after brainstorming):** the deleted Remotion full-compositor is
**not recoverable from git** (staged-but-never-committed, no longer in the index), so
rebuilding it would be a large from-scratch effort. Instead:
- **Preview** = a new, lightweight **preview-only** Remotion composition rendered in the
  web `<Player>` (reuses the existing `CaptionOverlay` + B-roll slide effects, adds an SFX
  audio layer). It never renders to a file — no `registerRoot`, no Cloudflare container.
- **Final video** = the existing, intact ffmpeg `compose_reel`, **extended to inject the AI
  SFX into its audio bed** (which already places transition whooshes at arbitrary times).

The SFX feature itself is identical either way (same cues, files, timing logic); only the
visual preview is an approximation of the ffmpeg output rather than pixel-identical.

## Goals

- The AI understands the script and adds fitting sound effects to the video.
- The user **hears the SFX in the preview**, timed to the (estimated) voice and to slides.
- The **final rendered video** contains the same SFX, tightly synced to the real voiceover.
- Remotion renders a faithful in-app preview; the existing ffmpeg path renders the final video.
- Deterministic, offline-capable SFX (no per-render generation cost).

## Non-goals (v1 — YAGNI)

- Manual editing of SFX cues (add/remove/nudge). Auto-placement only; an editor can come later.
- AI-generated / bespoke SFX per cue (rejected: cost, latency, non-determinism).
- Real voiceover audio in the preview (no TTS at compose time; preview is voice-silent).
- Re-introducing the 4 ad-format templates.
- Rebuilding the deleted Remotion full-compositor / final-render path (final stays on ffmpeg).

## Key decisions (from brainstorming)

1. **Remotion renders the preview; ffmpeg renders the final.** A new preview-only Remotion
   composition powers the in-app `<Player>`; the existing `compose_reel` renders the final
   MP4, extended to inject the AI SFX into its audio bed. (No compositor rebuild — the
   deleted one is unrecoverable from git.)
2. **"Voice effect" = SFX timed to the voice** (placed at specific words) **+ SFX synced to slides.**
3. **Curated bundled SFX library** (~15-25 named/tagged royalty-free files), shared by
   Remotion (preview + render) and the worker.
4. **Free OpenRouter model** picks SFX + placement, same recipe as `emotion.py`.
5. **Preview audio** = SFX + music over *estimated* word timings, captions animating, **no
   spoken voice**. **Final render** re-anchors to real ElevenLabs word timings.
6. **Compose-time AI, word-index anchored** (Approach A): the AI runs once at compose time;
   cues are anchored to a word index, resolved to seconds per-environment.

## Architecture

### Data model — `@sentezy/types` (canonical)

Mirrors the shape the old `TEMPLATE_META` used (single source of truth):

```ts
export const SFX_META = [
  { id: "whoosh",   label: "Whoosh",   tags: ["transition", "swipe"] },
  { id: "ding",     label: "Ding",     tags: ["highlight", "correct", "notify"] },
  { id: "pop",      label: "Pop",      tags: ["appear", "bubble"] },
  { id: "boom",     label: "Boom",     tags: ["impact", "reveal", "big"] },
  { id: "applause", label: "Applause", tags: ["success", "celebrate"] },
  { id: "cash",     label: "Cash",     tags: ["money", "sale", "price"] },
  { id: "riser",    label: "Riser",    tags: ["buildup", "tension"] },
  { id: "click",    label: "Click",    tags: ["tap", "select"] },
  // … ~15-25 total (curated, royalty-free)
] as const;

export type SfxId = (typeof SFX_META)[number]["id"];
export const SFX_IDS = SFX_META.map((s) => s.id) as unknown as [SfxId, ...SfxId[]];
export const Sfx = z.enum(SFX_IDS);

export const SfxCue = z.object({
  sfxId: Sfx,
  wordIndex: z.number().int().min(0),          // anchor into tokenizeScript(script)
  gain: z.number().min(0).max(1).default(0.7), // per-cue mix level
});
export type SfxCue = z.infer<typeof SfxCue>;
```

`ReelOptions` gains:

```ts
sfx: z.object({
  enabled: z.boolean().default(true),
  cues: z.array(SfxCue).default([]),
}).default({}),
```

Stored inside `videos.options` JSONB — **no DB migration**.

### Shared tokenization

```ts
export function tokenizeScript(script: string): string[]
```

Strips `[emotion]` tags, splits on whitespace, keeps punctuation attached to its token.
`wordIndex` in every `SfxCue` indexes into this array. `previewWords` (web) is refactored
to tokenize via this function so client word indices match the canonical tokens.

### Timing resolution (word-index → seconds), per-environment

The cue stores `wordIndex` (portable). The Remotion composition receives **concrete
resolved times** — it never needs the word list for SFX:

- **Preview (web):** `time = previewWords(script)[cue.wordIndex].start` (estimated seconds).
- **Render (worker):** `time = alignedWord(cue.wordIndex).start` from the real ElevenLabs
  word list.

**Alignment (worker):** map canonical token index → ElevenLabs word.
- If `tokenCount === elevenLabsWordCount` → 1:1 by index (the common case; `emotion.py`
  preserves word count).
- Else → proportional fallback: `elWord[ round(i / tokenCount * (W - 1)) ]`.

This decoupling (word-index stored; seconds resolved locally) is what makes the preview
truthful and the final render exact. The alignment helper is the single integration-risk
point and is unit-tested.

### AI — `POST /videos/suggest-sfx` (apps/api)

- Request `{ script }` → Response `{ cues: SfxCue[] }`.
- Calls the **free OpenRouter model** via a minimal TS client (mirrors `emotion.py`):
  strict system prompt, JSON output, 429-retry with backoff + terminal-4xx handling.
  Env: `OPENROUTER_API_KEY` (already present) + a new `OPENROUTER_SFX_MODEL` following the
  existing `OPENROUTER_VISION_MODEL` comma-separated free-model fallback-chain convention.
- Prompt: numbered canonical tokens + SFX palette (id + tags). Model returns sparse cues
  (~3-10) mapping meaning → SFX (price/"indirim" → `cash`, success → `applause`,
  emphasis beat → `boom`, scene change → `whoosh`).
- **Guards:** zod-validate each cue; drop out-of-range `wordIndex` and unknown `sfxId`;
  cap total count; dedupe per word. Any failure (no key, bad JSON, timeout) → **empty
  cues** (degrade to no SFX, never break generation).
- **The worker is a pure consumer** — no Python SFX AI. The web fetches cues on preview
  open, and ensures they exist before generate (one `suggest-sfx` call if the preview was
  skipped). Cues persist in `options.sfx.cues`.

### Remotion preview composition — `packages/remotion` (new, preview-only)

A new `ReelPreview` React component, written fresh (the old compositor is unrecoverable),
composed from **existing** building blocks so it stays small:
- avatar **still image** framed to a side (no alpha video — preview only);
- B-roll with the existing slide transitions (`broll/effects`);
- captions via the existing `CaptionOverlay`;
- **`SfxTrack` (new)** — one `<Audio>` per resolved cue at its frame, plus the transition
  whooshes and (best-effort) music `<Audio>`.

It renders **only** in the web `<Player>` — it is **not** registered in `Root.tsx`, needs no
`registerRoot`, and never hits `renderMedia` or the Cloudflare container. Preview audio =
SFX (+ music if a preview-playable URL is available; music in preview is best-effort, since
`options.music.trackKey` is an R2 key needing a signed URL client-side). No spoken voice.

Props: `words: CaptionWord[]`, `avatarImageUrl`, `broll`, `captionStyle`, `layout`,
`captions`, `sfxCues: { src, time, gain }[]` (already resolved to seconds + a playable
`src`). No template motion-graphics, no `Reel` `<Composition>`, no `index.ts` reel exports.

### Worker — `apps/worker` (extend the existing ffmpeg render)

**No `reel_remotion.py`, no Remotion render path.** The change is confined to the existing
ffmpeg engine:
- In `pipeline.py`, resolve `options.sfx.cues` → `[{ path, time, gain }]` using the real
  ElevenLabs word list + the token↔word alignment helper (§ Timing). Skip when
  `options.sfx.enabled` is false. Pass the resolved list into `compose_reel`.
- In `compose.py`, `compose_reel` gains a `sfx_cues: list[dict] | None = None` param. Each
  cue is added as an ffmpeg input at its `time`, appended to the existing `sfx_input_idxs` /
  `sfx_times` that already feed `_append_audio_bed` alongside the transition whooshes.
- Per-cue `gain`: `_append_audio_bed` gains an optional parallel `sfx_gains` list (defaults
  to the existing constant `_SFX_VOLUME` when omitted), so cue gains apply without changing
  the whoosh behaviour.
- `sfxId → file` maps to the bundled SFX library (§ SFX assets). Missing file → cue skipped.

### Infra — `infra/cloudflare/caption-renderer`

**No changes.** The `/render` caption-overlay route is untouched; there is no reel render.

### Web — `apps/web`

- **New preview modal + player**, written fresh, mirroring the existing `LoopingPreview` /
  `CaptionTile` `<Player>` pattern (rAF `seekTo` driver), rendering the new `ReelPreview`
  component. **No template gallery.**
- **"Önizle" button returns** on `MediaComposer`, opening the preview.
- New `useSuggestSfx` mutation hook (mirrors `useVoicePreview`) → `POST /videos/suggest-sfx`.
  Called on preview open and, as a fallback, before generate if cues are empty. Cues held in
  composer state and included as `options.sfx` in the PATCH payload.
- **SFX on/off toggle** in `SettingsDrawer` (copy the existing "Geçiş efekti sesi" switch);
  new `ComposerSettings.sfxEnabled` (default off) → `options.sfx.enabled`.

### SFX assets

Add ~15-25 curated royalty-free SFX named `{id}.mp3` (matching `SFX_META` ids), placed in
**both** locations that need them:
- **`apps/web/public/sfx/`** — served to the web `<Player>` preview (referenced via Remotion
  `staticFile("sfx/{id}.mp3")`, the same convention `fonts.ts` uses).
- **`apps/worker/sfx/library/`** — read by `compose_reel` for the final ffmpeg render (the
  existing `apps/worker/sfx/` transition whooshes stay where they are).

`SFX_META` (ids) is the single contract both sides key off. Licenses recorded alongside the
files (as with the existing fonts/whooshes).

## Data flow

```
Script (compose time)
  └─> POST /videos/suggest-sfx ──(free OpenRouter)──> cues[{sfxId, wordIndex, gain}]
        stored in options.sfx.cues
  ├─ PREVIEW: tokenizeScript → estimated cue times → Remotion <Player> ReelPreview
  │            (captions + slide effects + SFX audio; no spoken voice)
  └─ GENERATE: options → worker
        └─ TTS (real words) → align cue.wordIndex → times
           → compose_reel (ffmpeg): captions + slides + voice + music
             + transition whooshes + AI SFX injected into the audio bed → final MP4
```

## Error handling & degradation

- `suggest-sfx` failure → empty cues → video renders with no AI SFX (still valid).
- `options.sfx.enabled === false` → no AI SFX cues resolved in preview or render (transition
  whooshes, governed separately by `effects.transitionSfx`, are unaffected).
- Missing SFX file for an id → that cue is skipped (logged), others play.
- Token↔word count mismatch at render → proportional fallback keeps SFX roughly placed.
- The final render is the **existing, unchanged ffmpeg path** — this feature only adds SFX
  inputs to its audio bed, so it cannot introduce a new render-failure mode. If `sfx_cues`
  resolution throws, it degrades to the current no-AI-SFX behaviour and the job still renders.

## Testing

- `tokenizeScript` — unit tests (emotion tags, punctuation, multiple spaces, empty).
- Worker alignment helper — 1:1 case, count-mismatch proportional case, empty cues.
- `suggest-sfx` — schema-validation/guard tests (out-of-range wordIndex, unknown sfxId,
  bad JSON → empty), with the OpenRouter call mocked.
- `SfxTrack` — cue at time t maps to the correct frame; disabled → no audio.
- Manual E2E: script → preview (hear SFX) → generate → downloaded MP4 has synced SFX.

## Open items for the implementation plan

- Final SFX library contents + sourcing royalty-free files + license records.
- Whether transition whooshes remain automatic or also become AI-chosen (default: automatic).
- Debounce vs preview-open trigger for `suggest-sfx`.
- No TS test runner exists in the repo; the plan uses `pnpm typecheck` + manual verification
  for TS and a minimal `pytest` for the worker alignment helper (rather than introducing
  vitest to packages that never had it).
