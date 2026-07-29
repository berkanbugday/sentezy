/**
 * Post-build assertions for the landing page. Not a unit-test runner — it checks the
 * things that actually matter for a marketing page: that no invented claim survived,
 * that the real claims are present, that no dead links shipped, and that no periwinkle
 * from the pre-monochrome palette leaked through.
 *
 * Walks every emitted page in both the English and Turkish trees. The old gate read
 * dist/index.html alone, so a dead link or a forbidden claim on /terms — or anywhere in
 * /tr/ — shipped unnoticed.
 *
 *   pnpm --filter @sentezy/landing verify   (runs after `build`)
 */
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(HERE, "../dist");

// Invented claims and unshipped features that must never come back.
// "dijital ikiz" (Turkish for "digital twin") is left from the bilingual build that was
// previously removed — the Turkish tree is real again now, so it needs guarding again.
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
//   126 catalogue presenters          → apps/api/src/data/avatars.json (total entries)
//   24 distinct sectors               → same file
//   20 caption styles                 → CAPTION_STYLE_META, packages/types/src/index.ts
//   14 b-roll effects                 → BROLL_EFFECT_META, packages/types/src/index.ts
// The hero demo is now the first thing on the page and the only place the product is shown.
// It is driven entirely by these two hooks: `data-hd` is what src/scripts/hero-demo.ts looks
// for, and `data-step` is what every rule in the demo's stylesheet keys off. If either stops
// being emitted the demo does not throw — it renders as a still, empty composer that never
// advances, which looks deliberate and would ship unnoticed. Asserted in both trees.
const HERO_DEMO = ["data-hd", 'data-step="idle"'];

const REQUIRED = [
  ">126<", ">24<", ">20<", ">14<",         // the four verified proof numbers
  "Let Sentezy make your videos. You just post them.", // hero headline
  "instagram.com/sentezy.ai",                // the real account is linked
  "Your video is ready",                     // the hero demo's payoff frame, in English
  ...HERO_DEMO,
];

// Claims that must be present in the Turkish tree. The four proof numbers are checked in
// BOTH trees — they trace to source files and are facts, not copy, so they never differ.
const REQUIRED_TR = [
  ">126<", ">24<", ">20<", ">14<",
  "Videolarınızı Sentezy hazırlasın, siz sadece paylaşın.",  // hero headline
  "instagram.com/sentezy.ai",
  "Videonuz hazır",                          // the hero demo's payoff frame, in Turkish
  ...HERO_DEMO,
];

/** Every .html file under dist/, recursively. The old gate read dist/index.html alone, so a
 *  dead link or a forbidden claim on /terms shipped unnoticed. */
async function allPages(dir = DIST, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await allPages(p, out);
    else if (e.name.endsWith(".html")) out.push([p, await readFile(p, "utf8")]);
  }
  return out;
}

/** Built CSS, concatenated, whitespace-stripped and lowercased, so `rgba(201, 169, 233, …)`
 *  and the minifier's `#C9A9E938` both match the same needle.
 *
 *  Declarations of the two shared-theme periwinkle tokens are stripped first.
 *  `packages/ui/theme.css` is shared with the web app and cannot be edited from here; it always
 *  declares `--color-signal: #7c86e8` (which the landing shadows with #18181b in its own :root)
 *  and `--color-aurora: #c9a9e9` (which the landing simply never consumes). Either way the
 *  declaration never paints. Only a color reaching an actual property value — a background, a
 *  gradient, a shadow — is a real leak. Without this the gate could never pass, and Task 10
 *  chains it into `build`.
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

/** Every in-page link on a Turkish page must stay in the Turkish tree.
 *
 *  Matches anchors only — <link rel="stylesheet" href="/_astro/…"> and the hreflang tags are
 *  supposed to point outside /tr/, and matching every href would flag them.
 *
 *  This is the gate for the design's highest-risk detail: an English-rooted href on a Turkish
 *  page produces no error, no warning and no visual defect. The page looks perfect and drops
 *  the visitor into English one click later. */
