# Landing Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `apps/landing` as a reels-first marketing page that shows real proof (Instagram embeds, real avatar stills, real app screenshots), removes every invented claim, and adopts the web app's aurora/monochrome design language.

**Architecture:** `index.astro` is decomposed into one component per page section, all copy moves to a single bilingual `copy.ts`, and the periwinkle palette is replaced with the web app's premium-monochrome tokens plus its `--hero` aurora and `--frame` dark-panel gradients. Avatar cutouts are exported from R2 once into committed PNGs so the Cloudflare Pages build stays fully static. Instagram's `embed.js` is lazy-injected on scroll.

**Tech Stack:** Astro 5.6.1, Tailwind v4 (via `@tailwindcss/vite`), vanilla TS in `<script>` islands, `@aws-sdk/client-s3` (export script only, runs from `apps/api`).

Spec: `docs/superpowers/specs/2026-07-22-landing-page-redesign-design.md`

## Global Constraints

- Node 24 is required for this repo's toolchain. Run `node -v` before starting; if it reports v20, run `nvm use 24` (see the project's dev gotchas).
- All commands run from the repo root `/Users/berkan/Projects/sentezy`.
- The landing build must remain **fully static** — no network calls, no R2 access, no workspace TS imports at build time. `packages/types` is NOT imported by the landing; values are transcribed.
- **Avatar images are never referenced by URL.** They live in `src/assets/avatars/` and are rendered through `astro:assets` `<Image>`, so Astro resizes them and emits WebP at the size actually used. Files placed in `public/` are served byte-for-byte with no optimization — the raw cutouts are 1024×1536 RGBA PNGs totalling 22 MB, which would be catastrophic above the fold.
- `packages/ui/theme.css` must NOT be modified. The landing overrides tokens locally in `:root`, exactly as `apps/web/src/app/globals.css` does.
- `apps/web` must NOT be modified.
- **Forbidden strings** — these must never appear in `apps/landing/src` or `apps/landing/dist` again: `147M`, `122M`, `175+`, `SOC 2`, `Northwind`, `Vertex`, `LUMEN`, `Kavis`, `Orbita`, `Meridian`, `Aster`, `Polar`, `digital twin`, `dijital ikiz`.
- **Only these four numeric claims are permitted**, exactly as worded: `12` presenters, `24` sectors, `20` caption styles, `14` transitions.
- Every user-visible string must exist in both `en` and `tr` in `src/data/copy.ts`.
- Every animation must be disabled or frozen under `@media (prefers-reduced-motion: reduce)`.
- No `<a href="#">` dead links may remain in the shipped page.
- Primary CTA label is `Start free` / `Ücretsiz başla`, pointing at `${APP_URL}/signup`.

## File Structure

**Created:**

| Path | Responsibility |
|---|---|
| `apps/api/scripts/export-avatar-stills.ts` | One-shot: download the 12 avatar cutouts from R2 into the landing's `src/assets/` |
| `apps/landing/src/assets/avatars/*.png` | 12 committed avatar cutout PNGs, optimized at build time by `astro:assets` |
| `apps/landing/public/app/*.png` | 3 committed app screenshots |
| `apps/landing/scripts/verify.mjs` | Greps `dist/` for forbidden claims and required strings |
| `apps/landing/src/data/site.ts` | Outbound URLs (`APP_URL`, `INSTAGRAM_URL`) |
| `apps/landing/src/data/copy.ts` | Every EN/TR string, one export per section |
| `apps/landing/src/data/reels.ts` | Instagram shortcodes |
| `apps/landing/src/data/stills.ts` | The 12 marquee tile definitions |
| `apps/landing/src/components/*.astro` | 13 section components (listed per task) |
| `apps/landing/src/scripts/*.ts` | 4 client scripts (`i18n`, `reveal`, `insta`, `captions`) |

**Modified:**

| Path | Change |
|---|---|
| `apps/landing/src/pages/index.astro` | Reduced from 276 lines to a component assembly |
| `apps/landing/src/styles/global.css` | Retheme + new section styles, placeholder styles removed |
| `apps/landing/src/layouts/Base.astro` | Add caption-demo fonts, update meta description |
| `apps/landing/package.json` | Add `verify` script |

**Deleted:** the `.ph` / `.ph-label` / `.beam-*` / `.marquee` / `.wordmark` / `.metric*` CSS blocks and their markup.

**Note on a spec deviation:** the spec placed the export script at `apps/landing/scripts/pull-avatar-stills.ts`. It lives at `apps/api/scripts/export-avatar-stills.ts` instead, because `apps/api` already has `@aws-sdk/client-s3`, `tsx`, `dotenv-cli` and the R2 env schema. Adding the AWS SDK to the landing package purely for a one-shot script would bloat it for no gain. Output path is unchanged.

---

### Task 1: Export the 12 avatar cutouts from R2

**Files:**
- Create: `apps/api/scripts/export-avatar-stills.ts`
- Create (generated, committed): `apps/landing/src/assets/avatars/{anna,amara,camila,arda,aisha,hana,alp,mariam,sumeyye,aaliyah,kevser,beyza}.png`
- Modify: `apps/api/package.json` (add script entry)

**Interfaces:**
- Consumes: nothing.
- Produces: 12 PNG files at `apps/landing/src/assets/avatars/<slug>.png`, where `<slug>` is the avatar's `slug` field from `apps/api/src/data/avatars.json`. Tasks 4 and 8 resolve them with `import.meta.glob("../assets/avatars/*.png", { eager: true })` and render them through `astro:assets`.

**Why `src/assets/` and not `public/`:** Astro only optimizes images it can see through the module graph. Anything in `public/` is copied to the output verbatim — these cutouts are 1024×1536 RGBA PNGs averaging 1.8 MB, and they render at 270×480. Under `src/assets/` the `<Image>` component downscales them and emits WebP, taking the delivered payload from ~22 MB to well under 1 MB.

- [ ] **Step 1: Write the export script**

Create `apps/api/scripts/export-avatar-stills.ts`:

```ts
/**
 * One-shot: export the rendered avatar cutouts from R2 into the landing page's
 * src/assets folder, so the Astro build stays fully static (Cloudflare Pages does
 * not get R2 credentials). Re-run this whenever new avatars are rendered.
 *
 *   pnpm --filter @sentezy/api export:stills
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { env } from "../src/env";
import { r2 } from "../src/lib/r2";
import catalog from "../src/data/avatars.json" with { type: "json" };

type CatalogAvatar = { slug: string; name: string; sector: string; displayImageId: string; imageId: string };

// src/assets, not public/ — Astro only optimizes images reachable through the module graph.
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, "../../landing/src/assets/avatars");

async function main(): Promise<void> {
  const avatars = (catalog.avatars as CatalogAvatar[]).filter((a) => a.displayImageId);
  if (avatars.length === 0) throw new Error("no avatars with a displayImageId — nothing to export");

  await mkdir(OUT_DIR, { recursive: true });

  for (const avatar of avatars) {
    const res = await r2.send(new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: avatar.displayImageId }));
    if (!res.Body) throw new Error(`empty body for ${avatar.displayImageId}`);
    const bytes = await res.Body.transformToByteArray();
    const out = resolve(OUT_DIR, `${avatar.slug}.png`);
    await writeFile(out, bytes);
    console.log(`${avatar.slug.padEnd(10)} ${(bytes.length / 1024).toFixed(0).padStart(5)} KB  ${out}`);
  }

  console.log(`\nexported ${avatars.length} avatar cutouts`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Add the package script**

In `apps/api/package.json`, add to `"scripts"` after `"start"`:

```json
    "export:stills": "dotenv -e ../../.env -- tsx scripts/export-avatar-stills.ts",
```

- [ ] **Step 3: Run it and verify 12 files land**

Run:
```bash
pnpm --filter @sentezy/api export:stills
ls -1 apps/landing/src/assets/avatars/*.png | wc -l
```
Expected: the script prints 12 lines then `exported 12 avatar cutouts`, and `ls` reports `12`.

If the script fails with a zod env error, the root `.env` is missing R2 credentials — stop and report, do not fabricate the files.

- [ ] **Step 4: Verify the images are real cutouts, not green screens**

Run:
```bash
file apps/landing/src/assets/avatars/kevser.png
du -sh apps/landing/src/assets/avatars
```
Expected: `PNG image data, ... 8-bit/color RGBA` (the `-cut` variants are background-removed, so RGBA with alpha). The source directory is ~22 MB; that is fine because these are build inputs, not shipped bytes — Tasks 4 and 8 render them through `astro:assets`, and Task 10 Step 10 asserts the delivered payload.

- [ ] **Step 5: Commit**

```bash
git add apps/api/scripts/export-avatar-stills.ts apps/api/package.json apps/landing/src/assets/avatars
git commit -m "feat(landing): export rendered avatar cutouts from R2 into src/assets"
```

---

### Task 2: Retheme to the web app's design tokens

**Files:**
- Modify: `apps/landing/src/styles/global.css:1-16` (the `:root` block and `body`)
- Create: `apps/landing/scripts/verify.mjs`
- Modify: `apps/landing/package.json`

**Interfaces:**
- Consumes: nothing.
- Produces: CSS custom properties `--frame`, `--hero`, `--wash`, `--beam` and the retheme of `--color-*`. Every later task styles against these. Also produces `pnpm --filter @sentezy/landing verify`, which every later task re-runs.

- [ ] **Step 1: Write the failing verification script**

Create `apps/landing/scripts/verify.mjs`:

```js
/**
 * Post-build assertions for the landing page. Not a unit-test runner — it checks the
 * things that actually matter for a marketing page: that no invented claim survived,
 * that the real claims are present, that no dead links shipped, and that no periwinkle
 * from the pre-monochrome palette leaked through.
 *
 *   pnpm --filter @sentezy/landing verify   (runs after `build`)
 */
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(HERE, "../dist");

// Invented claims and unshipped features that must never come back.
const FORBIDDEN_TEXT = [
  "147M", "122M", "175+", "SOC 2",
  "digital twin", "dijital ikiz",
  'href="#"',
];

// The fake customer-logo marquee. Matched on word boundaries, not as substrings:
// "Aster" and "Polar" live inside ordinary words (disaster, polarizing, popularity),
// and a bare includes() would fail the build on legitimate copy with a message that
// reads as though the fake logos had reappeared.
const FORBIDDEN_WORDS = [
  "Northwind", "Vertex", "LUMEN", "Kavis", "Orbita", "Meridian", "Aster", "Polar",
];

// The old periwinkle accents, hardcoded as color literals in the stylesheet. A token
// rename cannot reach these, so the monochrome retheme cannot be verified from :root
// alone — the built CSS has to be checked directly. Both spellings are listed because
// Astro's minifier folds `rgba(201,169,233,.22)` into `#c9a9e938`. In the production
// pipeline only the hex needles ever fire; the decimal ones are defensive, for a
// dev-mode or unminified artifact reaching dist/.
//   #c9a9e9 / 201,169,233 — old --color-aurora
//   #7c86e8 / 124,134,232 — old --color-signal
const FORBIDDEN_CSS = ["c9a9e9", "201,169,233", "7c86e8", "124,134,232"];

// Claims that are true and must be present. Verified against source at plan time:
//   12 avatars with a displayImageId  → apps/api/src/data/avatars.json
//   24 distinct sectors               → same file
//   20 caption styles                 → CAPTION_STYLE_META, packages/types/src/index.ts
//   14 b-roll effects                 → BROLL_EFFECT_META, packages/types/src/index.ts
const REQUIRED = [];

