# Composer Settings Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shrink the "Ek ayarlar" drawer to four controls that provably work in both preview and render, move music into a VoicePicker-grade picker backed by a DB catalog, and delete the AI sound-effects feature end to end.

**Architecture:** The whole reel — preview and final render — goes through ONE Remotion composition (`packages/remotion/src/reel/Reel.tsx`). Settings flow web → `options` jsonb → worker → `build_reel_props` → the same component. So each setting is fixed once, at the layer where it actually lives, and both surfaces follow. Two merges shrink the surface: `avatarLayout`+`avatarSide` collapse into a single `avatarPosition`, and music leaves the drawer for its own composer chip.

**Tech Stack:** pnpm + turbo monorepo · Next.js 15 / React 19 (`apps/web`) · Fastify + zod (`apps/api`) · Prisma / Postgres (`packages/db`) · Remotion 4.0.489 (`packages/remotion`) · Python 3.12 + pytest (`apps/worker`) · Cloudflare container renderer (`infra/cloudflare/reel-renderer`)

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-19-composer-settings-cleanup-design.md` — read it before Task 1.
- **Every video is 9:16.** `aspectRatio` disappears from the UI and the request payload only. The `videos.aspect_ratio` column, the `aspect_ratio` Prisma enum, and the worker's `RATIO_DIMS` map stay exactly as they are. **No DB migration for aspect ratio.**
- **The drawer ends with exactly four controls:** Avatar yerleşimi, Altyazı konumu, Ses tonu, Geçiş efekti sesi. Nothing else.
- **All UI copy is Turkish.** Match the existing tone in `SettingsDrawer.tsx` / `VoicePicker.tsx`.
- **TS tests are standalone `node:assert` scripts** run with `npx tsx <path>` — there is no vitest/jest in this repo. Follow the existing pattern in `packages/remotion/src/reel/timing.test.ts` (top-level asserts, `console.log("<file> ok")` at the end).
- **Python tests are pytest**, in `apps/worker/tests/`, run with `cd apps/worker && uv run pytest`.
- **Music storage stays Cloudflare R2.** Do not introduce Supabase Storage.
- **Preview has no TTS.** Voice tone must never trigger an ElevenLabs call from the preview modal.
- **Back-compat is read-only.** Old `options` blobs with `avatarLayout`/`avatarSide` must still render; nothing newly written may contain those keys.
- Commit after every task. Conventional-commit prefixes (`feat:`, `fix:`, `refactor:`, `chore:`).

---

### Task 1: `avatarPosition` in the shared contract

Collapse `layout.avatarLayout` + `layout.avatarSide` into one `avatarPosition`, with a
reader that maps old stored blobs forward.

**Files:**
- Modify: `packages/types/src/index.ts:227-236` (the `layout` block of `ReelOptions`)
- Test: `packages/types/src/layout.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `AvatarPosition` — zod enum `["left","center","right"]` + inferred type, exported.
  - `readAvatarPosition(layout: unknown): AvatarPosition` — exported.
  - `ReelOptions.layout` is now `{ avatarPosition: AvatarPosition; captionPosition: "top" | "bottom" }`.

- [ ] **Step 1: Write the failing test**

Create `packages/types/src/layout.test.ts`:

```ts
import assert from "node:assert";
import { readAvatarPosition, ReelOptions } from "./index";

// Legacy blobs (written before 2026-07-19) map forward.
assert.strictEqual(readAvatarPosition({ avatarLayout: "bottom", avatarSide: "left" }), "center");
assert.strictEqual(readAvatarPosition({ avatarLayout: "bottom", avatarSide: "right" }), "center");
assert.strictEqual(readAvatarPosition({ avatarLayout: "side", avatarSide: "left" }), "left");
assert.strictEqual(readAvatarPosition({ avatarLayout: "side", avatarSide: "right" }), "right");

// Missing / malformed input falls back to the default side.
assert.strictEqual(readAvatarPosition({}), "right");
assert.strictEqual(readAvatarPosition(undefined), "right");
assert.strictEqual(readAvatarPosition(null), "right");
assert.strictEqual(readAvatarPosition({ avatarPosition: "sideways" }), "right");

// An explicit new-shape value wins over any legacy key.
assert.strictEqual(readAvatarPosition({ avatarPosition: "center", avatarSide: "left" }), "center");
assert.strictEqual(readAvatarPosition({ avatarPosition: "left", avatarLayout: "bottom" }), "left");

// ReelOptions normalises legacy blobs AND strips the legacy keys.
const legacy = ReelOptions.parse({
  layout: { avatarLayout: "bottom", avatarSide: "left", captionPosition: "top" },
});
assert.deepStrictEqual(legacy.layout, { avatarPosition: "center", captionPosition: "top" });

// New-shape blobs round-trip untouched.
const fresh = ReelOptions.parse({ layout: { avatarPosition: "left", captionPosition: "bottom" } });
assert.deepStrictEqual(fresh.layout, { avatarPosition: "left", captionPosition: "bottom" });

// Absent layout gets the defaults.
assert.deepStrictEqual(ReelOptions.parse({}).layout, {
  avatarPosition: "right",
  captionPosition: "bottom",
});

console.log("packages/types/src/layout.test.ts ok");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/types && npx tsx src/layout.test.ts`
Expected: FAIL — `SyntaxError` / `readAvatarPosition is not a function` (the export does not exist yet).

- [ ] **Step 3: Add `AvatarPosition` + `readAvatarPosition`**

In `packages/types/src/index.ts`, immediately **above** the `export const ReelOptions = z.object({` line, insert:

```ts
// ── Reel layout ─────────────────────────────────────────────────────────────
/** Where the cut-out avatar sits in the frame. "center" is bottom-centred (B-roll fills a
 *  top band); "left"/"right" frame it to that edge over full-frame B-roll. Replaces the old
 *  avatarLayout("side"|"bottom") + avatarSide("left"|"right") pair. */
export const AvatarPosition = z.enum(["left", "center", "right"]);
export type AvatarPosition = z.infer<typeof AvatarPosition>;

/** Read the avatar position out of a stored `options.layout` blob. Drafts written before
 *  2026-07-19 carry `avatarLayout` + `avatarSide` instead, so map those forward:
 *  bottom → center, otherwise the stored side. */
export function readAvatarPosition(layout: unknown): AvatarPosition {
  const l = (layout ?? {}) as Record<string, unknown>;
  const direct = AvatarPosition.safeParse(l.avatarPosition);
  if (direct.success) return direct.data;
  if (l.avatarLayout === "bottom") return "center";
  return l.avatarSide === "left" ? "left" : "right";
}
```

- [ ] **Step 4: Replace the `layout` block of `ReelOptions`**

In `packages/types/src/index.ts`, replace this whole block:

```ts
  // Reel layout: which side the cut-out avatar is framed to, and where the
  // captions sit (on the clear side, opposite the avatar).
  layout: z
    .object({
      // "side" = avatar framed left/right over full-frame B-roll;
      // "bottom" = avatar bottom-centred with B-roll filling a top band.
      avatarLayout: z.enum(["side", "bottom"]).default("side"),
      avatarSide: z.enum(["left", "right"]).default("right"),
      captionPosition: z.enum(["top", "bottom"]).default("bottom"),
    })
    .default({ avatarLayout: "side", avatarSide: "right", captionPosition: "bottom" }),
```

with:

```ts
  // Reel layout: where the cut-out avatar sits, and whether captions ride the top
  // or the bottom band. The preprocess folds legacy avatarLayout/avatarSide blobs
  // forward; the inner object then strips those keys.
  layout: z
    .preprocess(
      (v) =>
        v && typeof v === "object" ? { ...(v as object), avatarPosition: readAvatarPosition(v) } : v,
      z.object({
        avatarPosition: AvatarPosition.default("right"),
        captionPosition: z.enum(["top", "bottom"]).default("bottom"),
      }),
    )
    .default({ avatarPosition: "right", captionPosition: "bottom" }),
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/types && npx tsx src/layout.test.ts`
Expected: PASS — prints `packages/types/src/layout.test.ts ok`

- [ ] **Step 6: Commit**

```bash
git add packages/types/src/index.ts packages/types/src/layout.test.ts
git commit -m "feat(types): collapse avatarLayout+avatarSide into avatarPosition"
```

---

### Task 2: Thread `avatarPosition` through Remotion

Rename the prop across the Remotion package. **No behavior change** — `left`/`right` still
frame to that edge, `center` behaves exactly like the old `bottom`.

**Files:**
- Modify: `packages/remotion/src/types.ts:7-9,21-23`
- Modify: `packages/remotion/src/layout.ts:2,12-19,43-46`
- Modify: `packages/remotion/src/CaptionOverlay.tsx:33-56`
- Modify: `packages/remotion/src/reel/types.ts:3,16-18`
- Modify: `packages/remotion/src/reel/Reel.tsx:22-42`
- Modify: `packages/remotion/src/reel/AvatarLayer.tsx:19-30`
- Modify: `packages/remotion/src/sample.ts:18-40`
- Modify: `packages/remotion/src/index.ts:11`
- Modify: `apps/web/src/components/composer/CaptionTile.tsx:29`

**Interfaces:**
- Consumes: the `avatarPosition` semantics settled in Task 1. Note the Remotion package keeps its **own** local layout types (it does not import them from `@sentezy/types`) — follow that existing convention.
- Produces:
  - `packages/remotion/src/types.ts` exports `type AvatarPosition = "left" | "center" | "right"`; `CaptionLayout` and `AvatarSide` are gone.
  - `CaptionOverlayProps` = `{ words, styleId, font, color, avatarPosition, position }`.
  - `ReelProps` = `{ words, avatarUrl, broll, captionStyle, avatarPosition, position, captions, previewAudio, sfxCues, width?, height?, fps? }` (`layout` and `avatarSide` removed).
  - `captionBox(opts: { width; height; avatarPosition; position })`, `captionBoxWidth(opts: { width })`.
  - `AvatarLayer` props: `{ src: string; avatarPosition: AvatarPosition }`.

- [ ] **Step 1: Update the shared Remotion types**

In `packages/remotion/src/types.ts`, replace:

```ts
export type CaptionLayout = "side" | "bottom";
export type CaptionPosition = "top" | "bottom";
export type AvatarSide = "left" | "right";
```

with:

```ts
/** Where the cut-out avatar sits: framed to an edge, or bottom-centred. */
export type AvatarPosition = "left" | "center" | "right";
/** Which band the captions ride. */
export type CaptionPosition = "top" | "bottom";
```

Then in the same file, replace these three lines of `CaptionOverlayProps`:

```ts
  layout: CaptionLayout;
  position: CaptionPosition;
  avatarSide: AvatarSide;
```

with:

```ts
  avatarPosition: AvatarPosition;
  position: CaptionPosition;
```

- [ ] **Step 2: Update `layout.ts` signatures (placement math unchanged for now)**

In `packages/remotion/src/layout.ts`, replace the import on line 2:

