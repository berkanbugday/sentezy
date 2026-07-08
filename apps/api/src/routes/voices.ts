import type { FastifyInstance } from "fastify";
import { prisma } from "@sentezy/db";

export async function voiceRoutes(app: FastifyInstance) {
  app.get("/voices", { preHandler: app.authenticate }, async (req) => {
    const userId = req.user!.id;
    const voices = await prisma.voice.findMany({
      where: { OR: [{ isPublic: true }, { userId }] },
      orderBy: { label: "asc" },
    });
    return { voices };
  });
}
