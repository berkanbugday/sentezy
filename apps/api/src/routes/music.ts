import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@sentezy/db";
import { signedDownloadUrl } from "../lib/r2";

// Curated, license-free background beds. The catalog lives in the DB (music_catalog,
// seeded from data/music.json); the audio itself lives in R2 and is served signed.
const MusicQuery = z.object({ mood: z.string().optional() });

export async function musicRoutes(app: FastifyInstance) {
  app.get("/music", async (req) => {
    const q = MusicQuery.safeParse(req.query);
    const f = q.success ? q.data : {};
    const rows = await prisma.catalogMusic.findMany({
      where: { ...(f.mood ? { mood: f.mood } : {}) },
      orderBy: { createdAt: "asc" }, // preserves the authored catalog order
    });
    const music = await Promise.all(
      rows.map(async (t) => ({
        key: t.r2Key, // what gets stored in options.music.trackKey
        slug: t.slug,
        name: t.name,
        mood: t.mood,
        moodLabel: t.moodLabel,
        durationSec: t.durationSec,
        previewUrl: await signedDownloadUrl(t.r2Key),
      })),
    );
    // Distinct moods in catalog order — powers the picker's filter chips.
    const moodRows = await prisma.catalogMusic.findMany({
      distinct: ["mood"],
      select: { mood: true, moodLabel: true },
      orderBy: { createdAt: "asc" },
    });
    return { music, moods: moodRows.map((m) => ({ slug: m.mood, label: m.moodLabel })) };
  });
}
