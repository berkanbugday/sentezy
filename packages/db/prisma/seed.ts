import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const here = dirname(fileURLToPath(import.meta.url));

// Starter ElevenLabs voice catalog (prebuilt public voices).
// Verify IDs against your ElevenLabs account; prebuilt IDs are stable but plan-dependent.
const VOICES = [
  { elevenlabsVoiceId: "21m00Tcm4TlvDq8ikWAM", label: "Rachel", gender: "female", style: "calm, narration" },
  { elevenlabsVoiceId: "EXAVITQu4vr4xnSDxMaL", label: "Bella", gender: "female", style: "soft, friendly" },
  { elevenlabsVoiceId: "pNInz6obpgDQGcFmaJgB", label: "Adam", gender: "male", style: "deep, corporate" },
  { elevenlabsVoiceId: "ErXwobaYiN019PkySvjV", label: "Antoni", gender: "male", style: "warm, energetic" },
];

// The avatar library lives in apps/api/src/data/avatars.json (authored by the worker's
// build_avatar_catalog.py, image keys filled by generate_avatars.py). It's the seed
// source for the avatar_catalog table; re-run this seed after regenerating portraits.
type CatalogEntry = {
  slug: string;
  name: string;
  sector: string;
  sectorLabel: string;
  gender: string;
  age: string;
  ethnicity: string;
  hijab?: boolean;
  imageId?: string;
  displayImageId?: string;
};

function loadAvatarCatalog(): CatalogEntry[] {
  const path = join(here, "../../../apps/api/src/data/avatars.json");
  const data = JSON.parse(readFileSync(path, "utf8")) as { avatars: CatalogEntry[] };
  return data.avatars;
}

async function seedVoices() {
  for (const v of VOICES) {
    // No unique constraint on elevenlabs_voice_id, so upsert-by-find to stay idempotent.
    const existing = await prisma.voice.findFirst({
      where: { elevenlabsVoiceId: v.elevenlabsVoiceId, isPublic: true },
    });
    if (existing) {
      await prisma.voice.update({ where: { id: existing.id }, data: v });
    } else {
      await prisma.voice.create({ data: { ...v, isPublic: true } });
    }
  }
  const count = await prisma.voice.count({ where: { isPublic: true } });
  console.log(`Seeded voices — ${count} public voice(s) in catalog.`);
}

async function seedAvatarCatalog() {
  const catalog = loadAvatarCatalog();
  for (const a of catalog) {
    const fields = {
      name: a.name,
      sector: a.sector,
      sectorLabel: a.sectorLabel,
      gender: a.gender,
      age: a.age,
      ethnicity: a.ethnicity,
      hijab: Boolean(a.hijab),
      imageKey: a.imageId ?? "",
      displayImageKey: a.displayImageId ?? "",
    };
    // Idempotent upsert keyed by the stable slug — safe to re-run after regeneration.
    await prisma.catalogAvatar.upsert({
      where: { slug: a.slug },
      create: { slug: a.slug, ...fields },
      update: fields,
    });
  }
  const total = await prisma.catalogAvatar.count();
  const ready = await prisma.catalogAvatar.count({ where: { NOT: { imageKey: "" } } });
  console.log(`Seeded avatar catalog — ${total} personas (${ready} with portraits).`);
}

type MusicEntry = {
  slug: string;
  name: string;
  mood: string;
  moodLabel: string;
  r2Key: string;
  durationSec: number;
  source: string;
  license: string;
};

function loadMusicCatalog(): MusicEntry[] {
  const path = join(here, "../../../apps/api/src/data/music.json");
  const data = JSON.parse(readFileSync(path, "utf8")) as { tracks: MusicEntry[] };
  return data.tracks;
}

async function seedMusicCatalog() {
  const tracks = loadMusicCatalog();
  for (const t of tracks) {
    const fields = {
      name: t.name,
      mood: t.mood,
      moodLabel: t.moodLabel,
      r2Key: t.r2Key,
      durationSec: t.durationSec,
      source: t.source,
      license: t.license,
    };
    // Idempotent upsert keyed by the stable slug — safe to re-run after adding tracks.
    await prisma.catalogMusic.upsert({
      where: { slug: t.slug },
      update: fields,
      create: { slug: t.slug, ...fields },
    });
  }
  // Prune rows whose slug is no longer in music.json — upsert alone never deletes, so a
  // track removed from the file (e.g. a license takedown) would otherwise leave an orphan
  // DB row pointing at an R2 object that no longer exists. Keep the table an exact mirror
  // of the file.
  //
  // Guard: Prisma compiles `notIn: []` to SQL `WHERE 1=1`, which matches every row — so if
  // `keepSlugs` is empty (music.json parsed but its tracks array is empty), the deleteMany
  // below would wipe the ENTIRE live table instead of doing nothing. An empty catalog file
  // is overwhelmingly more likely to be a mistake (bad hand-edit, mis-resolved merge
  // conflict, upstream script bug) than a deliberate "delete everything" instruction, so we
  // refuse to prune in that case and leave existing rows untouched.
  const keepSlugs = tracks.map((t) => t.slug);
  if (keepSlugs.length === 0) {
    console.warn(
      "WARNING: music.json has zero tracks — skipping prune to avoid wiping the catalog. " +
        "If this is intentional, delete rows manually.",
    );
  } else {
    const { count: removed } = await prisma.catalogMusic.deleteMany({
      where: { slug: { notIn: keepSlugs } },
    });
    if (removed > 0) {
      console.log(`Pruned ${removed} music track(s) no longer in music.json.`);
    }
  }
  console.log(`Seeded music — ${await prisma.catalogMusic.count()} track(s) in catalog.`);
}

async function main() {
  await seedVoices();
  await seedAvatarCatalog();
  await seedMusicCatalog();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