/** Built CSS, concatenated, whitespace-stripped and lowercased, so `rgba(201, 169, 233, …)`
 *  and the minifier's `#C9A9E938` both match the same needle.
 *
 *  Custom-property *declarations* are stripped first. `packages/ui/theme.css` is shared with
 *  the web app and always defines the old periwinkle (`--color-signal: #7c86e8`,
 *  `--color-aurora: #c9a9e9`); the landing overrides those names in its own `:root`, so the
 *  declarations are inert. Only a color that survives into an actual property value — a
 *  background, a gradient, a shadow — is a real leak. Without this the gate could never pass,
 *  and Task 10 chains it into `build`.
 *
 *  Throws rather than passing vacuously if no stylesheet was emitted — a silently empty
 *  haystack would make every CSS assertion below succeed for the wrong reason. */
async function builtCss() {
  const dir = join(DIST, "_astro");
  const names = (await readdir(dir).catch(() => [])).filter((n) => n.endsWith(".css"));
  if (names.length === 0) throw new Error(`no stylesheet found in ${dir} — cannot verify the palette`);
  const files = await Promise.all(names.map((n) => readFile(join(dir, n), "utf8")));
  // Only the two shared-theme tokens are stripped, not every custom property: a future rule
  // that hides a periwinkle behind its own `--some-tint:` must still be caught.
  return files
    .join("\n")
    .replace(/\s+/g, "")
    .toLowerCase()
    .replace(/--color-(signal|aurora):[^;}]*/g, "");
}

