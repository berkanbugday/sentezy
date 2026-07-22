# Landing page redesign — design

Date: 2026-07-22
Scope: `apps/landing` (Astro → Cloudflare Pages)

## Problem

The current landing page (`apps/landing/src/pages/index.astro`, 276 lines, one file) is a
generic Synthesia clone. It fails on three counts:

1. **It sells a product we do not ship.** "Record two minutes, get a photoreal avatar",
   "175+ languages", "SOC 2 Type II". None of these exist.
2. **It has no proof.** Every visual is a gray placeholder: `avatar demo`,
   `avatar studio — screenshot`, `translation panel — screenshot`, `AI studio editor — screenshot`.
   The customer logo marquee (Northwind, Vertex, LUMEN, Kavis, Orbita, Meridian, Aster, Polar)
   is invented, as are the hero metrics (`147M+` videos, `122M+` avatars).
3. **It contradicts our own marketing.** `instagram.com/sentezy.ai` sells vertical reels ads
   for Travel · Beauty · Real Estate · Gym — "No Filming. No Editing. Free Demo." The landing
   page sells enterprise script-to-video.

## Decisions

| Question | Decision |
|---|---|
| Positioning | Reels-first in the hero; the studio (avatars, voices, captions, brand kit) appears below as the *how* |
| Video source | Official Instagram embeds, lazy-mounted |
| Hero visual | Counter-scrolling marquee of 9:16 reel stills |
| Stills source | Compose existing rendered avatar cutouts — generate no new avatars |
| Stack | Stays Astro at `apps/landing`, Cloudflare Pages |
| Language | EN default, TR toggle (extends the existing `data-tr` mechanism) |
| Pricing | Teaser band only, no numbers |
| Art direction | Bright studio — adopt the web app's design language |
| Presenter count | Claim **12**, not 126 |
| Primary CTA | "Start free" |

## Art direction

The landing adopts the web app's existing visual signature rather than inventing one.
Three tokens are lifted from `apps/web/src/app/globals.css`:

- `--hero` — aurora wash on white: cool blue/teal at left easing to warm amber/pink at right,
  fading down into white. Used behind the hero. (`globals.css:29`)
- `--frame` — soft-dark inset panel carrying the same aurora on near-black. Used by
  `AppShell.tsx:12` and `Sidebar.tsx:46`. Used for the Instagram showcase and final CTA bands.
- Premium-monochrome zinc scale + black pill CTAs (`globals.css:11-20`).

The landing's current periwinkle (`--beam`, `--wash` in `apps/landing/src/styles/global.css:5-8`)
is dropped. `packages/ui/theme.css` is left untouched — the landing overrides locally, exactly
as the web app does.

The dark `--frame` bands are load-bearing, not decoration: they give the Instagram reels a black
backdrop so they read as vivid, while the page overall stays bright.

## Verified claims

Every number on the page must trace to code. These are the only ones permitted:

| Claim | Source |
|---|---|
| 12 AI presenters | `apps/api/src/data/avatars.json` — entries with a non-empty `imageId` |
| 24 sectors | same file, distinct `sector` values |
| 20 caption styles | `CAPTION_STYLE_META`, `packages/types/src/index.ts:26` |
| 14 B-roll transitions | `BROLL_EFFECT_META`, `packages/types/src/index.ts:63` |

Deleted outright: the `147M+` / `122M+` / `175+` metric row, the `.marquee` wordmark section
and its "TEAMS WORLDWIDE TRUST SENTEZY" eyebrow, the SOC 2 FAQ claim, the digital-twin and
translation/lip-sync feature cards, and the `Translation` zig block.

KVKK and GDPR stay in the FAQ. SOC 2 goes.

## Page architecture

```
NAV        dock pill (kept as-is), EN/TR switch, Log in · Start free
HERO       --hero aurora wash
           left:  eyebrow / h1 / lead / [Start free] [▷ Watch a reel] / no-card microcopy
           right: two 9:16 columns of reel stills, counter-scrolling,
                  gradient-masked top and bottom
PROOF BAR  12 presenters · 24 sectors · 20 caption styles · 14 transitions
SECTORS    4 cards — Travel · Beauty · Real Estate · Gym
SHOWCASE   ── dark --frame band ── 3 Instagram embeds + follow @sentezy.ai
HOW        01 Paste a link or script · 02 Pick a presenter and style · 03 Publish
STUDIO     3 zig blocks with real app screenshots — composer, captions, brand kit
CAPTIONS   live CSS demo cycling caption styles inside a phone frame
PRICING    teaser band, no numbers
FAQ        rewritten
FINAL CTA  ── dark --frame band ── + footer
```