function localeLeaks(html) {
  const bad = [];
  // Case-insensitive, and accepts either quote style. An earlier draft matched only
  // lowercase <a and only href="…" — a leak written as href='/terms' or <A HREF> was
  // invisible to it, which is the precise silent failure this gate exists to prevent.
  for (const m of html.matchAll(/<a\s([^>]*?)href=["']([^"']*)["']([^>]*)>/gi)) {
    const attrs = m[1] + m[3];
    const href = m[2];

    // Leaving the site entirely, or staying on the page, is not a locale question.
    if (/^(https?:|mailto:|tel:|#)/i.test(href) || href.startsWith("//")) continue;

    // The language switcher's EN half legitimately points out of the Turkish tree — that is
    // the entire point of a switcher. It is identified by data-lang="en", not by its href,
    // so the exemption cannot be widened accidentally by some other link to the same path.
    // \b anchors it so a hypothetical xdata-lang="en" cannot claim the exemption.
    if (/\bdata-lang=["']en["']/.test(attrs)) continue;

    if (href === "/tr" || href.startsWith("/tr/")) continue;

    // Everything else is a leak — including a RELATIVE href. On a Turkish page "./terms"
    // resolves inside /tr/ today and outside it tomorrow depending on the emitting page's
    // depth. The project routes every internal link through localeHref, which always emits
    // an absolute path, so a relative href here means something bypassed that helper.
    bad.push(href);
  }
  return bad;
}

/** Every page in both trees must carry all three alternates, each pointing at a real absolute
 *  URL. A Turkish page orphaned from its English twin is invisible to Google as a translation,
 *  which is the entire point of building two trees.
 *
 *  Checks the href, not just the label. An earlier draft substring-matched `hreflang="tr"` and
 *  nothing else, so a tag with an empty or wrong href passed a check named "pairing" — and so
 *  would the literal text `hreflang="tr"` appearing anywhere in the body copy. */
function hreflangProblems(html) {
  const found = new Map();
  for (const m of html.matchAll(/<link\s[^>]*hreflang=["']([^"']+)["'][^>]*>/gi)) {
    found.set(m[1], /href=["']([^"']*)["']/i.exec(m[0])?.[1] ?? "");
  }
  const problems = [];
  for (const h of ["en", "tr", "x-default"]) {
    if (!found.has(h)) problems.push(`missing hreflang="${h}"`);
    else if (!/^https?:\/\/\S+/.test(found.get(h)))
      problems.push(`hreflang="${h}" href is empty or not absolute: ${JSON.stringify(found.get(h))}`);
  }
  return problems;
}

/** The tree a page lives in and the language it declares must agree. This is the cheap,
 *  structural half of cross-contamination detection: REQUIRED/REQUIRED_TR assert real copy but
 *  only on the two home pages, so a sub-page rendering the wrong locale would otherwise ship
 *  unnoticed. It catches misrouting, not mistranslation — see the limitation noted below.
 *
 *  Known limitation, deliberately accepted: a Turkish sub-page whose *body copy* silently
 *  rendered English would still pass this check — its `lang` attribute would be correct.
 *  Closing that properly needs per-page language assertions, which is a follow-up. */
function wrongHtmlLang(rel, html) {
  const lang = /<html[^>]*\slang=["']([^"']*)["']/i.exec(html)?.[1] ?? "";
  const expected = rel.startsWith("tr/") ? "tr" : "en";
  return lang === expected ? null : `<html lang="${lang}"> on a page in the ${expected} tree`;
}

async function main() {
  const pages = await allPages();
  if (pages.length === 0) throw new Error(`no HTML emitted to ${DIST} — nothing to verify`);

  const css = await builtCss();
  const rel = (p) => p.slice(DIST.length + 1);
  const page = (name) => pages.find(([p]) => rel(p) === name)?.[1] ?? "";

  const en = page("index.html");
  const tr = page("tr/index.html");
  if (!en) throw new Error("dist/index.html missing");
  if (!tr) throw new Error("dist/tr/index.html missing — the Turkish tree did not build");

  const failures = [
    // Forbidden claims now sweep every page, not just the index.
    ...pages.flatMap(([p, html]) => [
      ...FORBIDDEN_TEXT.filter((n) => html.includes(n))
        .map((n) => `forbidden claim in ${rel(p)}: ${JSON.stringify(n)}`),
      ...FORBIDDEN_WORDS.filter((w) => new RegExp(`\\b${w}\\b`).test(html))
        .map((w) => `fake customer logo in ${rel(p)}: ${w}`),
      ...hreflangProblems(html).map((h) => `${rel(p)}: ${h}`),
      ...[wrongHtmlLang(rel(p), html)].filter(Boolean).map((h) => `${rel(p)}: ${h}`),
    ]),
    // Locale leaks: Turkish pages only.
    ...pages
      .filter(([p]) => rel(p).startsWith("tr/"))
      .flatMap(([p, html]) =>
        localeLeaks(html).map(
          (href) => `locale leak in ${rel(p)}: <a href="${href}"> escapes the Turkish tree`,
        ),
      ),
    ...FORBIDDEN_CSS.filter((n) => css.includes(n))
      .map((n) => `periwinkle literal in built CSS: ${n} — a hardcoded color the token retheme could not reach`),
    ...REQUIRED.filter((n) => !en.includes(n))
      .map((n) => `required claim missing from index.html: ${JSON.stringify(n)}`),
    ...REQUIRED_TR.filter((n) => !tr.includes(n))
      .map((n) => `required claim missing from tr/index.html: ${JSON.stringify(n)}`),
  ];

  if (failures.length) {
    for (const f of failures) console.error(f);
    console.error(`\nverify FAILED — ${failures.length} problem(s)`);
    process.exit(1);
  }

  console.log(`verify OK — ${pages.length} page(s) checked`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