async function main() {
  const html = await readFile(join(DIST, "index.html"), "utf8");
  const css = await builtCss();

  const failures = [
    ...FORBIDDEN_TEXT.filter((n) => html.includes(n)).map((n) => `forbidden claim in HTML: ${JSON.stringify(n)}`),
    ...FORBIDDEN_WORDS.filter((w) => new RegExp(`\\b${w}\\b`).test(html)).map((w) => `fake customer logo in HTML: ${w}`),
    ...FORBIDDEN_CSS.filter((n) => css.includes(n)).map((n) => `periwinkle literal in built CSS: ${n} — a hardcoded color the token retheme could not reach`),
    ...REQUIRED.filter((n) => !html.includes(n)).map((n) => `required claim missing from HTML: ${JSON.stringify(n)}`),
  ];

  if (failures.length) {
    for (const f of failures) console.error(f);
    console.error(`\nverify FAILED — ${failures.length} problem(s)`);
    process.exit(1);
  }

  const checks = FORBIDDEN_TEXT.length + FORBIDDEN_WORDS.length + FORBIDDEN_CSS.length + REQUIRED.length;
  console.log(`verify OK — ${checks} checks passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

In `apps/landing/package.json`, add to `"scripts"`:

```json
    "verify": "node scripts/verify.mjs",
```

- [ ] **Step 2: Run it to confirm it FAILS against the current page**

Run:
```bash
pnpm --filter @sentezy/landing build && pnpm --filter @sentezy/landing verify
```
Expected: FAIL. It should report forbidden strings including `Northwind`, `Vertex`, `LUMEN`, `Kavis`, `Orbita`, `Meridian`, `Aster`, `Polar`, `SOC 2` and `href="#"`. (`147M`/`122M`/`175+` will NOT appear — those render via a JS count-up and the `data-count` attributes hold `147`/`122`/`175`. That is expected; they are removed in Task 5 regardless.)

This failure is the baseline. Do not fix it in this task.

- [ ] **Step 3: Retheme the tokens**

Replace `apps/landing/src/styles/global.css` lines 1-16 (from `@import "tailwindcss";` through the closing `}` of the `body` rule) with:

```css
@import "tailwindcss";
@import "@sentezy/ui/theme.css";

/* Premium monochrome — lifted from apps/web/src/app/globals.css so the landing and the
   product read as one company. Token NAMES are unchanged, so every existing utility and
   rule below recolors automatically. packages/ui/theme.css is deliberately untouched. */
:root {
  --color-paper: #ffffff;
  --color-mist: #f4f4f5;
  --color-ink: #0a0a0b;
  --color-slate: #52525b;
  --color-muted: #a1a1aa;
  --color-hairline: #e4e4e7;
  --color-signal: #18181b;
  --beam: linear-gradient(135deg, #3f3f46, #18181b);
  --wash: rgba(24, 24, 27, 0.06);

  /* Aurora hero — cool blue/teal easing into warm amber/pink, fading into white. */
  --hero:
    radial-gradient(75% 100% at 2% -10%, rgba(46, 116, 196, 0.34) 0%, rgba(46, 116, 196, 0) 52%),
    radial-gradient(55% 85% at 26% -12%, rgba(40, 196, 192, 0.20) 0%, rgba(40, 196, 192, 0) 48%),
    radial-gradient(85% 100% at 100% -12%, rgba(232, 146, 96, 0.34) 0%, rgba(232, 146, 96, 0) 54%),
    radial-gradient(48% 78% at 82% -12%, rgba(214, 112, 150, 0.22) 0%, rgba(214, 112, 150, 0) 50%),
    #ffffff;

  /* Soft-dark inset panel carrying the same aurora on near-black. Used for the
     Instagram showcase and the final CTA, so the reels sit on black. */
  --frame:
    radial-gradient(95% 65% at 0% 0%, rgba(52, 104, 184, 0.70) 0%, rgba(52, 104, 184, 0) 58%),
    radial-gradient(80% 70% at 12% 108%, rgba(96, 64, 168, 0.50) 0%, rgba(96, 64, 168, 0) 55%),
    radial-gradient(85% 75% at 100% 18%, rgba(170, 86, 96, 0.55) 0%, rgba(170, 86, 96, 0) 55%),
    linear-gradient(160deg, #16161c 0%, #111116 55%, #0d0d11 100%);
}

body {
  background: var(--color-paper);
  color: var(--color-slate);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}
```

- [ ] **Step 4: Add the shared dark-band primitive**

Append to the end of `apps/landing/src/styles/global.css`:

```css
/* ── dark band ──────────────────────────────────────────────────────────── */
/* A full-bleed soft-dark section echoing the app's --frame sidebar. Text inside
   flips to light; .btn-ghost inverts so it stays legible. */
.band { background: var(--frame); color: rgba(255,255,255,0.72); position: relative; }
.band .h2, .band .h3, .band .eyebrow { color: #fff; }
.band .lead, .band p { color: rgba(255,255,255,0.72); }
.band .btn-ghost { color: #fff; border-color: rgba(255,255,255,0.24); }
.band .btn-ghost:hover { background: rgba(255,255,255,0.10); color: #fff; }
.band .btn-primary { background: #fff; color: var(--color-ink); box-shadow: 0 8px 24px rgba(0,0,0,0.35); }
.band .btn-primary:hover { color: var(--color-ink); }
.band a { color: #fff; }
```

- [ ] **Step 5: Build and eyeball the retheme**

Run:
```bash
pnpm --filter @sentezy/landing build
```
Expected: build succeeds. The `verify` step still fails — that is correct, the fake content is removed in later tasks.

Run `pnpm --filter @sentezy/landing dev` and open `http://localhost:4321`. Expected: the page is now grayscale — no periwinkle. Buttons are black, the `.beam-flow` bar is graphite, links are near-black.

- [ ] **Step 6: Commit**

```bash
git add apps/landing/src/styles/global.css apps/landing/scripts/verify.mjs apps/landing/package.json
git commit -m "feat(landing): adopt the web app's monochrome tokens, aurora and frame gradients"
```

---

### Task 3: Extract site data and copy, decompose the nav and footer

This task is a pure refactor with one behavioural change (dead links removed). The page must look identical afterwards apart from the pruned nav/footer links.

**Files:**
- Create: `apps/landing/src/data/site.ts`
- Create: `apps/landing/src/data/copy.ts`
- Create: `apps/landing/src/components/Nav.astro`
- Create: `apps/landing/src/components/Footer.astro`
- Create: `apps/landing/src/scripts/i18n.ts`
- Create: `apps/landing/src/scripts/reveal.ts`
- Modify: `apps/landing/src/pages/index.astro`

**Interfaces:**
- Consumes: the `--frame` / `.band` primitive from Task 2.
- Produces:
  - `site.ts` exports `APP_URL: string`, `SIGNUP_URL: string`, `LOGIN_URL: string`, `INSTAGRAM_URL: string`.
  - `copy.ts` exports `type Copy = { en: string; tr: string }` and one `const` per section. Later tasks add their own exports to this file and must reuse the `Copy` type.
  - `<Nav />` and `<Footer />` take no props.
  - `src/scripts/i18n.ts` and `src/scripts/reveal.ts` are side-effecting modules imported once from `index.astro`.

- [ ] **Step 1: Create the site data**

Create `apps/landing/src/data/site.ts`:

```ts
/** Outbound destinations. The web app host is not fixed yet — set PUBLIC_APP_URL in the
 *  Cloudflare Pages build environment when it is, and nothing else needs to change. */
export const APP_URL: string = import.meta.env.PUBLIC_APP_URL ?? "http://localhost:3000";

export const SIGNUP_URL = `${APP_URL}/signup`;
export const LOGIN_URL = `${APP_URL}/login`;
export const INSTAGRAM_URL = "https://www.instagram.com/sentezy.ai/";
```

- [ ] **Step 2: Create the copy module with the nav and footer strings**

Create `apps/landing/src/data/copy.ts`:

```ts
/** Every user-visible string, in both languages. Components render the EN text as the
 *  element's content and the TR text as `data-tr`; src/scripts/i18n.ts swaps them at
 *  runtime. Keeping all copy here means a translation gap is a type error, not a
 *  half-translated page. */
export type Copy = { en: string; tr: string };

export const nav = {
  platform: { en: "Platform", tr: "Platform" },
  showcase: { en: "Showcase", tr: "Örnekler" },
  how: { en: "How it works", tr: "Nasıl çalışır" },
  login: { en: "Log in", tr: "Giriş yap" },
  cta: { en: "Start free", tr: "Ücretsiz başla" },
} satisfies Record<string, Copy>;

export const footer = {
  tagline: {
    en: "Reels with an AI presenter. No filming, no editing.",
    tr: "Yapay zeka sunuculu reels. Çekim yok, kurgu yok.",
  },
  productHead: { en: "Product", tr: "Ürün" },
  presenters: { en: "AI presenters", tr: "Yapay zeka sunucular" },
  captions: { en: "Captions", tr: "Altyazılar" },
  brandKit: { en: "Brand kit", tr: "Marka kiti" },
  solutionsHead: { en: "Solutions", tr: "Çözümler" },
  legalHead: { en: "Legal", tr: "Yasal" },
  privacy: { en: "Privacy", tr: "Gizlilik" },
  terms: { en: "Terms", tr: "Şartlar" },
  madeFor: { en: "Made for teams worldwide", tr: "Türkiye'de tasarlandı" },
  /** Identical in both languages, but it still lives here — a string that skips this module
   *  is a string nobody can find when the copy changes. */
  instagramHead: { en: "Instagram", tr: "Instagram" },
} satisfies Record<string, Copy>;

export const sectorNames = {
  travel: { en: "Travel", tr: "Seyahat" },
  beauty: { en: "Beauty", tr: "Güzellik" },
  realestate: { en: "Real Estate", tr: "Emlak" },
  gym: { en: "Gym", tr: "Spor Salonu" },
} satisfies Record<string, Copy>;
```

- [ ] **Step 3: Extract the client scripts**

Create `apps/landing/src/scripts/i18n.ts` — this is the existing logic from `index.astro:210-226`, moved verbatim except that it is now a module:

```ts
/** EN is authored in the markup; TR lives in data-tr. On first run we snapshot the EN
 *  text into data-en, then the switch just swaps between the two attributes. */
const q = (s: string) => Array.from(document.querySelectorAll<HTMLElement>(s));

q("[data-tr]").forEach((el) => {
  if (!el.hasAttribute("data-en")) el.setAttribute("data-en", el.textContent ?? "");
});

const swBtns = q("[data-switch]");

const setLang = (l: string) => {
  q("[data-tr]").forEach((el) => {
    el.textContent = l === "tr" ? el.getAttribute("data-tr") : el.getAttribute("data-en");
  });
  swBtns.forEach((b) => b.classList.toggle("on", b.getAttribute("data-switch") === l));
  document.documentElement.lang = l;
};

swBtns.forEach((b) => b.addEventListener("click", () => setLang(b.getAttribute("data-switch") ?? "en")));
```

Create `apps/landing/src/scripts/reveal.ts` — the existing reveal logic from `index.astro:228-275`, with the count-up removed (the metrics it animated are deleted in Task 5) and the FAQ accordion kept:

```ts
/** Scroll reveals, sticky-nav shadow, and the FAQ accordion. Under reduced motion every
 *  reveal is applied immediately instead of being observed. */
const q = (s: string) => Array.from(document.querySelectorAll<HTMLElement>(s));
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const nav = document.querySelector(".nav");
const onScroll = () => nav?.classList.toggle("scrolled", window.scrollY > 20);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

if (reduce) {
  q(".reveal,.stagger").forEach((el) => el.classList.add("in"));
} else {
  const io = new IntersectionObserver(
    (es) => {
      es.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
  );
  q(".reveal,.stagger").forEach((el) => io.observe(el));
}

q(".faq-q").forEach((btn) => {
  btn.addEventListener("click", () => btn.closest(".faq-item")?.classList.toggle("open"));
});
```

- [ ] **Step 4: Create Nav.astro**

Create `apps/landing/src/components/Nav.astro`. Note the dead `Pricing` and `Resources` links from the old nav are gone; `Platform`, `Showcase` and `How it works` all point at real in-page anchors created in later tasks.

```astro
---
import { nav } from "../data/copy";
import { LOGIN_URL, SIGNUP_URL } from "../data/site";
---

<header class="nav">
  <div class="wrap nav-in">
    <a class="logo" href="/"><img class="logo-mark" src="/sentezy-logo.png" alt="Sentezy" />Sentezy</a>
    <nav class="nav-menu">
      <a href="#showcase" data-tr={nav.showcase.tr}>{nav.showcase.en}</a>
      <a href="#how" data-tr={nav.how.tr}>{nav.how.en}</a>
      <a href="#platform" data-tr={nav.platform.tr}>{nav.platform.en}</a>
    </nav>
    <div class="nav-util">
      <div class="switch">
        <button class="sw-btn" data-switch="tr">TR</button>
        <button class="sw-btn on" data-switch="en">EN</button>
      </div>
      <a href={LOGIN_URL} class="nav-login" data-tr={nav.login.tr}>{nav.login.en}</a>
      <a href={SIGNUP_URL} class="btn btn-primary"><span data-tr={nav.cta.tr}>{nav.cta.en}</span></a>
    </div>
  </div>
</header>
```

- [ ] **Step 5: Create Footer.astro**

Create `apps/landing/src/components/Footer.astro`. The old Resources column (Blog / Guides / Support), the Pricing link, and the Translation / AI Studio product links are all removed — none had a destination.

```astro
---
import { footer, nav, sectorNames } from "../data/copy";
import { INSTAGRAM_URL, SIGNUP_URL } from "../data/site";
---

<footer class="footer">
  <div class="wrap">
    <div class="foot-grid">
      <div class="foot-brand">
        <a class="logo" href="/"><img class="logo-mark" src="/sentezy-logo.png" alt="Sentezy" />Sentezy</a>
        <p data-tr={footer.tagline.tr}>{footer.tagline.en}</p>
        <div class="switch">
          <button class="sw-btn" data-switch="tr">TR</button>
          <button class="sw-btn on" data-switch="en">EN</button>
        </div>
      </div>
      <div class="foot-col">
        <h4 data-tr={footer.productHead.tr}>{footer.productHead.en}</h4>
        <a href="#platform" data-tr={footer.presenters.tr}>{footer.presenters.en}</a>
        <a href="#captions" data-tr={footer.captions.tr}>{footer.captions.en}</a>
        <a href="#platform" data-tr={footer.brandKit.tr}>{footer.brandKit.en}</a>
      </div>
      <div class="foot-col">
        <h4 data-tr={footer.solutionsHead.tr}>{footer.solutionsHead.en}</h4>
        <a href="#sectors" data-tr={sectorNames.travel.tr}>{sectorNames.travel.en}</a>
        <a href="#sectors" data-tr={sectorNames.beauty.tr}>{sectorNames.beauty.en}</a>
        <a href="#sectors" data-tr={sectorNames.realestate.tr}>{sectorNames.realestate.en}</a>
        <a href="#sectors" data-tr={sectorNames.gym.tr}>{sectorNames.gym.en}</a>
      </div>
      <div class="foot-col">
        <h4 data-tr={footer.legalHead.tr}>{footer.legalHead.en}</h4>
        <a href="/kvkk">KVKK</a>
        <a href="/privacy" data-tr={footer.privacy.tr}>{footer.privacy.en}</a>
        <a href="/terms" data-tr={footer.terms.tr}>{footer.terms.en}</a>
      </div>
      <div class="foot-col">
        <h4 data-tr={footer.instagramHead.tr}>{footer.instagramHead.en}</h4>
        <a href={INSTAGRAM_URL} target="_blank" rel="noopener">@sentezy.ai</a>
        <a href={SIGNUP_URL} data-tr={nav.cta.tr}>{nav.cta.en}</a>
      </div>
    </div>
    <div class="foot-bottom">
      <span>© 2026 Sentezy</span>
      <span data-tr={footer.madeFor.tr}>{footer.madeFor.en}</span>
    </div>
  </div>
</footer>
```

- [ ] **Step 6: Rewire index.astro**

In `apps/landing/src/pages/index.astro`, replace the frontmatter with:

```astro
---
import Base from "../layouts/Base.astro";
import Nav from "../components/Nav.astro";
import Footer from "../components/Footer.astro";
---
```

Delete the old `<header class="nav">…</header>` block (lines 6-24) and put `<Nav />` in its place. Delete the old `<footer class="footer">…</footer>` block (lines 189-207) and put `<Footer />` in its place. Replace the entire trailing `<script>…</script>` block (lines 210-276) with:

```astro
<script>
  import "../scripts/i18n";
  import "../scripts/reveal";
</script>
```

Leave every other section untouched for now — they are replaced in Tasks 4-9.

- [ ] **Step 7: Typecheck and build**

Run:
```bash
pnpm --filter @sentezy/landing typecheck && pnpm --filter @sentezy/landing build
```
Expected: both succeed, zero errors.

- [ ] **Step 8: Check the nav and footer in the browser**

Run `pnpm --filter @sentezy/landing dev`, open `http://localhost:4321`.

Expected:
- The nav shows Showcase / How it works / Platform, and `Start free` points at `http://localhost:3000/signup` (hover and read the status bar).
- Clicking `TR` still swaps every string on the page, including the new nav and footer.
- The FAQ accordion still opens and closes.
- The footer has no Blog / Guides / Support column.

- [ ] **Step 9: Commit**

```bash
git add apps/landing/src/data apps/landing/src/scripts apps/landing/src/components apps/landing/src/pages/index.astro
git commit -m "refactor(landing): extract copy, site data, nav and footer; drop dead links"
```

---

### Task 4: Hero + reel-still marquee

**Files:**
- Create: `apps/landing/src/data/stills.ts`
- Create: `apps/landing/src/components/ReelMarquee.astro`
- Create: `apps/landing/src/components/Hero.astro`
- Modify: `apps/landing/src/data/copy.ts` (append `hero`)
- Modify: `apps/landing/src/styles/global.css` (add marquee styles, delete `.beam-*` and `.ph*`)
- Modify: `apps/landing/src/pages/index.astro`

**Interfaces:**
- Consumes: `/avatars/<slug>.png` from Task 1; `--hero` from Task 2; `Copy` from Task 3.
- Produces: `<Hero />` (no props), which renders `<ReelMarquee />` internally. `stills.ts` exports `type Still` and `const stills: Still[]`.

- [ ] **Step 1: Define the marquee tiles**

Create `apps/landing/src/data/stills.ts`. These are the exact 12 avatars that have a rendered cutout, with their real sector from `apps/api/src/data/avatars.json` — showing dental, pharmacy and optics alongside the four headline verticals is the point: it reads as breadth.

```ts
/** The 12 marquee tiles. Each is an honest composite of what the product outputs: a real
 *  rendered avatar cutout over a sector-tinted 9:16 backdrop, with a real caption style
 *  drawn in CSS. `slug` maps to /avatars/<slug>.png, exported by
 *  apps/api/scripts/export-avatar-stills.ts. `tint` indexes .tile-<tint> in global.css. */
export type Still = {
  slug: string;
  tint: "cool" | "warm" | "rose" | "teal" | "violet" | "amber";
  sector: { en: string; tr: string };
  caption: { en: string; tr: string };
  /** Caption treatment. Mirrors real CAPTION_STYLE_META ids. */
  style: "hormozi" | "tiktok" | "highlight" | "boxed" | "glow" | "clean";
};

export const stills: Still[] = [
  { slug: "kevser",   tint: "rose",   sector: { en: "E-commerce",  tr: "E-ticaret" },   caption: { en: "SOLD OUT TWICE", tr: "İKİ KEZ TÜKENDİ" }, style: "hormozi" },
  { slug: "anna",     tint: "cool",   sector: { en: "Real Estate", tr: "Emlak" },       caption: { en: "3+1 SEA VIEW",   tr: "3+1 DENİZ MANZARA" }, style: "boxed" },
  { slug: "aaliyah",  tint: "violet", sector: { en: "Influencer",  tr: "Influencer" },  caption: { en: "LINK IN BIO",    tr: "LİNK BIO'DA" },      style: "glow" },
  { slug: "mariam",   tint: "teal",   sector: { en: "Dental",      tr: "Diş" },         caption: { en: "SAME DAY SMILE", tr: "AYNI GÜN GÜLÜŞ" },   style: "highlight" },
  { slug: "beyza",    tint: "warm",   sector: { en: "E-commerce",  tr: "E-ticaret" },   caption: { en: "NEW DROP",       tr: "YENİ SEZON" },       style: "tiktok" },
  { slug: "hana",     tint: "cool",   sector: { en: "Finance",     tr: "Finans" },      caption: { en: "0% FOR 12 MO",   tr: "12 AY 0 FAİZ" },     style: "boxed" },
  { slug: "sumeyye",  tint: "teal",   sector: { en: "Health",      tr: "Sağlık" },      caption: { en: "BOOK IN 30 SEC", tr: "30 SANİYEDE RANDEVU" }, style: "highlight" },
  { slug: "camila",   tint: "amber",  sector: { en: "Automotive",  tr: "Otomotiv" },    caption: { en: "TEST DRIVE IT",  tr: "TEST SÜRÜŞÜ" },      style: "hormozi" },
  { slug: "arda",     tint: "teal",   sector: { en: "Pharmacy",    tr: "Eczane" },      caption: { en: "OPEN 24/7",      tr: "7/24 AÇIK" },        style: "clean" },
  { slug: "amara",    tint: "violet", sector: { en: "Education",   tr: "Eğitim" },      caption: { en: "ENROLL TODAY",   tr: "BUGÜN KAYIT OL" },   style: "tiktok" },
  { slug: "alp",      tint: "cool",   sector: { en: "Optics",      tr: "Optik" },       caption: { en: "2ND PAIR FREE",  tr: "2. GÖZLÜK BEDAVA" }, style: "glow" },
  { slug: "aisha",    tint: "warm",   sector: { en: "Automotive",  tr: "Otomotiv" },    caption: { en: "0 KM, 0 STRESS", tr: "0 KM, 0 STRES" },    style: "boxed" },
];

/** Two counter-scrolling columns. Split rather than interleaved so each column has a
 *  visible mix of tints. */
export const columnA = stills.filter((_, i) => i % 2 === 0);
export const columnB = stills.filter((_, i) => i % 2 === 1);
```

- [ ] **Step 2: Add the marquee styles**

Append to `apps/landing/src/styles/global.css`:

```css
/* ── reel marquee ───────────────────────────────────────────────────────── */
.reels { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; height: 620px; overflow: hidden;
  -webkit-mask-image: linear-gradient(180deg, transparent, #000 14%, #000 86%, transparent);
  mask-image: linear-gradient(180deg, transparent, #000 14%, #000 86%, transparent); }
/* The column's items are duplicated so translateY(-50%) can loop. Spacing MUST come from a
   per-tile margin, not `gap`: gap only renders BETWEEN children, so a doubled list of n tiles
   gets 2n-1 gaps, not 2n. Half of that height falls half a gap short of one full set, and the
   loop snaps by gap/2 (9px) every cycle. A bottom margin belongs to each tile, so the track is
   exactly 2x one set and the seam is invisible. */
.reel-col { display: flex; flex-direction: column; will-change: transform; }
.reel-col.up { animation: reel-up 38s linear infinite; }
.reel-col.down { animation: reel-down 38s linear infinite; }
.reels:hover .reel-col { animation-play-state: paused; }
@keyframes reel-up { from { transform: translateY(0); } to { transform: translateY(-50%); } }
@keyframes reel-down { from { transform: translateY(-50%); } to { transform: translateY(0); } }

.tile { position: relative; aspect-ratio: 9/16; border-radius: 18px; overflow: hidden; flex: none;
  margin-bottom: 18px;
  border: 1px solid rgba(255,255,255,0.5); box-shadow: 0 18px 44px rgba(10,10,12,0.16); }
.tile-cool   { background: linear-gradient(165deg, #2e74c4, #14304f); }
.tile-warm   { background: linear-gradient(165deg, #e89260, #6d3a1c); }
.tile-rose   { background: linear-gradient(165deg, #d67096, #58243a); }
.tile-teal   { background: linear-gradient(165deg, #28c4c0, #0e4746); }
.tile-violet { background: linear-gradient(165deg, #7f5ad0, #33215c); }
.tile-amber  { background: linear-gradient(165deg, #d8a13c, #5c4110); }
.tile img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
  object-position: top center; }
.tile::after { content: ""; position: absolute; inset: 0;
  background: linear-gradient(180deg, rgba(0,0,0,0.18) 0%, transparent 34%, rgba(0,0,0,0.45) 100%); }
.tile-sector { position: absolute; top: 10px; left: 10px; z-index: 2; font-family: var(--font-mono);
  font-size: 10px; letter-spacing: 0.04em; text-transform: uppercase; color: #fff;
  background: rgba(0,0,0,0.42); backdrop-filter: blur(6px); padding: 4px 8px; border-radius: 999px; }
.tile-cap { position: absolute; left: 10px; right: 10px; bottom: 14px; z-index: 2; text-align: center;
  font-family: var(--font-display); font-weight: 700; font-size: 15px; line-height: 1.15;
  text-transform: uppercase; color: #fff; }
/* Caption treatments — CSS stand-ins for the real burned-in styles. */
.cap-hormozi   { -webkit-text-stroke: 2px #000; paint-order: stroke fill; color: #ffe14d; font-size: 17px; }
.cap-tiktok    { text-shadow: 0 2px 0 #000, 0 0 12px rgba(0,0,0,0.6); }
.cap-highlight { display: inline-block; background: #ffe14d; color: #0a0a0b; padding: 3px 7px; border-radius: 5px; }
.cap-boxed     { display: inline-block; background: rgba(0,0,0,0.78); padding: 5px 9px; border-radius: 7px; }
.cap-glow      { color: #7de3ff; text-shadow: 0 0 10px #29b6ff, 0 0 22px rgba(41,182,255,0.6); }
.cap-clean     { font-weight: 600; text-transform: none; text-shadow: 0 1px 6px rgba(0,0,0,0.7); }

@media (max-width: 900px) { .reels { height: 420px; } }
@media (prefers-reduced-motion: reduce) { .reel-col { animation: none; } }
```

Then **delete** these now-unused rules from the same file: `.beam-stage`, `.beam-glow`, `.beam-inputs`, `.frag`, `.frag-ic`, `.beam-track`, `.beam-flow`, `@keyframes flow`, `.beam-avatar`, `.avatar-caption`, `.rec-dot`, `@keyframes pulse`, `.no-beam .beam-flow` (currently lines 69-82 and 147), and remove `.beam-flow, .rec-dot,` from the reduced-motion rule at the bottom, leaving `.marquee-track { animation: none; }`.

- [ ] **Step 3: Create ReelMarquee.astro**

Create `apps/landing/src/components/ReelMarquee.astro`. Each column's tile list is duplicated so the `translateY(-50%)` loop is seamless.

```astro
---
import { Image } from "astro:assets";
import { columnA, columnB, type Still } from "../data/stills";

/* The cutouts live in src/assets so astro:assets can downscale them and emit WebP — the
   originals are 1024x1536 PNGs and these render at 270px wide. A glob is needed because the
   slugs come from data; Astro resolves it at build time, so this stays fully static. */
const avatarImages = import.meta.glob<{ default: ImageMetadata }>("../assets/avatars/*.png", {
  eager: true,
});
const avatarOf = (slug: string): ImageMetadata => {
  const mod = avatarImages[`../assets/avatars/${slug}.png`];
  if (!mod) throw new Error(`no avatar image for slug "${slug}" — run pnpm --filter @sentezy/api export:stills`);
  return mod.default;
};

const cols: { dir: "up" | "down"; items: Still[] }[] = [
  { dir: "up", items: columnA },
  { dir: "down", items: columnB },
];
---

<div class="reels" aria-hidden="true">
  {cols.map((col) => (
    <div class={`reel-col ${col.dir}`}>
      {[...col.items, ...col.items].map((s) => (
        <div class={`tile tile-${s.tint}`}>
          <Image src={avatarOf(s.slug)} alt="" widths={[270, 540]} sizes="270px" loading="lazy" decoding="async" />
          <span class="tile-sector" data-tr={s.sector.tr}>{s.sector.en}</span>
          <div class="tile-cap"><span class={`cap-${s.style}`} data-tr={s.caption.tr}>{s.caption.en}</span></div>
        </div>
      ))}
    </div>
  ))}
</div>
```

`ImageMetadata` is a global type provided by Astro's client types — no import needed. If `astro check` cannot find it, add `/// <reference types="astro/client" />` to `apps/landing/src/env.d.ts`.

- [ ] **Step 4: Add the hero copy**

Append to `apps/landing/src/data/copy.ts`:

```ts
export const hero = {
  eyebrow: { en: "AI PRESENTER REELS", tr: "YAPAY ZEKA SUNUCULU REELS" },
  title: { en: "Reels that sell — without filming a thing.", tr: "Satan reels'ler — hiç çekim yapmadan." },
  lead: {
    en: "Paste a product link or a script. Sentezy picks an AI presenter, writes the copy, burns in viral captions, and hands back a finished 9:16 reel. Built for travel, beauty, real estate and gym brands.",
    tr: "Bir ürün linki ya da metin yapıştırın. Sentezy yapay zeka sunucuyu seçer, metni yazar, viral altyazıları basar ve size bitmiş bir 9:16 reels verir. Seyahat, güzellik, emlak ve spor salonu markaları için.",
  },
  ctaPrimary: { en: "Start free", tr: "Ücretsiz başla" },
  ctaSecondary: { en: "Watch a reel", tr: "Bir reels izle" },
  microcopy: { en: "No credit card required", tr: "Kredi kartı gerekmez" },
} satisfies Record<string, Copy>;
```

- [ ] **Step 5: Create Hero.astro**

Create `apps/landing/src/components/Hero.astro`:

```astro
---
import { hero } from "../data/copy";
import { SIGNUP_URL } from "../data/site";
import ReelMarquee from "./ReelMarquee.astro";
---

<section class="hero">
  <div class="wrap hero-grid">
    <div class="hero-copy reveal">
      <div class="eyebrow" data-tr={hero.eyebrow.tr}>{hero.eyebrow.en}</div>
      <h1 class="disp h1x" data-tr={hero.title.tr}>{hero.title.en}</h1>
      <p class="lead" data-tr={hero.lead.tr}>{hero.lead.en}</p>
      <div class="hero-cta">
        <a class="btn btn-primary btn-lg" href={SIGNUP_URL}>
          <span data-tr={hero.ctaPrimary.tr}>{hero.ctaPrimary.en}</span>
        </a>
        <a class="btn btn-ghost btn-lg" href="#showcase">
          <span class="play">▶</span><span data-tr={hero.ctaSecondary.tr}>{hero.ctaSecondary.en}</span>
        </a>
      </div>
      <div class="microcopy" data-tr={hero.microcopy.tr}>{hero.microcopy.en}</div>
    </div>
    <div class="hero-visual"><ReelMarquee /></div>
  </div>
</section>
```

- [ ] **Step 6: Apply the aurora and swap the hero in**

In `apps/landing/src/styles/global.css`, change the `.hero` rule (currently `.hero { padding: 150px 0 96px; }`) to:

```css
.hero { padding: 150px 0 96px; background: var(--hero); }
```

In `apps/landing/src/pages/index.astro`, add `import Hero from "../components/Hero.astro";` to the frontmatter and replace the entire `<section class="hero">…</section>` block with `<Hero />`.

- [ ] **Step 7: Build and check**

Run:
```bash
pnpm --filter @sentezy/landing typecheck && pnpm --filter @sentezy/landing build
```
Expected: both succeed.

Run `pnpm --filter @sentezy/landing dev` and open `http://localhost:4321`. Expected:
- A soft blue→amber aurora wash behind the hero.
- Two columns of 9:16 tiles scrolling in opposite directions, each showing a real avatar over a colored gradient with a sector chip and a styled caption.
- Hovering the marquee pauses both columns.
- No gray placeholder, no fake metric row (the metrics moved out with the old hero block).

Then in DevTools → Rendering → enable "Emulate prefers-reduced-motion: reduce" and reload. Expected: both columns are frozen.

- [ ] **Step 8: Commit**

```bash
git add apps/landing/src
git commit -m "feat(landing): aurora hero with a counter-scrolling reel-still marquee"
```

---

### Task 5: Proof bar and sector cards

Replaces the fake metric row, the fake customer-logo marquee, the five feature cards (two of which described unshipped features) and the four use-case cards.

**Files:**
- Create: `apps/landing/src/components/ProofBar.astro`
- Create: `apps/landing/src/components/Sectors.astro`
- Modify: `apps/landing/src/data/copy.ts` (append `proof`, `sectors`)
- Modify: `apps/landing/src/styles/global.css`
- Modify: `apps/landing/src/pages/index.astro`
- Modify: `apps/landing/scripts/verify.mjs` (fill in `REQUIRED`)

**Interfaces:**
- Consumes: `Copy`, `sectorNames` from Task 3.
- Produces: `<ProofBar />`, `<Sectors />` (no props). `Sectors` renders `id="sectors"`, linked to from the footer.

- [ ] **Step 1: Add the proof and sector copy**

Append to `apps/landing/src/data/copy.ts`:

```ts
/** Every number here traces to source. Do not add one that does not.
 *   12 → apps/api/src/data/avatars.json, entries with a non-empty displayImageId
 *   24 → same file, distinct `sector` values
 *   20 → CAPTION_STYLE_META in packages/types/src/index.ts
 *   14 → BROLL_EFFECT_META in packages/types/src/index.ts */
export const proof = [
  { n: "12", label: { en: "AI presenters", tr: "Yapay zeka sunucu" } },
  { n: "24", label: { en: "Sectors covered", tr: "Sektör" } },
  { n: "20", label: { en: "Caption styles", tr: "Altyazı stili" } },
  { n: "14", label: { en: "Transitions", tr: "Geçiş efekti" } },
] satisfies { n: string; label: Copy }[];

export const sectors = {
  eyebrow: { en: "BUILT FOR", tr: "KİMLER İÇİN" },
  title: { en: "Made for the businesses that live on reels.", tr: "Reels'te yaşayan işletmeler için." },
  items: [
    {
      key: "travel",
      body: { en: "Fill tours and hotel nights with reels that show the place, not a brochure.", tr: "Turları ve otel gecelerini broşür değil, mekânı gösteren reels'lerle doldurun." },
    },
    {
      key: "beauty",
      body: { en: "Before-and-afters, price drops and open slots — posted daily, filmed never.", tr: "Öncesi-sonrası, indirimler ve boş randevular — her gün paylaşın, hiç çekim yapmayın." },
    },
    {
      key: "realestate",
      body: { en: "Every new listing gets its own presenter-led reel the day it goes live.", tr: "Her yeni ilan, yayına girdiği gün kendi sunuculu reels'ine kavuşur." },
    },
    {
      key: "gym",
      body: { en: "Class schedules, transformations and campaigns, on a weekly drumbeat.", tr: "Ders programları, dönüşümler ve kampanyalar — her hafta düzenli." },
    },
  ],
} as const;
```

- [ ] **Step 2: Add the styles**

Append to `apps/landing/src/styles/global.css`:

```css
/* ── proof bar ──────────────────────────────────────────────────────────── */
.proof { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; padding: 34px 0;
  border-top: 1px solid var(--color-hairline); border-bottom: 1px solid var(--color-hairline); }
.proof-item { text-align: center; }
.proof-n { font-family: var(--font-mono); font-weight: 500; font-size: 40px; line-height: 1;
  color: var(--color-ink); font-variant-numeric: tabular-nums; }
.proof-l { display: block; margin-top: 8px; font-size: 13.5px; color: var(--color-muted); }

/* ── sector cards ───────────────────────────────────────────────────────── */
.sector-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
.sector { padding: 26px; border-radius: 20px; border: 1px solid var(--color-hairline);
  background: var(--color-paper); transition: transform 0.25s cubic-bezier(0.22,1,0.36,1), box-shadow 0.25s; }
.sector:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(10,10,12,0.07); }
.sector-bar { width: 34px; height: 4px; border-radius: 999px; margin-bottom: 18px; }
.sector:nth-child(1) .sector-bar { background: linear-gradient(90deg, #2e74c4, #28c4c0); }
.sector:nth-child(2) .sector-bar { background: linear-gradient(90deg, #d67096, #e89260); }
.sector:nth-child(3) .sector-bar { background: linear-gradient(90deg, #7f5ad0, #2e74c4); }
.sector:nth-child(4) .sector-bar { background: linear-gradient(90deg, #d8a13c, #d67096); }
.sector .h3 { font-size: 19px; margin-bottom: 8px; }
.sector p { font-size: 14.5px; color: var(--color-slate); line-height: 1.55; }

@media (max-width: 900px) { .proof, .sector-grid { grid-template-columns: 1fr 1fr; } }
@media (max-width: 560px) { .sector-grid { grid-template-columns: 1fr; } .proof-n { font-size: 32px; } }
```

Then **delete** the now-unused `.metric-row`, `.metric`, `.metric-n`, `.metric-l`, `.marquee`, `.marquee-track`, `@keyframes marq` and `.wordmark` rules, plus the rules orphaned by removing the feature-card and use-case sections — `.grid3`, `.card`, `.card:hover`, `.chip`, `.card .h3`, `.card p`, `.grid4`, `.uc`, `.uc:hover`, `.uc-num`, `.uc .h3`, `.uc p`, and the `.grid3, .grid4` entries in both media queries. Retitle the section comment to `zig blocks / steps`, and drop `.marquee-track { animation: none; }` from the reduced-motion block (which then only needs the `.reveal, .stagger > *` rule plus `.reel-col`). Also delete the `.metric-row`/`.metric-n` entries in the `max-width: 560px` media query.

- [ ] **Step 3: Create ProofBar.astro**

```astro
---
import { proof } from "../data/copy";
---

<section class="sec" style="padding-top:0">
  <div class="wrap">
    <div class="proof stagger">
      {proof.map((p) => (
        <div class="proof-item">
          <div class="proof-n mono">{p.n}</div>
          <span class="proof-l" data-tr={p.label.tr}>{p.label.en}</span>
        </div>
      ))}
    </div>
  </div>
</section>
```

- [ ] **Step 4: Create Sectors.astro**

```astro
---
import { sectorNames, sectors } from "../data/copy";
---

<section class="sec mist" id="sectors">
  <div class="wrap">
    <div class="sec-head reveal">
      <div class="eyebrow" data-tr={sectors.eyebrow.tr}>{sectors.eyebrow.en}</div>
      <h2 class="disp h2" data-tr={sectors.title.tr}>{sectors.title.en}</h2>
    </div>
    <div class="sector-grid stagger">
      {sectors.items.map((s) => (
        <div class="sector">
          <div class="sector-bar"></div>
          <h3 class="disp h3" data-tr={sectorNames[s.key].tr}>{sectorNames[s.key].en}</h3>
          <p data-tr={s.body.tr}>{s.body.en}</p>
        </div>
      ))}
    </div>
  </div>
</section>
```

- [ ] **Step 5: Swap into index.astro**

Add to the frontmatter:

```astro
import ProofBar from "../components/ProofBar.astro";
import Sectors from "../components/Sectors.astro";
```

Delete these three blocks entirely and put `<ProofBar />` then `<Sectors />` where the first one was:
- the `<section class="sec">` containing `class="marquee"` (the fake customer logos),
- the `<section class="sec mist" id="features">` containing the five `.card` feature tiles,
- the `<section class="sec mist">` containing the four `.uc` use-case tiles.

- [ ] **Step 6: Fill in the verify script's REQUIRED list**

In `apps/landing/scripts/verify.mjs`, replace `const REQUIRED = [];` with:

```js
const REQUIRED = [
  ">12<", ">24<", ">20<", ">14<",           // the four verified proof numbers
  "Reels that sell",                         // hero headline
  "instagram.com/sentezy.ai",                // the real account is linked
];
```

- [ ] **Step 7: Build and verify**

Run:
```bash
pnpm --filter @sentezy/landing typecheck && pnpm --filter @sentezy/landing build && pnpm --filter @sentezy/landing verify
```
Expected: typecheck and build succeed. `verify` should now clear every fake-logo check and every REQUIRED check. It will still fail on `href="#"` (the FAQ/final-CTA/zig sections keep dead links until Tasks 7-9), on `175+`/`SOC 2`/`digital twin` (the FAQ, rewritten in Task 9), and on the two `periwinkle literal in built CSS` lines (`.beam-*` goes in Task 4, `.final-wash` in Task 9). Those are expected. If any of `Northwind`, `Vertex`, `LUMEN`, `Kavis`, `Orbita`, `Meridian`, `Aster` or `Polar` still appear, the logo marquee block was not fully deleted — that is a real failure.

- [ ] **Step 8: Commit**

```bash
git add apps/landing/src apps/landing/scripts/verify.mjs
git commit -m "feat(landing): verified proof bar and sector cards; drop fake metrics and logos"
```

---

### Task 6: Instagram showcase

**Files:**
- Create: `apps/landing/src/data/reels.ts`
- Create: `apps/landing/src/components/InstaShowcase.astro`
- Create: `apps/landing/src/scripts/insta.ts`
- Modify: `apps/landing/src/data/copy.ts` (append `showcase`)
- Modify: `apps/landing/src/styles/global.css`
- Modify: `apps/landing/src/pages/index.astro`

**Interfaces:**
- Consumes: `.band` from Task 2; `INSTAGRAM_URL` from Task 3.
- Produces: `<InstaShowcase />` rendering `id="showcase"` (the hero's secondary CTA and the nav both link to it). `reels.ts` exports `type Reel` and `const reels: Reel[]`.

- [ ] **Step 1: Define the reels**

Create `apps/landing/src/data/reels.ts`. Shortcodes taken from the embed snippets supplied by the account owner on 2026-07-22.

```ts
/** Real posts from instagram.com/sentezy.ai. Adding a reel here is the only step needed
 *  to put it on the page — InstaShowcase renders one card per entry, and falls back to a
 *  single follow card when the list is empty. */
export type Reel = { shortcode: string };

export const reels: Reel[] = [
  { shortcode: "DbCAH3rCwxe" },
  { shortcode: "DbDOIBPic25" },
  { shortcode: "DbFxuR3CUqM" },
];

export const permalink = (shortcode: string) => `https://www.instagram.com/reel/${shortcode}/`;
```

- [ ] **Step 2: Write the lazy embed loader**

Create `apps/landing/src/scripts/insta.ts`:

```ts
/** Instagram's embed.js is heavy third-party JS that blocks nothing we need above the fold, so
 *  it is injected only when the showcase approaches the viewport.
 *
 *  Until then each slot holds a skeleton at the typical reel-embed height. We cannot know the
 *  real height in advance — Instagram sizes the iframe itself, and a longer caption makes it
 *  taller — so this reduces the reflow rather than eliminating it. The section is below the
 *  fold and loads on approach, so any residual shift lands off-screen. */
declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } };
  }
}

const section = document.querySelector("#showcase");

const load = () => {
  if (document.querySelector('script[data-insta-embed]')) return;
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://www.instagram.com/embed.js";
  s.setAttribute("data-insta-embed", "");
  // embed.js auto-processes on load, but call it explicitly in case it was already cached.
  s.addEventListener("load", () => window.instgrm?.Embeds.process());
  document.body.appendChild(s);
};

if (section) {
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        load();
        io.disconnect();
      }
    },
    { rootMargin: "400px 0px" },
  );
  io.observe(section);
}

export {};
```

- [ ] **Step 3: Add the showcase copy**

Append to `apps/landing/src/data/copy.ts`:

```ts
export const showcase = {
  eyebrow: { en: "SHOWCASE", tr: "ÖRNEKLER" },
  title: { en: "Real reels. Made with Sentezy.", tr: "Gerçek reels'ler. Sentezy ile yapıldı." },
  lead: {
    en: "Every one of these was generated end to end — script, presenter, voice, captions and edit. Nobody held a camera.",
    tr: "Bunların hepsi baştan sona üretildi — metin, sunucu, ses, altyazı ve kurgu. Kimse kamera tutmadı.",
  },
  follow: { en: "Follow @sentezy.ai", tr: "@sentezy.ai'yi takip et" },
  /** Inside the blockquote. embed.js replaces it once the script lands, but it is our own
   *  markup until then — and stays visible for anyone with JS blocked or Instagram unreachable. */
  viewOnInstagram: { en: "View this reel on Instagram", tr: "Bu reels'i Instagram'da izle" },
  empty: { en: "See the latest reels on Instagram", tr: "En yeni reels'leri Instagram'da izleyin" },
} satisfies Record<string, Copy>;
```

- [ ] **Step 4: Add the showcase styles**

Append to `apps/landing/src/styles/global.css`:

```css
/* ── instagram showcase ─────────────────────────────────────────────────── */
.ig-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 44px;
  align-items: start; }
/* min-height approximates a reel embed at this column width. Instagram sizes the iframe
   itself and a long caption makes it taller, so this is a best-effort floor that limits the
   shift, not a guarantee of none — the section is below the fold either way. */
.ig-card { position: relative; border-radius: 20px; overflow: hidden; background: #fff;
  box-shadow: 0 24px 64px rgba(0,0,0,0.35); min-height: 720px; }
/* Instagram replaces the blockquote's contents wholesale; these keep our frame tidy and hold
   the embed above the skeleton. */
.ig-card .instagram-media { position: relative; z-index: 1;
  margin: 0 !important; min-width: 0 !important; width: 100% !important;
  border-radius: 20px !important; box-shadow: none !important; }
.ig-skeleton { position: absolute; inset: 0; z-index: 0; background:
  linear-gradient(100deg, #f4f4f5 30%, #ececee 50%, #f4f4f5 70%) 0 0 / 300% 100%;
  animation: ig-shimmer 1.4s linear infinite; }
@keyframes ig-shimmer { to { background-position: -300% 0; } }
.ig-follow { display: flex; justify-content: center; margin-top: 40px; }

@media (max-width: 900px) { .ig-grid { grid-template-columns: 1fr; max-width: 480px; margin-inline: auto; } }
@media (prefers-reduced-motion: reduce) { .ig-skeleton { animation: none; } }
```

- [ ] **Step 5: Create InstaShowcase.astro**

Note the blockquote carries **only** the attributes Instagram's script requires — the inline `style` and the ~60 lines of placeholder markup in Instagram's copy-paste snippet are dropped, because `embed.js` replaces the node's children entirely.

```astro
---
import { showcase } from "../data/copy";
import { permalink, reels } from "../data/reels";
import { INSTAGRAM_URL } from "../data/site";

// With reels, the grid is the content and the trailing ghost button is the follow-up. With
// none, the empty-state button IS the call to action — showing both would stack two buttons
// pointing at the same URL, so each branch renders exactly one.
---

<section class="sec band" id="showcase">
  <div class="wrap">
    <div class="sec-head reveal">
      <div class="eyebrow" data-tr={showcase.eyebrow.tr}>{showcase.eyebrow.en}</div>
      <h2 class="disp h2" data-tr={showcase.title.tr}>{showcase.title.en}</h2>
      <p class="lead" data-tr={showcase.lead.tr}>{showcase.lead.en}</p>
    </div>

    {reels.length > 0 ? (
      <div class="ig-grid reveal">
        {reels.map((r) => (
          <div class="ig-card">
            <div class="ig-skeleton"></div>
            <blockquote
              class="instagram-media"
              data-instgrm-permalink={permalink(r.shortcode)}
              data-instgrm-version="14"
            >
              <a href={permalink(r.shortcode)} target="_blank" rel="noopener" data-tr={showcase.viewOnInstagram.tr}>
                {showcase.viewOnInstagram.en}
              </a>
            </blockquote>
          </div>
        ))}
      </div>
    ) : (
      <div class="ig-follow">
        <a class="btn btn-primary btn-lg" href={INSTAGRAM_URL} target="_blank" rel="noopener">
          <span data-tr={showcase.empty.tr}>{showcase.empty.en}</span>
        </a>
      </div>
    )}

    {reels.length > 0 && (
      <div class="ig-follow">
        <a class="btn btn-ghost btn-lg" href={INSTAGRAM_URL} target="_blank" rel="noopener">
          <span data-tr={showcase.follow.tr}>{showcase.follow.en}</span>
        </a>
      </div>
    )}
  </div>
</section>
```

- [ ] **Step 6: Wire it up**

In `apps/landing/src/pages/index.astro`, add `import InstaShowcase from "../components/InstaShowcase.astro";` and place `<InstaShowcase />` immediately after `<Sectors />`.

Add the loader to the page's script block, so it reads:

```astro
<script>
  import "../scripts/i18n";
  import "../scripts/reveal";
  import "../scripts/insta";
</script>
```

- [ ] **Step 7: Build and check the lazy load**

Run:
```bash
pnpm --filter @sentezy/landing typecheck && pnpm --filter @sentezy/landing build
```
Expected: both succeed.

Run `pnpm --filter @sentezy/landing dev`, open `http://localhost:4321`, open DevTools → Network, and filter for `embed.js`. Expected:
- On first paint, **no** request for `embed.js`.
- Scroll toward the showcase — the request fires roughly 400px before the section enters view.
- Three reels render inside dark rounded cards on the dark aurora band.
- The `Watch a reel` hero button and the nav's `Showcase` link both scroll here.

- [ ] **Step 8: Commit**

```bash
git add apps/landing/src
git commit -m "feat(landing): instagram showcase on a dark band with lazy-loaded embeds"
```

---

### Task 7: How it works, and the studio blocks with real screenshots

Replaces the three zig blocks whose media were gray placeholders, and drops the Translation block entirely (that feature does not exist).

**SHIPPED VARIANT (2026-07-23).** Two deviations from the original text below, both forced:
1. Screenshots live in `src/assets/app/`, not `public/app/` — the Task 1 binding (astro:assets
   optimizes; `public/` ships bytes untouched).
2. **No screenshot has been captured** — no agent here can drive a logged-in browser. Rather than
   block the whole task, the block list is discovered from the filesystem at build time
   (`src/data/shots.ts`), so the page honors the spec's cut-not-placeholder rule *today* (the
   section and its nav/footer links are simply absent) and lights up with no code change the
   moment a PNG lands. Step 1 is therefore still open, and Task 10 must re-check `#platform`.

**Files:**
- Create: `apps/landing/src/assets/app/{composer,captions,brand-kit}.png` (**still pending — user**)
- Create: `apps/landing/src/data/shots.ts`
- Create: `apps/landing/src/components/HowItWorks.astro`
- Create: `apps/landing/src/components/StudioBlocks.astro`
- Modify: `apps/landing/src/data/copy.ts` (append `how`, `studio`)
- Modify: `apps/landing/src/components/{Nav,Footer}.astro` (guard the `#platform` links)
- Modify: `apps/landing/src/styles/global.css`
- Modify: `apps/landing/src/pages/index.astro`

**Interfaces:**
- Consumes: `Copy`, `SIGNUP_URL`.
- Produces: `<HowItWorks />` rendering `id="how"`, `<StudioBlocks />` rendering `id="platform"`
  **when at least one screenshot exists**, and `HAS_STUDIO` from `src/data/shots.ts`, which Nav
  and Footer use so a link never points at a section that did not render.

- [ ] **Step 1: Capture the three screenshots** — OPEN, blocked on the user

Start the web app and capture. From the repo root:

```bash
pnpm --filter @sentezy/web dev
```

Then in a browser at `http://localhost:3000`, log in and capture these three views at a 1440x900 viewport, cropping to the inset white content panel (exclude the OS chrome and the browser bar):

| View | Route | Save as |
|---|---|---|
| Media composer with a presenter and voice selected | `/dashboard` | `apps/landing/src/assets/app/composer.png` |
| Caption style picker, open | `/dashboard` (open the caption picker) | `apps/landing/src/assets/app/captions.png` |
| Brand kit | `/brand-kit` | `apps/landing/src/assets/app/brand-kit.png` |

Save as PNG at 2x device pixel ratio. The filename **is** the key: `shots.ts` matches
`src/assets/app/<key>.png` against `studio.blocks[].key`, so a typo silently drops the block.

**If a view cannot be captured** (app will not start, no seeded data, credentials unavailable): per the spec that block is **cut from the page** — it does not ship as a placeholder. Do not substitute a mockup or a stock image. Dropping fewer than three files is fine; the rest render.

Verify:
```bash
ls -la apps/landing/src/assets/app/
pnpm --filter @sentezy/landing build   # blocks appear, #platform + its nav/footer links return
```

- [x] **Step 2: Add the copy**

Appended to `apps/landing/src/data/copy.ts` — `how` (3 steps) and `studio` (3 blocks). Shipped
shape differs from the draft in two details: the third block's `key` is `"brand-kit"` (it names
the file), and there is no `img` field at all — the image is resolved from `key` by `shots.ts`.