```ts
import type { AvatarSide, CaptionLayout, CaptionPosition } from "./types";
```

with:

```ts
import type { AvatarPosition, CaptionPosition } from "./types";
```

Replace the `captionBox` signature block:

```ts
export function captionBox(opts: {
  width: number;
  height: number;
  layout: CaptionLayout;
  position: CaptionPosition;
  avatarSide: AvatarSide;
}): CSSProperties {
```

with:

```ts
export function captionBox(opts: {
  width: number;
  height: number;
  avatarPosition: AvatarPosition;
  position: CaptionPosition;
}): CSSProperties {
```

Replace the `captionBoxWidth` signature:

```ts
export function captionBoxWidth(opts: { width: number; layout: CaptionLayout }): number {
```

with:

```ts
export function captionBoxWidth(opts: { width: number }): number {
```

- [ ] **Step 3: Update `CaptionOverlay.tsx`**

In `packages/remotion/src/CaptionOverlay.tsx`, in the destructure at line 33-41 replace
`layout,` and `avatarSide,` with a single `avatarPosition,` (keep `position`). Then replace
line 51:

```ts
  const boxW = captionBoxWidth({ width, layout });
```

with:

```ts
  const boxW = captionBoxWidth({ width });
```

and line 56:

```ts
  const box = captionBox({ width, height, layout, position, avatarSide });
```

with:

```ts
  const box = captionBox({ width, height, avatarPosition, position });
```

- [ ] **Step 4: Update `AvatarLayer.tsx`**

In `packages/remotion/src/reel/AvatarLayer.tsx`, replace the component block (lines 19-30):

```tsx
export const AvatarLayer: React.FC<{
  src: string;
  avatarSide: "left" | "right";
  avatarLayout: "side" | "bottom";
}> = ({ src, avatarSide, avatarLayout }) => {
  const heightPct = avatarLayout === "bottom" ? "54%" : "48%";
  const align = avatarLayout === "bottom" ? "center" : avatarSide === "left" ? "flex-start" : "flex-end";
```

with:

```tsx
export const AvatarLayer: React.FC<{
  src: string;
  avatarPosition: AvatarPosition;
}> = ({ src, avatarPosition }) => {
  const heightPct = avatarPosition === "center" ? "54%" : "48%";
  const align = avatarPosition === "center" ? "center" : avatarPosition === "left" ? "flex-start" : "flex-end";
```

and add the type import at the top of the file, under the `remotion` import:

```tsx
import type { AvatarPosition } from "../types";
```

- [ ] **Step 5: Update `reel/types.ts` and `Reel.tsx`**

In `packages/remotion/src/reel/types.ts`, replace line 3:

```ts
import type { AvatarSide, CaptionLayout, CaptionPosition, CaptionWord } from "../types";
```

with:

```ts
import type { AvatarPosition, CaptionPosition, CaptionWord } from "../types";
```

and replace lines 16-18:

```ts
  layout: CaptionLayout;
  position: CaptionPosition;
  avatarSide: AvatarSide;
```

with:

```ts
  avatarPosition: AvatarPosition;
  position: CaptionPosition;
```

In `packages/remotion/src/reel/Reel.tsx`, in the destructure replace `layout,` and
`avatarSide,` with `avatarPosition,`; replace line 33:

```tsx
      {avatarUrl && <AvatarLayer src={avatarUrl} avatarSide={avatarSide} avatarLayout={layout} />}
```

with:

```tsx
      {avatarUrl && <AvatarLayer src={avatarUrl} avatarPosition={avatarPosition} />}
```

and inside the `<CaptionOverlay …>` block replace the `layout={layout}` and
`avatarSide={avatarSide}` props with a single `avatarPosition={avatarPosition}` (keep
`position={position}`).

- [ ] **Step 6: Update `sample.ts` and the package export surface**

In `packages/remotion/src/sample.ts`, in **both** `SAMPLE_PROPS` and `SAMPLE_REEL_PROPS`
replace the `layout: "side",` and `avatarSide: "right",` entries with a single:

```ts
  avatarPosition: "right",
```

In `packages/remotion/src/index.ts`, in the `export type { … } from "./types";` block
replace `CaptionLayout,` with `AvatarPosition,` (keep the list alphabetical:
`AvatarPosition, CaptionCompositionProps, CaptionOverlayProps, CaptionPosition, CaptionWord, EffectProps`).

- [ ] **Step 7: Update the web caption tile**

In `apps/web/src/components/composer/CaptionTile.tsx`, in the props object at line ~29
replace:

```tsx
    avatarSide: "right" as const,
```

with:

```tsx
    avatarPosition: "right" as const,
```

and remove any sibling `layout: "side" as const,` line if present.

- [ ] **Step 8: Typecheck**

Run: `pnpm --filter @sentezy/remotion typecheck && pnpm --filter @sentezy/web typecheck`
Expected: PASS for `@sentezy/remotion`. `@sentezy/web` may still fail on `MediaComposer.tsx`
and `SfxPreviewModal.tsx` (they still pass `layout`/`avatarSide`) — that is expected and is
fixed in Task 5. Confirm those are the ONLY web errors.

- [ ] **Step 9: Commit**

```bash
git add packages/remotion/src apps/web/src/components/composer/CaptionTile.tsx
git commit -m "refactor(remotion): single avatarPosition prop replaces layout+avatarSide"
```

---

### Task 3: Fix the caption position bug

`captionBox` maps `position` to `top: 26%` vs `40%` — both near mid-screen, which is why
"Üst"/"Alt" looks like it does nothing. Give each a real band.

**Files:**
- Modify: `packages/remotion/src/layout.ts:20-46`
- Test: `packages/remotion/src/layout.test.ts` (create)

**Interfaces:**
- Consumes: `captionBox`, `captionBoxWidth` signatures from Task 2.
- Produces: no signature change — only the numbers `captionBox` returns.

- [ ] **Step 1: Write the failing test**

Create `packages/remotion/src/layout.test.ts`:

```ts
import assert from "node:assert";
import { captionBox, captionBoxWidth } from "./layout";

const W = 1080;
const H = 1920;
const POSITIONS = ["left", "center", "right"] as const;

/** The box is anchored by `top: N%` + translateY(-50%), so N is the block's vertical centre. */
function centrePct(avatarPosition: (typeof POSITIONS)[number], position: "top" | "bottom"): number {
  const box = captionBox({ width: W, height: H, avatarPosition, position });
  return Number(String(box.top).replace("%", ""));
}

// "Üst" and "Alt" must land in genuinely different bands — the bug was 26% vs 40%.
const top = centrePct("right", "top");
const bottom = centrePct("right", "bottom");
assert.ok(top <= 25, `top band sits too low: ${top}%`);
assert.ok(bottom >= 70, `bottom band sits too high: ${bottom}%`);
assert.ok(bottom - top >= 45, `top and bottom barely differ: ${bottom - top}%`);

// A bottom-centred avatar owns the lower frame, so "Alt" lifts above its head...
const centerBottom = centrePct("center", "bottom");
assert.ok(centerBottom < bottom, "a centre avatar must raise the bottom caption band");
// ...but stays clearly below the top band.
assert.ok(centerBottom - top >= 30, `raised bottom band too close to the top band: ${centerBottom - top}%`);

// A side avatar never changes the bands (left and right are mirror images).
assert.strictEqual(centrePct("left", "bottom"), centrePct("right", "bottom"));
// The avatar is always bottom-anchored, so "Üst" is avatar-independent.
for (const p of POSITIONS) assert.strictEqual(centrePct(p, "top"), top);

// The block never leaves the frame once translateY(-50%) has centred it.
for (const p of POSITIONS) {
  for (const pos of ["top", "bottom"] as const) {
    const c = centrePct(p, pos);
    assert.ok(c > 5 && c < 95, `caption centre ${c}% is outside the frame (${p}/${pos})`);
  }
}

// Captions stay full width — the frame minus both 6% edge insets (deliberate design).
assert.strictEqual(captionBoxWidth({ width: W }), W - 2 * W * 0.06);

// Horizontal insets are symmetric.
const box = captionBox({ width: W, height: H, avatarPosition: "right", position: "bottom" });
assert.strictEqual(box.left, box.right);
assert.strictEqual(box.position, "absolute");

console.log("packages/remotion/src/layout.test.ts ok");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/remotion && npx tsx src/layout.test.ts`
Expected: FAIL — `AssertionError: bottom band sits too high: 40%`

- [ ] **Step 3: Fix the placement math**

In `packages/remotion/src/layout.ts`, replace the whole doc comment + body of `captionBox`
(everything from the `/**` above `export function captionBox` down to its closing `}`) with:

```ts
/**
 * Compute the absolute box the caption block lives in. The box is anchored by its vertical
 * CENTRE (`top: N%` + translateY(-50%)) and spans the full frame width minus a 6% inset on
 * each side — big, centred captions are the deliberate look.
 *
 * `position` picks a real band, not a nudge:
 *  - "top"    → an upper band at 20%, clear of the platform chrome at the very top.
 *  - "bottom" → a lower band at 78%.
 * The avatar is always bottom-anchored, so only the bottom band has to dodge it: with
 * `avatarPosition: "center"` the avatar is bottom-centred at 54% frame height, so the band
 * lifts to 62% to sit just above the head. Side avatars (left/right) leave the bottom clear.
 */
export function captionBox(opts: {
  width: number;
  height: number;
  avatarPosition: AvatarPosition;
  position: CaptionPosition;
}): CSSProperties {
  const { width, avatarPosition, position } = opts;
  const edge = Math.round(width * 0.06);
  const centerPct = position === "top" ? 20 : avatarPosition === "center" ? 62 : 78;

  return {
    position: "absolute",
    left: edge,
    right: edge,
    top: `${centerPct}%`,
    transform: "translateY(-50%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/remotion && npx tsx src/layout.test.ts`
Expected: PASS — prints `packages/remotion/src/layout.test.ts ok`

- [ ] **Step 5: Re-run the sibling test to check for regressions**

Run: `cd packages/remotion && npx tsx src/reel/timing.test.ts && pnpm typecheck`
Expected: both PASS (the timing test prints nothing on success and exits 0).

- [ ] **Step 6: Commit**

```bash
git add packages/remotion/src/layout.ts packages/remotion/src/layout.test.ts
git commit -m "fix(remotion): caption position now picks a real top/bottom band"
```

---

### Task 4: Worker + renderer service speak `avatarPosition`

**Files:**
- Modify: `apps/worker/sentezy_worker/pipeline.py:196-230`
- Modify: `apps/worker/sentezy_worker/providers/reel_remotion.py:18-46`
- Modify: `infra/cloudflare/reel-renderer/container/server.mjs:61-80`
- Modify: `infra/cloudflare/reel-renderer/README.md:33`
- Test: `apps/worker/tests/test_layout.py` (create)

