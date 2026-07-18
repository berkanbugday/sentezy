# Render ≡ Preview Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the rendered reel pixel-identical to the in-app preview by rendering the entire visual from ONE Remotion composition (used by both the web `<Player>` and `renderMedia`), while ffmpeg is reduced to building the audio bed, muxing, and the thumbnail — deleting the parallel ffmpeg compositor, the libass caption engine, and all dead code.

**Architecture:** A single `Reel` composition in `packages/remotion` renders B-roll (hook→cutaways→CTA) + transitions + avatar (`<Img>` in browser, `<OffthreadVideo transparent>` matte in render) + captions. The Cloudflare renderer runs `renderMedia` on it → opaque H.264. The worker uploads the matted avatar + signs B-roll URLs, calls the renderer, then muxes voice + ducked music + SFX with `-c:v copy` and makes the thumbnail. No second render engine, no fallback.

**Tech Stack:** Remotion 4.x (React → video), `@remotion/transitions`, `@remotion/player`; Cloudflare Containers (Node + Chromium + FFmpeg); Python 3 worker (ffmpeg via subprocess, boto3/R2, httpx); pnpm + Turborepo monorepo.

## Global Constraints

- **Composition dims/fps:** 9:16 → 1080×1920; 1:1 → 1080×1080; 16:9 → 1920×1080. `fps = 30`. Duration = `ceil((lastWordEnd + 0.3) * fps)` frames (existing `durationFromWords`).
- **Render output:** opaque H.264, `imageFormat: "jpeg"` (NOT ProRes/alpha/PNG — that was captions-only).
- **Avatar source branch:** image (`data:`/`blob:`/image extension) → `<Img>`; video matte (`.mov`/`.webm`/http video) → `<OffthreadVideo transparent>`.
- **B-roll timing (shared formula, keep TS ↔ Python in sync):** `hook = min(1.6, total*0.22)` s; `close = min(1.4, total*0.18)` s; cutaways fill `[t0+hook, t1-close]` evenly; if the mid span `< 0.6` s, `hook = min(0.5, total*0.15)`, no close. `total = lastWord.end - firstWord.start`.
- **Rules of Hooks:** every `useContext`/`useVideoConfig`/`useCurrentFrame` call goes ABOVE any conditional `return` — windowed components must not change hook order at their window boundary (only the persistent `<Player>` catches this, not `renderMedia`).
- **Fonts:** loaded by `packages/remotion/src/fonts.ts` (`ensureFontsLoaded`, runs at module load). No worker-side fonts.
- **Git:** commits are DEFERRED — do not `git commit` unless the user asks (Berkan's standing rule). Each task ends with a **verification checkpoint** (stage changes, run the listed checks green); batch-commit later on request.
- **Bundle-standalone:** `packages/remotion` is bundled STANDALONE by the container (no `@sentezy/types` workspace pkg present). Therefore `@sentezy/types` may only be imported with `import type` (elided at build) — NEVER as a runtime value. Any needed constant (e.g. entrance ids) must be a local literal in the remotion package. (A runtime `@sentezy/types` import fails the container render with "Can't resolve '@sentezy/types'", even though the in-monorepo CLI render succeeds.)
- **Nothing is a fallback:** there is exactly one render path. On renderer failure the worker raises and the Redis consumer retries — no ffmpeg-compositor second path.

---

## File Structure

**`packages/remotion/src/`**
- `reel/timing.ts` — CREATE. Pure B-roll window math (frames) from words + clip count.
- `reel/AvatarLayer.tsx` — CREATE. Img⇄OffthreadVideo avatar, bottom-anchored, side/bottom framing.
- `reel/BrollLayer.tsx` — CREATE. Blurred backdrop + hook→cutaways→close TransitionSeries.
- `reel/SfxTrack.tsx` — MOVE from `preview/SfxTrack.tsx`.
- `reel/Reel.tsx` — CREATE. The composition: BrollLayer + AvatarLayer + CaptionOverlay + SfxTrack(previewAudio).
- `reel/types.ts` — CREATE. `ReelProps`.
- `Root.tsx` — MODIFY. Register `Reel`; remove standalone `CaptionOverlay` composition.
- `index.ts` — MODIFY. Export `Reel`/`ReelProps`/`brollSegments`; drop `ReelPreview`/`ReelPreviewProps`/`PreviewBrollItem`; keep `SfxTrack`/`ResolvedSfxCue` re-export from new path.
- `preview/ReelPreview.tsx`, `preview/SfxTrack.tsx`, `preview/` — DELETE.

**`infra/cloudflare/reel-renderer/`** (renamed from `caption-renderer/`)
- `container/server.mjs` — MODIFY. `/render` → `/render-reel` (opaque h264, `reelKey`).
- `src/index.ts` — MODIFY. Relay `/render-reel`; `CaptionRenderer`→`ReelRenderer`, binding `REEL_RENDERER`.
- `wrangler.jsonc` — MODIFY. `name`, `class_name`, binding.
- `README.md` — MODIFY. Endpoint/name.

**`apps/worker/sentezy_worker/`**
- `models.py` — CREATE. `Word` dataclass (moved out of `compose.py`).
- `audio.py` — CREATE. Audio-bed helpers (moved) + `mux_audio`.
- `thumbnail.py` — CREATE. `make_thumbnail` (moved).
- `providers/reel_remotion.py` — CREATE (replaces `captions_remotion.py`). `render_reel`/`render_reel_local`.
- `compose.py` — DELETE.
- `providers/captions_remotion.py` — DELETE.
- `config.py` — MODIFY. Drop `caption_engine`; `caption_renderer_url`→`reel_renderer_url`.
- `pipeline.py` — MODIFY. Single render path.
- `sfx.py`, `providers/elevenlabs.py` — MODIFY. Import `Word` from `models`.
- `pyproject.toml` — MODIFY. Remove `fonttools`.
- `fonts/` — DELETE (libass-only).
- `tests/test_sfx.py` — MODIFY. Import `Word` from `models`.
- `tests/test_audio.py` — CREATE. `mux_audio` arg-builder test.

**`apps/web/src/`**
- `components/composer/SfxPreviewModal.tsx` — MODIFY. Render `Reel` (was `ReelPreview`).
- `lib/sfxPreview.ts` — MODIFY. Use shared `brollSegments` for slide-SFX timing parity.

**`infra/docker-compose.yml`** — MODIFY. Rename service; drop `RENDER_ENGINE`/`CAPTION_ENGINE`; `CAPTION_RENDERER_URL`→`REEL_RENDERER_URL`.

---

## Phase 1 — Remotion `Reel` composition

### Task 1: B-roll timing math (`reel/timing.ts`)

**Files:**
- Create: `packages/remotion/src/reel/timing.ts`
- Test: `packages/remotion/src/reel/timing.test.ts`

**Interfaces:**
- Produces: `brollSegments(words: {start:number;end:number}[], clipCount: number, fps: number): { hookFrames: number; closeFrames: number; midFromFrame: number; midDurationFrames: number; clips: {fromFrame:number; durationInFrames:number}[] }` — clip frames are ABSOLUTE (0 = composition start). Empty `clips` when `clipCount===0` or `words` empty.

- [ ] **Step 1: Write the failing test**

```ts
// packages/remotion/src/reel/timing.test.ts
import assert from "node:assert";
import { brollSegments } from "./timing";

// 5s of words @30fps, 2 clips → hook=1.1s (min(1.6, 5*0.22)), close=0.9s (min(1.4,5*0.18)),
// mid=[1.1,4.1]=3.0s split into 2 → clip0 [1.1,2.6], clip1 [2.6,4.1].
const words = [{ start: 0, end: 0.5 }, { start: 4.5, end: 5.0 }];
const r = brollSegments(words, 2, 30);
assert.strictEqual(r.hookFrames, Math.round(1.1 * 30));
assert.strictEqual(r.closeFrames, Math.round(0.9 * 30));
assert.strictEqual(r.clips.length, 2);
assert.strictEqual(r.clips[0].fromFrame, Math.round(1.1 * 30));
assert.strictEqual(r.clips[0].durationInFrames, Math.round(1.5 * 30));
assert.strictEqual(r.clips[1].fromFrame, Math.round(2.6 * 30));

// no media → no clips
assert.strictEqual(brollSegments(words, 0, 30).clips.length, 0);
// empty words → no clips
assert.strictEqual(brollSegments([], 3, 30).clips.length, 0);

console.log("timing ok");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/remotion && npx tsx src/reel/timing.test.ts`
Expected: FAIL — `Cannot find module './timing'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/remotion/src/reel/timing.ts
export type BrollClipWindow = { fromFrame: number; durationInFrames: number };
export type BrollLayout = {
  hookFrames: number;
  closeFrames: number;
  midFromFrame: number;
  midDurationFrames: number;
  clips: BrollClipWindow[];
};

/**
 * Absolute frame windows for the reel's B-roll: a short avatar-only hook, evenly-spaced
 * cutaways filling the middle, an avatar-only CTA close. MUST mirror the worker's
 * `_broll_segments` proportions so preview and render place clips the same way.
 */
export function brollSegments(
  words: { start: number; end: number }[],
  clipCount: number,
  fps: number,
): BrollLayout {
  const empty: BrollLayout = { hookFrames: 0, closeFrames: 0, midFromFrame: 0, midDurationFrames: 0, clips: [] };
  if (clipCount <= 0 || words.length === 0) return empty;
  const t0 = words[0]!.start;
  const t1 = words[words.length - 1]!.end;
  const total = t1 - t0;
  if (total <= 0.1) return empty;

  let hook = Math.min(1.6, total * 0.22);
  const close = Math.min(1.4, total * 0.18);
  let midStart = t0 + hook;
  let midEnd = t1 - close;
  let hasClose = true;
  if (midEnd - midStart < 0.6) {
    hook = Math.min(0.5, total * 0.15);
    midStart = t0 + hook;
    midEnd = t1;
    hasClose = false;
  }
  const span = (midEnd - midStart) / clipCount;
  const sec = (s: number) => Math.round(s * fps); // absolute: frame 0 = composition t=0 (word clock)
  const clips: BrollClipWindow[] = [];
  for (let i = 0; i < clipCount; i++) {
    const s = midStart + i * span;
    const e = i < clipCount - 1 ? midStart + (i + 1) * span : midEnd;
    clips.push({ fromFrame: sec(s), durationInFrames: Math.max(1, sec(e) - sec(s)) });
  }
  return {
    hookFrames: Math.round(hook * fps),
    closeFrames: hasClose ? Math.round(close * fps) : 0,
    midFromFrame: sec(midStart),
    midDurationFrames: sec(midEnd) - sec(midStart),
    clips,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/remotion && npx tsx src/reel/timing.test.ts`
Expected: `timing ok`.

- [ ] **Step 5: Verification checkpoint**

Run: `pnpm --filter @sentezy/remotion exec tsc --noEmit`
Expected: no errors. Stage `packages/remotion/src/reel/timing.ts` + `timing.test.ts`.

---

### Task 2: Avatar layer (`reel/AvatarLayer.tsx`)

**Files:**
- Create: `packages/remotion/src/reel/AvatarLayer.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `AvatarLayer: React.FC<{ src: string; avatarSide: "left"|"right"; avatarLayout: "side"|"bottom" }>`; helper `isImageSrc(src: string): boolean`.

- [ ] **Step 1: Write the component**

```tsx
// packages/remotion/src/reel/AvatarLayer.tsx
import React from "react";
import { AbsoluteFill, Img, OffthreadVideo } from "remotion";

/** True when the src is a still image (data/blob URL or image extension) vs a video matte. */
export function isImageSrc(src: string): boolean {
  const s = src.split("?")[0]!.toLowerCase();
  if (s.startsWith("data:image") || s.startsWith("blob:")) return true;
  if (/\.(mov|webm|mp4|m4v)$/.test(s)) return false;
  return /\.(png|jpe?g|webp|gif|avif)$/.test(s) || s.startsWith("data:");
}

/**
 * The bottom-anchored avatar. In the browser <Player> the src is a still image (<Img>);
 * in the renderer it is the ProRes-4444 matte .mov, drawn with <OffthreadVideo transparent>
 * so its alpha composites over the B-roll. Framing (scale/anchor/side) lives here — the
 * single source of avatar placement for both preview and render.
 */
export const AvatarLayer: React.FC<{
  src: string;
  avatarSide: "left" | "right";
  avatarLayout: "side" | "bottom";
}> = ({ src, avatarSide, avatarLayout }) => {
  const heightPct = avatarLayout === "bottom" ? "54%" : "48%";
  const align = avatarLayout === "bottom" ? "center" : avatarSide === "left" ? "flex-start" : "flex-end";
  const media = isImageSrc(src) ? (
    <Img src={src} style={{ height: heightPct, objectFit: "contain" }} />
  ) : (
    <OffthreadVideo src={src} transparent style={{ height: heightPct, objectFit: "contain" }} />
  );
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: align }}>{media}</AbsoluteFill>
  );
};
```

- [ ] **Step 2: Verification checkpoint**

Run: `pnpm --filter @sentezy/remotion exec tsc --noEmit`
Expected: no errors. Stage the file.

---

### Task 3: B-roll layer (`reel/BrollLayer.tsx`)

**Files:**
- Create: `packages/remotion/src/reel/BrollLayer.tsx`

**Interfaces:**
- Consumes: `brollSegments` (Task 1); `brollTransition`, `BrollEntrance`, `isEntrance`, `TransitionSeries` from `../broll/effects`.
- Produces: `BrollLayer: React.FC<{ broll: {url:string; kind?:"image"|"video"; transition:string}[]; words:{start:number;end:number}[] }>`.

- [ ] **Step 1: Write the component**

```tsx
// packages/remotion/src/reel/BrollLayer.tsx
import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, Sequence, useVideoConfig } from "remotion";
import { BrollEntrance, brollTransition, isEntrance, TransitionSeries } from "../broll/effects";
import { brollSegments } from "./timing";

