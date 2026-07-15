import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { signedDownloadUrl, signedUploadUrl } from "../lib/r2";

// MVP backgrounds: solid colors + (later) curated presets.
// Premium monochrome background options (dark → light neutral grays).
const COLORS = ["#0A0A0B", "#18181B", "#3F3F46", "#71717A", "#D4D4D8", "#FFFFFF"];

export async function backgroundRoutes(app: FastifyInstance) {
  app.get("/backgrounds", async () => {
    return {
      colors: COLORS,
      images: [] as Array<{ id: string; label: string }>,
    };
  });

  // Presigned R2 PUT for a custom background photo (images live in R2 like video clips,
  // referenced by key). The client PUTs the raw file, then we hand back a signed preview.
  app.post("/backgrounds/upload", { preHandler: app.authenticate }, async (req) => {
    const body = (req.body ?? {}) as { contentType?: string };
    const ct = body.contentType && /^image\//.test(body.contentType) ? body.contentType : "image/png";
    const ext = (ct.split("/")[1] || "png").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "png";
    const key = `images/${randomUUID()}.${ext}`;
    const uploadURL = await signedUploadUrl(key, ct);
    const imageUrl = await signedDownloadUrl(key, 86400);
    return { id: key, uploadURL, imageUrl };
  });

  // Presigned R2 PUT for a B-roll video clip (e.g. a screen recording). Like the
  // images above, clips live in R2 under broll/ and are referenced by key.
  app.post("/backgrounds/upload-video", { preHandler: app.authenticate }, async (req) => {
    const body = (req.body ?? {}) as { contentType?: string };
    const ct = body.contentType && /^video\//.test(body.contentType) ? body.contentType : "video/mp4";
    const ext = (ct.split("/")[1] || "mp4").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "mp4";
    const key = `broll/${randomUUID()}.${ext}`;
    const uploadURL = await signedUploadUrl(key, ct);
    const previewUrl = await signedDownloadUrl(key, 86400);
    return { key, uploadURL, previewUrl };
  });
}
