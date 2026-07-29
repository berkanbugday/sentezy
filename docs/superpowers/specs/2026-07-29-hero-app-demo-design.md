# Hero app demo — design

**Date:** 2026-07-29
**Status:** approved, ready to implement

## Problem

Visitors land and leave in ~3 seconds. Two causes, both visible in the mobile screenshot Berkan sent:

1. **The first screen has no pitch on it.** `global.css` gives `.hero-visual { order: -1 }` below
   900px, so a phone opens on a 380px-tall wall of AI faces. The eyebrow, the headline
   (`Videolarınızı Sentezy hazırlasın`) and the CTA are all below the fold. The visitor sees
   twelve strangers and no product.
2. **The product is never shown.** Nothing on the page depicts the thing you actually do —
   upload media, write a line, pick a presenter, get a reel. `Platform.astro` shows the four
   *choices* (presenter/voice/music/captions) as phone slides, and `HowItWorks.astro` describes
   the flow in three numbered paragraphs, but no one ever sees the app.

The fix is one component: an animated, faithful replay of the composer, in the hero slot, with
the mobile order corrected so copy comes first.

## Approach

**Scripted DOM/CSS animation**, not a recorded video.

A recorded screencast was rejected: it cannot be produced without a live session with real
avatars and a real render; it puts 2–5 MB on the exact first paint that is causing the bounce;
13px UI text is illegible once a 1440px capture is downscaled into a 340px phone column; and it
needs two recordings (TR + EN) that go stale on every UI change. Lottie has the same staleness
problem plus a runtime dependency.

The DOM approach is ~4 KB of JS, crisp at any DPI, reads its strings from the existing i18n
files so TR and EN are one build, and degrades to a static finished state under
`prefers-reduced-motion`.

## Placement

`HeroDemo` replaces `ReelMarquee` inside `Hero.astro`'s `.hero-visual`.

`.hero-visual { order: -1 }` is removed, so a phone gets **eyebrow → headline → lead → demo →
CTA**. The demo sits between the pitch and the button, which is where a demo belongs.

`ReelMarquee` (two vertical columns, 620px tall) is replaced by `PresenterStrip` — the same
tiles on the existing `.marquee` horizontal primitive (`global.css:227`) — mounted directly
under `ProofBar`. A 420px vertical marquee mid-page fights the scroll direction; a slim
horizontal band does not. Its job is unchanged: proof that there are 126 presenters across 24
sectors, sitting right below the bar that states those two numbers.

## Components

Three new files, no new dependencies.

### `src/data/heroDemo.ts`

The timeline as data, so retiming never means editing logic.

```ts
export type Step = "idle" | "drop" | "uploaded" | "typing" | "typed" | "menu1"
  | "avatars" | "picked" | "menu2" | "captions" | "styled" | "making" | "done";
export type Beat = { at: number; step?: Step; cursor?: string; click?: boolean };
```

Also exports `LOOP`, the typewriter window (`TYPE_FROM`/`TYPE_TO`), the three uploaded clips
(poster slugs `1`, `3`, `5`) and the picked presenter (`kevser`).

The first uploaded clip is `posters/1.jpg`, which is the first frame of `/reels/1.mp4` — the
video that plays at the end. What goes in is literally what comes out.

### `src/components/HeroDemo.astro`

```
.hd                        container-type: inline-size
  .hd-glow                 the accent wash, same primitive as .glow
  .appwin                  font-size: clamp(10px, 2.5cqw, 13px) — the only scale knob
    .appwin-bar            traffic lights + app.sentezy.com pill
    .appwin-body
      .appside             Home / Library / Presenters / Brand kit + credits (hidden <900px)
      .appmain
        .appmain-head      "What are we making today?"
        .compose           faithful copy of MediaComposer's card
          .compose-tabs      Product link | Upload media
          .compose-slot      .drop and .tray stacked, so neither collapses
          .compose-script    typed text + caret
          .compose-row       Video options · settings · Preview · Make video
        .hd-menu           the ActionMenu popover
        .hd-modal          presenter grid / caption grid
      .hd-done             the result: ✓ header, 9:16 reel, Download
  .hd-cursor
  .hd-steps                4 labels, the active one lit
```

Modals and menus hide with `visibility`/`opacity`, never `display: none`, so cursor anchors
always have a measurable rect.

### `src/scripts/hero-demo.ts`

One `requestAnimationFrame` loop. Holds `t0`, applies every beat whose `at` has passed, drives
the typewriter by interpolating `text.slice(0, n)` across the type window, and wraps at `LOOP`.

- Cursor moves by writing `translate` to `.hd-cursor` from the anchor's rect measured at that
  moment, so responsive reflow needs no special handling.
- `IntersectionObserver` starts it at 25% visibility and stops it when it leaves; `visibilitychange`
  pauses on a hidden tab.
- The reel `<video>` is `muted playsinline preload="none"`; `.play()` on the `done` beat,
  `.pause()` + `currentTime = 0` on wrap.
- `prefers-reduced-motion` short-circuits everything: sets `data-step="done"`, hides the cursor,
  and leaves the video on its poster. The four step labels all render lit, so the story is
  still told — just not sequenced.

## Copy

A new `heroDemo` key on `Copy` in `i18n/types.ts`, filled in `copy.en.ts` and `copy.tr.ts`.
Missing or misspelled keys are build errors, which is the guarantee that file exists to give.

Includes the sidebar labels, the composer's own strings (verbatim from `MediaComposer.tsx`
where they exist), the typed script, the four step labels, and the result screen.

## Non-goals

- The demo abbreviates: it picks a presenter and a caption style. Voice shows as already chosen
  rather than adding a fifth beat to an already 17s loop.
- No interaction. Clicking the demo does nothing; the CTA beneath it is the interaction.
- The real app UI is not refactored to share code with the demo. The landing is Astro, the app
  is Next/React; a shared component would drag React into a static page for one visual.

## Verification

`scripts/verify.mjs` gains assertions that the demo shipped in both trees (`data-hd` present,
the result string present in each locale). Existing gates — forbidden claims, locale leaks,
hreflang, periwinkle CSS — cover the new markup automatically since they sweep every page.

Manual: `pnpm --filter @sentezy/landing dev`, check `/` and `/tr` at 1440px, 900px and 375px,
and with reduced motion forced on.