- [x] **Step 2b: Create shots.ts**

```ts
const shots = import.meta.glob<{ default: ImageMetadata }>("../assets/app/*.png", { eager: true });
export const studioBlocks = studio.blocks.flatMap((b) => {
  const mod = shots[`../assets/app/${b.key}.png`];
  return mod ? [{ ...b, shot: mod.default }] : [];
});
export const HAS_STUDIO = studioBlocks.length > 0;
```

- [x] **Step 3: Add the styles**

```css
.zig-shot { border-radius: 20px; overflow: hidden; border: 1px solid var(--color-hairline);
  box-shadow: 0 28px 72px rgba(10,10,12,0.14); background: var(--color-paper); }
.zig-shot img { display: block; width: 100%; height: auto; }
```

`.ph`, `.ph-label` and `.zig-media` are deleted with the markup that used them, and the two
`.zig.rev .zig-media { order }` rules (base + 900px breakpoint) now target `.zig-shot`.
`.inline-cta` is deleted too — its only consumers were the three `href="#"` arrows that went
with the old blocks.

- [x] **Step 4: Create HowItWorks.astro** — as drafted; renders `id="how"` from `how`.

- [x] **Step 5: Create StudioBlocks.astro**

As drafted, with the whole `<section>` wrapped in `{studioBlocks.length > 0 && (…)}`, iterating
`studioBlocks` (not `studio.blocks`), and the `<img>` replaced by astro:assets
`<Image src={b.shot} widths={[640,960,1280]} sizes="(max-width: 900px) 92vw, 560px" />`.
No `.inline-cta` link on these blocks — the old ones pointed at `#`.