**Interfaces:**
- Consumes: the `options.layout` shape from Task 1; the `ReelProps` shape from Task 2.
- Produces:
  - `sentezy_worker.pipeline.read_avatar_position(layout: dict) -> str` — returns `"left" | "center" | "right"`.
  - `build_reel_props(..., avatar_position: str, position: str, ...)` — the `layout` and
    `avatar_side` keyword arguments are gone; the emitted props dict now carries
    `"avatarPosition"` and no longer carries `"layout"` or `"avatarSide"`.

- [ ] **Step 1: Write the failing test**

Create `apps/worker/tests/test_layout.py`:

```python
from sentezy_worker.pipeline import read_avatar_position
from sentezy_worker.providers.reel_remotion import build_reel_props
from sentezy_worker.models import Word


def test_legacy_bottom_layout_maps_to_center():
    assert read_avatar_position({"avatarLayout": "bottom", "avatarSide": "left"}) == "center"
    assert read_avatar_position({"avatarLayout": "bottom", "avatarSide": "right"}) == "center"


def test_legacy_side_layout_keeps_its_side():
    assert read_avatar_position({"avatarLayout": "side", "avatarSide": "left"}) == "left"
    assert read_avatar_position({"avatarLayout": "side", "avatarSide": "right"}) == "right"


def test_missing_or_malformed_layout_falls_back_to_right():
    assert read_avatar_position({}) == "right"
    assert read_avatar_position({"avatarPosition": "sideways"}) == "right"


def test_explicit_avatar_position_wins_over_legacy_keys():
    assert read_avatar_position({"avatarPosition": "center", "avatarSide": "left"}) == "center"
    assert read_avatar_position({"avatarPosition": "left", "avatarLayout": "bottom"}) == "left"


def test_build_reel_props_emits_avatar_position_only():
    props = build_reel_props(
        [Word(text="merhaba", start=0.0, end=0.4)],
        avatar_url=None,
        broll=[],
        style="karaoke",
        font="General Sans",
        color="#FFD54A",
        avatar_position="center",
        position="top",
        captions=True,
        width=1080,
        height=1920,
        fps=30,
    )
    assert props["avatarPosition"] == "center"
    assert props["position"] == "top"
    assert "layout" not in props
    assert "avatarSide" not in props
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/worker && uv run pytest tests/test_layout.py -v`
Expected: FAIL — `ImportError: cannot import name 'read_avatar_position'`

- [ ] **Step 3: Add `read_avatar_position` and use it in the pipeline**

In `apps/worker/sentezy_worker/pipeline.py`, add this module-level function directly above
the function that contains the `# 3) Render the reel` comment:

```python
def read_avatar_position(layout: dict) -> str:
    """Where the avatar sits: "left" | "center" | "right".

    Drafts written before 2026-07-19 store avatarLayout("side"|"bottom") + avatarSide
    instead, so map those forward: bottom → center, otherwise the stored side.
    """
    pos = layout.get("avatarPosition")
    if pos in ("left", "center", "right"):
        return pos
    if layout.get("avatarLayout") == "bottom":
        return "center"
    return "left" if layout.get("avatarSide") == "left" else "right"
```

Then in the render section, replace:

```python
    layout = options.get("layout") or {}
    avatar_side = layout.get("avatarSide", "right")
    avatar_layout = layout.get("avatarLayout", "side")
```

with:

```python
    layout = options.get("layout") or {}
    avatar_position = read_avatar_position(layout)
```

and replace the `build_reel_props(...)` call's layout arguments — change:

```python
        layout=avatar_layout, position=cap_position, avatar_side=avatar_side,
```

to:

```python
        avatar_position=avatar_position, position=cap_position,
```

- [ ] **Step 4: Update `build_reel_props`**

In `apps/worker/sentezy_worker/providers/reel_remotion.py`, in the signature replace:

```python
    layout: str,
    position: str,
    avatar_side: str,
```

with:

```python
    avatar_position: str,
    position: str,
```

and in the returned dict replace:

```python
        "layout": layout,
        "position": position,
        "avatarSide": avatar_side,
```

with:

```python
        "avatarPosition": avatar_position,
        "position": position,
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/worker && uv run pytest tests/test_layout.py -v`
Expected: PASS — 5 passed.

- [ ] **Step 6: Update the renderer service**

In `infra/cloudflare/reel-renderer/container/server.mjs`, replace the destructure at line 61-62:

```js
  const { jobId, words, avatarUrl, broll, captionStyle, layout, position, avatarSide, captions, width, height, fps } =
    req.body ?? {};
```

with:

```js
  const { jobId, words, avatarUrl, broll, captionStyle, avatarPosition, position, captions, width, height, fps } =
    req.body ?? {};
```

and in the `inputProps` object replace:

```js
      captionStyle, layout, position, avatarSide,
```

with:

```js
      captionStyle, avatarPosition, position,
```

In `infra/cloudflare/reel-renderer/README.md` line 33, replace:

```
  "layout": { "avatarSide": "right", "avatarLayout": "side", "captionPosition": "bottom" },
```

with:

```
  "avatarPosition": "right", "position": "bottom",
```

- [ ] **Step 7: Verify nothing else still sends the old props**

Run: `grep -rn "avatarSide\|avatarLayout" apps/worker infra/cloudflare packages/remotion/src packages/types/src | grep -v node_modules | grep -v "\.test\." | grep -v readAvatarPosition | grep -v read_avatar_position`
Expected: **no output** apart from the back-compat comments inside `read_avatar_position` /
`readAvatarPosition`. Any other hit is a missed call site — fix it.

- [ ] **Step 8: Run the full worker suite**

Run: `cd apps/worker && uv run pytest -q`
Expected: PASS (`tests/test_sfx.py` still passes here; it is deleted in Task 7).

- [ ] **Step 9: Commit**

```bash
git add apps/worker infra/cloudflare
git commit -m "refactor(worker): pass avatarPosition to the reel renderer"
```

---

### Task 5: Rebuild the settings drawer

Drop En/boy, merge the two avatar controls, drop Müzik and Yapay zekâ ses efektleri from the
drawer. The AI-SFX *backend* is removed in Task 7; the music *picker* arrives in Task 11.
This task leaves music temporarily unset on new videos — that is intentional and Task 11
restores it.

**Files:**
- Modify: `apps/web/src/lib/composerSettings.ts` (rewrite)
- Modify: `apps/web/src/components/composer/SettingsDrawer.tsx` (rewrite)
- Modify: `apps/web/src/components/MediaComposer.tsx:255-292,579-594`
- Modify: `apps/web/src/components/composer/SfxPreviewModal.tsx:32,54-56`
- Modify: `apps/web/src/lib/schemas.ts:26,48-50`

**Interfaces:**
- Consumes: `AvatarPosition` semantics from Task 1.
- Produces:
  - `ComposerSettings` = `{ avatarPosition: "left"|"center"|"right"; captionPosition: "top"|"bottom"; voiceEmotion: string; transitionSfx: boolean }`.
  - `DEFAULT_SETTINGS` = `{ avatarPosition: "right", captionPosition: "bottom", voiceEmotion: "", transitionSfx: true }`.
  - `SettingsDrawer` props: `{ settings: ComposerSettings; onChange: (s: ComposerSettings) => void; mediaCount: number }` (`mediaCount` is wired in Task 6 — add the prop here with a `= 0` default so this task compiles standalone).

- [ ] **Step 1: Rewrite `composerSettings.ts`**

Replace the entire contents of `apps/web/src/lib/composerSettings.ts` with:

```ts
// The four extra video settings surfaced in the dashboard "Ek ayarlar" drawer.
// Everything else the composer needs — avatar, voice, music, caption style — lives in
// MediaComposer's own state, next to the chip that picks it.
// Every video is 9:16; there is no aspect-ratio setting.

export type ComposerSettings = {
  /** Where the cut-out avatar sits: an edge, or bottom-centred. */
  avatarPosition: "left" | "center" | "right";
  captionPosition: "top" | "bottom";
  /** ElevenLabs v3 audio tag ("" = natural delivery). */
  voiceEmotion: string;
  /** Whoosh on each B-roll transition — only audible with 2+ clips. */
  transitionSfx: boolean;
};

export const DEFAULT_SETTINGS: ComposerSettings = {
  avatarPosition: "right",
  captionPosition: "bottom",
  voiceEmotion: "",
  transitionSfx: true,
};
```

- [ ] **Step 2: Rewrite the drawer body**

In `apps/web/src/components/composer/SettingsDrawer.tsx`:

Replace the import block (lines 3-7) with:

```tsx
import { useEffect, useState } from "react";
import { VOICE_EMOTIONS } from "@/components/wizard/constants";
import { Icon } from "@/components/icons";
import { type ComposerSettings } from "@/lib/composerSettings";
```

Replace the three option-list constants (`LAYOUT_OPTS`, `SIDE_OPTS`, `CAPPOS_OPTS`) with:

```tsx
const AVATAR_POS_OPTS: Opt<ComposerSettings["avatarPosition"]>[] = [
  { value: "left", label: "Sol" },
  { value: "center", label: "Orta" },
  { value: "right", label: "Sağ" },
];
const CAPPOS_OPTS: Opt<ComposerSettings["captionPosition"]>[] = [
  { value: "top", label: "Üst" },
  { value: "bottom", label: "Alt" },
];
```

Replace the component signature line and the `useMusic` lines:

```tsx
export function SettingsDrawer({ settings, onChange }: { settings: ComposerSettings; onChange: (s: ComposerSettings) => void }) {
  const [open, setOpen] = useState(false);
  const musicQ = useMusic(open); // only fetch once the drawer is opened
  const tracks = musicQ.data ?? [];
```

with:

```tsx
export function SettingsDrawer({
  settings,
  onChange,
  mediaCount = 0,
}: {
  settings: ComposerSettings;
  onChange: (s: ComposerSettings) => void;
  /** Uploaded clip count — transition SFX only exist between clips. */
  mediaCount?: number;
}) {
  const [open, setOpen] = useState(false);
```

Finally replace the entire `<div className="flex flex-col gap-5 px-5 py-5">…</div>` block
(every `<Field>` from "En / boy" through "Yapay zekâ ses efektleri") with:

```tsx
          <div className="flex flex-col gap-5 px-5 py-5">
            <Field label="Avatar yerleşimi">
              <Pills options={AVATAR_POS_OPTS} value={settings.avatarPosition} onChange={(v) => set("avatarPosition", v)} />
            </Field>
            <Field label="Altyazı konumu">
              <Pills options={CAPPOS_OPTS} value={settings.captionPosition} onChange={(v) => set("captionPosition", v)} />
            </Field>
            <Field label="Ses tonu">
              <Pills options={VOICE_EMOTIONS} value={settings.voiceEmotion} onChange={(v) => set("voiceEmotion", v)} />
            </Field>
            <Field label="Geçiş efekti sesi">
              <button
                type="button"
                role="switch"
                aria-checked={settings.transitionSfx}
                onClick={() => set("transitionSfx", !settings.transitionSfx)}
                className="flex items-center gap-2.5 text-[12.5px] font-medium text-ink"
              >
                <span className={`relative h-5 w-9 flex-none rounded-full transition-colors ${settings.transitionSfx ? "bg-ink" : "bg-hairline"}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${settings.transitionSfx ? "left-[18px]" : "left-0.5"}`} />
                </span>
                {settings.transitionSfx ? "Açık" : "Kapalı"}
              </button>
            </Field>
          </div>
```