export type ReelBrollItem = { url: string; kind?: "image" | "video"; transition: string };

const COVER: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.85)" };

const Media: React.FC<{ item: ReelBrollItem }> = ({ item }) =>
  item.kind === "video" ? <OffthreadVideo src={item.url} muted style={COVER} /> : <Img src={item.url} style={COVER} />;

/**
 * Full-frame B-roll: a full-duration blurred backdrop of the first clip (so the avatar-only
 * hook/close read as a soft scene), with the sharp cutaways slotted into the mid window as a
 * TransitionSeries joined by each clip's chosen transition. Even one clip still gets a backdrop.
 */
export const BrollLayer: React.FC<{ broll: ReelBrollItem[]; words: { start: number; end: number }[] }> = ({
  broll,
  words,
}) => {
  const { fps, width, height, durationInFrames } = useVideoConfig();
  if (broll.length === 0) return <AbsoluteFill style={{ background: "radial-gradient(120% 120% at 50% 0%, #1a1c22, #0b0b0d)" }} />;

  const seg = brollSegments(words, broll.length, fps);
  const ov = Math.round(fps * 0.4); // transition overlap

  const children: React.ReactNode[] = [];
  broll.forEach((b, i) => {
    if (i > 0) {
      const tr = brollTransition(b.transition, { fps, width, height });
      children.push(<TransitionSeries.Transition key={`t${i}`} presentation={tr.presentation} timing={tr.timing} />);
    }
    // each clip's window + the overlap it shares with its neighbours' transitions
    const base = seg.clips[i]?.durationInFrames ?? Math.round(durationInFrames / broll.length);
    // A sequence must be at least as long as the transitions touching it (up to 2×ov for an
    // interior clip) or Remotion throws; otherwise use the clip's own window length.
    const dur = Math.max(ov * 2 + 2, base);
    const media = <Media item={b} />;
    children.push(
      <TransitionSeries.Sequence key={`s${i}`} durationInFrames={dur}>
        {isEntrance(b.transition) ? <BrollEntrance effectId={b.transition}>{media}</BrollEntrance> : media}
      </TransitionSeries.Sequence>,
    );
  });

  // Start the cutaways at the first clip's frame and let the TransitionSeries render its natural
  // length (sum of sequences minus transition overlaps, which is ≤ the mid window). No outer
  // durationInFrames cap — capping truncates the tail mid-transition for 3+ clips; the
  // full-duration backdrop fills any small gap before the avatar-only close, reading smoothly.
  const midFrom = seg.clips.length > 0 ? seg.clips[0]!.fromFrame : 0;

  return (
    <AbsoluteFill>
      {/* full-duration blurred backdrop */}
      <AbsoluteFill>
        <Media item={broll[0]!} />
        <AbsoluteFill style={{ backdropFilter: "blur(24px)", background: "rgba(0,0,0,0.35)" }} />
      </AbsoluteFill>
      {/* sharp cutaways starting at the mid window */}
      <Sequence from={midFrom}>
        <TransitionSeries>{children}</TransitionSeries>
      </Sequence>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Verification checkpoint**

Run: `pnpm --filter @sentezy/remotion exec tsc --noEmit`
Expected: no errors. Stage the file.

Note on the backdrop blur: `backdropFilter` renders in Chromium (both `<Player>` and the container). If a still shows it not blurring in the container render (Task 6 stills), switch the backdrop to a pre-blurred `<Img style={{ filter: "blur(24px)" }}>` copy instead — same visual, no backdrop-filter dependency.

---

### Task 4: Move `SfxTrack`, add `Reel` composition + `ReelProps`

**Files:**
- Create: `packages/remotion/src/reel/SfxTrack.tsx` (moved), `packages/remotion/src/reel/types.ts`, `packages/remotion/src/reel/Reel.tsx`
- Delete: `packages/remotion/src/preview/SfxTrack.tsx`

**Interfaces:**
- Consumes: `AvatarLayer` (T2), `BrollLayer`+`ReelBrollItem` (T3), `CaptionOverlay` (existing), `SfxTrack`/`ResolvedSfxCue` (moved).
- Produces: `Reel: React.FC<ReelProps>`; `ReelProps` (below).

- [ ] **Step 1: Move `SfxTrack.tsx` into `reel/` (verbatim)**

Move `packages/remotion/src/preview/SfxTrack.tsx` → `packages/remotion/src/reel/SfxTrack.tsx` with identical contents (the `ResolvedSfxCue` type + `SfxTrack` component). Do not change the code.

- [ ] **Step 2: Create `reel/types.ts`**

```ts
// packages/remotion/src/reel/types.ts
import type { CaptionStyleId } from "@sentezy/types";
import type { AvatarSide, CaptionLayout, CaptionPosition, CaptionWord } from "../types";
import type { ResolvedSfxCue } from "./SfxTrack";
import type { ReelBrollItem } from "./BrollLayer";

/** Props for the single Reel composition — passed verbatim by the web <Player> (preview)
 *  and by the Cloudflare renderer as Remotion inputProps (render). Width/height/fps come
 *  from the composition config via calculateMetadata, mirrored here for calculateMetadata. */
export type ReelProps = {
  words: CaptionWord[];
  /** Still-image URL (browser preview) or matte .mov URL (render). */
  avatarUrl: string | null;
  broll: ReelBrollItem[];
  captionStyle: { styleId: CaptionStyleId; font: string; color: string };
  layout: CaptionLayout;
  position: CaptionPosition;
  avatarSide: AvatarSide;
  captions: boolean;
  /** True only in the web <Player> — mounts audible SfxTrack. The render is opaque + silent. */
  previewAudio: boolean;
  sfxCues: ResolvedSfxCue[];
  width?: number;
  height?: number;
  fps?: number;
};
```

- [ ] **Step 3: Create `reel/Reel.tsx`**

```tsx
// packages/remotion/src/reel/Reel.tsx
import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { CaptionOverlay } from "../CaptionOverlay";
import { AvatarLayer } from "./AvatarLayer";
import { BrollLayer } from "./BrollLayer";
import { SfxTrack } from "./SfxTrack";
import type { ReelProps } from "./types";

/**
 * THE reel composition. Rendered identically by the web <Player> (preview) and by
 * renderMedia in the Cloudflare renderer (the actual opaque H.264). The ONLY per-context
 * difference is avatarUrl: a still image in the browser, the matte .mov in the render
 * (AvatarLayer branches on the src). Audio is preview-only; the render is opaque + silent
 * and the worker muxes the final audio with ffmpeg.
 */
export const Reel: React.FC<ReelProps> = ({
  words,
  avatarUrl,
  broll,
  captionStyle,
  layout,
  position,
  avatarSide,
  captions,
  previewAudio,
  sfxCues,
}) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0b0d" }}>
      <BrollLayer broll={broll} words={words} />
      {avatarUrl && <AvatarLayer src={avatarUrl} avatarSide={avatarSide} avatarLayout={layout} />}
      {captions && (
        <CaptionOverlay
          words={words}
          styleId={captionStyle.styleId}
          font={captionStyle.font}
          color={captionStyle.color}
          layout={layout}
          position={position}
          avatarSide={avatarSide}
        />
      )}
      {previewAudio && <SfxTrack cues={sfxCues} fps={fps} />}
    </AbsoluteFill>
  );
};
```

- [ ] **Step 4: Verification checkpoint**

Run: `pnpm --filter @sentezy/remotion exec tsc --noEmit`
Expected: no errors (note: `index.ts` still references old `preview/` paths — Task 5 fixes exports; if tsc fails only on `index.ts`/`preview` imports, proceed to Task 5 then re-run). Stage new files; stage deletion of `preview/SfxTrack.tsx`.

---

### Task 5: Register `Reel` in Root, fix exports, delete `preview/ReelPreview.tsx`

**Files:**
- Modify: `packages/remotion/src/Root.tsx`, `packages/remotion/src/index.ts`
- Delete: `packages/remotion/src/preview/ReelPreview.tsx` (and the now-empty `preview/` dir)

**Interfaces:**
- Produces: composition id `Reel`; package exports `Reel`, `ReelProps`, `ReelBrollItem`, `brollSegments`, `SfxTrack`, `ResolvedSfxCue`.

- [ ] **Step 1: Update `Root.tsx`**

Replace the whole file with:

```tsx
// packages/remotion/src/Root.tsx
import React from "react";
import { Composition } from "remotion";
import { Reel } from "./reel/Reel";
import type { ReelProps } from "./reel/types";
import { SAMPLE_REEL_PROPS } from "./sample";

/** Duration in frames from the last word's end (+0.3s tail). */
const durationFromWords = (words: { end: number }[] | undefined, fps: number): number => {
  const lastEnd = words && words.length > 0 ? words[words.length - 1]!.end : 5;
  return Math.max(1, Math.ceil((lastEnd + 0.3) * fps));
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Reel"
      component={Reel}
      durationInFrames={150}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={SAMPLE_REEL_PROPS}
      calculateMetadata={({ props }: { props: ReelProps }) => {
        const fps = props.fps ?? 30;
        return {
          durationInFrames: durationFromWords(props.words, fps),
          fps,
          width: props.width ?? 1080,
          height: props.height ?? 1920,
        };
      }}
    />
  );
};
```

- [ ] **Step 2: Add `SAMPLE_REEL_PROPS` to `sample.ts`**

Append to `packages/remotion/src/sample.ts`:

```ts
import type { ReelProps } from "./reel/types";

export const SAMPLE_REEL_PROPS: ReelProps = {
  words: SAMPLE_WORDS,
  avatarUrl: null,
  broll: [],
  captionStyle: { styleId: "highlight", font: "Poppins", color: "#FFD54A" },
  layout: "bottom",
  position: "bottom",
  avatarSide: "right",
  captions: true,
  previewAudio: false,
  sfxCues: [],
  width: 1080,
  height: 1920,
  fps: 30,
};
```

- [ ] **Step 3: Update `index.ts`**

Replace the "Preview-only surface" block (last 3 export lines) and the CaptionOverlay-composition-facing bits. The final file:

```ts
// packages/remotion/src/index.ts
// Library surface for the web app (<Player>) and the Cloudflare renderer.
// NOTE: importing this does NOT call registerRoot — that lives in remotion-entry.ts.
export { CaptionOverlay } from "./CaptionOverlay";
export { EFFECTS } from "./effects/registry";
export { CAPTION_FONT_FAMILIES, ensureFontsLoaded, resolveFamily } from "./fonts";
export { buildPages } from "./timing";
export { SAMPLE_PROPS, SAMPLE_WORDS, SAMPLE_REEL_PROPS } from "./sample";
export type {
  CaptionCompositionProps,
  CaptionLayout,
  CaptionOverlayProps,
  CaptionPosition,
  CaptionWord,
  EffectProps,
} from "./types";

// B-roll effect surface — the web effect-picker previews import these.
export { BrollEffectDemo, brollDemoDurationInFrames } from "./broll/BrollEffectDemo";
export { brollTransition, BrollEntrance, isEntrance } from "./broll/effects";

// The Reel composition — rendered by the web <Player> (preview) AND renderMedia (the actual video).
export { Reel } from "./reel/Reel";
export { brollSegments } from "./reel/timing";
export { SfxTrack, type ResolvedSfxCue } from "./reel/SfxTrack";
export type { ReelProps } from "./reel/types";
export type { ReelBrollItem } from "./reel/BrollLayer";
```

- [ ] **Step 4: Delete `preview/ReelPreview.tsx`**

Run: `git rm packages/remotion/src/preview/ReelPreview.tsx` (and remove the now-empty `preview/` directory).

- [ ] **Step 5: Verification checkpoint**

Run: `pnpm --filter @sentezy/remotion exec tsc --noEmit`
Expected: no errors.
Run (renders the opaque reel from the CLI to prove the composition + fonts + transitions + captions all resolve):
`cd packages/remotion && npx remotion render src/remotion-entry.ts Reel /tmp/reel.mp4 --codec=h264 --log=error`
Expected: a valid `/tmp/reel.mp4`. Then `npx remotion still src/remotion-entry.ts Reel /tmp/reel-2s.png --frame=60` — eyeball a mid-frame (captions render in Poppins; no crash). Stage all Phase-1 changes.

---

## Phase 2 — Renderer (`caption-renderer` → `reel-renderer`)

### Task 6: `/render-reel` endpoint (opaque H.264)

**Files:**
- Modify: `infra/cloudflare/caption-renderer/container/server.mjs`

**Interfaces:**
- Produces: `POST /render-reel` accepting `{ jobId, words, avatarUrl, broll, captionStyle, layout, position, avatarSide, captions, width, height, fps }`; responds `{ reelKey }` (R2) or streams `video/mp4` inline (local).

- [ ] **Step 1: Replace the `/render` handler**

Replace the `app.post("/render", …)` block (lines ~61–91) with:

```js
app.post("/render-reel", async (req, res) => {
  const { jobId, words, avatarUrl, broll, captionStyle, layout, position, avatarSide, captions, width, height, fps } =
    req.body ?? {};
  if (!jobId || !Array.isArray(words)) {
    return res.status(400).json({ error: "jobId and words[] are required" });
  }
  const outPath = path.join(os.tmpdir(), `${jobId}.mp4`);
  try {
    const serveUrl = await getServeUrl();
    // previewAudio:false + sfxCues:[] → the render is opaque and silent; the worker muxes audio.
    const inputProps = {
      words, avatarUrl: avatarUrl ?? null, broll: broll ?? [],
      captionStyle, layout, position, avatarSide,
      captions: captions !== false, previewAudio: false, sfxCues: [],
      width, height, fps,
    };
    const composition = await selectComposition({ serveUrl, id: "Reel", inputProps });
    await renderMedia({
      serveUrl,
      composition,
      codec: "h264",
      imageFormat: "jpeg", // OPAQUE reel — not the old ProRes/alpha caption overlay
      outputLocation: outPath,
      inputProps,
    });
    await deliver(res, outPath, { key: `reels/${jobId}.mp4`, contentType: "video/mp4", keyField: "reelKey" });
  } catch (err) {
    console.error("render-reel failed", err);
    fs.rm(outPath, { force: true }, () => {});
    res.status(500).json({ error: String(err?.message ?? err) });
  }
});
```

- [ ] **Step 2: Update the header comment + listen log**

Change the top comment `POST /render → CaptionOverlay …` to `POST /render-reel → Reel composition → opaque H.264 .mp4`, and the listen log to `reel renderer listening on :${PORT}`.

- [ ] **Step 3: Verification checkpoint**

Run (from repo root, builds the container and hits the new route):
```
docker compose -f infra/docker-compose.yml up -d --build reel-renderer   # (service renamed in Task 8)
curl -s -X POST http://localhost:8080/render-reel -H 'content-type: application/json' \
  -d '{"jobId":"t1","words":[{"text":"Bu","start":0,"end":0.5},{"text":"hafta","start":0.6,"end":1.2}],
       "avatarUrl":null,"broll":[],"captionStyle":{"styleId":"highlight","font":"Poppins","color":"#FFD54A"},
       "layout":"bottom","position":"bottom","avatarSide":"right","captions":true,"width":1080,"height":1920,"fps":30}' \
  --output /tmp/reel-http.mp4
ffprobe -v error -show_entries stream=codec_name,width,height -of default=nk=1 /tmp/reel-http.mp4
```
Expected: `h264`, `1080`, `1920`. (Run after Task 8 renames the service, or temporarily target the current `caption-renderer` service.) Stage `server.mjs`.

---

### Task 7: Relay `/render-reel`; rename Worker class/binding

**Files:**
- Modify: `infra/cloudflare/caption-renderer/src/index.ts`

- [ ] **Step 1: Replace `src/index.ts`**

```ts
// infra/cloudflare/caption-renderer/src/index.ts
import { Container, getContainer } from "@cloudflare/containers";

// Cloudflare Worker: forwards POST /render-reel to a Cloudflare Container running
// Node + Chromium + FFmpeg (container/server.mjs), which renders the @sentezy/remotion
// `Reel` composition to an opaque H.264 .mp4 and uploads it to R2 ({ reelKey }).

export interface Env {
  REEL_RENDERER: DurableObjectNamespace<ReelRenderer>;
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET: string;
}

export class ReelRenderer extends Container<Env> {
  defaultPort = 8080;
  sleepAfter = "5m";
  envVars = {
    R2_ACCOUNT_ID: this.env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: this.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: this.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET: this.env.R2_BUCKET,
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") return new Response("ok");
    if (request.method === "POST" && url.pathname === "/render-reel") {
      const container = getContainer(env.REEL_RENDERER);
      return container.fetch(request);
    }
    return new Response("Not found", { status: 404 });
  },
};
```

- [ ] **Step 2: Verification checkpoint**

Run: `cd infra/cloudflare/caption-renderer && npx tsc --noEmit -p tsconfig.json` (if a tsconfig build check exists; else skip). Stage the file.

---

### Task 8: Rename renderer service (dir + wrangler + docker-compose + README)

**Files:**
- Rename dir: `infra/cloudflare/caption-renderer/` → `infra/cloudflare/reel-renderer/`
- Modify: `wrangler.jsonc`, `README.md`, `infra/docker-compose.yml`

- [ ] **Step 1: Rename the directory**

Run: `git mv infra/cloudflare/caption-renderer infra/cloudflare/reel-renderer`

- [ ] **Step 2: Update `wrangler.jsonc`**

In `infra/cloudflare/reel-renderer/wrangler.jsonc`: `"name": "sentezy-caption-renderer"` → `"sentezy-reel-renderer"`; `"class_name": "CaptionRenderer"` → `"ReelRenderer"` (both occurrences — the migration/DO class entry and the binding); binding `{ "name": "CAPTION_RENDERER", … }` → `{ "name": "REEL_RENDERER", "class_name": "ReelRenderer" }`.

- [ ] **Step 3: Update `infra/docker-compose.yml`**

In the renderer service block (lines ~36–72): rename service key `caption-renderer:` → `reel-renderer:`, `container_name: sentezy-caption-renderer` → `sentezy-reel-renderer`, `dockerfile: infra/cloudflare/caption-renderer/container/Dockerfile` → `infra/cloudflare/reel-renderer/container/Dockerfile`, and the worker `depends_on: caption-renderer:` → `reel-renderer:`. In the worker `environment:` remove `RENDER_ENGINE` and `CAPTION_ENGINE`; replace `CAPTION_RENDERER_URL: http://caption-renderer:8080` with `REEL_RENDERER_URL: http://reel-renderer:8080`. Update the top-of-file comments referencing `caption-renderer`/`CAPTION_ENGINE`.

- [ ] **Step 4: Update `README.md`**

Replace `caption-renderer`/`/render`/"caption overlay"/ProRes references with `reel-renderer`/`/render-reel`/"opaque reel H.264".

- [ ] **Step 5: Verification checkpoint**

Run: `docker compose -f infra/docker-compose.yml config >/dev/null && echo compose-ok`
Expected: `compose-ok` (valid compose file). Stage all renames/edits.

---

## Phase 3 — Worker (ffmpeg = audio + mux + thumbnail)

### Task 9: Extract `Word` to `models.py`

**Files:**
- Create: `apps/worker/sentezy_worker/models.py`
- Modify: `apps/worker/sentezy_worker/sfx.py:6`, `apps/worker/sentezy_worker/providers/elevenlabs.py:7`, `apps/worker/tests/test_sfx.py:1`

**Interfaces:**
- Produces: `sentezy_worker.models.Word` (`@dataclass` with `text: str`, `start: float`, `end: float`).

- [ ] **Step 1: Create `models.py`**

```python
# apps/worker/sentezy_worker/models.py
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Word:
    """A transcribed word with absolute timing in seconds (ElevenLabs alignment)."""
    text: str
    start: float
    end: float
```

- [ ] **Step 2: Repoint the three importers**

- `sfx.py:6` — `from .compose import Word` → `from .models import Word`
- `providers/elevenlabs.py:7` — `from ..compose import Word` → `from ..models import Word`
- `tests/test_sfx.py:1` — `from sentezy_worker.compose import Word` → `from sentezy_worker.models import Word`

- [ ] **Step 3: Verification checkpoint**

Run: `cd apps/worker && uv run python -m pytest tests/test_sfx.py -q`
Expected: PASS (still imports `Word`, now from `models`; `compose.py` still exists this task). Stage the changes.

---

### Task 10: `audio.py` — audio bed helpers + `mux_audio`

**Files:**
- Create: `apps/worker/sentezy_worker/audio.py`
- Test: `apps/worker/tests/test_audio.py`

**Interfaces:**
- Consumes: `Word` (T9).
- Produces:
  - `SFX_VOLUME`, `_BROLL_SFX_MAP`, `_SFX_TRANS_DIR`, `_transition_sfx_path(transition)`, `_append_audio_bed(...)`, `_run` (COPIED from `compose.py`; compose.py left untouched — deleted wholesale in Task 15) + new `SFX_TRANSITION_LEAD = 0.2`. NOT `_sfx_slide_times` (depended on the deleted `_xfade`; whoosh timing is inlined in `_ffmpeg_audio_cmd`).
  - `mux_audio(video_path, voice_path, out_path, *, music_path=None, music_volume=0.15, broll=None, transition_sfx=True, sfx_cues=None)` — stream-copies `video_path`'s video, builds the audio bed, writes `out_path`.
  - `_ffmpeg_audio_cmd(...)` — pure arg builder (for testing), returns the full ffmpeg argv.

- [ ] **Step 1: Write the failing test**

```python
# apps/worker/tests/test_audio.py
from sentezy_worker.audio import _ffmpeg_audio_cmd


def test_voice_only_maps_copied_video_and_voice():
    cmd = _ffmpeg_audio_cmd(
        video_path="/v.mp4", voice_path="/a.mp3", out_path="/o.mp4",
        music_path=None, music_volume=0.15, broll=[], transition_sfx=False, sfx_cues=[],
    )
    # video is stream-copied, never re-encoded
    assert "-c:v" in cmd and cmd[cmd.index("-c:v") + 1] == "copy"
    # two inputs: the opaque video then the voice
    assert cmd.count("-i") == 2
    assert "/v.mp4" in cmd and "/a.mp3" in cmd
    # voice maps straight through when there is no bed
    assert "-map" in cmd and "0:v" in " ".join(cmd)


def test_music_adds_sidechain_and_faststart():
    cmd = _ffmpeg_audio_cmd(
        video_path="/v.mp4", voice_path="/a.mp3", out_path="/o.mp4",
        music_path="/m.mp3", music_volume=0.2, broll=[], transition_sfx=False, sfx_cues=[],
    )
    fc = cmd[cmd.index("-filter_complex") + 1]
    assert "sidechaincompress" in fc
    assert "+faststart" in " ".join(cmd)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/worker && uv run python -m pytest tests/test_audio.py -q`
Expected: FAIL — `No module named 'sentezy_worker.audio'`.

- [ ] **Step 3: Create `audio.py`**

COPY these symbols **verbatim** from `compose.py` into `audio.py` (same code; leave compose.py untouched — it is deleted in Task 15): `SFX_VOLUME` (line 211), `_BROLL_SFX_MAP` (26–31), `_SFX_TRANS_DIR` (24), `_transition_sfx_path` (97–102), `_append_audio_bed` (518–557), and the `_run` helper (112–116). Do NOT copy `_sfx_slide_times` (it used the deleted `_xfade`). Add `SFX_TRANSITION_LEAD = 0.2` and the new `mux_audio` + `_ffmpeg_audio_cmd`:

```python
# apps/worker/sentezy_worker/audio.py  (header + new functions; moved helpers omitted here for brevity)
from __future__ import annotations

import os
import subprocess

# ── moved verbatim from compose.py: _run, _BROLL_SFX_MAP, _SFX_TRANS_DIR,
#    _transition_sfx_path, _sfx_slide_times, _append_audio_bed, SFX_VOLUME ──
# (paste those bodies here unchanged)


def _ffmpeg_audio_cmd(
    *,
    video_path: str,
    voice_path: str,
    out_path: str,
    music_path: str | None,
    music_volume: float,
    broll: list[dict],
    transition_sfx: bool,
    sfx_cues: list[dict],
) -> list[str]:
    """Build the ffmpeg argv that stream-copies the opaque render's video and attaches the
    reel audio bed (voice + ducked music + transition/AI SFX). Pure — no process spawned."""
    # [0] opaque video (video copied), [1] avatar voice.
    inputs: list[str] = ["-i", video_path, "-i", voice_path]
    voice_idx = 1
    idx = 2

    music_idx = None
    if music_path:
        inputs += ["-i", music_path]
        music_idx = idx
        idx += 1

    # transition whooshes: one per B-roll cutaway that slides in (clips 1..N-1). Clip 0
    # appears without a transition (the backdrop is already shown), so it gets none. Each
    # whoosh lands SFX_TRANSITION_LEAD seconds before its cutaway's absolute start — the same
    # placement the web preview uses (slideSfxCues), for audio parity. NOTE: does NOT use the
    # deleted ffmpeg `_xfade` (Remotion owns transitions now); the lead is a fixed constant.
    sfx_times: list[float] = []
    sfx_files: list[str] = []
    if transition_sfx:
        for k in range(1, len(broll)):
            _p = _transition_sfx_path(broll[k].get("transition"))
            if _p:
                sfx_files.append(_p)
                sfx_times.append(max(0.0, float(broll[k]["start"]) - SFX_TRANSITION_LEAD))

    sfx_input_idxs: list[int] = []
    for f in sfx_files:
        inputs += ["-i", f]
        sfx_input_idxs.append(idx)
        idx += 1

    # AI voice-timed SFX: one input per cue, mixed at per-cue gain.
    sfx_gains: list[float] = [SFX_VOLUME] * len(sfx_input_idxs)
    for cue in (sfx_cues or []):
        inputs += ["-i", cue["path"]]
        sfx_input_idxs.append(idx)
        sfx_times.append(float(cue["time"]))
        sfx_gains.append(float(cue["gain"]))
        idx += 1

    fc: list[str] = []
    audio_map = _append_audio_bed(
        fc,
        voice_idx=voice_idx,
        music_idx=music_idx,
        music_volume=music_volume,
        sfx_input_idxs=sfx_input_idxs,
        sfx_times=sfx_times,
        sfx_gains=sfx_gains,
    )

    cmd = ["ffmpeg", "-y", *inputs]
    if fc:
        cmd += ["-filter_complex", ";".join(fc)]
    cmd += [
        "-map", "0:v",
        *audio_map,
        "-c:v", "copy",
        "-c:a", "aac", "-b:a", "128k",
        "-shortest", "-movflags", "+faststart",
        out_path,
    ]
    return cmd


def mux_audio(
    video_path: str,
    voice_path: str,
    out_path: str,
    *,
    music_path: str | None = None,
    music_volume: float = 0.15,
    broll: list[dict] | None = None,
    transition_sfx: bool = True,
    sfx_cues: list[dict] | None = None,
) -> None:
    """Attach the reel's audio bed to the opaque Remotion render (video stream-copied)."""
    _run(_ffmpeg_audio_cmd(
        video_path=video_path, voice_path=voice_path, out_path=out_path,
        music_path=music_path, music_volume=music_volume,
        broll=broll or [], transition_sfx=transition_sfx, sfx_cues=sfx_cues or [],
    ))
```

Note: `_append_audio_bed` returns `["-map", "{voice_idx}:a?"]` when there is no bed, in which case `fc` is empty — the `_ffmpeg_audio_cmd` handles that (`-filter_complex` omitted). Adjust the moved `_append_audio_bed`'s no-bed return to `["-map", f"{voice_idx}:a?"]` exactly as in the source.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/worker && uv run python -m pytest tests/test_audio.py -q`
Expected: PASS.

- [ ] **Step 5: Verification checkpoint (real mux)**

Run a real 2-input mux to confirm ffmpeg accepts the graph:
```
cd apps/worker && uv run python -c "
from sentezy_worker.audio import mux_audio
import subprocess
subprocess.run(['ffmpeg','-y','-f','lavfi','-i','color=c=black:s=320x568:r=30:d=2','-pix_fmt','yuv420p','/tmp/v.mp4'],check=True)
subprocess.run(['ffmpeg','-y','-f','lavfi','-i','sine=frequency=440:duration=2','/tmp/a.mp3'],check=True)
mux_audio('/tmp/v.mp4','/tmp/a.mp3','/tmp/o.mp4', music_path=None, broll=[], transition_sfx=False, sfx_cues=[])
print(subprocess.run(['ffprobe','-v','error','-show_entries','stream=codec_type,codec_name','-of','csv=p=0','/tmp/o.mp4'],capture_output=True,text=True).stdout)
"
```
Expected: output lists a `video,h264` (copied) + `audio,aac` stream. Stage `audio.py` + `test_audio.py`.

---

### Task 11: `thumbnail.py`

**Files:**
- Create: `apps/worker/sentezy_worker/thumbnail.py`

**Interfaces:**
- Produces: `make_thumbnail(video_path, out_path, *, at="00:00:01")`.

- [ ] **Step 1: Create `thumbnail.py`**

```python
# apps/worker/sentezy_worker/thumbnail.py
from __future__ import annotations

import subprocess


def _run(cmd: list[str]) -> None:
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg failed ({proc.returncode}):\n{proc.stderr.decode('utf-8', 'replace')[-2000:]}")


def make_thumbnail(video_path: str, out_path: str, *, at: str = "00:00:01") -> None:
    """Grab a poster frame from the finished reel."""
    _run(["ffmpeg", "-y", "-ss", at, "-i", video_path, "-frames:v", "1", "-q:v", "3", out_path])
```

- [ ] **Step 2: Verification checkpoint**

Run: `cd apps/worker && uv run python -c "from sentezy_worker.thumbnail import make_thumbnail; make_thumbnail('/tmp/o.mp4','/tmp/thumb.jpg'); import os; print(os.path.getsize('/tmp/thumb.jpg')>0)"`
Expected: `True`. Stage the file.

---

### Task 12: `providers/reel_remotion.py` (replaces `captions_remotion.py`)

**Files:**
- Create: `apps/worker/sentezy_worker/providers/reel_remotion.py`
- Delete: `apps/worker/sentezy_worker/providers/captions_remotion.py`

**Interfaces:**
- Consumes: `Storage` (`signed_get_url`, `download`).
- Produces:
  - `render_reel(renderer_url, storage, props, *, job_id, dest, timeout=600.0) -> str` — POST `/render-reel`; JSON `{reelKey}` → download signed, else save inline mp4 bytes.
  - `render_reel_local(props, *, dest, workdir, timeout=600.0) -> str` — CLI `remotion render … Reel … --codec=h264`.
  - `build_reel_props(...) -> dict` — assemble the inputProps dict.

- [ ] **Step 1: Create `reel_remotion.py`**

```python
# apps/worker/sentezy_worker/providers/reel_remotion.py
from __future__ import annotations

import json
import os
import pathlib
import subprocess

import httpx

from ..models import Word

# Remotion reel renderer. Two backends, same opaque H.264 output of the @sentezy/remotion `Reel`
# composition (avatar + B-roll + transitions + captions):
#   • render_reel        — POST to the renderer service (prod; needs REEL_RENDERER_URL)
#   • render_reel_local  — shell to the Remotion CLI (dev; Node on the host)


def build_reel_props(
    words: list[Word],
    *,
    avatar_url: str | None,
    broll: list[dict],
    style: str,
    font: str,
    color: str | None,
    layout: str,
    position: str,
    avatar_side: str,
    captions: bool,
    width: int,
    height: int,
    fps: int,
) -> dict:
    """The Reel composition inputProps (JSON-safe). broll items: {url, kind, transition}."""
    return {
        "words": [{"text": w.text, "start": w.start, "end": w.end} for w in words],
        "avatarUrl": avatar_url,
        "broll": [{"url": b["url"], "kind": b.get("kind", "image"), "transition": b.get("transition") or "fade"} for b in broll],
        "captionStyle": {"styleId": style, "font": font or "General Sans", "color": color or "#FFD54A"},
        "layout": layout,
        "position": position,
        "avatarSide": avatar_side,
        "captions": captions,
        "previewAudio": False,
        "sfxCues": [],
        "width": width,
        "height": height,
        "fps": fps,
    }


def render_reel(renderer_url: str, storage, props: dict, *, job_id: str, dest: str, timeout: float = 600.0) -> str:
    """Render via the renderer service → write the opaque mp4 to `dest`. Raises on failure."""
    payload = {"jobId": job_id, **props}
    with httpx.stream("POST", renderer_url.rstrip("/") + "/render-reel", json=payload, timeout=timeout) as r:
        r.raise_for_status()
        if r.headers.get("content-type", "").startswith("application/json"):
            r.read()
            reel_key = r.json()["reelKey"]  # R2 key → signed GET
            storage.download(storage.signed_get_url(reel_key), dest)
        else:
            with open(dest, "wb") as f:
                for chunk in r.iter_bytes():
                    f.write(chunk)
    return dest


def _project_dir() -> pathlib.Path:
    env = os.environ.get("REMOTION_PROJECT_DIR")
    if env:
        return pathlib.Path(env)
    for parent in pathlib.Path(__file__).resolve().parents:
        cand = parent / "packages" / "remotion"
        if cand.exists():
            return cand
    return pathlib.Path("packages/remotion")


def _remotion_bin(project_dir: pathlib.Path) -> list[str]:
    for base in (project_dir, *project_dir.resolve().parents):
        cand = base / "node_modules" / ".bin" / "remotion"
        if cand.exists():
            return [str(cand)]
    return ["npx", "--no-install", "remotion"]


def render_reel_local(props: dict, *, dest: str, workdir: str, timeout: float = 600.0) -> str:
    """Render with the local Remotion CLI (needs Node on the host). Opaque H.264."""
    project_dir = _project_dir()
    entry = os.environ.get("REMOTION_ENTRY", "src/remotion-entry.ts")
    props_path = os.path.join(workdir, "reel-props.json")
    with open(props_path, "w", encoding="utf-8") as f:
        json.dump(props, f)
    cmd = [
        *_remotion_bin(project_dir), "render", entry, "Reel", dest,
        "--codec=h264", f"--props={props_path}", "--log=error",
    ]
    subprocess.run(cmd, cwd=str(project_dir), check=True, timeout=timeout)
    return dest
```

- [ ] **Step 2: Delete `captions_remotion.py`**

Run: `git rm apps/worker/sentezy_worker/providers/captions_remotion.py`

- [ ] **Step 3: Verification checkpoint**

Run: `cd apps/worker && uv run python -c "import sentezy_worker.providers.reel_remotion as m; print(bool(m.build_reel_props))"`
Expected: `True`. Stage the changes. (Note: `pipeline.py` still imports `captions_remotion` until Task 14 — a full import of `pipeline` will fail until then; that's expected.)

---

### Task 13: `config.py` — single render URL, drop caption engine

**Files:**
- Modify: `apps/worker/sentezy_worker/config.py`

- [ ] **Step 1: Edit the dataclass + loader**

Remove the `caption_engine: str` field and its loader line. Rename `caption_renderer_url` → `reel_renderer_url` and its env key:

- Field: `caption_renderer_url: str | None` → `reel_renderer_url: str | None` (update the docstring above it to "Base URL of the reel renderer (POST /render-reel). Unset → local Remotion CLI.").
- Loader: delete `caption_engine=(_get("CAPTION_ENGINE", …) …),`; change `caption_renderer_url=_get("CAPTION_RENDERER_URL")` → `reel_renderer_url=_get("REEL_RENDERER_URL")`.

- [ ] **Step 2: Verification checkpoint**

Run: `cd apps/worker && uv run python -c "from sentezy_worker.config import Config; print('caption_engine' not in Config.__dataclass_fields__ and 'reel_renderer_url' in Config.__dataclass_fields__)"`
Expected: `True`. Stage `config.py`.

---

### Task 14: `pipeline.py` — single render path

**Files:**
- Modify: `apps/worker/sentezy_worker/pipeline.py`

**Interfaces:**
- Consumes: `render_reel`/`render_reel_local`/`build_reel_props` (T12), `mux_audio` (T10), `make_thumbnail` (T11), `matte_video_to_mov` (existing).

- [ ] **Step 1: Update imports (lines 7–15)**

Replace:
```python
from .compose import build_captions_ass, compose_reel, make_thumbnail
...
from .providers.captions_remotion import render_caption_overlay, render_caption_overlay_local
```
with:
```python
from .audio import mux_audio
from .thumbnail import make_thumbnail
from .providers.reel_remotion import build_reel_props, render_reel, render_reel_local
```
(Keep the other imports: `Config`, `Db`, `matte_video_to_mov`, `ElevenLabs`, `HeyGen`, `resolve_sfx_cues`/`tokenize_script`, `Storage`.)

- [ ] **Step 2: Replace step 3 (compose) — lines ~201–279**

Replace the entire block from `# 3) Compose reel …` through the `compose_reel(...)` call with:

```python
    # 3) Render the reel — ONE Remotion composition (avatar + B-roll + transitions + captions)
    #    → opaque H.264. Identical to the in-app <Player> preview by construction.
    db.set_stage(video_id, "compose", 70)
    layout = options.get("layout") or {}
    avatar_side = layout.get("avatarSide", "right")
    avatar_layout = layout.get("avatarLayout", "side")
    caps = options.get("captions", True)
    if isinstance(caps, bool):  # legacy drafts store captions as a plain boolean
        caps = {"enabled": caps}
    captions_on = caps.get("enabled", True)
    cap_style = caps.get("style", "karaoke")
    cap_font = caps.get("font") or "General Sans"
    cap_color = caps.get("color")
    cap_position = layout.get("captionPosition", "bottom")

    broll_media = _resolve_broll_media(options, storage, workdir)
    segments = _broll_segments(words, broll_media)  # used for SFX slide timing (audio parity)

    # Upload the matted avatar so the renderer can fetch it (signed R2 GET), then sign B-roll.
    cutout_key = f"cutouts/{video_id}.mov"
    storage.upload_r2(avatar_cutout_path, cutout_key, "video/quicktime")
    avatar_signed = storage.signed_get_url(cutout_key, 86400)
    broll_props = [
        {"url": storage.signed_get_url(b["ref"], 86400) if b.get("kind") == "video" else storage.image_url(b["ref"]),
         "kind": b.get("kind", "image"), "transition": b.get("transition")}
        for b in broll_media if b.get("ref")
    ]

    props = build_reel_props(
        words, avatar_url=avatar_signed, broll=broll_props,
        style=cap_style, font=cap_font, color=cap_color,
        layout=avatar_layout, position=cap_position, avatar_side=avatar_side,
        captions=captions_on, width=width, height=height, fps=30,
    )
    reel_video = f"{workdir}/reel_video.mp4"
    if cfg.reel_renderer_url:
        render_reel(cfg.reel_renderer_url, storage, props, job_id=video_id, dest=reel_video)
    else:
        render_reel_local(props, dest=reel_video, workdir=workdir)

    # 3b) Audio bed: voice + ducked music + transition/AI SFX (ffmpeg; video stream-copied).
    effects = options.get("effects") or {}
    transition_sfx = effects.get("transitionSfx", True)
    music_path = _resolve_music(options, storage, workdir)
    music_volume = float((options.get("music") or {}).get("volume", 0.15))
    sfx_opt = options.get("sfx") or {}
    sfx_cues_resolved: list[dict] = []
    if sfx_opt.get("enabled") and sfx_opt.get("cues"):
        try:
            sfx_cues_resolved = resolve_sfx_cues(sfx_opt["cues"], words, tokenize_script(video["script"]))
        except Exception as e:  # noqa: BLE001 — SFX are optional; never fail the job
            print(f"pipeline: sfx cue resolution failed ({e}); continuing without AI SFX")
            sfx_cues_resolved = []

    reel_path = f"{workdir}/reel.mp4"
    mux_audio(
        reel_video, audio_path, reel_path,
        music_path=music_path, music_volume=music_volume,
        broll=segments, transition_sfx=transition_sfx, sfx_cues=sfx_cues_resolved,
    )
```

(Note: `_resolve_logo` is no longer used — the logo overlay lived in `compose_reel`. Remove the `_resolve_logo` function definition, lines ~98–104, since branding-logo overlay is not part of the Reel composition. If a logo is desired later it becomes a Reel prop.)

- [ ] **Step 3: Verification checkpoint**

Run: `cd apps/worker && uv run python -c "import ast; ast.parse(open('sentezy_worker/pipeline.py').read()); print('parse ok')"`
Then: `cd apps/worker && uv run ruff check sentezy_worker/pipeline.py`
Expected: `parse ok` + ruff clean (no unused `_resolve_logo`/imports). Stage `pipeline.py`.

---

### Task 15: Delete `compose.py`, worker `fonts/`, `fonttools`

**Files:**
- Delete: `apps/worker/sentezy_worker/compose.py`, `apps/worker/fonts/`
- Modify: `apps/worker/pyproject.toml:15`

- [ ] **Step 1: Confirm no remaining importers**

Run: `grep -rn "compose import\|from .compose\|from ..compose\|import compose\|fontTools\|fonttools" apps/worker/sentezy_worker apps/worker/tests`
Expected: NO matches (all repointed in Tasks 9/10/11/14). If any remain, fix before deleting.

- [ ] **Step 2: Delete files + dep**

Run:
```
git rm apps/worker/sentezy_worker/compose.py
git rm -r apps/worker/fonts
```
Remove `"fonttools>=4.55",` (line 15) from `apps/worker/pyproject.toml`.

- [ ] **Step 3: Verification checkpoint**

Run:
```
cd apps/worker && uv run python -m compileall sentezy_worker -q && uv run ruff check sentezy_worker && uv run python -m pytest -q
```
Expected: compile clean, ruff clean, all tests PASS. Stage deletions + `pyproject.toml`.

---

## Phase 4 — Web preview + compose glue

### Task 16: Web preview renders `Reel`

**Files:**
- Modify: `apps/web/src/components/composer/SfxPreviewModal.tsx`

**Interfaces:**
- Consumes: `Reel`, `ReelProps`, `ReelBrollItem` from `@sentezy/remotion`.

- [ ] **Step 1: Swap import + component + inputProps**

- Line 4: `import { type PreviewBrollItem, ReelPreview } from "@sentezy/remotion";` → `import { type ReelBrollItem, Reel } from "@sentezy/remotion";`
- The `broll` prop type `PreviewBrollItem[]` → `ReelBrollItem[]` (in the destructured props block, line ~33).
- `inputProps` (lines 49–59): rename `avatarImageUrl` → `avatarUrl`, add `previewAudio: true`, `width: W`, `height: H`, `fps: FPS`:

```tsx
  const inputProps = {
    words,
    avatarUrl: avatarImageUrl ?? null,
    broll,
    captionStyle: { styleId: captionStyle.styleId, font: captionStyle.font, color: captionStyle.color },
    layout: layout.avatarLayout,
    position: layout.captionPosition,
    avatarSide: layout.avatarSide,
    captions,
    previewAudio: true,
    sfxCues,
    width: W,
    height: H,
    fps: FPS,
  };
```

- Line 72: `component={ReelPreview}` → `component={Reel}`.

(The caller `MediaComposer.tsx` passes `broll` items shaped `{ url, transition }`; `ReelBrollItem` additionally allows `kind` — image items without `kind` default to image in `Media`, so no caller change is required. If uploaded videos should show in preview, ensure the caller includes `kind: "video"` — verify in MediaComposer's preview `broll` builder and add `kind` if missing.)

- [ ] **Step 2: Verification checkpoint**

Run: `pnpm --filter @sentezy/web exec tsc --noEmit`
Expected: no errors. If `MediaComposer` still references `PreviewBrollItem`, repoint it to `ReelBrollItem`.

---

### Task 17: Slide-SFX preview parity via shared `brollSegments`

**Files:**
- Modify: `apps/web/src/lib/sfxPreview.ts`

**Interfaces:**
- Consumes: `brollSegments` from `@sentezy/remotion`; existing `previewWords` timing.

- [ ] **Step 1: Align slide-SFX times to the composition's clip frames**

Replace `slideSfxCues` so the whoosh times come from the SAME `brollSegments` the `Reel` uses (each clip `k≥1` gets a whoosh at its clip start, minus a small lead), instead of the ad-hoc `k*total/n`:

```ts
import { brollSegments, type ReelBrollItem, type ResolvedSfxCue } from "@sentezy/remotion";
import { previewWords } from "@/lib/captionPreview";
// ... keep sfxSrc / transitionSfxSrc / resolvePreviewSfx ...

const FPS = 30;

/** Slide-transition SFX, one per cutaway, timed to the SAME clip frames the Reel places
 *  (via shared brollSegments) so the preview's whooshes land on the visible transitions. */
export function slideSfxCues(broll: ReelBrollItem[], script: string, enabled: boolean): ResolvedSfxCue[] {
  if (!enabled || broll.length < 2) return [];
  const seg = brollSegments(previewWords(script), broll.length, FPS);
  const out: ResolvedSfxCue[] = [];
  for (let k = 1; k < broll.length; k++) {
    const startFrame = seg.clips[k]?.fromFrame ?? 0;
    out.push({
      src: transitionSfxSrc(brollSfxStem(broll[k]!.transition)),
      time: Math.max(0, startFrame / FPS - 0.2),
      gain: 0.5,
    });
  }
  return out;
}
```

Update the call site in `SfxPreviewModal.tsx` (line ~45): `slideSfxCues(broll, total, transitionSfx)` → `slideSfxCues(broll, script, transitionSfx)` and drop the now-unused `total` argument usage. Keep the `brollSfxStem`/`SfxCue`/`tokenizeScript` imports as needed.

- [ ] **Step 2: Verification checkpoint**

Run: `pnpm --filter @sentezy/web exec tsc --noEmit && pnpm --filter @sentezy/web build`
Expected: typecheck + `next build` clean. Stage web changes.

---

### Task 18: Full-stack build + browser preview smoke

**Files:** none (verification only).

- [ ] **Step 1: Monorepo typecheck/build**

Run: `pnpm -w turbo run typecheck build --filter=@sentezy/web --filter=@sentezy/remotion` (or the repo's equivalent). Expected: all green.

- [ ] **Step 2: Browser preview**

Start the web app, open the composer, upload media + type a script, press **Önizle**, and confirm in a real browser (headless Chrome does not reliably paint `<Player>`): the modal shows the `Reel` — avatar-only hook, B-roll cutaways with the chosen transitions, captions in the chosen style, avatar-only close; pressing play produces SFX on the transitions. (This is the exact composition the renderer will produce.)

---

## Phase 5 — End-to-end parity (Berkan-gated, manual)

### Task 19: One real reel through the stack

**Files:** none (verification only).

- [ ] **Step 1: Bring up the stack**

Run: `docker compose -f infra/docker-compose.yml up -d --build` (redis + `reel-renderer` + worker; worker env has `REEL_RENDERER_URL=http://reel-renderer:8080`, no `CAPTION_ENGINE`/`RENDER_ENGINE`).

- [ ] **Step 2: Drive a job** (ElevenLabs-credit-gated — Berkan's manual step)

Create a video from the web app (or enqueue a job) with avatar + voice + script + B-roll + captions + a music track + SFX. Watch it reach `ready`.

- [ ] **Step 3: Parity check**

Open the finished `videos/{id}.mp4` and the **Önizle** modal side by side. Confirm identical: B-roll transitions, caption style/font/color/animation, layout, avatar framing/side, timing, and SFX placement. Note any drift (expected only: avatar is a talking video in the file vs a still in the preview — framing must still match). File findings; if visual drift exists it is a composition bug (same component both sides), if audio drift exists it is a `brollSegments` TS↔Python constant mismatch (Task 1 / worker `_broll_segments`).

---

## Self-Review

**Spec coverage:**
- One-Remotion-pass render → Tasks 1–5 (`Reel`), 6 (`/render-reel`). ✓
- ffmpeg = audio + mux + thumbnail → Tasks 10, 11. ✓
- Delete ffmpeg compositor/libass/xfade → Task 15 (`compose.py` + `fonts/` + `fonttools`). ✓
- Renderer rename + endpoint → Tasks 6–8. ✓
- Worker single path (no fallback) → Tasks 12–14. ✓
- `config` caption-engine removal → Task 13. ✓
- B-roll hook→cutaways→close → Tasks 1, 3. ✓
- Avatar Img⇄OffthreadVideo branch → Task 2. ✓
- Audio parity requirement → Tasks 1 (shared formula), 10 (bed), 17 (web slide-SFX parity), 19 (e2e check). ✓
- Web preview on `Reel` → Task 16. ✓
- Delete stale exports/`ReelPreview` → Task 5. ✓
- docker-compose env cleanup → Task 8. ✓

**Placeholder scan:** No "TBD"/"handle edge cases"/"similar to Task N"; new code is shown in full; moved code cites exact source line ranges. ✓

**Type consistency:** `ReelProps` fields (`avatarUrl`, `previewAudio`, `sfxCues`, `broll: ReelBrollItem[]`) are consistent across `types.ts` (T4), `Reel.tsx` (T4), `Root.tsx` `SAMPLE_REEL_PROPS` (T5), the renderer inputProps (T6), `build_reel_props` (T12), and the web `inputProps` (T16). `brollSegments(words, clipCount, fps)` signature matches all call sites (T1 test, T3, T17). `mux_audio(video_path, voice_path, out_path, *, …)` matches T10 def and T14 call. `render_reel(url, storage, props, *, job_id, dest)` / `render_reel_local(props, *, dest, workdir)` match T12 def and T14 calls. `Word` from `models` matches T9 repoints. ✓

**Cross-language seam noted:** `reel/timing.ts::brollSegments` (TS) and worker `pipeline._broll_segments` (Python) must keep identical proportions; called out in Global Constraints, Task 1, and Task 19.