- [x] **Step 6: Swap into index.astro**

`<HowItWorks />` then `<StudioBlocks />` replace both the `id="solutions"` zig section and the
old hand-written how-it-works section, sitting between `<InstaShowcase />` and the FAQ.

- [x] **Step 7: Build and check**

```bash
pnpm --filter @sentezy/landing typecheck && pnpm --filter @sentezy/landing build && pnpm --filter @sentezy/landing verify
```
Actual: typecheck 0 errors, build clean, `dist/_astro` still 1.6 MB. `verify` stays at the same
6 failures as after Task 6 — `175+`, `SOC 2`, `digital twin`, `dijital ikiz`, `href="#"` and the
`.final-wash` periwinkle, all owned by Task 9. The three `href="#"` arrows this task removed were
not the last ones; the final CTA still has one.

- [x] **Step 8: Commit**

```bash
git add apps/landing/src docs .superpowers
git commit -m "feat(landing): how-it-works section and screenshot-gated studio blocks"
```

---

### Task 8: Caption style demo — SHIPPED 2026-07-23

**Files:**
- Create: `apps/landing/src/components/CaptionDemo.astro`
- Create: `apps/landing/src/scripts/captions.ts`
- Modify: `apps/landing/src/data/copy.ts` (append `captionDemo`)
- Modify: `apps/landing/src/styles/global.css`
- ~~Modify: `apps/landing/src/layouts/Base.astro`~~ — not needed. The file list said "caption-demo
  fonts", but the demo uses `--font-display` (General Sans), already loaded for the whole page.
  The other reason to touch Base — its meta description still claims "175+ languages" — belongs
  to Task 9, which rewrites the title and description defaults.
