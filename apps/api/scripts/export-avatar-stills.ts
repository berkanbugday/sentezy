/**
 * One-shot: export the rendered avatar cutouts from R2 into the landing page's
 * public/ folder, so the Astro build stays fully static (Cloudflare Pages does
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

const EXPECTED_COUNT = 12;

async function main(): Promise<void> {
  const avatars = (catalog.avatars as CatalogAvatar[]).filter((a) => a.displayImageId);
  if (avatars.length !== EXPECTED_COUNT) {
    throw new Error(
      `expected exactly ${EXPECTED_COUNT} avatars with a displayImageId, found ${avatars.length} — ` +
        `later tasks (src/data/stills.ts) hardcode all ${EXPECTED_COUNT} slugs, so a drift here silently breaks them. ` +
        `Check apps/api/src/data/avatars.json.`,
    );
  }

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
