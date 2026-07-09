import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@sentezy/db";
import { createDirectUpload, imageUrl } from "../lib/cloudflareImages";

const CreatePresenter = z.object({ name: z.string().min(1).max(80) });

export async function presenterRoutes(app: FastifyInstance) {
  app.get("/presenters", { preHandler: app.authenticate }, async (req) => {
    const rows = await prisma.presenter.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
    });
    // The web preview needs a ready delivery URL (the account hash is server-only).
    const presenters = rows.map((p) => ({ ...p, imageUrl: imageUrl(p.previewImageId ?? p.sourceImageId) }));
    return { presenters };
  });

  // Create a presenter and return a one-time Cloudflare Images upload URL for the photo.
  app.post("/presenters", { preHandler: app.authenticate }, async (req, reply) => {
    const body = CreatePresenter.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_body", details: body.error.flatten() });
    }
    const upload = await createDirectUpload();
    const presenter = await prisma.presenter.create({
      data: {
        userId: req.user!.id,
        name: body.data.name,
        sourceImageId: upload.id,
        status: "pending",
      },
    });
    return { presenter, uploadURL: upload.uploadURL, imageUrl: imageUrl(upload.id) };
  });
}
