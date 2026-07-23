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
//   126 catalogue presenters          → apps/api/src/data/avatars.json (total entries)
//   24 distinct sectors               → same file
//   20 caption styles                 → CAPTION_STYLE_META, packages/types/src/index.ts
//   14 b-roll effects                 → BROLL_EFFECT_META, packages/types/src/index.ts
const REQUIRED = [
  ">126<", ">24<", ">20<", ">14<",         // the four verified proof numbers
  "Post every day without filming a thing.", // hero headline
  "instagram.com/sentezy.ai",                // the real account is linked
];

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
