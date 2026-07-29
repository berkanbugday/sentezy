# Landing page: English + Turkish

**Date:** 2026-07-28
**Status:** Approved, not yet implemented
**Scope:** `apps/landing` only

## Goal

Serve the landing site in English and Turkish, picking the visitor's language from their
browser on first arrival, with a manual switcher that overrides and persists.

## Why this is not the thing that was removed

The page shipped bilingual once and it was deliberately torn out. `src/data/copy.ts` records
the reason: English lived in the markup with a `data-tr` twin beside it, swapped at runtime.
That doubled every string, put a switcher in both the nav and the footer, and made the copy
tedious to edit.

This design inverts all three properties of that approach:

| Removed approach | This design |
| --- | --- |
| Both languages in one HTML file | Two static files, each one language |
| Swapped by JS after load | Resolved at build time |
| Strings doubled inline in markup | Two copy modules, no markup duplication |
| Switcher in nav **and** footer | Switcher in nav only |
| A missing translation renders blank | A missing key fails the build |

The last row is the important one. The previous build had no way to know a string had gone
untranslated; this one cannot compile without it.

## Architecture

### Routing

Astro's native i18n, static output, two real page trees.

```
astro.config.mjs
  i18n: {
    locales: ["en", "tr"],
    defaultLocale: "en",
    routing: { prefixDefaultLocale: false },
  }
```

```
src/pages/            src/pages/tr/
  index.astro           index.astro
  soon.astro            soon.astro
  terms.astro           terms.astro
  privacy.astro         privacy.astro
  kvkk.astro            kvkk.astro
```

`/` is English; `/tr/` is Turkish. Each is a fully-rendered single-language HTML file. The
page files stay thin — they import the same components, which resolve their own copy.

### Copy modules

```
src/i18n/
  types.ts       the shape: Copy, Studio, Reels, Stills + the key unions — no strings
  copy.en.ts     today's src/data/copy.ts, moved
  copy.tr.ts     same shape, Turkish
  studio.en.ts   studio.ts label fields
  studio.tr.ts
  reels.en.ts    reels.ts label + alt fields
  reels.tr.ts
  stills.en.ts   stills.ts sector + caption overlays
  stills.tr.ts
  index.ts       getCopy / getStudio / getReels / getStills, plus localeOf,
                 localeHref and barePath — the whole locale surface
```

**The type guard.** A missing, extra or misspelled Turkish key must be a build error. This is
the guard the previous bilingual build lacked, and it is the load-bearing part of the design.
It needs care to get right:

`types.ts` declares the shape explicitly and holds no strings:

```ts
export type Copy = {
  nav: { platform: string; showcase: string; how: string; login: string; cta: string };
  hero: { eyebrow: string; title: string; /* … */ };
  sectors: { eyebrow: string; title: string; lead: string;
             items: { key: string; name: string; body: string }[] };
  // …
};
```

Both locale modules then declare against it — `export const copy: Copy = { … }` — and
`index.ts` selects:

```ts
import { copy as en } from "./copy.en";
import { copy as tr } from "./copy.tr";
const dict: Record<Locale, Copy> = { en, tr };
```

Two traps this avoids, both of which would silently defeat the guard:

1. **Don't infer the shape from the English module.** `typeof import("./copy.en")` is a module
   type, not an object type — `satisfies` cannot be applied to a module's export list. Naming
   the shape in `types.ts` sidesteps this entirely.
2. **`as const` must go.** `sectors`, `how` and `faq` currently use `as const`, so their
   inferred types are the *literal English strings* (`name: "Beauty & Hair"`). Typing Turkish
   against that would reject every correct translation. The explicit types in `types.ts`
   replace what `as const` was providing (shape safety) without freezing the values.

The other three data files (`studio.ts`, `reels.ts`, `stills.ts`) each get the same
treatment: one shape in `types.ts`, two locale modules declared against it. Their lookup
keys — `Presenter.slug`, `Voice.name`, `Track.mood`, `captionStyles[].id`, `Reel.file`,
`Still.id` — get the same union-type guard as `SectorKey` below, not an open
`Record<string, string>`; the latter would type-check with keys missing, extra or
misspelled and silently defeat the guarantee this section claims.