(The `mediaCount` gating lands in Task 6 — for now the prop is accepted and unused.)

- [ ] **Step 3: Update the composer payload and preview props**

In `apps/web/src/components/MediaComposer.tsx`, in the `options` object replace:

```ts
        layout: { avatarLayout: settings.avatarLayout, avatarSide: settings.avatarSide, captionPosition: settings.captionPosition },
```

with:

```ts
        layout: { avatarPosition: settings.avatarPosition, captionPosition: settings.captionPosition },
```

Delete the music spread line (music returns in Task 11):

```ts
        ...(settings.musicTrackKey ? { music: { trackKey: settings.musicTrackKey, volume: settings.musicVolume ?? 0.15 } } : {}),
```

In the `PATCH /videos/:id` body, delete the line:

```ts
          aspectRatio: settings.aspectRatio,
```

(`UpdateVideoDraft.aspectRatio` is optional and the DB column defaults to `9:16`.)

In the `<SfxPreviewModal …>` JSX replace:

```tsx
        layout={{ avatarLayout: settings.avatarLayout, avatarSide: settings.avatarSide, captionPosition: settings.captionPosition }}
```

with:

```tsx
        layout={{ avatarPosition: settings.avatarPosition, captionPosition: settings.captionPosition }}
```

- [ ] **Step 4: Update the preview modal's prop plumbing**

In `apps/web/src/components/composer/SfxPreviewModal.tsx`, replace the `layout` prop type
(line 32):

```tsx
  layout: { avatarLayout: "side" | "bottom"; avatarSide: "left" | "right"; captionPosition: "top" | "bottom" };
```

with:

```tsx
  layout: { avatarPosition: "left" | "center" | "right"; captionPosition: "top" | "bottom" };
```

and in `inputProps` replace:

```tsx
    layout: layout.avatarLayout,
    position: layout.captionPosition,
    avatarSide: layout.avatarSide,
```

with:

```tsx
    avatarPosition: layout.avatarPosition,
    position: layout.captionPosition,
```

- [ ] **Step 5: Update the legacy wizard schema**

In `apps/web/src/lib/schemas.ts`, delete the `aspectRatio` line (line ~26) and replace the
two avatar lines (~48-49):

```ts
  avatarLayout: z.enum(["side", "bottom"]).default("side"),
  avatarSide: z.enum(["left", "right"]).default("right"),
```

with:

```ts
  avatarPosition: z.enum(["left", "center", "right"]).default("right"),
```

If removing `aspectRatio` breaks `WizardSteps.tsx`, delete the corresponding ratio control
there too — every video is 9:16.

- [ ] **Step 6: Confirm nothing still references the removed fields**

Run: `grep -rn "aspectRatio\|avatarLayout\|avatarSide\|sfxEnabled\|musicTrackKey\|musicVolume" apps/web/src`
Expected: the only remaining `aspectRatio` hits are **read-only display** of a saved video —
`lib/types.ts`, `LibraryView.tsx`, `RecentVideos.tsx`, `VideoDetail.tsx`. Those stay. Any
`avatarLayout`/`avatarSide`/`sfxEnabled` hit outside `MediaComposer.tsx` (which still has AI
SFX state until Task 7) is a miss — fix it.

- [ ] **Step 7: Typecheck + build**

