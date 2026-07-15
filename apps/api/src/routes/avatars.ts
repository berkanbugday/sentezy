import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@sentezy/db";
import { signedDownloadUrl, signedUploadUrl } from "../lib/r2";

const CreateAvatar = z.object({ name: z.string().min(1).max(80), sourceImageId: z.string().optional() });

// Filters run in the DB (avatar_catalog, seeded from data/avatars.json). hijab is a query
// string ("true"/"false") so it round-trips through the URL cleanly.
const AvatarQuery = z.object({
  sector: z.string().optional(),
  gender: z.enum(["kadın", "erkek"]).optional(),
  age: z.enum(["genç", "yetişkin", "olgun"]).optional(),
  hijab: z.enum(["true", "false"]).optional(),
});

export async function avatarRoutes(app: FastifyInstance) {
  // The avatar library shown in the picker — the curated catalog with filter metadata,
  // filtered in the DB. Pending avatars (no image yet) come back ready:false with no
  // imageUrl so the picker can show the whole library and light each tile up as it lands.
  app.get("/avatars", async (req) => {
    const q = AvatarQuery.safeParse(req.query);
    const f = q.success ? q.data : {};
    const rows = await prisma.catalogAvatar.findMany({
      where: {
        ...(f.sector ? { sector: f.sector } : {}),
        ...(f.gender ? { gender: f.gender } : {}),
        ...(f.age ? { age: f.age } : {}),
        ...(f.hijab !== undefined ? { hijab: f.hijab === "true" } : {}),
      },
      orderBy: { createdAt: "asc" }, // preserves the authored catalog order
    });
    const avatars = await Promise.all(
      rows.map(async (a) => ({
        id: a.imageKey, // green-screen source R2 key for HeyGen ("" while pending)
        slug: a.slug,
        name: a.name,
        sector: a.sector,
        sectorLabel: a.sectorLabel,
        gender: a.gender,
        age: a.age,
        hijab: a.hijab,
        ready: Boolean(a.imageKey),
        // picker shows the matted thumbnail; fall back to the source if it's missing
        imageUrl: a.displayImageKey ? await signedDownloadUrl(a.displayImageKey) : a.imageKey ? await signedDownloadUrl(a.imageKey) : "",
      })),
    );
    // Distinct sectors in catalog order — powers the picker's filter chips.
    const sectorRows = await prisma.catalogAvatar.findMany({
      distinct: ["sector"],
      select: { sector: true, sectorLabel: true },
      orderBy: { createdAt: "asc" },
    });
    const sectors = sectorRows.map((s) => ({ slug: s.sector, label: s.sectorLabel }));
    return { avatars, sectors };
  });

  // The user's own created avatars (records instantiated from a catalog pick or upload).
  app.get("/avatars/mine", { preHandler: app.authenticate }, async (req) => {
    const rows = await prisma.avatar.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
    });
    // The web preview needs a ready delivery URL — a signed R2 GET (keys are server-only).
    const avatars = await Promise.all(
      rows.map(async (a) => ({ ...a, imageUrl: await signedDownloadUrl(a.previewImageId ?? a.sourceImageId) })),
    );
    return { avatars };
  });

  app.post("/avatars", { preHandler: app.authenticate }, async (req, reply) => {
    const body = CreateAvatar.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_body", details: body.error.flatten() });
    }

    // Selecting a preset avatar — reference the existing image, no upload.
    if (body.data.sourceImageId) {
      const known = await prisma.catalogAvatar.findFirst({ where: { imageKey: body.data.sourceImageId } });
      if (!known) {
        return reply.code(400).send({ error: "unknown_avatar" });
      }
      const avatar = await prisma.avatar.create({
        data: { userId: req.user!.id, name: body.data.name, sourceImageId: body.data.sourceImageId, status: "ready" },
      });
      return { avatar, imageUrl: await signedDownloadUrl(avatar.sourceImageId) };
    }

    // Custom photo: create an avatar + a presigned R2 PUT (client uploads the raw file).
    const key = `avatars/${randomUUID()}.png`;
    const uploadURL = await signedUploadUrl(key, "image/png");
    const avatar = await prisma.avatar.create({
      data: { userId: req.user!.id, name: body.data.name, sourceImageId: key, status: "pending" },
    });
    return { avatar, uploadURL, imageUrl: await signedDownloadUrl(key, 86400) };
  });
}
