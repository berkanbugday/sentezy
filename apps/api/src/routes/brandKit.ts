import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@sentezy/db";
import { signedDownloadUrl, signedUploadUrl } from "../lib/r2";

// The user's brand kit: logo, name, colour, and optional uploaded intro/outro clips.
// One row per user. A video never references this row — switching branding on snapshots
// it into videos.options.branding, so editing the kit does not retroactively change
// videos that have already been made.

const UpdateBrandKit = z.object({
  brandName: z.string().max(60).nullable().optional(),
  handle: z.string().max(40).nullable().optional(),
  logoKey: z.string().max(200).nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  font: z.string().max(60).optional(),
  outroCta: z.string().max(40).nullable().optional(),
  // A clip is only usable with its duration: the value shifts the voiceover for the whole
  // reel, so key and length must be set (or cleared) together. Enforced below.
  introClipKey: z.string().max(200).nullable().optional(),
  introClipMs: z.number().int().positive().nullable().optional(),
  outroClipKey: z.string().max(200).nullable().optional(),
  outroClipMs: z.number().int().positive().nullable().optional(),
});

const DEFAULTS = {
  brandName: null,
  handle: null,
  logoKey: null,
  color: "#0A0A0B",
  font: "General Sans",
  outroCta: null,
  introClipKey: null,
  introClipMs: null,
  outroClipKey: null,
  outroClipMs: null,
};

type KitRow = {
  brandName: string | null;
  handle: string | null;
  logoKey: string | null;
  color: string;
  font: string;
  outroCta: string | null;
  introClipKey: string | null;
  introClipMs: number | null;
  outroClipKey: string | null;
  outroClipMs: number | null;
};

/** Shape returned to the client: the stored keys plus freshly signed URLs to preview them.
 *  Projected field by field rather than spread, so a saved kit and the defaults returned for
 *  a user with no row have EXACTLY the same keys — otherwise the client would see id/userId/
 *  timestamps appear and disappear depending on whether the row exists. Those columns are
 *  internal anyway and nothing on the screen needs them. */
async function present(kit: KitRow) {
  return {
    brandName: kit.brandName,
    handle: kit.handle,
    logoKey: kit.logoKey,
    color: kit.color,
    font: kit.font,
    outroCta: kit.outroCta,
    introClipKey: kit.introClipKey,
    introClipMs: kit.introClipMs,
    outroClipKey: kit.outroClipKey,
    outroClipMs: kit.outroClipMs,
    logoUrl: kit.logoKey ? await signedDownloadUrl(kit.logoKey, 86400) : null,
    introClipUrl: kit.introClipKey ? await signedDownloadUrl(kit.introClipKey, 86400) : null,
    outroClipUrl: kit.outroClipKey ? await signedDownloadUrl(kit.outroClipKey, 86400) : null,
  };
}

export async function brandKitRoutes(app: FastifyInstance) {
  // Never 404: a user who has never opened the screen still needs it to render, so an
  // absent row is returned as the defaults rather than an error.
  app.get("/brand-kit", { preHandler: app.authenticate }, async (req) => {
    const kit = await prisma.brandKit.findUnique({ where: { userId: req.user!.id } });
    return present(kit ?? DEFAULTS);
  });

  app.put("/brand-kit", { preHandler: app.authenticate }, async (req, reply) => {
    const parsed = UpdateBrandKit.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    const data = parsed.data;

    // A clip key without a duration (or the reverse) would desynchronise the audio for the
    // entire reel, so reject the pair rather than storing half of it. Clearing both to
    // null is fine — that just removes the clip.
    for (const end of ["intro", "outro"] as const) {
      const key = data[`${end}ClipKey`];
      const ms = data[`${end}ClipMs`];
      if (key && !ms) return reply.code(400).send({ error: `${end}_clip_duration_required` });
      if (ms && !key) return reply.code(400).send({ error: `${end}_clip_key_required` });
    }

    const kit = await prisma.brandKit.upsert({
      where: { userId: req.user!.id },
      create: { userId: req.user!.id, ...data },
      update: data,
    });
    return present(kit);
  });

  // Presigned R2 PUT for the logo. Same two-step shape as /backgrounds/upload: the client
  // PUTs the raw file, then saves the returned key through PUT /brand-kit.
  app.post("/brand-kit/logo", { preHandler: app.authenticate }, async (req) => {
    const body = (req.body ?? {}) as { contentType?: string };
    const ct = body.contentType && /^image\//.test(body.contentType) ? body.contentType : "image/png";
    const ext = (ct.split("/")[1] || "png").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "png";
    const key = `brand/${randomUUID()}.${ext}`;
    return { key, uploadURL: await signedUploadUrl(key, ct), url: await signedDownloadUrl(key, 86400) };
  });

  // Presigned R2 PUT for an uploaded intro/outro clip.
  app.post("/brand-kit/clip", { preHandler: app.authenticate }, async (req) => {
    const body = (req.body ?? {}) as { contentType?: string };
    const ct = body.contentType && /^video\//.test(body.contentType) ? body.contentType : "video/mp4";
    const ext = (ct.split("/")[1] || "mp4").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "mp4";
    const key = `brand/${randomUUID()}.${ext}`;
    return { key, uploadURL: await signedUploadUrl(key, ct), url: await signedDownloadUrl(key, 86400) };
  });
}