Components change one line each — `import { hero } from "../data/copy"` becomes
`const { hero } = getCopy(Astro.currentLocale)`. Astro derives `currentLocale` from the URL,
so no prop drilling and no component restructuring. Ten components are touched, none
reshaped.

### What is translated, and what is never translated

Translate **labels**. Never translate **identifiers or proper nouns** — they are join keys
into the API's data, and translating one silently breaks a lookup.

| File | Translate | Never touch |
| --- | --- | --- |
| `copy.ts` | all display strings | `sectors.items[].key` (maps to `avatars.json` sector values) |
| `studio.ts` | `Voice.meta`, `Track.mood`, `captionStyles[].label` | `slug`, `tint`, `Presenter.name`, `Voice.name`, `Track.name`, `captionStyles[].id`, `bars`, `sec` |
| `reels.ts` | `sector`, `alt` | `file` |
| `stills.ts` | `sector`, `caption` | `id`, `slug`, `tint`, `style` |

> **Corrected during execution (2026-07-28).** This section originally listed three data
> files. `src/data/stills.ts` is a fourth: 12 sector labels and 12 caption overlays rendered
> by `ReelMarquee.astro` on the hero marquee. It was missed because the marquee is
> `aria-hidden` and the strings read as decorative — they are not, they are visible ad copy.
> Absorbed into plan Tasks 3 and 5.

`sectors.items[].key` gets a union type in `types.ts`:

```ts
export type SectorKey = "beauty" | "tech" | "realestate" | /* … 24 total */;
```

This is not decoration. `Footer.astro:43` looks a sector up by key and asserts the result is
present:

```ts
{["beauty", "realestate", "fitness", "ecommerce"].map((k) => (
  <a href="#sectors">{sectors.items.find((s) => s.key === k)!.name}</a>
))}
```

If a Turkish key drifts — translated, reordered away, typo'd — `find` returns `undefined` and
that `!` turns into a crash during the build, with a message that points at the footer rather
than at the real cause. The union makes a drifted key a type error at the source instead.

Two judgment calls inside `studio.ts`:

- `captionStyles` labels — "Hormozi" and "TikTok" are proper nouns and stay as-is in Turkish.
  "Highlight", "Boxed", "Neon", "Clean" are descriptions and get translated.
- `Track.name` values ("After the Storm", "Quiet Hour") are real track titles from
  `music.json`. They stay English in both trees, the way song titles do.

`alt` text in `reels.ts` is translated. It never appears on screen, but a Turkish screen
reader user hears it, and leaving it English is the accessibility equivalent of an
untranslated paragraph.

### The proof numbers stay identical

`126`, `24`, `20`, `14` trace to source files (`avatars.json`, `CAPTION_STYLE_META`,
`BROLL_EFFECT_META`). They are facts, not copy. Both trees render the same digits, and the
build gate asserts this in both.

## Language detection

An inline script, first element in `<head>`, English pages only — before the stylesheet and
font links, so it runs before the browser paints.

1. `localStorage["sentezy-lang"]` set → honor it, stop. **A manual choice always beats the
   browser.**
2. Else `navigator.languages` first entry starts with `tr` → `location.replace("/tr" + path)`.
3. Else stay.

Notes:

- Never runs on `/tr/` pages — no redirect loop is possible.
- `location.replace`, not `location.href`, so the back button doesn't trap the visitor on a
  page that immediately redirects again.
- `navigator.languages` (the ordered list), not `navigator.language` (the single top value) —
  a visitor whose browser is English-first but Turkish-second is better served in English, and
  the ordered list expresses that correctly.
- The switcher writes `localStorage` on click, so the override survives future visits.

Accepted cost of client-side detection: a Turkish visitor makes an extra round trip to `/`
before landing on `/tr/`. Chosen over an edge function because it works identically in
`astro dev` and needs no Cloudflare-specific runtime.

## Language switcher

Nav only, in the utility row beside "Start free". Compact `EN · TR`, current locale marked
with `aria-current="true"`. Links to the counterpart URL of the *current page* — `/terms`
switches to `/tr/terms`, not to `/tr/`. Nothing in the footer.

## Internal links must be locale-aware

Every internal `href` in a shared component is currently absolute and English-rooted. On the
Turkish tree these would silently eject the visitor back into English:

