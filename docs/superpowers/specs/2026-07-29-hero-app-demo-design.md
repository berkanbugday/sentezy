# Hero app demo — design

**Date:** 2026-07-29
**Status:** shipped (uncommitted). Revised after Berkan's review — see Placement and HeroDemo.

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

`.hero-visual { order: -1 }` is removed, and on a phone `.hero-copy` dissolves into the grid
(`display: contents`) so its parts can be ordered individually: **headline → demo → CTA →
lead**. Removing the order flip alone was not enough — the lead paragraph ran seven lines at
390px and buried the demo just as effectively. The eyebrow is gone entirely and the lead is cut
to two sentences, both for the same reason.

`ReelMarquee` is deleted outright. It first became `PresenterStrip` — the same tiles on the
horizontal `.marquee` primitive, under `ProofBar` — and Berkan cut that too: the showcase wall
and the sector rail already carry the faces, and a third band of them was repetition. Its data
(`data/stills.ts`, `i18n/stills.*.ts`, the `Stills` type, the `.tile*` rules) went with it
rather than being left as dead weight both locales are type-forced to maintain.

## Components

Three new files, no new dependencies.

### `src/data/heroDemo.ts`

The timeline as data, so retiming never means editing logic.

```ts
export type Step = "idle" | "drop" | "uploaded" | "typing" | "typed" | "menu1"
  | "avatars" | "picked" | "menu2" | "captions" | "styled" | "making" | "done";
export type Beat = { at: number; step?: Step; cursor?: string; click?: boolean };
```

Also exports `LOOP` (15.2s), the typewriter window, the three uploaded clips (poster slugs `3`,
`4`, `6`) and the picked presenter (`kevser`).

The first uploaded clip is `posters/3.jpg`, which is the first frame of `/reels/3.mp4` — the
video that plays at the end. What goes in is literally what comes out. Posters `1` and `5` are
deliberately not used: the tray crops a square from near the top of a 9:16 frame and their
burned-in captions fall inside it, which makes a raw upload look like a finished render.

### `src/components/HeroDemo.astro`

The chrome is the app's own shell, not a browser window. `AppShell.tsx` renders a dark
`--frame` background carrying the sidebar, with the content on an inset white panel; that
floating workspace is the product's signature look, and a traffic-light title bar would have
been a stock SaaS screenshot that happens to contain Sentezy. Both `--frame` and `--hero` are
already declared in the landing's stylesheet with the values `apps/web/src/app/globals.css`
uses, so the demo and the product cannot drift apart on colour. Sidebar labels, order, icons
and the credits pill are copied from `Sidebar.tsx`.

```
.hd                        container-type: inline-size
  .hd-glow                 the accent wash, same primitive as .glow
  .appwin                  --frame; font-size: clamp(10.5px, 1.9cqw, 15.5px) — the only scale knob
    .appside               dark rail: Home / Your videos / Avatars / Brand Kit + credits (hidden <900px)
    .apppanel > .panel     the inset white workspace
      .appmain
        .aurora            the dashboard's --hero block behind the heading and composer
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

Sleeps between beats: one `setTimeout` to the next beat's `at`, and `requestAnimationFrame` only
for the 2.2s the typewriter is drawing. An always-on frame loop would wake the main thread sixty
times a second for fifteen seconds to do nothing on almost every frame — on the page whose whole
problem is people leaving it on a phone. Everything else the demo animates (cursor travel, wipes,
spinners, the glow) is CSS and runs on the compositor regardless.

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
  rather than adding a fifth beat to an already 15s loop.
- No interaction. Clicking the demo does nothing; the CTA beneath it is the interaction.
- The real app UI is not refactored to share code with the demo. The landing is Astro, the app
  is Next/React; a shared component would drag React into a static page for one visual.

## Verification

`scripts/verify.mjs` gains assertions that the demo shipped in both trees (`data-hd` present,
the result string present in each locale). Existing gates — forbidden claims, locale leaks,
hreflang, periwinkle CSS — cover the new markup automatically since they sweep every page.

Manual: `pnpm --filter @sentezy/landing dev`, check `/` and `/tr` at 1440px, 900px and 375px,
and with reduced motion forced on.
