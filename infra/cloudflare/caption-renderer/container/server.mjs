import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import express from "express";

// HTTP server that runs inside the Cloudflare Container. It renders @sentezy/remotion
// compositions with Node + Chromium + FFmpeg:
//   POST /render-reel  → Reel composition → opaque H.264 .mp4
// and uploads to R2 (prod) or streams the file back inline (local docker-compose).
// The Worker (../src/index.ts) forwards the route here.

const PORT = process.env.PORT || 8080;
const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;

// Upload to R2 when creds are present (Cloudflare / prod); otherwise stream the .mov back in
// the response (local docker-compose — no R2 round-trip, no secrets needed in the renderer).
const useR2 = Boolean(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET);
const s3 = useR2
  ? new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    })
  : null;

// Bundle the Remotion project once and reuse the serveUrl (keep it warm) — re-bundling per
// request is the #1 latency mistake. The bundle is produced from the copied package source.
let serveUrlPromise = null;
function getServeUrl() {
  if (!serveUrlPromise) {
    serveUrlPromise = bundle({ entryPoint: path.resolve("/app/remotion/src/remotion-entry.ts") });
  }
  return serveUrlPromise;
}

const app = express();
app.use(express.json({ limit: "8mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

// Deliver a rendered file: upload to R2 and return its key (prod), or stream it back inline
// (local). Shared by both render routes. `keyField` names the JSON field the worker reads.
async function deliver(res, outPath, { key, contentType, keyField }) {
  if (useR2) {
    await s3.send(
      new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: fs.createReadStream(outPath), ContentType: contentType }),
    );
    fs.rm(outPath, { force: true }, () => {});
    res.json({ [keyField]: key });
  } else {
    res.setHeader("Content-Type", contentType);
    const stream = fs.createReadStream(outPath);
    stream.pipe(res);
    stream.on("close", () => fs.rm(outPath, { force: true }, () => {}));
  }
}

app.post("/render-reel", async (req, res) => {
  const { jobId, words, avatarUrl, broll, captionStyle, layout, position, avatarSide, captions, width, height, fps } =
    req.body ?? {};
  if (!jobId || !Array.isArray(words)) {
    return res.status(400).json({ error: "jobId and words[] are required" });
  }
  const outPath = path.join(os.tmpdir(), `${jobId}.mp4`);
  try {
    const serveUrl = await getServeUrl();
    // previewAudio:false + sfxCues:[] → the render is opaque and silent; the worker muxes audio.
    const inputProps = {
      words, avatarUrl: avatarUrl ?? null, broll: broll ?? [],
      captionStyle, layout, position, avatarSide,
      captions: captions !== false, previewAudio: false, sfxCues: [],
      width, height, fps,
    };
    const composition = await selectComposition({ serveUrl, id: "Reel", inputProps });
    await renderMedia({
      serveUrl,
      composition,
      codec: "h264",
      imageFormat: "jpeg", // OPAQUE reel — not the old ProRes/alpha caption overlay
      outputLocation: outPath,
      inputProps,
    });
    await deliver(res, outPath, { key: `reels/${jobId}.mp4`, contentType: "video/mp4", keyField: "reelKey" });
  } catch (err) {
    console.error("render-reel failed", err);
    fs.rm(outPath, { force: true }, () => {});
    res.status(500).json({ error: String(err?.message ?? err) });
  }
});

app.listen(PORT, () => console.log(`reel renderer listening on :${PORT}`));
