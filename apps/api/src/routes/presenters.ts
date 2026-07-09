import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@sentezy/db";
import { createDirectUpload, imageUrl } from "../lib/cloudflareImages";

const CreatePresenter = z.object({ name: z.string().min(1).max(80), sourceImageId: z.string().optional() });

// Curated AI presenter avatars (Cloudflare Images ids). Users pick one — no upload.
const AVATARS = [
  { id: "be5e4625-aaa8-447e-9fb3-c1660d5db500", name: "Defne" },
  { id: "d0c8da36-50df-4e58-c459-81ccd198fe00", name: "Kerem" },
  { id: "f3fe5310-8212-49cf-69bb-81ee18d47800", name: "Selin" },
  { id: "1a88b800-f411-454d-1fc3-ae5ac854b700", name: "Emre" },
];
const AVATAR_IDS = new Set(AVATARS.map((a) => a.id));

export async function presenterRoutes(app: FastifyInstance) {
  // The avatar library shown in the picker.
  app.get("/avatars", async () => ({
    avatars: AVATARS.map((a) => ({ ...a, imageUrl: imageUrl(a.id) })),
  }));

  app.get("/presenters", { preHandler: app.authenticate }, async (req) => {
    const rows = await prisma.presenter.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
    });
    // The web preview needs a ready delivery URL (the account hash is server-only).
    const presenters = rows.map((p) => ({ ...p, imageUrl: imageUrl(p.previewImageId ?? p.sourceImageId) }));
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
      return { presenter, imageUrl: imageUrl(presenter.sourceImageId) };
    }

    // Legacy: create a presenter + a one-time Cloudflare Images upload URL.
    const upload = await createDirectUpload();
    const presenter = await prisma.presenter.create({
      data: { userId: req.user!.id, name: body.data.name, sourceImageId: upload.id, status: "pending" },
    });
    return { presenter, uploadURL: upload.uploadURL, imageUrl: imageUrl(upload.id) };
  });
}
