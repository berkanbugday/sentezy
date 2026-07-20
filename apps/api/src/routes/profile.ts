import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@sentezy/db";

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
}
