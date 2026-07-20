import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@sentezy/db";
import { env } from "../env";
import { collectUserR2Keys } from "../lib/accountKeys";
import { deleteObjects } from "../lib/r2";

// The signed-in user's own account: display name, plan, and credit balance. Nothing else
// creates a profile row (no signup handler / no Supabase trigger — see videos.ts), so GET
// provisions one on first read, exactly as the credit debit does.

const UpdateProfile = z.object({
  // Trimmed and length-bounded; empty clears it back to null (the UI then shows the email).
  displayName: z.string().trim().max(80).nullable().optional(),
});

export async function profileRoutes(app: FastifyInstance) {
  app.get("/profile", { preHandler: app.authenticate }, async (req) => {
    const id = req.user!.id;
    // Upsert rather than findUnique: a brand-new user has no row until they spend a credit,
    // and the settings screen must render before then.
    const p = await prisma.profile.upsert({ where: { id }, create: { id }, update: {} });
    return {
      displayName: p.displayName,
      // The email is the verified token's, never a stored copy — the token is the source of
      // truth and a stored email could drift from the real auth identity.
      email: req.user!.email,
      plan: p.plan,
      credits: p.credits,
    };
  });

  app.patch("/profile", { preHandler: app.authenticate }, async (req, reply) => {
    const parsed = UpdateProfile.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    const id = req.user!.id;
    // Only displayName is writable — plan and credits are server-owned. An empty string is
    // stored as null so "unset" has one representation.
    const displayName =
      parsed.data.displayName === undefined ? undefined : parsed.data.displayName || null;
    const p = await prisma.profile.upsert({
      where: { id },
      create: { id, ...(displayName !== undefined ? { displayName } : {}) },
      update: { ...(displayName !== undefined ? { displayName } : {}) },
    });
    return { displayName: p.displayName, email: req.user!.email, plan: p.plan, credits: p.credits };
  });

  // Permanently delete the account: purge the user's R2 objects and DB rows, then the
  // Supabase auth identity. Irreversible. Order matters — gather storage keys BEFORE
  // deleting the rows that name them, and delete the auth user LAST so a failure there
  // leaves a recoverable (data-less) account rather than orphaned data under a live login.
  app.delete("/profile", { preHandler: app.authenticate }, async (req, reply) => {
    const userId = req.user!.id;

    const [videos, avatars, brandKit] = await Promise.all([
      prisma.video.findMany({ where: { userId }, select: { outputKey: true, thumbnailImageId: true, options: true } }),
      prisma.avatar.findMany({ where: { userId }, select: { sourceImageId: true, previewImageId: true } }),
      prisma.brandKit.findUnique({ where: { userId }, select: { logoKey: true, introClipKey: true, outroClipKey: true } }),
    ]);

    // Best-effort — a stuck storage object must not strand the user with an undeletable
    // account. Failures are logged, not surfaced.
    const { failed } = await deleteObjects(collectUserR2Keys({ videos, avatars, brandKit }));
    if (failed.length) req.log.warn({ userId, failed }, "account deletion: some R2 keys were not removed");

    // One transaction so the purge is all-or-nothing. jobs cascade from videos; the credit
    // ledger only SetNulls its video_id, so its rows are deleted explicitly by user.
    await prisma.$transaction([
      prisma.creditLedger.deleteMany({ where: { userId } }),
      prisma.video.deleteMany({ where: { userId } }),
      prisma.avatar.deleteMany({ where: { userId } }),
      prisma.voice.deleteMany({ where: { userId } }), // user-owned only; public voices have userId null
      prisma.brandKit.deleteMany({ where: { userId } }),
      prisma.profile.deleteMany({ where: { id: userId } }),
    ]);

    // Delete the Supabase auth identity via the GoTrue admin endpoint. Using the REST API
    // with the service-role key avoids pulling in supabase-js for one call.
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: "DELETE",
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
    });
    if (!res.ok && res.status !== 404) {
      // The data is already gone; only the login remains. Report it so the client can tell
      // the user to contact support rather than pretending the account is fully removed.
      req.log.error({ userId, status: res.status }, "account deletion: auth user delete failed");
      return reply.code(502).send({ error: "auth_delete_failed" });
    }

    return { ok: true };
  });
}