No section ships a gray placeholder. All four `.ph` boxes are removed.

## Components

`index.astro` is decomposed. Each component owns one section, takes no props beyond a
`lang`-agnostic copy object, and can be read in full without scrolling.

```
src/components/
  Nav.astro            dock nav + EN/TR switch          (ported, retheme only)
  Hero.astro           aurora hero, copy + CTAs
  ReelMarquee.astro    two counter-scrolling still columns
  ProofBar.astro       the four verified numbers
  Sectors.astro        4 sector cards
  InstaShowcase.astro  dark band, lazy-mounted IG embeds
  HowItWorks.astro     3 steps
  StudioBlocks.astro   3 zig blocks with screenshots
  CaptionDemo.astro    animated caption-style cycler
  PricingTeaser.astro  no-numbers band
  Faq.astro            accordion                        (ported, copy rewritten)
  FinalCta.astro       dark band
  Footer.astro         footer                           (ported, links pruned)
src/data/
  copy.ts              every EN/TR string, one object per section
  reels.ts             Instagram shortcodes + sector tags
  stills.ts            marquee tile definitions (avatar slug, sector, caption text/style)
  site.ts              APP_URL, INSTAGRAM_URL and other outbound links
src/scripts/
  i18n.ts              data-tr swap                     (ported)
  reveal.ts            IntersectionObserver reveal      (ported, count-up removed)
  insta.ts             lazy-mount instagram embed.js
  captions.ts          caption-demo cycler
src/styles/global.css  retheme to app tokens + new section styles
```

### ReelMarquee

Two columns of 9:16 tiles scrolling in opposite directions, masked with a vertical
`mask-image` gradient at both ends. Pure CSS `@keyframes` translate; the track is duplicated
for a seamless loop. Pauses on hover and is disabled entirely under
`prefers-reduced-motion: reduce` (the existing `reduce` check in the page script).

Each tile is **composed, not photographed**: an avatar cutout PNG over a sector-tinted 9:16
gradient, with a real caption style rendered in CSS underneath. This is an honest preview of
what the product outputs, costs no generation, and reuses avatars that already exist.

Tiles are defined in `src/data/stills.ts` — one entry per tile giving the avatar slug, sector
tint, caption text and caption style id. 12 tiles, 6 per column.

### Asset pipeline

`apps/landing/scripts/pull-avatar-stills.ts` — a one-time Node script, not part of the build.
It reads `apps/api/src/data/avatars.json`, takes the entries with a non-empty `displayImageId`,
downloads each cutout from R2 using the existing worker credentials, and writes them to
`apps/landing/public/avatars/<slug>.png`. The PNGs are committed. The build never touches R2
or the network, so Cloudflare Pages stays a pure static build.

### InstaShowcase

Instagram's `embed.js` is **not** in the initial payload. An `IntersectionObserver` on the
showcase section injects the script tag the first time the section approaches the viewport,
then calls `window.instgrm?.Embeds.process()`. Until it loads, each slot shows a skeleton card
sized to the embed's aspect so nothing reflows.

Three reels, from `src/data/reels.ts`:

| Shortcode | Permalink |
|---|---|
| `DbCAH3rCwxe` | https://www.instagram.com/reel/DbCAH3rCwxe/ |
| `DbDOIBPic25` | https://www.instagram.com/reel/DbDOIBPic25/ |
| `DbFxuR3CUqM` | https://www.instagram.com/reel/DbFxuR3CUqM/ |

Each `<blockquote class="instagram-media">` carries only the attributes Instagram requires
(`data-instgrm-permalink`, `data-instgrm-version="14"`, `data-instgrm-captioned`); the inline
`style` and the placeholder markup Instagram ships in its copy-paste snippet are dropped, since
`embed.js` replaces the node's contents wholesale. The blockquote sits inside our own card so
the surrounding frame is ours even though the iframe is not.