Run: `pnpm --filter @sentezy/web typecheck && pnpm --filter @sentezy/web build`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): drawer down to four settings; avatar position merged, ratio fixed at 9:16"
```

---

### Task 6: Make the transition-SFX toggle honest

The toggle is a no-op below 2 clips: both `sfxPreview.slideSfxCues` (`broll.length < 2`) and
the worker's `range(1, len(broll))` need a transition to sound. Say so in the UI.

**Files:**
- Modify: `apps/web/src/components/MediaComposer.tsx` (props + a `useEffect`)
- Modify: `apps/web/src/components/DashboardHome.tsx`
- Modify: `apps/web/src/components/composer/SettingsDrawer.tsx`

**Interfaces:**
- Consumes: `SettingsDrawer`'s `mediaCount` prop from Task 5.
- Produces: `MediaComposer` gains an optional prop `onMediaCountChange?: (n: number) => void`, called whenever the uploaded-clip count changes.

- [ ] **Step 1: Report the media count out of `MediaComposer`**

In `apps/web/src/components/MediaComposer.tsx`, extend the component signature:

```tsx
export function MediaComposer({
  extraSettings,
}: {
  extraSettings?: ComposerSettings;
}) {
```

to:

```tsx
export function MediaComposer({
  extraSettings,
  onMediaCountChange,
}: {
  extraSettings?: ComposerSettings;
  /** Reports the uploaded-clip count so the settings drawer can gate clip-only options. */
  onMediaCountChange?: (n: number) => void;
}) {
```

and add this effect directly below the existing `useEffect` that closes the effect picker
(`if (!multiple) setEffectOpen(false);`):

```tsx
  // Transition SFX only exist between clips — the drawer needs the count to gate its toggle.
  useEffect(() => {
    onMediaCountChange?.(items.length);
  }, [items.length, onMediaCountChange]);
```

- [ ] **Step 2: Hold the count in `DashboardHome`**

In `apps/web/src/components/DashboardHome.tsx`, replace the body of the component with:

```tsx
export function DashboardHome() {
  const [settings, setSettings] = useState<ComposerSettings>(DEFAULT_SETTINGS);
  // Lifted out of MediaComposer so the drawer can gate clip-only settings.
  const [mediaCount, setMediaCount] = useState(0);

  return (
    <div>
      <section className="hero-aurora -mx-5 -mt-6 px-5 pb-10 pt-10 sm:-mx-6 sm:px-6 sm:pt-12 md:-mx-8 md:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="disp text-[26px] font-semibold leading-tight text-ink sm:text-[34px]">Sentezy&apos;e hoş geldin</h1>
              <p className="mt-1.5 text-[14px] text-slate sm:text-[15px]">Medyanı içe aktar ve videonu oluştur</p>
            </div>
            <SettingsDrawer settings={settings} onChange={setSettings} mediaCount={mediaCount} />
          </div>
          <MediaComposer extraSettings={settings} onMediaCountChange={setMediaCount} />
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Gate the toggle in the drawer**

In `apps/web/src/components/composer/SettingsDrawer.tsx`, add above the `return (` statement:

```tsx
  // A transition sound plays AT a cut, so it needs at least two clips to sit between.
  const transitionSfxAvailable = mediaCount >= 2;
```

and replace the "Geçiş efekti sesi" `<Field>` block with:

```tsx
            <Field label="Geçiş efekti sesi">
              <button
                type="button"
                role="switch"
                aria-checked={settings.transitionSfx}
                disabled={!transitionSfxAvailable}
                onClick={() => set("transitionSfx", !settings.transitionSfx)}
                className="flex items-center gap-2.5 text-[12.5px] font-medium text-ink transition disabled:cursor-not-allowed disabled:opacity-45"
              >
                <span className={`relative h-5 w-9 flex-none rounded-full transition-colors ${settings.transitionSfx ? "bg-ink" : "bg-hairline"}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${settings.transitionSfx ? "left-[18px]" : "left-0.5"}`} />
                </span>
                {settings.transitionSfx ? "Açık" : "Kapalı"}
              </button>
              {!transitionSfxAvailable && (
                <p className="mt-1.5 text-[11.5px] text-muted">Geçiş sesi klipler arasında çalar — en az 2 medya yükle.</p>
              )}
            </Field>
```

- [ ] **Step 4: Verify in the running app**

Run: `pnpm --filter @sentezy/web dev`
Then in the browser at the dashboard:
1. Open "Ek ayarlar" with no uploads → the "Geçiş efekti sesi" switch is dimmed and
   unclickable, with the note underneath.
2. Upload one image → still dimmed.
3. Upload a second image → the switch becomes active and the note disappears.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @sentezy/web typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src
git commit -m "fix(web): disable transition-SFX toggle until there are 2+ clips"
```

---

### Task 7: Delete the AI sound-effects feature

Full removal — UI, API endpoint, prompt code, shared types, worker resolver, and the 16
bundled `.mp3` files. The *transition* whooshes are a separate system and must survive.

**Files:**
- Modify: `apps/web/src/components/MediaComposer.tsx`
- Rename: `apps/web/src/components/composer/SfxPreviewModal.tsx` → `apps/web/src/components/composer/PreviewModal.tsx`
- Modify: `apps/web/src/lib/queries.ts:4,152-162`
- Modify: `apps/web/src/lib/sfxPreview.ts:1-29`
- Delete: `apps/web/public/sfx/*.mp3` (16 files; keep `apps/web/public/sfx/transitions/`)
- Modify: `apps/web/public/sfx/LICENSES.md`
- Modify: `apps/api/src/routes/videos.ts:8,292-301`
- Delete: `apps/api/src/lib/sfx.ts`
- Modify: `packages/types/src/index.ts:59-90,251-257`
- Delete: `apps/worker/sentezy_worker/sfx.py`
- Delete: `apps/worker/tests/test_sfx.py`
- Modify: `apps/worker/sentezy_worker/pipeline.py` (import + cue-resolution block + `mux_audio` call)
- Modify: `apps/worker/sentezy_worker/audio.py` (`mux_audio` signature)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `PreviewModal` — same props as `SfxPreviewModal` minus `cues`.
  - `mux_audio(video, voice, dest, *, music_path, music_volume, broll, transition_sfx)` — the `sfx_cues` keyword argument is gone.
  - **Survivors (do not touch):** `packages/remotion/src/reel/SfxTrack.tsx`, `ResolvedSfxCue`, `BROLL_SFX_MAP`, `brollSfxStem`, `tokenizeScript`, `apps/web/public/sfx/transitions/*.wav`, `apps/worker/sfx/transitions/*.wav`, `sfxPreview.transitionSfxSrc`, `sfxPreview.slideSfxCues`.

- [ ] **Step 1: Strip the shared types**

In `packages/types/src/index.ts`, delete the whole `// ── Sound effects ──` block — from the
`export const SFX_META = [` line down to and including `export type SfxCue = z.infer<typeof SfxCue>;`
(this removes `SFX_META`, `SfxId`, `SFX_IDS`, `Sfx`, `SfxCue`). **Keep** the
`tokenizeScript` function that follows it, and fix its doc comment: replace the sentence
`the contract that makes SfxCue.wordIndex mean the same thing on the web (estimated timing) and in the worker (real TTS timing).`
with `the contract that keeps word indexing identical on the web (estimated timing) and in the worker (real TTS timing).`

Then delete the `sfx` block from `ReelOptions`:

```ts
  // AI voice-timed sound effects (POST /videos/suggest-sfx). Separate from
  // effects.transitionSfx (the automatic slide whooshes).
  sfx: z
    .object({
      enabled: z.boolean().default(false),
      cues: z.array(SfxCue).default([]),
    })
    .default({ enabled: false, cues: [] }),
```

Also fix the stale reference in the `BROLL_SFX_MAP` comment: replace
`(separate from the AI voice-timed SFX_META palette)` with `(one per B-roll cut)`.

Run: `cd packages/types && npx tsx src/layout.test.ts`
Expected: PASS (still prints `packages/types/src/layout.test.ts ok`).

- [ ] **Step 2: Delete the API endpoint and prompt code**

```bash
rm apps/api/src/lib/sfx.ts
```

In `apps/api/src/routes/videos.ts`, delete the import on line 8:

```ts
import { sfxEnabled, suggestSfxCues } from "../lib/sfx";
```

and delete the entire `app.post("/videos/suggest-sfx", …)` handler (around lines 292-301),
including any zod schema declared only for it.

Run: `pnpm --filter @sentezy/api typecheck`
Expected: PASS.

- [ ] **Step 3: Delete the worker resolver**

```bash
rm apps/worker/sentezy_worker/sfx.py apps/worker/tests/test_sfx.py
```

In `apps/worker/sentezy_worker/pipeline.py`, delete the `resolve_sfx_cues` import, then
delete this block:

```python
    sfx_opt = options.get("sfx") or {}
    sfx_cues_resolved: list[dict] = []
    if sfx_opt.get("enabled") and sfx_opt.get("cues"):
        try:
            sfx_cues_resolved = resolve_sfx_cues(sfx_opt["cues"], words, tokenize_script(video["script"]))
        except Exception as e:  # noqa: BLE001 — SFX are optional; never fail the job
            print(f"pipeline: sfx cue resolution failed ({e}); continuing without AI SFX")
            sfx_cues_resolved = []
```

and in the `mux_audio(...)` call delete the `sfx_cues=sfx_cues_resolved,` argument. If
`tokenize_script` is now unused in `pipeline.py`, remove its import too.

In `apps/worker/sentezy_worker/audio.py`, remove the `sfx_cues` parameter from `mux_audio`'s
signature and delete the block that appends those cues to `sfx_files` / `sfx_times`. **Keep**
the `if transition_sfx:` loop over `range(1, len(broll))` and everything it touches
(`_BROLL_SFX_MAP`, `_transition_lead`, `_transition_sfx_path`, `_append_audio_bed`).

Run: `cd apps/worker && uv run pytest -q`
Expected: PASS — `tests/test_audio.py`, `tests/test_layout.py`, `tests/test_emotion.py`,
`tests/test_avatar_catalog.py` all green, no `test_sfx.py`.

- [ ] **Step 4: Strip the web query + preview helper**

In `apps/web/src/lib/queries.ts`, delete the `import type { SfxCue } from "@sentezy/types";`
line and the whole `useSuggestSfx` mutation.

In `apps/web/src/lib/sfxPreview.ts`, delete the `sfxSrc` function and the
`resolvePreviewSfx` function, and drop `SfxCue` and `tokenizeScript` from the
`@sentezy/types` import (it should end up importing only `brollSfxStem`). Update the file's
top comment if it mentions AI SFX. Keep `transitionSfxSrc`, `slideSfxCues`, `PER_WORD`,
`FPS`, `SLIDE_SFX_GAIN`.

- [ ] **Step 5: Rename and simplify the preview modal**

```bash
git mv apps/web/src/components/composer/SfxPreviewModal.tsx apps/web/src/components/composer/PreviewModal.tsx
```

In the renamed file: rename the exported component `SfxPreviewModal` → `PreviewModal`,
delete the `cues` prop (both from the props type and the destructure), drop `SfxCue` from the
`@sentezy/types` import, drop `resolvePreviewSfx` from the `@/lib/sfxPreview` import, and
replace the cue memo:

```tsx
  // AI voice-timed SFX + slide-synced whooshes, both audible during real playback.
  const sfxCues = useMemo(() => {
    return [...resolvePreviewSfx(script, cues), ...slideSfxCues(broll, script, transitionSfx)];
  }, [script, cues, broll, transitionSfx]);
```

with:

```tsx
  // Slide-synced whooshes, audible during real playback (the render muxes them with ffmpeg).
  const sfxCues = useMemo(() => slideSfxCues(broll, script, transitionSfx), [broll, script, transitionSfx]);
```

Also update the footer hint text:

```tsx
        <div className="px-5 py-3 text-[12px] text-muted">Sesi duymak için oynat&apos;a bas — ses efektleri gerçek seslendirmeye göre hizalanır</div>
```

to:

```tsx
        <div className="px-5 py-3 text-[12px] text-muted">Sesi duymak için oynat&apos;a bas — seslendirme render sırasında eklenir</div>
```

- [ ] **Step 6: Strip AI SFX out of `MediaComposer`**

In `apps/web/src/components/MediaComposer.tsx`:
- delete `import type { SfxCue } from "@sentezy/types";`
- change `import { SfxPreviewModal } from "./composer/SfxPreviewModal";` to `import { PreviewModal } from "./composer/PreviewModal";`
- remove `useSuggestSfx` from the `@/lib/queries` import and delete `const suggestSfx = useSuggestSfx();`
- delete `const [sfxCues, setSfxCues] = useState<SfxCue[]>([]);`
- delete the effect that clears cues on script edit:

```tsx
  // AI SFX cues are placed by script word-index; a script edit invalidates them.
  useEffect(() => {
    setSfxCues([]);
  }, [script]);
```

- replace the whole `openPreview` function with:

```tsx
  function openPreview() {
    setPreviewOpen(true);
  }
```

- delete the "Ensure SFX cues exist before render" block (`let cuesForRender = sfxCues; …`)
  and the `sfx: { enabled: settings.sfxEnabled, cues: cuesForRender },` line from `options`
- rename the JSX element `<SfxPreviewModal … />` to `<PreviewModal … />` and delete its
  `cues={sfxCues}` prop

- [ ] **Step 7: Delete the bundled AI SFX audio**

```bash
git rm apps/web/public/sfx/*.mp3
```

Then open `apps/web/public/sfx/LICENSES.md` and delete every entry for the removed `.mp3`
files, keeping only the credits that apply to `transitions/*.wav`. If the file ends up with
no entries at all, delete it — `apps/web/public/sfx/transitions/LICENSES.md` covers the
survivors.

- [ ] **Step 8: Verify the removal is complete and the survivors are intact**

Run: `grep -rn "SfxCue\|SFX_META\|suggestSfx\|suggest-sfx\|sfxEnabled\|resolve_sfx_cues\|resolvePreviewSfx\|SfxPreviewModal" apps packages infra --include=* 2>/dev/null | grep -v node_modules | grep -v "\.next"`
Expected: **no output.**

Run: `ls packages/remotion/src/reel/SfxTrack.tsx apps/web/public/sfx/transitions/*.wav apps/worker/sfx/transitions/*.wav`
Expected: all present — `SfxTrack.tsx` plus five `.wav` files in each directory.

- [ ] **Step 9: Typecheck and build everything**

Run: `pnpm typecheck && pnpm --filter @sentezy/web build && cd apps/worker && uv run pytest -q`
Expected: all PASS.

- [ ] **Step 10: Commit**

```bash
git add -A apps packages
git commit -m "refactor: remove the AI sound-effects feature end to end"
```

---

### Task 8: `music_catalog` table

Move the hardcoded three-track list into a seeded DB catalog, following the `avatar_catalog`
pattern (`data/*.json` → `seed.ts` → table → API route).

**Files:**
- Create: `apps/api/src/data/music.json`
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/<timestamp>_music_catalog/migration.sql` (generated)
- Modify: `packages/db/prisma/seed.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - Prisma model `CatalogMusic` → table `music_catalog`, accessed as `prisma.catalogMusic`.
  - Fields: `id`, `slug` (unique), `name`, `mood`, `moodLabel`, `r2Key`, `durationSec`, `source`, `license`, `createdAt`.
  - `apps/api/src/data/music.json` shape: `{ note: string, tracks: Array<{ slug, name, mood, moodLabel, r2Key, durationSec, source, license }> }`.

- [ ] **Step 1: Seed data file**

Create `apps/api/src/data/music.json` with the three tracks already sitting in R2:

```json
{
  "note": "Background music catalog — seed source for the music_catalog table. Add tracks with scripts/add-music.mjs, then re-run `pnpm --filter @sentezy/db seed`.",
  "tracks": [
    {
      "slug": "cinematic",
      "name": "Sinematik",
      "mood": "cinematic",
      "moodLabel": "Sinematik",
      "r2Key": "music/cinematic.mp3",
      "durationSec": 0,
      "source": "https://pixabay.com/music/",
      "license": "Pixabay Content License"
    },
    {
      "slug": "calm",
      "name": "Sakin",
      "mood": "calm",
      "moodLabel": "Sakin",
      "r2Key": "music/calm.mp3",
      "durationSec": 0,
      "source": "https://pixabay.com/music/",
      "license": "Pixabay Content License"
    },
    {
      "slug": "upbeat",
      "name": "Enerjik",
      "mood": "upbeat",
      "moodLabel": "Enerjik",
      "r2Key": "music/upbeat.mp3",
      "durationSec": 0,
      "source": "https://pixabay.com/music/",
      "license": "Pixabay Content License"
    }
  ]
}
```

(`durationSec: 0` means "unknown" — the picker hides the duration when it is 0. Task 9's
script fills real values for newly added tracks.)

- [ ] **Step 2: Add the Prisma model**

In `packages/db/prisma/schema.prisma`, directly after the block that ends with
`@@map("avatar_catalog")`, add:

```prisma
/// Curated background-music beds. Files live in R2 under music/*.mp3; seeded from
/// apps/api/src/data/music.json.
model CatalogMusic {
  id          String   @id @default(uuid())
  slug        String   @unique
  name        String
  mood        String
  moodLabel   String   @map("mood_label")
  r2Key       String   @map("r2_key")
  durationSec Int      @default(0) @map("duration_sec")
  source      String   @default("")
  license     String   @default("")
  createdAt   DateTime @default(now()) @map("created_at")

  @@index([mood])
  @@map("music_catalog")
}
```

- [ ] **Step 3: Generate the migration**

Run: `pnpm --filter @sentezy/db exec prisma migrate dev --name music_catalog`
Expected: a new folder under `packages/db/prisma/migrations/` containing a
`CREATE TABLE "music_catalog"` statement, and the Prisma client regenerated.

If the dev database is unreachable, generate SQL only and apply it later:
`pnpm --filter @sentezy/db exec prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script`

- [ ] **Step 4: Extend the seed**

In `packages/db/prisma/seed.ts`, add this type and loader next to the avatar ones:

```ts
type MusicEntry = {
  slug: string;
  name: string;
  mood: string;
  moodLabel: string;
  r2Key: string;
  durationSec: number;
  source: string;
  license: string;
};

function loadMusicCatalog(): MusicEntry[] {
  const path = join(here, "../../../apps/api/src/data/music.json");
  const data = JSON.parse(readFileSync(path, "utf8")) as { tracks: MusicEntry[] };
  return data.tracks;
}

async function seedMusicCatalog() {
  const tracks = loadMusicCatalog();
  for (const t of tracks) {
    const fields = {
      name: t.name,
      mood: t.mood,
      moodLabel: t.moodLabel,
      r2Key: t.r2Key,
      durationSec: t.durationSec,
      source: t.source,
      license: t.license,
    };
    // Idempotent upsert keyed by the stable slug — safe to re-run after adding tracks.
    await prisma.catalogMusic.upsert({
      where: { slug: t.slug },
      update: fields,
      create: { slug: t.slug, ...fields },
    });
  }
  console.log(`Seeded music — ${await prisma.catalogMusic.count()} track(s) in catalog.`);
}
```

and call it from the main function alongside `await seedAvatarCatalog();`:

```ts
  await seedMusicCatalog();
```

- [ ] **Step 5: Run the seed and verify**

Run: `pnpm --filter @sentezy/db seed`
Expected: prints `Seeded music — 3 track(s) in catalog.`

- [ ] **Step 6: Commit**

```bash
git add packages/db apps/api/src/data/music.json
git commit -m "feat(db): music_catalog table seeded from data/music.json"
```

---

### Task 9: Track-acquisition script + a real library

Give the catalog a repeatable way to grow, then grow it — the drawer's three tracks are not
a library.

**Files:**
- Create: `scripts/add-music.mjs`
- Modify: `apps/api/src/data/music.json`
- Create: `apps/api/src/data/MUSIC_LICENSES.md`

**Interfaces:**
- Consumes: the `music.json` shape from Task 8.
- Produces: `node scripts/add-music.mjs <url> --slug=<slug> --name=<name> --mood=<mood> --mood-label=<label> --license=<license>` — downloads the audio, probes its duration with `ffprobe`, uploads it to R2 at `music/<slug>.mp3`, and appends the entry to `apps/api/src/data/music.json`.

- [ ] **Step 1: Write the script**

Create `scripts/add-music.mjs`:

```js
#!/usr/bin/env node
// Add a background-music track to the catalog: download → probe duration → upload to R2 →
// append to apps/api/src/data/music.json. Re-run `pnpm --filter @sentezy/db seed` afterwards.
//
//   node scripts/add-music.mjs <url> --slug=lofi-chill --name="Lofi" \
//     --mood=calm --mood-label="Sakin" --license="Pixabay Content License"
//
// Needs ffprobe on PATH and the R2 credentials from .env.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const [url, ...rest] = process.argv.slice(2);
const flag = (n) => rest.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const slug = flag("slug");
const name = flag("name");
const mood = flag("mood");
const moodLabel = flag("mood-label") ?? mood;
const license = flag("license") ?? "";

if (!url || !slug || !name || !mood) {
  console.error("usage: add-music.mjs <url> --slug= --name= --mood= [--mood-label=] [--license=]");
  process.exit(1);
}

const dir = mkdtempSync(join(tmpdir(), "sentezy-music-"));
const local = join(dir, `${slug}.mp3`);

const res = await fetch(url);
if (!res.ok) throw new Error(`download failed: ${res.status} ${url}`);
writeFileSync(local, Buffer.from(await res.arrayBuffer()));

const probed = execFileSync("ffprobe", [
  "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", local,
]).toString().trim();
const durationSec = Math.round(Number(probed));
if (!Number.isFinite(durationSec) || durationSec <= 0) throw new Error(`bad duration: ${probed}`);

const key = `music/${slug}.mp3`;
const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
await s3.send(new PutObjectCommand({
  Bucket: process.env.R2_BUCKET,
  Key: key,
  Body: readFileSync(local),
  ContentType: "audio/mpeg",
}));

const jsonPath = new URL("../apps/api/src/data/music.json", import.meta.url).pathname;
const catalog = JSON.parse(readFileSync(jsonPath, "utf8"));
catalog.tracks = catalog.tracks.filter((t) => t.slug !== slug);
catalog.tracks.push({ slug, name, mood, moodLabel, r2Key: key, durationSec, source: url, license });
writeFileSync(jsonPath, `${JSON.stringify(catalog, null, 2)}\n`);

console.log(`added ${slug} (${durationSec}s) → ${key}`);
```

Run: `chmod +x scripts/add-music.mjs`

- [ ] **Step 2: Verify the script's argument handling without touching the network**

Run: `node scripts/add-music.mjs`
Expected: exits 1 and prints the usage line.

- [ ] **Step 3: Source real royalty-free tracks**

Use WebSearch/WebFetch to find **at least 8** instrumental, loopable, license-free tracks
with direct audio URLs. Acceptable sources, in order of preference:
1. **Pixabay Music** (Pixabay Content License — free for commercial use, no attribution)
2. **Free Music Archive**, CC0 / CC-BY tracks only
3. **incompetech.com** (CC-BY, attribution required — record the full credit line)

Cover these moods so the picker's filter chips are meaningful, at least two tracks each:
`cinematic` (Sinematik), `calm` (Sakin), `upbeat` (Enerjik), `corporate` (Kurumsal).

For every track, record: direct audio URL, title, author, source page, exact license name.
**Reject anything whose license page you could not read** — do not guess.

- [ ] **Step 4: Add each track**

For each track, run (substituting the real values):

```bash
dotenv -e .env -- node scripts/add-music.mjs "<direct-audio-url>" \
  --slug=<kebab-slug> --name="<Turkish display name>" \
  --mood=<cinematic|calm|upbeat|corporate> --mood-label="<Sinematik|Sakin|Enerjik|Kurumsal>" \
  --license="<exact license name>"
```

Expected per run: `added <slug> (<n>s) → music/<slug>.mp3`

- [ ] **Step 5: Record the credits**

Create `apps/api/src/data/MUSIC_LICENSES.md` with one section per track:

```markdown
# Background music credits

Every track below is cleared for commercial use. Tracks are stored in R2 under `music/`
and catalogued in `music.json` (seeded into the `music_catalog` table).

## <Track name> — `music/<slug>.mp3`

- **Author:** <author>
- **Source:** <source page URL>
- **License:** <exact license name>
- **Attribution required:** <yes, with the exact credit line | no>
```

- [ ] **Step 6: Re-seed and verify the catalog**

Run: `pnpm --filter @sentezy/db seed`
Expected: prints `Seeded music — 11 track(s) in catalog.` (3 original + at least 8 new).

- [ ] **Step 7: Commit**

```bash
git add scripts/add-music.mjs apps/api/src/data/music.json apps/api/src/data/MUSIC_LICENSES.md
git commit -m "feat: royalty-free music library + add-music acquisition script"
```

---

### Task 10: `GET /music` reads the catalog

**Files:**
- Modify: `apps/api/src/routes/music.ts` (rewrite)

**Interfaces:**
- Consumes: `prisma.catalogMusic` from Task 8.
- Produces: `GET /music?mood=<slug>` → `{ music: Array<{ key, slug, name, mood, moodLabel, durationSec, previewUrl }>, moods: Array<{ slug, label }> }`. `key` is the R2 object key stored in `options.music.trackKey` (the worker's `_resolve_music` already downloads it unchanged).

- [ ] **Step 1: Rewrite the route**

Replace the entire contents of `apps/api/src/routes/music.ts` with:

```ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@sentezy/db";
import { signedDownloadUrl } from "../lib/r2";

// Curated, license-free background beds. The catalog lives in the DB (music_catalog,
// seeded from data/music.json); the audio itself lives in R2 and is served signed.
const MusicQuery = z.object({ mood: z.string().optional() });

export async function musicRoutes(app: FastifyInstance) {
  app.get("/music", async (req) => {
    const q = MusicQuery.safeParse(req.query);
    const f = q.success ? q.data : {};
    const rows = await prisma.catalogMusic.findMany({
      where: { ...(f.mood ? { mood: f.mood } : {}) },
      orderBy: { createdAt: "asc" }, // preserves the authored catalog order
    });
    const music = await Promise.all(
      rows.map(async (t) => ({
        key: t.r2Key, // what gets stored in options.music.trackKey
        slug: t.slug,
        name: t.name,
        mood: t.mood,
        moodLabel: t.moodLabel,
        durationSec: t.durationSec,
        previewUrl: await signedDownloadUrl(t.r2Key),
      })),
    );
    // Distinct moods in catalog order — powers the picker's filter chips.
    const moodRows = await prisma.catalogMusic.findMany({
      distinct: ["mood"],
      select: { mood: true, moodLabel: true },
      orderBy: { createdAt: "asc" },
    });
    return { music, moods: moodRows.map((m) => ({ slug: m.mood, label: m.moodLabel })) };
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @sentezy/api typecheck`
Expected: PASS.

- [ ] **Step 3: Verify against the running API**

Run in one terminal: `pnpm --filter @sentezy/api dev`
Then: `curl -s localhost:4000/music | head -c 600`
Expected: JSON with a `music` array (11+ entries, each with a signed `previewUrl` and a
non-zero `durationSec` for the tracks added in Task 9) and a `moods` array of 4 entries.

Run: `curl -s "localhost:4000/music?mood=calm" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d['music']), {t['mood'] for t in d['music']})"`
Expected: a count of at least 2 and the set `{'calm'}`.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/music.ts
git commit -m "feat(api): GET /music reads the music_catalog table with mood filtering"
```

---

### Task 11: The music picker

A VoicePicker-grade modal, opened from its own composer chip.

**Files:**
- Create: `apps/web/src/components/composer/MusicPicker.tsx`
- Modify: `apps/web/src/lib/queries.ts` (the `MusicTrack` type + `useMusic`)
- Modify: `apps/web/src/components/MediaComposer.tsx` (state, chip, modal, payload)

**Interfaces:**
- Consumes: `GET /music` from Task 10.
- Produces:
  - `MusicTrack` = `{ key: string; slug: string; name: string; mood: string; moodLabel: string; durationSec: number; previewUrl: string }`.
  - `useMusic(mood?: string)` → `{ music: MusicTrack[]; moods: Array<{ slug: string; label: string }> }`.
  - `MusicPicker` props: `{ open: boolean; onClose: () => void; selectedKey: string | null; onSelect: (t: MusicTrack | null) => void; volume: number; onVolumeChange: (v: number) => void }`.
  - `MediaComposer` state: `selectedMusic: MusicTrack | null`, `musicVolume: number` (default `0.15`).

- [ ] **Step 1: Update the query layer**

In `apps/web/src/lib/queries.ts`, replace:

```ts
export type MusicTrack = { key: string; name: string; previewUrl: string };
```

with:

```ts
export type MusicTrack = {
  key: string; // R2 object key — what lands in options.music.trackKey
  slug: string;
  name: string;
  mood: string;
  moodLabel: string;
  durationSec: number;
  previewUrl: string;
};
export type MusicMood = { slug: string; label: string };
```

change the query key:

```ts
  music: ["music"] as const,
```

to:

```ts
  music: (mood = "") => ["music", mood] as const,
```

and replace `useMusic`:

```ts
export function useMusic(enabled = true) {
  return useQuery({ queryKey: qk.music, queryFn: () => apiFetch<{ music: MusicTrack[] }>("/music").then((r) => r.music), enabled });
}
```

with:

```ts
/** The background-music catalog, optionally narrowed to one mood (filtered server-side). */
export function useMusic(mood = "", enabled = true) {
  return useQuery({
    queryKey: qk.music(mood),
    queryFn: () => apiFetch<{ music: MusicTrack[]; moods: MusicMood[] }>(`/music${mood ? `?mood=${encodeURIComponent(mood)}` : ""}`),
    enabled,
  });
}
```

- [ ] **Step 2: Write the picker**

Create `apps/web/src/components/composer/MusicPicker.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { type MusicTrack, useMusic } from "@/lib/queries";
import { Spinner } from "./Spinner";

/** mm:ss, or "" when the catalog has no duration for the track. */
function fmt(sec: number): string {
  if (!sec || sec <= 0) return "";
  return `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
}

/** Background-music picker — mirrors VoicePicker: mood chips filtered server-side, text
 *  search over the loaded page, per-row audio preview, and a "Yok" (none) escape hatch.
 *  The chosen track's level rides along so the caller can send it with the render. */
export function MusicPicker({
  open,
  onClose,
  selectedKey,
  onSelect,
  volume,
  onVolumeChange,
}: {
  open: boolean;
  onClose: () => void;
  selectedKey: string | null;
  onSelect: (t: MusicTrack | null) => void;
  volume: number;
  onVolumeChange: (v: number) => void;
}) {
  const [mood, setMood] = useState("");
  const [q, setQ] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const musicQ = useMusic(mood, open);
  const tracks = musicQ.data?.music ?? [];
  const moods = musicQ.data?.moods ?? [];

  const filtered = tracks.filter(
    (t) => !q.trim() || `${t.name} ${t.moodLabel}`.toLowerCase().includes(q.trim().toLowerCase()),
  );

  function stop() {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlaying(null);
  }
  function play(t: MusicTrack) {
    if (playing === t.key) return stop();
    audioRef.current?.pause();
    const a = new Audio(t.previewUrl);
    a.volume = 0.7;
    audioRef.current = a;
    a.onended = () => setPlaying(null);
    a.play().catch(() => setPlaying(null));
    setPlaying(t.key);
  }

  // Never leave a preview playing behind a closed modal.
  useEffect(() => {
    if (!open) stop();
  }, [open]);
  useEffect(() => () => stop(), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button type="button" aria-label="Kapat" onClick={onClose} className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
      <div className="sheet-in relative z-10 flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-paper shadow-2xl sm:rounded-[24px] sm:border sm:border-hairline">
        <div className="flex-none px-5 pt-5">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-hairline sm:hidden" />
          <div className="flex items-start justify-between gap-3">
            <h3 className="disp mt-0.5 text-[18px] font-semibold text-ink">Müzik seç</h3>
            <button type="button" onClick={onClose} aria-label="Kapat" className="grid h-8 w-8 flex-none place-items-center rounded-full text-muted transition hover:bg-mist hover:text-ink">
              <Icon.close width={18} height={18} className="block" />
            </button>
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Müzik ara"
            className="mt-3 w-full rounded-full border border-hairline bg-paper px-4 py-2 text-[13.5px] text-ink outline-none placeholder:text-muted focus:border-ink"
          />
          <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setMood("")}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition ${mood === "" ? "border-ink bg-ink text-paper" : "border-hairline text-slate hover:bg-mist"}`}
            >
              Tümü
            </button>
            {moods.map((m) => (
              <button
                key={m.slug}
                type="button"
                onClick={() => setMood(m.slug)}
                className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition ${mood === m.slug ? "border-ink bg-ink text-paper" : "border-hairline text-slate hover:bg-mist"}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="no-scrollbar mt-2 flex-1 overflow-y-auto px-5 pb-2">
          <button
            type="button"
            onClick={() => { stop(); onSelect(null); onClose(); }}
            className={`flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition ${!selectedKey ? "border-ink bg-mist" : "border-hairline hover:bg-mist"}`}
          >
            <span className="grid h-9 w-9 flex-none place-items-center rounded-full border border-hairline text-muted">
              <Icon.close width={15} height={15} />
            </span>
            <span className="text-[14px] font-medium text-ink">Yok</span>
          </button>

          {musicQ.isLoading && (
            <div className="flex items-center gap-2 px-1 py-4 text-[13px] text-muted">
              <Spinner size={14} /> Yükleniyor…
            </div>
          )}
          {!musicQ.isLoading && filtered.length === 0 && (
            <p className="px-1 py-6 text-center text-[13px] text-muted">Bu filtreye uyan müzik yok.</p>
          )}

          {filtered.map((t) => (
            <div
              key={t.key}
              className={`mt-2 flex items-center gap-3 rounded-2xl border px-3.5 py-3 transition ${selectedKey === t.key ? "border-ink bg-mist" : "border-hairline"}`}
            >
              <button
                type="button"
                onClick={() => play(t)}
                aria-label={playing === t.key ? `${t.name} önizlemesini durdur` : `${t.name} önizlemesini oynat`}
                className="grid h-9 w-9 flex-none place-items-center rounded-full border border-hairline text-ink transition hover:bg-paper"
              >
                {playing === t.key ? <Icon.close width={14} height={14} /> : <Icon.play width={14} height={14} />}
              </button>
              <button type="button" onClick={() => { stop(); onSelect(t); onClose(); }} className="flex-1 text-left">
                <div className="text-[14px] font-medium text-ink">{t.name}</div>
                <div className="text-[12px] text-muted">
                  {t.moodLabel}
                  {fmt(t.durationSec) && ` · ${fmt(t.durationSec)}`}
                </div>
              </button>
            </div>
          ))}
        </div>

        {selectedKey && (
          <div className="flex-none border-t border-hairline px-5 py-4">
            <div className="mb-1.5 flex items-center justify-between text-[11.5px] text-muted">
              <span>Müzik seviyesi</span>
              <span className="mono">{Math.round(volume * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={0.4}
              step={0.01}
              value={volume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              className="w-full accent-ink"
            />
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire the chip into the composer**

In `apps/web/src/components/MediaComposer.tsx`:

Add the import next to the other picker imports:

```tsx
import { MusicPicker } from "./composer/MusicPicker";
```

and add `type MusicTrack` to the existing `@/lib/queries` import.

Add the state next to `selectedVoice`:

```tsx
  const [musicOpen, setMusicOpen] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState<MusicTrack | null>(null);
  const [musicVolume, setMusicVolume] = useState(0.15); // UI cap 0.4 — the bed never buries the voice
```

Restore the music entry in the `options` object, directly above the `layout:` line:

```ts
        ...(selectedMusic ? { music: { trackKey: selectedMusic.key, volume: musicVolume } } : {}),
```

Add the chip immediately **after** the voice chip button and before the caption-style chip
button, so the row reads `Avatar seç · Ses seç · Müzik seç · Aa · Önizle`:

```tsx
          {/* music chip */}
          <button
            type="button"
            onClick={() => setMusicOpen(true)}
            className="flex items-center gap-2 rounded-full border border-hairline bg-paper py-1 pl-2.5 pr-3 text-[13px] font-medium text-ink transition hover:bg-mist"
          >
            <Icon.play width={14} height={14} className="text-slate" />
            {selectedMusic ? selectedMusic.name : "Müzik seç"}
            <Icon.chevronDown width={14} height={14} className="text-muted" />
          </button>
```

and mount the modal next to the other pickers:

```tsx
      <MusicPicker
        open={musicOpen}
        onClose={() => setMusicOpen(false)}
        selectedKey={selectedMusic?.key ?? null}
        onSelect={setSelectedMusic}
        volume={musicVolume}
        onVolumeChange={setMusicVolume}
      />
```

- [ ] **Step 4: Typecheck + build**

Run: `pnpm --filter @sentezy/web typecheck && pnpm --filter @sentezy/web build`
Expected: PASS.

- [ ] **Step 5: Verify in the running app**

With the API running, run `pnpm --filter @sentezy/web dev` and on the dashboard:
1. The chip row reads `Avatar seç · Ses seç · Müzik seç · Aa · Önizle`.
2. Clicking "Müzik seç" opens the modal with the mood chips and every catalog track.
3. ▶ on a row plays that track; ▶ on another row stops the first.
4. Picking a track closes the modal and the chip shows its name; the level slider appears
   when the modal is reopened.
5. "Yok" clears the selection and the chip returns to "Müzik seç".
6. A mood chip narrows the list (verify the network tab shows `/music?mood=…`).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): VoicePicker-grade music picker with its own composer chip"
```

---

### Task 12: Music in the preview

The preview currently has no music bed, so what the user hears is not what renders. Add it.

**Files:**
- Modify: `packages/remotion/src/reel/types.ts`
- Modify: `packages/remotion/src/reel/Reel.tsx`
- Modify: `packages/remotion/src/sample.ts`
- Modify: `apps/worker/sentezy_worker/providers/reel_remotion.py`
- Modify: `apps/web/src/components/composer/PreviewModal.tsx`
- Modify: `apps/web/src/components/MediaComposer.tsx`

**Interfaces:**
- Consumes: `selectedMusic` / `musicVolume` from Task 11; `PreviewModal` from Task 7.
- Produces:
  - `ReelProps` gains `musicUrl: string | null` and `musicVolume: number`.
  - `PreviewModal` gains props `musicUrl?: string | null` and `musicVolume?: number`.
  - `build_reel_props` emits `"musicUrl": None, "musicVolume": 0` — the render stays silent and the worker keeps muxing the real, ducked bed with ffmpeg.

- [ ] **Step 1: Extend the Reel props**

In `packages/remotion/src/reel/types.ts`, add these two fields directly below `sfxCues`:

```ts
  /** Preview-only background bed (a signed R2 URL). null = no music. */
  musicUrl: string | null;
  /** 0..1 bed level, matched to options.music.volume. */
  musicVolume: number;
```

- [ ] **Step 2: Play it in the composition**

In `packages/remotion/src/reel/Reel.tsx`, add `Audio` to the `remotion` import:

```tsx
import { AbsoluteFill, Audio, useVideoConfig } from "remotion";
```

add `musicUrl,` and `musicVolume,` to the destructure, and replace the SFX line:

```tsx
      {previewAudio && <SfxTrack cues={sfxCues} fps={fps} />}
```

with:

```tsx
      {previewAudio && musicUrl && <Audio src={musicUrl} volume={musicVolume} loop />}
      {previewAudio && <SfxTrack cues={sfxCues} fps={fps} />}
```

The render passes `previewAudio: false`, so the output stays opaque and silent — the worker
still muxes the real (sidechain-ducked) bed with ffmpeg. Note the preview bed is a flat level
with no ducking; that difference is expected.

In `packages/remotion/src/sample.ts`, add to `SAMPLE_REEL_PROPS`:

```ts
  musicUrl: null,
  musicVolume: 0.15,
```

- [ ] **Step 3: Keep the worker's props valid**

In `apps/worker/sentezy_worker/providers/reel_remotion.py`, add to the returned dict, next to
`"sfxCues": []`:

```python
        "musicUrl": None,   # the bed is muxed by ffmpeg after the render, not baked in
        "musicVolume": 0,
```

- [ ] **Step 4: Pass the bed into the preview**

In `apps/web/src/components/composer/PreviewModal.tsx`, add to the props type:

```tsx
  musicUrl?: string | null;
  musicVolume?: number;
```

add `musicUrl = null,` and `musicVolume = 0.15,` to the destructure, and add to
`inputProps`:

```tsx
    musicUrl,
    musicVolume,
```

In `apps/web/src/components/MediaComposer.tsx`, add these props to the `<PreviewModal … />`
element:

```tsx
        musicUrl={selectedMusic?.previewUrl ?? null}
        musicVolume={musicVolume}
```

- [ ] **Step 5: Typecheck everything**

Run: `pnpm typecheck && cd apps/worker && uv run pytest -q`
Expected: all PASS.

- [ ] **Step 6: Verify in the running app**

With web + API running: pick a music track, write a script, open "Önizle" and press play.
Expected: the chosen bed plays under the reel at the level set by the slider; moving the
slider and reopening the preview changes the level; selecting "Yok" makes the preview silent
apart from transition whooshes.

- [ ] **Step 7: Commit**

```bash
git add packages/remotion apps/worker apps/web/src
git commit -m "feat: play the music bed in the preview so it matches the render"
```

---

### Task 13: Prove voice tone works

Ses tonu already reaches the worker; the user asked whether it actually does anything. Lock
the contract down with tests rather than a manual guess.

**Files:**
- Test: `apps/api/src/lib/emotion.test.ts` (create)
- Test: `apps/worker/tests/test_voice_tone.py` (create)

**Interfaces:**
- Consumes: `applyEmotionTag` from `apps/api/src/lib/elevenlabs.ts`; the tone-reading logic in `apps/worker/sentezy_worker/pipeline.py`.
- Produces: no production code — tests only, unless a test uncovers a real defect.

- [ ] **Step 1: Write the API test**

Create `apps/api/src/lib/emotion.test.ts`:

```ts
import assert from "node:assert";
import { applyEmotionTag } from "./elevenlabs";

// The six tones the drawer offers (wizard/constants.ts VOICE_EMOTIONS).
const TONES = ["", "warmly", "excited", "cheerfully", "seriously", "sincerely"];

// "" is Doğal — no tag, the script goes through untouched.
assert.strictEqual(applyEmotionTag("Merhaba dünya.", ""), "Merhaba dünya.");
assert.strictEqual(applyEmotionTag("Merhaba dünya.", undefined), "Merhaba dünya.");
assert.strictEqual(applyEmotionTag("Merhaba dünya.", "   "), "Merhaba dünya.");

// Every real tone prepends its v3 audio tag.
for (const tone of TONES.filter(Boolean)) {
  assert.strictEqual(applyEmotionTag("Merhaba dünya.", tone), `[${tone}] Merhaba dünya.`);
}

// An already-annotated script wins — the per-sentence pass must not be overridden.
assert.strictEqual(
  applyEmotionTag("[excited] Merhaba! [warmly] Hoş geldin.", "seriously"),
  "[excited] Merhaba! [warmly] Hoş geldin.",
);

// A bracketed non-tag (e.g. a bracketed number) is not mistaken for an existing tag.
assert.strictEqual(applyEmotionTag("[1] Merhaba.", "warmly"), "[warmly] [1] Merhaba.");

console.log("apps/api/src/lib/emotion.test.ts ok");
```

- [ ] **Step 2: Run it**

Run: `cd apps/api && npx tsx src/lib/emotion.test.ts`
Expected: PASS — prints `apps/api/src/lib/emotion.test.ts ok`. If any assertion fails, fix
`applyEmotionTag` (not the test) and note the fix in the commit message.

- [ ] **Step 3: Write the worker test**

Create `apps/worker/tests/test_voice_tone.py`:

```python
"""The tone the drawer sets must survive the trip into the TTS call.

pipeline.py reads options.voice.emotion, then either (a) hands it to the LLM tagging pass,
or (b) with no LLM key, passes it as a single leading v3 tag. An already-tagged script
short-circuits both. These tests pin that decision table.
"""
import re


def _decide(options: dict, script: str, has_llm_key: bool) -> tuple[str, str | None]:
    """Mirror of pipeline.py's tone branch → (route, emotion_tag).

    route is "passthrough" | "llm" | "leading-tag".
    """
    tone = ((options.get("voice") or {}).get("emotion")) or ""
    already_tagged = bool(re.search(r"\[[a-zA-Z]", script))
    if not tone or already_tagged:
        return ("passthrough", None)
    return ("llm", None) if has_llm_key else ("leading-tag", tone)


def test_natural_tone_is_a_passthrough():
    assert _decide({"voice": {"emotion": ""}}, "Merhaba.", True) == ("passthrough", None)
    assert _decide({}, "Merhaba.", True) == ("passthrough", None)


def test_tone_with_an_llm_key_goes_through_the_tagging_pass():
    assert _decide({"voice": {"emotion": "warmly"}}, "Merhaba.", True) == ("llm", None)


def test_tone_without_an_llm_key_becomes_a_single_leading_tag():
    assert _decide({"voice": {"emotion": "excited"}}, "Merhaba.", False) == ("leading-tag", "excited")


def test_an_already_tagged_script_is_never_re_tagged():
    assert _decide({"voice": {"emotion": "seriously"}}, "[excited] Merhaba.", True) == ("passthrough", None)
    assert _decide({"voice": {"emotion": "seriously"}}, "[excited] Merhaba.", False) == ("passthrough", None)


def test_every_drawer_tone_reaches_the_tts_call():
    for tone in ("warmly", "excited", "cheerfully", "seriously", "sincerely"):
        assert _decide({"voice": {"emotion": tone}}, "Merhaba.", False) == ("leading-tag", tone)
```

- [ ] **Step 4: Run it**

Run: `cd apps/worker && uv run pytest tests/test_voice_tone.py -v`
Expected: PASS — 5 passed.

- [ ] **Step 5: Confirm the mirror still matches the real code**

Run: `grep -n "already_tagged\|emotion_tag\|tone = " apps/worker/sentezy_worker/pipeline.py`
Read the output and confirm the branch structure matches `_decide` exactly. If `pipeline.py`
has drifted, update `_decide` (and the assertions) to match reality — the test documents the
real code, not the other way around.

- [ ] **Step 6: Verify the tone reaches a real voice preview**

With web + API running: open "Ek ayarlar", set Ses tonu to "Enerjik", then open "Ses seç",
enable the "kendi metninle dinle" (real TTS) option and play a voice.
Expected: the request to `POST /voices/preview` carries `"emotion":"excited"` (check the
network tab) and the delivery is audibly more energetic than with "Doğal".

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/lib/emotion.test.ts apps/worker/tests/test_voice_tone.py
git commit -m "test: pin the voice-tone contract from the drawer through to TTS"
```

---

### Task 14: End-to-end verification

Nothing in this plan is finished until one real queued render proves the four settings
survive the whole pipeline.

**Files:** none (verification only; fix-forward commits if something breaks).

**Interfaces:**
- Consumes: everything from Tasks 1-13.
- Produces: a verification note appended to the spec.

- [ ] **Step 1: Full static check**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: all PASS.

- [ ] **Step 2: Full test sweep**

```bash
cd packages/types && npx tsx src/layout.test.ts
cd ../remotion && npx tsx src/layout.test.ts && npx tsx src/reel/timing.test.ts
cd ../../apps/api && npx tsx src/lib/emotion.test.ts
cd ../worker && uv run pytest -q
```

Expected: every command exits 0.

- [ ] **Step 3: Confirm the drawer is exactly four controls**

Run the web app, open "Ek ayarlar".
Expected, in order: **Avatar yerleşimi** (Sol/Orta/Sağ) · **Altyazı konumu** (Üst/Alt) ·
**Ses tonu** (6 pills) · **Geçiş efekti sesi** (toggle). No En/boy, no Avatar tarafı, no
Müzik, no Yapay zekâ ses efektleri.

- [ ] **Step 4: Preview matrix**

Pick an avatar, write a script, upload 2 images, and open "Önizle" for each combination
below. Confirm each is **visibly/audibly different**:

| Setting | Check |
|---|---|
| Avatar yerleşimi = Sol | avatar hugs the left edge |
| Avatar yerleşimi = Orta | avatar is bottom-centred, larger |
| Avatar yerleşimi = Sağ | avatar hugs the right edge |
| Altyazı konumu = Üst | captions ride the upper fifth of the frame |
| Altyazı konumu = Alt | captions ride the lower band — and sit noticeably higher when avatar = Orta |
| Geçiş efekti sesi = Açık | a whoosh lands on each cut between the two images |
| Geçiş efekti sesi = Kapalı | no whoosh |
| Müzik seçili | the bed plays under the reel at the slider's level |
| Müzik = Yok | no bed |

- [ ] **Step 5: One real render**

With the worker running, create a video using: avatar = Orta, altyazı = Üst, ses tonu =
Enerjik, a music track, geçiş efekti sesi = Açık, 2+ uploaded clips. Wait for it to finish
in the library and play the result.

Expected in the finished MP4: the avatar is bottom-centred; captions ride the top band; the
music bed plays and ducks under the voice; a whoosh lands on the cut; the delivery is
energetic. **The rendered video must match what the preview showed.**

- [ ] **Step 6: Verify an old video still renders**

Find a video created before this branch (its `options.layout` still has
`avatarLayout`/`avatarSide`) and re-queue it, or insert a draft with a legacy `options` blob.
Expected: it renders with the equivalent avatar placement — `bottom` → centred,
`side`+`left` → left. No crash, no default-to-right regression.

- [ ] **Step 7: Record the result in the spec**

Append to `docs/superpowers/specs/2026-07-19-composer-settings-cleanup-design.md`:

```markdown
## Doğrulama sonucu

- Tarih: <YYYY-MM-DD>
- Statik: `pnpm typecheck && pnpm lint && pnpm build` — <sonuç>
- Testler: types/remotion/api/worker — <sonuç>
- Önizleme matrisi: <sonuç, farklılık gösteren/göstermeyen ayarlar>
- Gerçek render (video id `<id>`): <sonuç>
- Eski `options` blob'u geriye uyum: <sonuç>
```

Fill in what actually happened, including anything that failed.

- [ ] **Step 8: Commit**

```bash
git add docs/superpowers/specs/2026-07-19-composer-settings-cleanup-design.md
git commit -m "docs: record end-to-end verification of the settings cleanup"
```
