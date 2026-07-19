#!/usr/bin/env node
// Add a background-music track to the catalog: download → probe duration → upload to R2 →
// append to apps/api/src/data/music.json. Re-run `pnpm --filter @sentezy/db seed` afterwards.
//
//   node scripts/add-music.mjs <url> --slug=lofi-chill --name="Lofi" \
//     --mood=calm --mood-label="Sakin" --license="Pixabay Content License"
//
// Remove a track (deletes the R2 object and the music.json entry — does NOT touch the
// database directly; re-run the seed afterwards so seedMusicCatalog prunes the DB row):
//
//   node scripts/add-music.mjs --remove=lofi-chill
//
// Needs ffprobe on PATH and the R2 credentials from .env.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const [url, ...rest] = process.argv.slice(2);
const flag = (n) => rest.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const jsonPath = new URL("../apps/api/src/data/music.json", import.meta.url).pathname;

function makeS3() {
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT ?? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

// --remove mode: delete the R2 object and the music.json entry for an existing slug.
const removeSlug = flag("remove") ?? (url?.startsWith("--remove=") ? url.slice(9) : undefined);
if (removeSlug) {
  const catalog = JSON.parse(readFileSync(jsonPath, "utf8"));
  const entry = catalog.tracks.find((t) => t.slug === removeSlug);
  if (!entry) {
    console.error(`no track with slug "${removeSlug}" in music.json`);
    process.exit(1);
  }

  // Write music.json BEFORE deleting the R2 object — not after. If the process dies
  // between the two steps (crash, write failure, kill signal), we want the failure mode
  // to be an orphaned R2 object (invisible, harmless, cleanable later) rather than a
  // catalog row/JSON entry that still points at an object we already deleted (a dangling
  // reference that breaks the music picker at runtime once the next seed run picks it
  // up). Do not reorder this back to delete-then-write.
  catalog.tracks = catalog.tracks.filter((t) => t.slug !== removeSlug);
  writeFileSync(jsonPath, `${JSON.stringify(catalog, null, 2)}\n`);

  const s3 = makeS3();
  await s3.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: entry.r2Key }));

  console.log(`removed ${removeSlug} → deleted ${entry.r2Key} from R2 and its music.json entry`);
  process.exit(0);
}

const slug = flag("slug");
const name = flag("name");
const mood = flag("mood");
const moodLabel = flag("mood-label") ?? mood;
const license = flag("license") ?? "";

if (!url || !slug || !name || !mood) {
  console.error("usage: add-music.mjs <url> --slug= --name= --mood= [--mood-label=] [--license=]");
  console.error("       add-music.mjs --remove=<slug>");
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
const s3 = makeS3();
await s3.send(new PutObjectCommand({
  Bucket: process.env.R2_BUCKET,
  Key: key,
  Body: readFileSync(local),
  ContentType: "audio/mpeg",
}));

const catalog = JSON.parse(readFileSync(jsonPath, "utf8"));
catalog.tracks = catalog.tracks.filter((t) => t.slug !== slug);
catalog.tracks.push({ slug, name, mood, moodLabel, r2Key: key, durationSec, source: url, license });
writeFileSync(jsonPath, `${JSON.stringify(catalog, null, 2)}\n`);

console.log(`added ${slug} (${durationSec}s) → ${key}`);