If `reels.ts` is empty the section renders a single "Follow @sentezy.ai" card instead of
breaking.

### StudioBlocks screenshots

Three real screenshots of the running web app, captured into `apps/landing/public/app/`:

- `composer.png` — the media composer with a presenter and voice selected
- `captions.png` — the caption style picker
- `brand-kit.png` — the brand kit view

Captured from a locally running `apps/web` at a 2x device pixel ratio, cropped to the inset
white panel. If a screenshot cannot be captured for a block, that block is cut from the page
rather than shipped as a placeholder.

### CaptionDemo

A 9:16 phone frame cycling through caption styles on a fixed sample line, one style every
~2.2s, with the style's label shown beneath. Styles and labels come from `CAPTION_STYLE_META`,
transcribed into `copy.ts` (the landing does not import from `packages/types`, to keep the
Astro build free of workspace TS deps). Frozen on the first style under reduced motion.

## Copy

All strings live in `src/data/copy.ts` as `{ en, tr }` pairs. The existing runtime swap
(`data-tr` attribute, `data-en` captured on first load) is kept — components emit
`data-tr` from the copy object rather than hardcoding it inline.

Hero:

- eyebrow — EN `AI PRESENTER REELS` / TR `YAPAY ZEKA SUNUCULU REELS`
- h1 — EN `Reels that sell — without filming a thing.` /
  TR `Satan reels'ler — hiç çekim yapmadan.`
- lead — EN `Paste a product link or a script. Sentezy picks an AI presenter, writes the copy,
  burns in viral captions, and hands back a finished 9:16 reel. Built for travel, beauty,
  real estate and gym brands.` /
  TR `Bir ürün linki ya da metin yapıştırın. Sentezy yapay zeka sunucuyu seçer, metni yazar,
  viral altyazıları basar ve size bitmiş bir 9:16 reels verir. Seyahat, güzellik, emlak ve
  spor salonu markaları için.`
- CTAs — `Start free` / `Ücretsiz başla` and `▷ Watch a reel` / `▷ Bir reels izle`
  (the second scrolls to `#showcase`)
- microcopy — `No credit card required` / `Kredi kartı gerekmez`

How it works:

- 01 `Paste a link or script` / `Link ya da metin yapıştırın`
- 02 `Pick a presenter and style` / `Sunucu ve stil seçin`
- 03 `Publish` / `Yayınlayın`

Pricing teaser: `Start free. Upgrade when you scale.` /
`Ücretsiz başlayın. Büyüdükçe yükseltin.` — with a `Start free` CTA, no numbers.

FAQ, rewritten to four honest questions: is it free, which sectors are covered, do I need a
camera or editing skills, is my data safe (KVKK/GDPR).

Nav and footer links that currently point at `#` and have no destination (Pricing, Resources,
Blog, Guides, Support, and the Translation/AI Studio product links) are removed rather than
left dead. The footer keeps Product, Solutions and Legal columns only.

## Outbound links

`src/data/site.ts`:

- `APP_URL` — base URL of the web app. `Start free` → `${APP_URL}/signup`,
  `Log in` → `${APP_URL}/login`. Defaults to `http://localhost:3000`, overridable at build
  time via the `PUBLIC_APP_URL` env var. A production host is not yet chosen; setting
  `PUBLIC_APP_URL` in the Cloudflare Pages build is the only change needed when it is.
- `INSTAGRAM_URL` — `https://www.instagram.com/sentezy.ai/`

## Non-goals

- No new avatar generation.
- No self-hosted video files.
- No change to `packages/ui/theme.css` or to the web app.
- No pricing numbers.
- No dark-mode toggle on the landing — it is a light page with dark bands.

## Testing

The landing has no test runner today and one is not introduced. Verification is:

1. `pnpm --filter @sentezy/landing build` succeeds and `astro check` passes.
2. Manual pass at 1440px, 1024px, 768px and 390px widths.
3. `prefers-reduced-motion: reduce` — marquee, reveals and caption cycler are all static.
4. Instagram `embed.js` is absent from the network log until the showcase is scrolled to.
5. Grep the built `dist/` for the deleted claims (`147M`, `122M`, `175+`, `SOC 2`,
   `Northwind`) — all must return nothing.
6. TR toggle swaps every visible string, including all new sections.
