import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Prisma, prisma } from "@sentezy/db";

import { signedDownloadUrl, signedUploadUrl } from "../lib/r2";

// The user's brand kit: logo, name, colour, and optional uploaded intro/outro clips.
// One row per user. A video never references this row — switching branding on snapshots
// it into videos.options.branding, so editing the kit does not retroactively change
// videos that have already been made.

/** Mirrors BrandCrop in @sentezy/types, redeclared with THIS package's zod: nesting a
 *  schema built by another copy of zod inside one of ours is a type error, since the two
 *  resolve to different instances. Parsing across the boundary is fine — nesting is not. */
const Crop = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  scale: z.number().min(1).max(4),
});

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
  introClipCrop: Crop.nullable().optional(),
  outroClipKey: z.string().max(200).nullable().optional(),
  outroClipMs: z.number().int().positive().nullable().optional(),
  outroClipCrop: Crop.nullable().optional(),
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
  introClipCrop: null,
  outroClipKey: null,
  outroClipMs: null,
  outroClipCrop: null,
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
  introClipCrop: unknown;
  outroClipKey: string | null;
  outroClipMs: number | null;
  outroClipCrop: unknown;
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
    introClipCrop: kit.introClipCrop ?? null,
    outroClipKey: kit.outroClipKey,
    outroClipMs: kit.outroClipMs,
    outroClipCrop: kit.outroClipCrop ?? null,
    logoUrl: kit.logoKey ? await signedDownloadUrl(kit.logoKey, 86400) : null,
    introClipUrl: kit.introClipKey ? await signedDownloadUrl(kit.introClipKey, 86400) : null,
    outroClipUrl: kit.outroClipKey ? await signedDownloadUrl(kit.outroClipKey, 86400) : null,
  };
}

/** MIME → file extension. Explicit rather than derived from the subtype, because the
 *  obvious `ct.split("/")[1]` mangles the two that matter: `image/svg+xml` becomes
 *  "svgxml" and `video/quicktime` becomes "quicktime", neither of which is the real
 *  extension. The stored key's extension is load-bearing — the composition decides whether
 *  to draw an end as a still or play it as video by looking at it (isImageSrc). */
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

function pickContentType(requested: string | undefined, fallback: string, allow: RegExp): string {
  return requested && allow.test(requested) && requested in EXT ? requested : fallback;
}

export async function brandKitRoutes(app: FastifyInstance) {
  const presign = async (contentType: string) => {
    const key = `brand/${randomUUID()}.${EXT[contentType] ?? "bin"}`;
    return { key, uploadURL: await signedUploadUrl(key, contentType), url: await signedDownloadUrl(key, 86400) };
  };

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

    // Prisma will not take a bare `null` for a nullable Json column — clearing one needs
    // the DbNull sentinel, which is how it distinguishes SQL NULL from the JSON value null.
    const { introClipCrop, outroClipCrop, ...rest } = data;
    const write = {
      ...rest,
      ...(introClipCrop !== undefined ? { introClipCrop: introClipCrop ?? Prisma.DbNull } : {}),
      ...(outroClipCrop !== undefined ? { outroClipCrop: outroClipCrop ?? Prisma.DbNull } : {}),
    };

    const kit = await prisma.brandKit.upsert({
      where: { userId: req.user!.id },
      create: { userId: req.user!.id, ...write },
      update: write,
    });
    return present(kit);
  });

  // Presigned R2 PUT for the logo. Same two-step shape as /backgrounds/upload: the client
  // PUTs the raw file, then saves the returned key through PUT /brand-kit.
  app.post("/brand-kit/logo", { preHandler: app.authenticate }, async (req) => {
    const ct = pickContentType((req.body as { contentType?: string })?.contentType, "image/png", /^image\//);
    return presign(ct);
  });

  // Presigned R2 PUT for an uploaded intro/outro end — an image OR a video. Both are
  // allowed: an end card is often a designed still, not footage.
  app.post("/brand-kit/clip", { preHandler: app.authenticate }, async (req) => {
    const ct = pickContentType((req.body as { contentType?: string })?.contentType, "video/mp4", /^(image|video)\//);
    return presign(ct);
  });
}
