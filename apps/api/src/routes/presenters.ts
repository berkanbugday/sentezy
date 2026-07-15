import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@sentezy/db";
import { signedDownloadUrl, signedUploadUrl } from "../lib/r2";
import catalog from "../data/avatars.json";

const CreatePresenter = z.object({ name: z.string().min(1).max(80), sourceImageId: z.string().optional() });

type CatalogAvatar = {
  slug: string;
  name: string;
  sector: string;
  sectorLabel: string;
  gender: "kadın" | "erkek";
  age: "genç" | "yetişkin" | "olgun";
  ethnicity: string;
  imageId: string; // green-screen source (fed to HeyGen), or "" while still being generated
  displayImageId: string; // matted transparent thumbnail for the picker (may be "")
  prompt: string;
};

// The full 100-avatar library (apps/api/src/data/avatars.json, built by the worker's
// build_avatar_catalog.py). Avatars with an empty imageId are still pending generation.
const CATALOG = catalog.avatars as CatalogAvatar[];
// Only avatars with a real image can be picked (HeyGen needs the source photo).
const READY = CATALOG.filter((a) => a.imageId);
const AVATAR_IDS = new Set(READY.map((a) => a.imageId));

// Distinct sectors, in catalog order — powers the picker's filter chips.
const SECTORS = [...new Map(CATALOG.map((a) => [a.sector, a.sectorLabel])).entries()].map(
  ([slug, label]) => ({ slug, label }),
);

const AvatarQuery = z.object({
  sector: z.string().optional(),
  gender: z.enum(["kadın", "erkek"]).optional(),
  age: z.enum(["genç", "yetişkin", "olgun"]).optional(),
});

export async function presenterRoutes(app: FastifyInstance) {
  // The avatar library shown in the picker — full catalog with filter metadata.
  // Pending avatars are returned with ready:false and no imageUrl so the picker can
  // show the whole library and light each tile up as its portrait lands.
  app.get("/avatars", async (req) => {
    const q = AvatarQuery.safeParse(req.query);
    const f = q.success ? q.data : {};
    const avatars = await Promise.all(
      CATALOG.filter(
        (a) => (!f.sector || a.sector === f.sector) && (!f.gender || a.gender === f.gender) && (!f.age || a.age === f.age),
      ).map(async (a) => ({
        id: a.imageId, // green-screen source for HeyGen ("" while pending) — now an R2 key
        slug: a.slug,
        name: a.name,
        sector: a.sector,
        sectorLabel: a.sectorLabel,
        gender: a.gender,
        age: a.age,
        ready: Boolean(a.imageId),
        // picker shows the matted thumbnail; fall back to the source if it's missing
        imageUrl: a.displayImageId ? await signedDownloadUrl(a.displayImageId) : a.imageId ? await signedDownloadUrl(a.imageId) : "",
      })),
    );
    return { avatars, sectors: SECTORS };
  });

  app.get("/presenters", { preHandler: app.authenticate }, async (req) => {
    const rows = await prisma.presenter.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
    });
    // The web preview needs a ready delivery URL — a signed R2 GET (keys are server-only).
    const presenters = await Promise.all(
      rows.map(async (p) => ({ ...p, imageUrl: await signedDownloadUrl(p.previewImageId ?? p.sourceImageId) })),
    );
    return { presenters };
  });

  app.post("/presenters", { preHandler: app.authenticate }, async (req, reply) => {
    const body = CreatePresenter.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_body", details: body.error.flatten() });
    }

    // Selecting a preset avatar — reference the existing image, no upload.
    if (body.data.sourceImageId) {
      if (!AVATAR_IDS.has(body.data.sourceImageId)) {
        return reply.code(400).send({ error: "unknown_avatar" });
      }
      const presenter = await prisma.presenter.create({
        data: { userId: req.user!.id, name: body.data.name, sourceImageId: body.data.sourceImageId, status: "ready" },
      });
      return { presenter, imageUrl: await signedDownloadUrl(presenter.sourceImageId) };
    }

    // Custom photo: create a presenter + a presigned R2 PUT (client uploads the raw file).
    const key = `presenters/${randomUUID()}.png`;
    const uploadURL = await signedUploadUrl(key, "image/png");
    const presenter = await prisma.presenter.create({
      data: { userId: req.user!.id, name: body.data.name, sourceImageId: key, status: "pending" },
    });
    return { presenter, uploadURL, imageUrl: await signedDownloadUrl(key, 86400) };
  });
}