- `Footer.astro` — `/kvkk`, `/privacy`, `/terms`
- `Nav.astro` — the logo's `href="/"`
- `soon.astro` — `← Back to home`
- `site.ts` — `START_URL = "/soon"`, behind every CTA on the page

All of them route through Astro's `getRelativeLocaleUrl(locale, path)`, so the Turkish tree
links within itself. In-page anchors (`#showcase`, `#how`, `#platform`, `#sectors`) are
unaffected — they stay as-is.

This is the highest-risk detail in the implementation: it produces no error, no warning and
no visual defect. The page looks perfect and quietly drops Turkish visitors into English one
click later. The build gate covers it — see below.

## SEO

- `<html lang>` follows the locale.
- `Base.astro` emits reciprocal `hreflang` tags on every page, plus `x-default` → English.
- Both trees are fully crawlable. Detection is client-side, so Googlebot indexes each page in
  its own language rather than being bounced.

## Build gate

`scripts/verify.mjs` currently reads only `dist/index.html`. It gets extended, not replaced:

- **Both trees checked.** English claims asserted against `dist/index.html`, Turkish against
  `dist/tr/index.html`.
- **Proof numbers in both.** `>126<`, `>24<`, `>20<`, `>14<` must appear in each tree.
- **Forbidden claims swept site-wide.** `FORBIDDEN_TEXT`, `FORBIDDEN_WORDS` and the
  `href="#"` check run across every emitted HTML file, not just the index. This closes a gap
  that exists today: a dead link on `/terms` currently ships unnoticed.
- **Note:** `FORBIDDEN_TEXT` already contains `"dijital ikiz"` — the Turkish for "digital
  twin", left from the previous bilingual build. It now has a real tree to guard again.
- **No locale leak.** Every internal `href` in `dist/tr/**.html` must start with `/tr/` or
  `#`. Anything pointing at a bare `/terms`, `/soon` or `/` fails the build. This is the
  automated form of the risk described above — the one failure mode that is otherwise
  invisible.
- **hreflang pairing.** Every page must carry both `hreflang` tags. A Turkish page orphaned
  from its English twin fails the build.
- **Periwinkle CSS check** is unchanged — the stylesheet is shared, so it runs once.

## Legal pages

Turkish versions of `terms`, `privacy` and `kvkk`.

> **These are legally-operative text.** Each Turkish legal page carries a header comment
> marking it as awaiting review by someone qualified before launch. This was raised during
> design and the full scope was confirmed; the marker exists so the state is visible in the
> source rather than remembered.

The KVKK notice is the natural case for Turkish — it is Türkiye's own statute (Law No. 6698).
Its current English text says the notice "can be provided in Turkish on request"; that
sentence is dropped from the Turkish version, which *is* the Turkish provision.

## Incidental fix

`src/scripts/reels.ts:77` carries a comment describing the removed `data-tr` mechanism:

> "Both hint labels ship in the markup with their own data-tr, so the class swap keeps working
> after a language switch and no string lives outside copy.ts."

That machinery is gone. The class-swap behaviour it describes is still correct and still
works under this design — the labels come from `copy.<locale>.ts` and the swap is CSS-driven
— so only the comment is wrong. It gets rewritten to describe what actually happens.

## Out of scope

- **`apps/web`** stays English. It was rewritten TR→EN on 2026-07-23; this ask was the
  landing page.
- **`START_URL`** still points at `/soon`, localized per tree.

## Known follow-up

Every Turkish CTA points at `/tr/soon` today. When the app opens, those CTAs switch to
`APP_URL/signup` — an **English** app. A Turkish visitor will cross a language seam at the
moment of signup. Nothing to fix now; recorded so it is a decision later rather than a
surprise.

## Success criteria

1. `pnpm --filter @sentezy/landing build` passes, including the extended verify gate.
2. `dist/tr/index.html` contains no English marketing copy; `dist/index.html` contains no
   Turkish.
3. Deleting any key from `copy.tr.ts` fails `astro check` — verified deliberately, not
   assumed.
4. A browser set to Turkish landing on `/` arrives at `/tr/`; one set to English stays.
5. Choosing EN on `/tr/` and reloading keeps you on English.
6. Both trees carry reciprocal `hreflang` tags.
7. From `/tr/`, clicking through the footer legal links and every CTA never leaves the
   Turkish tree — checked by walking the page, not by reading the source.
