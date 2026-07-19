import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Prisma, prisma } from "@sentezy/db";
import { type AspectRatio, CreateVideoDraft, CreateVideoRequest, UpdateVideoDraft } from "@sentezy/types";
import { enqueueVideo } from "../lib/redis";
import { SEP, resolveVoice } from "../lib/voices";
import { emotionEnabled, enhanceScriptEmotion } from "../lib/emotion";
import { publicUrl, signedDownloadUrl } from "../lib/r2";
import { isDev } from "../env";

const EnhanceEmotionBody = z.object({
  script: z.string().min(1).max(5000),
  imageIds: z.array(z.string()).max(20).default([]),
  tone: z.string().max(40).default(""),
});

const UpdateVideoTitle = z.object({ title: z.string().trim().min(1).max(120) });

const CREDIT_COST = 1;

// zod AspectRatio ("9:16") → Prisma enum member ("r9_16")
const RATIO: Record<AspectRatio, "r9_16" | "r1_1" | "r16_9"> = {
  "9:16": "r9_16",
  "1:1": "r1_1",
  "16:9": "r16_9",
};

/**
 * Provision a free-tier profile on first use. Nothing creates profiles (no signup handler / no
 * Supabase `handle_new_user` trigger), so without this the credit debit's `updateMany` matches 0
 * rows for a brand-new user → 402 "insufficient_credits". Idempotent upsert; `credits` defaults to
 * 30 (Prisma schema). Runs inside the credit transaction so provisioning + debit are atomic.
 */
async function ensureProfile(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  await tx.profile.upsert({ where: { id: userId }, create: { id: userId }, update: {} });
}

