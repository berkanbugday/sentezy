import type { FastifyInstance } from "fastify";
import { Prisma, prisma } from "@sentezy/db";
import { type AspectRatio, CreateVideoRequest } from "@sentezy/types";
import { enqueueVideo } from "../lib/redis";
import { imageUrl } from "../lib/cloudflareImages";
import { publicUrl, signedDownloadUrl } from "../lib/r2";

const CREDIT_COST = 1;

// zod AspectRatio ("9:16") → Prisma enum member ("r9_16")
const RATIO: Record<AspectRatio, "r9_16" | "r1_1" | "r16_9"> = {
  "9:16": "r9_16",
  "1:1": "r1_1",
  "16:9": "r16_9",
};

export async function videoRoutes(app: FastifyInstance) {
  app.get("/videos", { preHandler: app.authenticate }, async (req) => {
    const videos = await prisma.video.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
    });
    return { videos };
  });

  app.get("/videos/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const video = await prisma.video.findFirst({ where: { id, userId: req.user!.id } });
    if (!video) return reply.code(404).send({ error: "not_found" });

    let downloadUrl: string | null = null;
    if (video.outputKey) downloadUrl = publicUrl(video.outputKey) ?? (await signedDownloadUrl(video.outputKey));
    const thumbnailUrl = video.thumbnailImageId ? imageUrl(video.thumbnailImageId) : null;
    return { video, downloadUrl, thumbnailUrl };
  });

  app.post("/videos", { preHandler: app.authenticate }, async (req, reply) => {
    const parsed = CreateVideoRequest.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    const userId = req.user!.id;
    const input = parsed.data;

    const presenter = await prisma.presenter.findFirst({ where: { id: input.presenterId, userId } });
    if (!presenter) return reply.code(400).send({ error: "invalid_presenter" });
    const voice = await prisma.voice.findFirst({
      where: { id: input.voiceId, OR: [{ isPublic: true }, { userId }] },
    });
    if (!voice) return reply.code(400).send({ error: "invalid_voice" });

    try {
      const video = await prisma.$transaction(async (tx) => {
        const debit = await tx.profile.updateMany({
          where: { id: userId, credits: { gte: CREDIT_COST } },
          data: { credits: { decrement: CREDIT_COST } },
        });
        if (debit.count === 0) throw new Error("insufficient_credits");
        const v = await tx.video.create({
          data: {
            userId,
            title: input.title,
            script: input.script,
            presenterId: input.presenterId,
            voiceId: input.voiceId,
            aspectRatio: RATIO[input.aspectRatio],
            options: input.options as unknown as Prisma.InputJsonValue,
            status: "queued",
            creditsCost: CREDIT_COST,
          },
        });
        await tx.creditLedger.create({
          data: { userId, delta: -CREDIT_COST, reason: "video_create", videoId: v.id },
        });
        await tx.job.create({ data: { videoId: v.id, status: "queued" } });
        return v;
      });

      await enqueueVideo({ videoId: video.id, userId });
      return reply.code(201).send({ video });
    } catch (e) {
      if (e instanceof Error && e.message === "insufficient_credits") {
        return reply.code(402).send({ error: "insufficient_credits" });
      }
      throw e;
    }
  });
}