- Modify: `apps/landing/src/pages/index.astro`

**Deviation:** the `…and 14 more styles.` string went into `captionDemo.more` rather than being
inlined in the markup, matching how every other string on the page is handled. The six ids and
TR labels were re-checked against `CAPTION_STYLE_META` before shipping: clean=Sade, tiktok=TikTok,
hormozi=Hormozi, boxed=Kutu, highlight=Vurgu, glow=Neon — all present, 20 entries total, so
6 shown + 14 more is exact.

**Interfaces:**
- Consumes: the `.cap-*` caption treatments from Task 4 (reused verbatim, not redefined).
- Produces: `<CaptionDemo />` rendering `id="captions"`, linked from the footer.

- [x] **Step 1: Add the demo copy**

Append to `apps/landing/src/data/copy.ts`. The style ids and Turkish labels are transcribed from `CAPTION_STYLE_META` in `packages/types/src/index.ts:26` — the landing does not import from the workspace, per the build constraint. Six of the twenty are shown; the heading states the real total.

```ts
export const captionDemo = {
  eyebrow: { en: "CAPTIONS", tr: "ALTYAZILAR" },
  title: { en: "20 caption styles. Burned into the file.", tr: "20 altyazı stili. Dosyaya işlenmiş." },
  lead: {
    en: "Not an overlay a platform can strip — the captions are rendered into the video, word by word, on the beat.",
    tr: "Platformun kaldırabileceği bir katman değil — altyazılar videoya, kelime kelime, ritme oturarak işlenir.",
  },
  sample: { en: "THIS REEL SELLS", tr: "BU REELS SATIYOR" },
  /** id → label, transcribed from CAPTION_STYLE_META (packages/types/src/index.ts). */
  styles: [
    { id: "hormozi", label: { en: "Hormozi", tr: "Hormozi" } },
    { id: "tiktok", label: { en: "TikTok", tr: "TikTok" } },
    { id: "highlight", label: { en: "Highlight", tr: "Vurgu" } },
    { id: "boxed", label: { en: "Boxed", tr: "Kutu" } },
    { id: "glow", label: { en: "Neon", tr: "Neon" } },
    { id: "clean", label: { en: "Clean", tr: "Sade" } },
  ],
} as const;
```