export async function videoRoutes(app: FastifyInstance) {
  app.get("/videos", { preHandler: app.authenticate }, async (req) => {
    const rows = await prisma.video.findMany({
      where: { userId: req.user!.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
    // R2 isn't a public bucket, so hand the browser a delivery URL per thumbnail
    // (public CDN url if configured, else a signed GET) — mirrors GET /videos/:id.
    const videos = await Promise.all(
      rows.map(async (video) => ({
        ...video,
        thumbnailUrl: video.thumbnailImageId
          ? (publicUrl(video.thumbnailImageId) ?? (await signedDownloadUrl(video.thumbnailImageId, 86400)))
          : null,
      })),
    );
    return { videos };
  });

  app.get("/videos/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const video = await prisma.video.findFirst({
      where: { id, userId: req.user!.id, deletedAt: null },
      include: { avatar: true, voice: true },
    });
    if (!video) return reply.code(404).send({ error: "not_found" });

    let downloadUrl: string | null = null;
    let fileDownloadUrl: string | null = null;
    if (video.outputKey) {
      downloadUrl = publicUrl(video.outputKey) ?? (await signedDownloadUrl(video.outputKey));
      // Force-download variant (Content-Disposition: attachment); the inline downloadUrl above is
      // what the <video> plays, this one makes the browser save the file.
      const safeTitle = (video.title || "sentezy").replace(/[^\w.-]+/g, "_").slice(0, 60) || "sentezy";
      fileDownloadUrl = await signedDownloadUrl(video.outputKey, 3600, { downloadAs: `${safeTitle}.mp4` });
    }
    const thumbnailUrl = video.thumbnailImageId ? await signedDownloadUrl(video.thumbnailImageId, 86400) : null;

    // Delivery URLs for the B-roll so a resumed draft can show thumbnails: images and
    // video clips both via a signed R2 GET (keys are server-only, R2 isn't a public bucket).
    const bg = (video.options as {
      background?: {
        images?: string[];
        transitions?: string[];
        type?: string;
        value?: string;
        media?: Array<{ kind: "image" | "video"; ref: string; transition?: string }>;
      };
    } | null)?.background;
    let mediaList = bg?.media;
    if (!mediaList) {
      const ids = bg?.images ?? (bg?.type === "image" && bg?.value ? [bg.value] : []);
      const trans = bg?.transitions ?? [];
      mediaList = ids.map((ref, i) => ({ kind: "image" as const, ref, transition: trans[i] }));
    }
    const brollMedia = await Promise.all(
      mediaList.map(async (m) => ({
        kind: m.kind,
        ref: m.ref,
        transition: m.transition,
        url: await signedDownloadUrl(m.ref, 86400),
      })),
    );
    const brollImageUrls = brollMedia.filter((m) => m.kind === "image").map((m) => m.url); // back-compat

    // Shaped to satisfy the composer's Avatar/Voice types verbatim (apps/web/src/components/
    // wizard/types.ts) so a later "reuse this video" flow can assign these straight into
    // composer state with no cast and no client-side catalog lookup.
    //
    // video.avatar.sourceImageId is the green-screen source key — rendering it raw shows a
    // person on a bright green background, so prefer the catalog's matted thumbnail. The
    // catalog row (matched by imageKey === sourceImageId) also supplies the sector/gender/age
    // fields the composer's Avatar type requires. An uploaded avatar has no catalog row, so
    // fall back to the source key for the image and neutral defaults for the catalog-only
    // fields rather than returning null.
    let avatar: {
      id: string;
      slug: string;
      name: string;
      imageUrl: string;
      sector: string;
      sectorLabel: string;
      gender: "kadın" | "erkek";
      age: "genç" | "yetişkin" | "olgun";
      hijab: boolean;
      ready: boolean;
    } | null = null;
    if (video.avatar) {
      const catalog = await prisma.catalogAvatar.findFirst({ where: { imageKey: video.avatar.sourceImageId } });
      const key = catalog?.displayImageKey || video.avatar.sourceImageId;
      avatar = {
        id: video.avatar.sourceImageId,
        slug: catalog?.slug ?? "",
        name: catalog?.name ?? video.avatar.name,
        imageUrl: key ? await signedDownloadUrl(key, 86400) : "",
        sector: catalog?.sector ?? "",
        sectorLabel: catalog?.sectorLabel ?? "",
        gender: catalog?.gender === "erkek" ? "erkek" : "kadın",
        age: catalog?.age === "genç" || catalog?.age === "olgun" ? catalog.age : "yetişkin",
        hijab: catalog?.hijab ?? false,
        ready: video.avatar.status === "ready",
      };
    }
    const voice = video.voice
      ? { id: video.voice.id, label: video.voice.label, gender: video.voice.gender, style: video.voice.style }
      : null;

    const { avatar: _avatarRow, voice: _voiceRow, ...videoRow } = video;
    return {
      video: videoRow,
      downloadUrl,
      fileDownloadUrl,
      thumbnailUrl,
      brollImageUrls,
      brollMedia,
      avatar,
      voice,
    };
  });

  app.post("/videos", { preHandler: app.authenticate }, async (req, reply) => {
    const parsed = CreateVideoRequest.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    const userId = req.user!.id;
    const input = parsed.data;

    const avatar = await prisma.avatar.findFirst({ where: { id: input.avatarId, userId } });
    if (!avatar) return reply.code(400).send({ error: "invalid_avatar" });
    // A shared-library voice ("owner|voice") is added to the account and materialised here.
    try {
      input.voiceId = (await resolveVoice(userId, input.voiceId)).dbId;
    } catch {
      return reply.code(400).send({ error: "invalid_voice" });
    }
    const voice = await prisma.voice.findFirst({
      where: { id: input.voiceId, OR: [{ isPublic: true }, { userId }] },
    });
    if (!voice) return reply.code(400).send({ error: "invalid_voice" });

    try {
      const video = await prisma.$transaction(async (tx) => {
        // No signup/trigger creates profiles — provision one on first use so the debit has a row.
        await ensureProfile(tx, userId);
        // Dev bypasses the credit gate entirely (no debit, no ledger) so local runs are free.
        if (!isDev) {
          const debit = await tx.profile.updateMany({
            where: { id: userId, credits: { gte: CREDIT_COST } },
            data: { credits: { decrement: CREDIT_COST } },
          });
          if (debit.count === 0) throw new Error("insufficient_credits");
        }
        const v = await tx.video.create({
          data: {
            userId,
            title: input.title,
            script: input.script,
            avatarId: input.avatarId,
            voiceId: input.voiceId,
            aspectRatio: RATIO[input.aspectRatio],
            options: input.options as unknown as Prisma.InputJsonValue,
            status: "queued",
            creditsCost: isDev ? 0 : CREDIT_COST,
          },
        });
        if (!isDev) {
          await tx.creditLedger.create({
            data: { userId, delta: -CREDIT_COST, reason: "video_create", videoId: v.id },
          });
        }
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

  // ── Draft flow: create early, save progressively, generate at the end ──

  // Create an empty draft (no credit debit, not queued).
  app.post("/videos/draft", { preHandler: app.authenticate }, async (req, reply) => {
    const parsed = CreateVideoDraft.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    const video = await prisma.video.create({
      data: {
        userId: req.user!.id,
        title: parsed.data.title?.trim() || "Adsız video",
        script: parsed.data.script ?? "",
        status: "draft",
      },
    });
    return reply.code(201).send({ video });
  });

  // Progressively save a draft's fields. Draft-only; no side effects.
  app.patch("/videos/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = UpdateVideoDraft.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    const existing = await prisma.video.findFirst({ where: { id, userId: req.user!.id, deletedAt: null } });
    if (!existing) return reply.code(404).send({ error: "not_found" });
    if (existing.status !== "draft") return reply.code(409).send({ error: "not_a_draft" });
    const d = parsed.data;
    // Adopt a shared-library voice id ("owner|voice") into a real Voice row before storing
    // it in the uuid column; a plain DB id passes through, a failed adopt keeps the prior.
    let voiceIdUpdate = d.voiceId;
    if (d.voiceId && d.voiceId.includes(SEP)) {
      try {
        voiceIdUpdate = (await resolveVoice(req.user!.id, d.voiceId)).dbId;
      } catch {
        voiceIdUpdate = existing.voiceId ?? undefined;
      }
    }
    const video = await prisma.video.update({
      where: { id },
      data: {
        ...(d.title !== undefined ? { title: d.title.trim() || "Adsız video" } : {}),
        ...(d.script !== undefined ? { script: d.script } : {}),
        ...(d.avatarId !== undefined ? { avatarId: d.avatarId } : {}),
        ...(d.voiceId !== undefined ? { voiceId: voiceIdUpdate } : {}),
        ...(d.aspectRatio !== undefined ? { aspectRatio: RATIO[d.aspectRatio] } : {}),
        ...(d.options !== undefined ? { options: d.options as unknown as Prisma.InputJsonValue } : {}),
      },
    });
    return { video };
  });

  // Rename a video at ANY status. Deliberately separate from PATCH /videos/:id, which is
  // draft-only: a rendered video's script/avatar/options were already consumed by the
  // render, so a title-only route is the safe way to allow the one edit that stays valid.
  app.patch("/videos/:id/title", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = UpdateVideoTitle.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    const existing = await prisma.video.findFirst({ where: { id, userId: req.user!.id, deletedAt: null } });
    if (!existing) return reply.code(404).send({ error: "not_found" });
    const video = await prisma.video.update({ where: { id }, data: { title: parsed.data.title } });
    return { video };
  });

  // Soft delete — the row is hidden from every read, the R2 objects are deliberately kept.
  // A repeat call 404s because the ownership lookup filters deletedAt like all other reads.
  app.delete("/videos/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.video.findFirst({ where: { id, userId: req.user!.id, deletedAt: null } });
    if (!existing) return reply.code(404).send({ error: "not_found" });
    await prisma.video.update({ where: { id }, data: { deletedAt: new Date() } });
    return reply.code(204).send();
  });

  // Finalize a draft: validate, debit a credit, queue it for the worker.
  app.post("/videos/:id/generate", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const userId = req.user!.id;
    const draft = await prisma.video.findFirst({ where: { id, userId, deletedAt: null } });
    if (!draft) return reply.code(404).send({ error: "not_found" });
    if (draft.status !== "draft") return reply.code(409).send({ error: "already_generated" });
    // Avatar is OPTIONAL — a faceless reel needs voice + script + some B-roll media instead of a
    // presenter. Require an avatar OR at least one uploaded media clip so there's a visual.
    const media = (draft.options as { background?: { media?: unknown[] } } | null)?.background?.media;
    const hasMedia = Array.isArray(media) && media.length > 0;
    if (!draft.voiceId || !draft.script.trim() || (!draft.avatarId && !hasMedia)) {
      return reply.code(400).send({ error: "incomplete_draft" });
    }
    if (draft.avatarId) {
      const avatar = await prisma.avatar.findFirst({ where: { id: draft.avatarId, userId } });
      if (!avatar) return reply.code(400).send({ error: "invalid_avatar" });
    }
    const voice = await prisma.voice.findFirst({
      where: { id: draft.voiceId, OR: [{ isPublic: true }, { userId }] },
    });
    if (!voice) return reply.code(400).send({ error: "invalid_voice" });

    try {
      const video = await prisma.$transaction(async (tx) => {
        // No signup/trigger creates profiles — provision one on first use so the debit has a row.
        await ensureProfile(tx, userId);
        // Dev bypasses the credit gate entirely (no debit, no ledger) so local runs are free.
        if (!isDev) {
          const debit = await tx.profile.updateMany({
            where: { id: userId, credits: { gte: CREDIT_COST } },
            data: { credits: { decrement: CREDIT_COST } },
          });
          if (debit.count === 0) throw new Error("insufficient_credits");
        }
        const v = await tx.video.update({ where: { id }, data: { status: "queued", creditsCost: isDev ? 0 : CREDIT_COST } });
        if (!isDev) {
          await tx.creditLedger.create({
            data: { userId, delta: -CREDIT_COST, reason: "video_create", videoId: id },
          });
        }
        await tx.job.create({ data: { videoId: id, status: "queued" } });
        return v;
      });
      await enqueueVideo({ videoId: video.id, userId });
      return reply.code(200).send({ video });
    } catch (e) {
      if (e instanceof Error && e.message === "insufficient_credits") {
        return reply.code(402).send({ error: "insufficient_credits" });
      }
      throw e;
    }
  });

  // Scenario-step "add emotion": analyze the B-roll photos + script with a vision model
  // and return the script annotated with ElevenLabs v3 audio tags (words preserved).
  app.post("/videos/enhance-emotion", { preHandler: app.authenticate }, async (req, reply) => {
    const parsed = EnhanceEmotionBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    if (!emotionEnabled()) {
      return reply.send({ script: parsed.data.script, changed: false, enabled: false });
    }
    const imageUrls = await Promise.all(parsed.data.imageIds.map((id) => signedDownloadUrl(id, 86400)));
    const result = await enhanceScriptEmotion(parsed.data.script, imageUrls, parsed.data.tone);
    return reply.send({ ...result, enabled: true });
  });
}
