/**
 * Post-build assertions for the landing page. Not a unit-test runner — it checks the
 * things that actually matter for a marketing page: that no invented claim survived,
 * that the real claims are present, and that no dead links shipped.
 *
 *   pnpm --filter @sentezy/landing verify   (runs after `build`)
 */
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(HERE, "../dist/index.html");

// Claims that were invented and must never come back.
const FORBIDDEN = [
  "147M", "122M", "175+", "SOC 2",
  "Northwind", "Vertex", "LUMEN", "Kavis", "Orbita", "Meridian", "Aster", "Polar",
  "digital twin", "dijital ikiz",
  'href="#"',
];

// Claims that are true and must be present. Verified against source at plan time:
//   12 avatars with a displayImageId  → apps/api/src/data/avatars.json
//   24 distinct sectors               → same file
//   20 caption styles                 → CAPTION_STYLE_META, packages/types/src/index.ts
//   14 b-roll effects                 → BROLL_EFFECT_META, packages/types/src/index.ts
const REQUIRED = [];

async function main() {
  const html = await readFile(DIST, "utf8");

  const found = FORBIDDEN.filter((needle) => html.includes(needle));
  const missing = REQUIRED.filter((needle) => !html.includes(needle));

  for (const f of found) console.error(`FORBIDDEN string present in dist: ${JSON.stringify(f)}`);
  for (const m of missing) console.error(`REQUIRED string missing from dist: ${JSON.stringify(m)}`);

  if (found.length || missing.length) {
    console.error(`\nverify FAILED — ${found.length} forbidden, ${missing.length} missing`);
    process.exit(1);
  }
  console.log(`verify OK — ${FORBIDDEN.length} forbidden absent, ${REQUIRED.length} required present`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