- [x] **Step 2: Write the cycler**

Create `apps/landing/src/scripts/captions.ts`:

```ts
/** Cycles the caption demo through its styles. Each style is a .cap-demo-slide; exactly one
 *  carries .on at a time. Frozen on the first slide under reduced motion. */
const slides = Array.from(document.querySelectorAll<HTMLElement>(".cap-demo-slide"));
const chips = Array.from(document.querySelectorAll<HTMLElement>(".cap-chip"));

if (slides.length > 1 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  let i = 0;
  setInterval(() => {
    slides[i].classList.remove("on");
    chips[i]?.classList.remove("on");
    i = (i + 1) % slides.length;
    slides[i].classList.add("on");
    chips[i]?.classList.add("on");
  }, 2200);
}

export {};
```

- [x] **Step 3: Add the styles**

Append to `apps/landing/src/styles/global.css`:

```css
/* ── caption demo ───────────────────────────────────────────────────────── */
.cap-demo { display: grid; grid-template-columns: 320px 1fr; gap: 56px; align-items: center;
  margin-top: 48px; }
.cap-phone { position: relative; width: 300px; aspect-ratio: 9/16; border-radius: 26px;
  overflow: hidden; background: linear-gradient(165deg, #2e74c4, #14304f);
  border: 6px solid #0a0a0b; box-shadow: 0 30px 80px rgba(10,10,12,0.28); }
.cap-phone img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
  object-position: top center; }
.cap-phone::after { content: ""; position: absolute; inset: 0;
  background: linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.5) 100%); }
.cap-demo-slide { position: absolute; left: 16px; right: 16px; bottom: 40px; z-index: 2;
  text-align: center; font-family: var(--font-display); font-weight: 700; font-size: 22px;
  line-height: 1.15; text-transform: uppercase; color: #fff;
  opacity: 0; transform: translateY(6px); transition: opacity 0.35s, transform 0.35s; }
.cap-demo-slide.on { opacity: 1; transform: none; }
.cap-chips { display: flex; flex-wrap: wrap; gap: 10px; }
.cap-chip { font-family: var(--font-mono); font-size: 12.5px; padding: 8px 14px; border-radius: 999px;
  border: 1px solid var(--color-hairline); color: var(--color-muted); background: var(--color-paper);
  transition: background 0.25s, color 0.25s, border-color 0.25s; }
.cap-chip.on { background: var(--color-ink); color: #fff; border-color: var(--color-ink); }
.cap-more { margin-top: 18px; font-size: 14px; color: var(--color-muted); }

@media (max-width: 900px) {
  .cap-demo { grid-template-columns: 1fr; justify-items: center; gap: 32px; }
  .cap-phone { width: 260px; }
}
@media (prefers-reduced-motion: reduce) { .cap-demo-slide { transition: none; } }
```

- [x] **Step 4: Create CaptionDemo.astro**

```astro
---
import { Image } from "astro:assets";
import { captionDemo } from "../data/copy";
/* Static import, unlike ReelMarquee's glob — this component always shows the same avatar. */
import kevser from "../assets/avatars/kevser.png";
---

<section class="sec" id="captions">
  <div class="wrap">
    <div class="sec-head reveal">
      <div class="eyebrow" data-tr={captionDemo.eyebrow.tr}>{captionDemo.eyebrow.en}</div>
      <h2 class="disp h2" data-tr={captionDemo.title.tr}>{captionDemo.title.en}</h2>
      <p class="lead" data-tr={captionDemo.lead.tr}>{captionDemo.lead.en}</p>
    </div>
    <div class="cap-demo reveal">
      <div class="cap-phone">
        <Image src={kevser} alt="" widths={[300, 600]} sizes="300px" loading="lazy" decoding="async" />
        {captionDemo.styles.map((s, i) => (
          <div class={`cap-demo-slide${i === 0 ? " on" : ""}`}>
            <span class={`cap-${s.id}`} data-tr={captionDemo.sample.tr}>{captionDemo.sample.en}</span>
          </div>
        ))}
      </div>
      <div>
        <div class="cap-chips">
          {captionDemo.styles.map((s, i) => (
            <span class={`cap-chip${i === 0 ? " on" : ""}`} data-tr={s.label.tr}>{s.label.en}</span>
          ))}
        </div>
        <p class="cap-more" data-tr="…ve 14 stil daha.">…and 14 more styles.</p>
      </div>
    </div>
  </div>
</section>
```

- [x] **Step 5: Wire it up**

In `apps/landing/src/pages/index.astro`, add `import CaptionDemo from "../components/CaptionDemo.astro";` and place `<CaptionDemo />` after `<StudioBlocks />`. Add `import "../scripts/captions";` to the page script block.

- [x] **Step 6: Build and check**

```bash
pnpm --filter @sentezy/landing typecheck && pnpm --filter @sentezy/landing build
```
Actual: 0 errors, build clean, `dist/_astro` still 1.6 MB (no new image — the demo reuses
`kevser.png`, already emitted for the marquee). Built HTML carries 6 `.cap-demo-slide` and
6 `.cap-chip`, exactly one of each with `on`, and the cycler is inside the single inlined
module script. `verify` unchanged at 6 failures, all Task 9's.

In the browser: a phone frame cycles through six caption treatments roughly every 2.2s, with the matching chip highlighting in step. Under emulated reduced motion, it freezes on `Hormozi` with that chip lit.

Confirm the arithmetic reads correctly: six shown + "and 14 more styles" = the 20 claimed in the heading.

- [x] **Step 7: Commit**

```bash
git add apps/landing/src
git commit -m "feat(landing): animated caption-style demo"
```

---

### Task 9: Pricing teaser, rewritten FAQ, final CTA — SHIPPED 2026-07-23

**Files:**
- Create: `apps/landing/src/components/PricingTeaser.astro`
- Create: `apps/landing/src/components/Faq.astro`
- Create: `apps/landing/src/components/FinalCta.astro`
- Modify: `apps/landing/src/data/copy.ts` (append `pricing`, `faq`, `finalCta`)
- Modify: `apps/landing/src/styles/global.css`
- Modify: `apps/landing/src/layouts/Base.astro`
- Modify: `apps/landing/src/pages/index.astro`

**Interfaces:**
- Consumes: `.band`, `SIGNUP_URL`, the existing `.faq*` styles.
- Produces: `<PricingTeaser />`, `<Faq />` rendering `id="faq"`, `<FinalCta />`. After this task `index.astro` contains no raw section markup.

- [x] **Step 1: Add the copy**

Append to `apps/landing/src/data/copy.ts`. The FAQ is rewritten to four claims that are all true — the SOC 2 and digital-twin answers are gone.

```ts
export const pricing = {
  title: { en: "Start free. Upgrade when you scale.", tr: "Ücretsiz başlayın. Büyüdükçe yükseltin." },
  body: {
    en: "Your first reels are on us — no card, no trial timer. Move to a paid plan when you need more of them.",
    tr: "İlk reels'leriniz bizden — kart yok, deneme süresi yok. Daha fazlasına ihtiyacınız olunca ücretli plana geçin.",
  },
  cta: { en: "Start free", tr: "Ücretsiz başla" },
} satisfies Record<string, Copy>;

export const faq = {
  eyebrow: { en: "FAQ", tr: "SSS" },
  title: { en: "Frequently asked questions.", tr: "Sık sorulan sorular." },
  items: [
    {
      q: { en: "Is Sentezy really free to start?", tr: "Sentezy'e başlamak gerçekten ücretsiz mi?" },
      a: { en: "Yes. You get credits to make your first reels with no card on file. Upgrade only when you need more.", tr: "Evet. Kart bilgisi vermeden ilk reels'lerinizi yapacak kredi alırsınız. Yalnızca daha fazlasına ihtiyacınız olunca yükseltin." },
    },
    {
      q: { en: "Which sectors do the presenters cover?", tr: "Sunucular hangi sektörleri kapsıyor?" },
      a: { en: "24 sectors, from real estate and beauty to dental, pharmacy, automotive and e-commerce. Each presenter is styled for their line of work.", tr: "Emlaktan güzelliğe, dişten eczaneye, otomotivden e-ticarete 24 sektör. Her sunucu kendi işine göre giydirilmiştir." },
    },
    {
      q: { en: "Do I need a camera or editing skills?", tr: "Kamera ya da kurgu bilgisi gerekiyor mu?" },
      a: { en: "Neither. You write or paste a script, pick a presenter and a style, and Sentezy renders the finished 9:16 file — voice, captions, music and all.", tr: "İkisi de gerekmiyor. Metni yazın ya da yapıştırın, sunucu ve stil seçin; Sentezy bitmiş 9:16 dosyayı ses, altyazı ve müzikle birlikte üretir." },
    },
    {
      q: { en: "Is my data safe? (KVKK/GDPR)", tr: "Verilerim güvende mi? (KVKK/GDPR)" },
      a: { en: "Your scripts, uploads and rendered videos are encrypted in transit and at rest, and handled in line with KVKK and GDPR. You can delete your account and all its media at any time from Settings.", tr: "Metinleriniz, yüklemeleriniz ve videolarınız aktarımda ve saklamada şifrelenir; KVKK ve GDPR'a uygun işlenir. Hesabınızı ve tüm medyanızı istediğiniz an Ayarlar'dan silebilirsiniz." },
    },
  ],
} as const;

export const finalCta = {
  title: { en: "Your next reel is five minutes away.", tr: "Sıradaki reels'iniz beş dakika uzakta." },
  cta: { en: "Start free", tr: "Ücretsiz başla" },
  microcopy: { en: "No credit card required", tr: "Kredi kartı gerekmez" },
} satisfies Record<string, Copy>;
```

- [x] **Step 2: Add the pricing style**

Append to `apps/landing/src/styles/global.css`:

```css
/* ── pricing teaser ─────────────────────────────────────────────────────── */
.price-band { text-align: center; max-width: 44em; margin: 0 auto; }
.price-band .h2 { margin-bottom: 16px; }
.price-band .lead { margin: 0 auto 28px; }
```

Then **delete** the `.final-wash` rule — the final CTA now uses `.band` instead of a periwinkle radial.

- [x] **Step 3: Create PricingTeaser.astro**

```astro
---
import { pricing } from "../data/copy";
import { SIGNUP_URL } from "../data/site";
---

<section class="sec mist">
  <div class="wrap">
    <div class="price-band reveal">
      <h2 class="disp h2" data-tr={pricing.title.tr}>{pricing.title.en}</h2>
      <p class="lead" data-tr={pricing.body.tr}>{pricing.body.en}</p>
      <a class="btn btn-primary btn-lg" href={SIGNUP_URL}>
        <span data-tr={pricing.cta.tr}>{pricing.cta.en}</span>
      </a>
    </div>
  </div>
</section>
```

- [x] **Step 4: Create Faq.astro**

```astro
---
import { faq } from "../data/copy";
---

<section class="sec" id="faq">
  <div class="wrap">
    <div class="sec-head reveal">
      <div class="eyebrow" data-tr={faq.eyebrow.tr}>{faq.eyebrow.en}</div>
      <h2 class="disp h2" data-tr={faq.title.tr}>{faq.title.en}</h2>
    </div>
    <div class="faq reveal">
      {faq.items.map((item) => (
        <div class="faq-item">
          <button class="faq-q" type="button">
            <span data-tr={item.q.tr}>{item.q.en}</span>
            <span class="faq-ic">+</span>
          </button>
          <div class="faq-a"><p data-tr={item.a.tr}>{item.a.en}</p></div>
        </div>
      ))}
    </div>
  </div>
</section>
```

- [x] **Step 5: Create FinalCta.astro**

```astro
---
import { finalCta } from "../data/copy";
import { SIGNUP_URL } from "../data/site";
---

<section class="sec band">
  <div class="wrap">
    <div class="price-band reveal">
      <h2 class="disp h2" data-tr={finalCta.title.tr}>{finalCta.title.en}</h2>
      <a class="btn btn-primary btn-lg" href={SIGNUP_URL}>
        <span data-tr={finalCta.cta.tr}>{finalCta.cta.en}</span>
      </a>
      <div class="microcopy" style="margin-top:16px" data-tr={finalCta.microcopy.tr}>{finalCta.microcopy.en}</div>
    </div>
  </div>
</section>
```

- [x] **Step 6: Finish index.astro**

Replace the whole of `apps/landing/src/pages/index.astro` with:

```astro
---
import Base from "../layouts/Base.astro";
import Nav from "../components/Nav.astro";
import Hero from "../components/Hero.astro";
import ProofBar from "../components/ProofBar.astro";
import Sectors from "../components/Sectors.astro";
import InstaShowcase from "../components/InstaShowcase.astro";
import HowItWorks from "../components/HowItWorks.astro";
import StudioBlocks from "../components/StudioBlocks.astro";
import CaptionDemo from "../components/CaptionDemo.astro";
import PricingTeaser from "../components/PricingTeaser.astro";
import Faq from "../components/Faq.astro";
import FinalCta from "../components/FinalCta.astro";
import Footer from "../components/Footer.astro";
---

<Base>
  <Nav />
  <Hero />
  <ProofBar />
  <Sectors />
  <InstaShowcase />
  <HowItWorks />
  <StudioBlocks />
  <CaptionDemo />
  <PricingTeaser />
  <Faq />
  <FinalCta />
  <Footer />
</Base>

<script>
  import "../scripts/i18n";
  import "../scripts/reveal";
  import "../scripts/insta";
  import "../scripts/captions";
</script>
```

- [x] **Step 7: Update the page metadata**

In `apps/landing/src/layouts/Base.astro`, replace the `title` and `description` defaults (lines 9-10) with:

```ts
  title = "Sentezy — reels with an AI presenter",
  description = "Turn a product link or a script into a finished 9:16 reel with an AI presenter, viral captions and your brand kit. No filming, no editing.",
```

- [x] **Step 8: Build and verify — this must now pass clean**

```bash
pnpm --filter @sentezy/landing typecheck && pnpm --filter @sentezy/landing build && pnpm --filter @sentezy/landing verify
```
Actual: typecheck 0 errors across 27 files, build clean, **`verify OK — 25 checks passed`** —
green for the first time since the gate was written in Task 2.

**Deviations, both forced by deleting `.final-wash`:**
- The old closer's headline sizing (`.final .h2` 44px / 32px under 900px) lived in the same rules
  being deleted, so `FinalCta` carries a `final-cta` class and the sizing moves to `.final-cta`.
  Dropping it would have shrunk the closer to a normal 36px section heading.
- That 900px override had to be appended in its OWN media block at the end of the file, not added
  to the existing 900px block — the base `.final-cta .h2` rule is declared after it, and at equal
  specificity the later rule wins and the mobile size never applies.
- The plan's inline `style="margin-top:16px"` on the microcopy became `.final-cta .microcopy`.

- [x] **Step 9: Commit**

```bash
git add apps/landing/src
git commit -m "feat(landing): pricing teaser, honest FAQ, final CTA; index is now pure assembly"
```

---

### Task 10: Full verification sweep

**Files:**
- Modify: `apps/landing/package.json` (chain verify into build)
- Modify: any file where the sweep finds a defect

**Interfaces:**
- Consumes: everything.
- Produces: a page that satisfies every item in the spec's Testing section.

- [ ] **Step 1: Chain verify into the build**

In `apps/landing/package.json`, change the `build` script so a bad claim can never ship:

```json
    "build": "astro build && node scripts/verify.mjs",
```

Run `pnpm --filter @sentezy/landing build`. Expected: build succeeds and ends with `verify OK`.

- [ ] **Step 2: Full-repo build and typecheck**

Run:
```bash
pnpm build && pnpm typecheck
```
Expected: every workspace passes. The landing changes must not have broken `apps/web` or `apps/api`.

- [ ] **Step 3: Source-level grep for anything the dist check can miss**

Run:
```bash
grep -rnE '147M|122M|175\+|SOC 2|Northwind|Vertex|LUMEN|Kavis|Orbita|Meridian|Aster|Polar|digital twin|dijital ikiz|href="#"|ph-label|beam-stage|zig-media' apps/landing/src apps/landing/public 2>/dev/null
```
Expected: **no output**. Any hit is a leftover from an incomplete deletion — remove it.

- [ ] **Step 4: Confirm every string is bilingual**

Run:
```bash
grep -c 'data-tr' apps/landing/dist/index.html
```
Expected: a count above 90.

Then open `http://localhost:4321` (`pnpm --filter @sentezy/landing dev`), click `TR`, and scroll the whole page. Expected: no English text remains anywhere except the brand name `Sentezy`, `@sentezy.ai`, `KVKK`, `TikTok`, `Hormozi`, `Instagram` and the Instagram embeds' own chrome. Any English left over means a component hardcoded a string instead of reading `copy.ts` — fix it there.

- [ ] **Step 5: Responsive pass**

In DevTools, check the page at 1440px, 1024px, 768px and 390px widths.

Expected at every width:
- No horizontal scrollbar on `<body>`.
- The reel marquee stays inside its column and does not overflow.
- The Instagram embeds collapse to a single centred column below 900px.
- The nav menu hides below 900px (existing behaviour) and the CTA stays reachable.
- Text never overlaps an image.

- [ ] **Step 6: Reduced-motion pass**

In DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion: reduce", reload.

Expected: the reel columns are frozen, the caption demo is frozen on its first style, the Instagram skeleton shimmer is static, and every `.reveal` section is visible immediately rather than faded in.

- [ ] **Step 7: Confirm the third-party script stays lazy**

Reload with DevTools → Network open, filter `embed.js`, and do not scroll.

Expected: zero requests to `instagram.com/embed.js` until the showcase approaches the viewport.

- [ ] **Step 8: Commit**

```bash
git add apps/landing
git commit -m "chore(landing): gate the build on the claim-verification check"
```

- [ ] **Step 9: Assert the delivered image payload**

The source cutouts total ~22 MB. `astro:assets` must have downscaled them and emitted WebP.

Run:
```bash
du -sh apps/landing/dist
du -sh apps/landing/dist/_astro
ls apps/landing/dist/_astro | grep -cE '\.(webp|avif)$'
ls -1 apps/landing/src/assets/avatars/*.png | wc -l
```

Expected:
- `dist/_astro` is **under 3 MB** — if it is anywhere near 22 MB, the images are being copied
  unoptimized and something still references them by URL rather than through `<Image>`.
- The WebP/AVIF count is at least 12 (one or more variants per avatar).
- No `dist/avatars/` directory exists at all:
  ```bash
  test -d apps/landing/dist/avatars && echo "REGRESSION: avatars served unoptimized from public/" || echo "ok"
  ```
  Expected: `ok`.

If any of these fail, find the component still using a `src="/avatars/…"` string and convert it
to `astro:assets`.

- [ ] **Step 10: Report**

Summarise for the user:
- The verify output.
- Which of the three app screenshots were captured, and whether any block had to be cut.
- The final `dist/` page weight (`du -sh apps/landing/dist`).
- The open item: `PUBLIC_APP_URL` still defaults to `http://localhost:3000` and must be set in the Cloudflare Pages build before this goes live.

---

## Self-Review

**Spec coverage:** Positioning (Tasks 4, 5, 7) · art direction and the three lifted tokens (Task 2) · verified claims and deletion of invented ones (Tasks 2, 5, 10) · full page architecture (Tasks 4-9) · component decomposition (Tasks 3-9) · asset pipeline (Task 1) · lazy Instagram embeds with an empty-state fallback (Task 6) · studio screenshots with the cut-not-placeholder rule (Task 7) · caption demo (Task 8) · bilingual copy module (Task 3, extended by every later task) · outbound links (Task 3) · all six spec Testing items (Task 10 steps 1-7). No gaps.

**Deviations from spec, both deliberate and noted inline:** the export script lives in `apps/api` rather than `apps/landing` (the AWS SDK and R2 env already exist there); and `scripts/verify.mjs` was added, which the spec's Testing item 5 described as a manual grep — automating it and gating the build on it is strictly stronger.

**Type consistency:** `Copy` is defined once in Task 3 and reused by every later `satisfies Record<string, Copy>`. Sections using nested arrays (`sectors`, `how`, `studio`, `faq`, `captionDemo`) use `as const` instead, since `Record<string, Copy>` does not describe them — this is consistent across all five. `Still.tint` values match the six `.tile-<tint>` classes in Task 4. `Still.style` values match the six `.cap-<style>` classes, which Task 8 reuses via `captionDemo.styles[].id` — the same six ids in both places. Slugs in `stills.ts` match the 12 `displayImageId` entries verified against `apps/api/src/data/avatars.json`. Anchor ids are defined once and referenced consistently: `#showcase` (Task 6, linked from Tasks 3 and 4), `#how` and `#platform` (Task 7, linked from Task 3), `#sectors` (Task 5, linked from Task 3), `#captions` (Task 8, linked from Task 3).

**Placeholder scan:** every code step contains complete, runnable content. No TBDs.
