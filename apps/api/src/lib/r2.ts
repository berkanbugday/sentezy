import { randomUUID } from "node:crypto";
import { DeleteObjectsCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../env";
import { safeFetch } from "./ssrf";

// Cloudflare R2 is S3-compatible.
export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

export async function signedDownloadUrl(
  key: string,
  expiresIn = 3600,
  opts?: { downloadAs?: string },
): Promise<string> {
  // `downloadAs` sets Content-Disposition: attachment so the browser SAVES the file (needed for a
  // real cross-origin download — the <a download> attribute is ignored on cross-origin URLs).
  return getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      ...(opts?.downloadAs ? { ResponseContentDisposition: `attachment; filename="${opts.downloadAs}"` } : {}),
    }),
    { expiresIn },
  );
}

/** Presigned PUT URL so the browser uploads a file (e.g. a B-roll video clip) straight to R2. */
export async function signedUploadUrl(key: string, contentType: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(r2, new PutObjectCommand({ Bucket: env.R2_BUCKET, Key: key, ContentType: contentType }), { expiresIn });
}

export function publicUrl(key: string): string | null {
  return env.R2_PUBLIC_URL ? `${env.R2_PUBLIC_URL.replace(/\/$/, "")}/${key}` : null;
}

/** Best-effort batch delete. Used when purging an account — a storage object that fails to
 *  delete must not block the account deletion, so this never throws: it returns the keys it
 *  could not remove for the caller to log. S3 caps DeleteObjects at 1000 keys per call, so
 *  batch. Empty input is a no-op. */
export async function deleteObjects(keys: string[]): Promise<{ failed: string[] }> {
  const unique = [...new Set(keys.filter(Boolean))];
  const failed: string[] = [];
  for (let i = 0; i < unique.length; i += 1000) {
    const batch = unique.slice(i, i + 1000);
    try {
      const res = await r2.send(
        new DeleteObjectsCommand({ Bucket: env.R2_BUCKET, Delete: { Objects: batch.map((Key) => ({ Key })) } }),
      );
      for (const e of res.Errors ?? []) if (e.Key) failed.push(e.Key);
    } catch {
      failed.push(...batch);
    }
  }
  return { failed };
}

/** Server-side upload of raw bytes to R2 (e.g. an image scraped from a product page). */
export async function uploadBuffer(key: string, body: Buffer | Uint8Array, contentType: string): Promise<void> {
  await r2.send(new PutObjectCommand({ Bucket: env.R2_BUCKET, Key: key, Body: body, ContentType: contentType }));
}

// Guardrails for pulling remote assets into R2 (product-import). Big enough for
// high-res product photos / short clips, small enough to reject a runaway download.
const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15 MB
const MAX_VIDEO_BYTES = 60 * 1024 * 1024; // 60 MB
const EXT_FROM_CT: Record<string, string> = {
  "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
};

/**
 * Download a remote image/video and store it in R2 under the same key namespaces the
 * browser-upload path uses (`images/…`, `broll/…`) so the worker resolves it identically.
 * Returns the R2 key + a signed preview URL, or null if the asset is missing/too big/wrong
 * type — callers ingest a gallery best-effort, skipping the ones that fail.
 */
export async function ingestRemoteAsset(
  url: string,
  kind: "image" | "video",
): Promise<{ ref: string; url: string; kind: "image" | "video" } | null> {
  try {
    // safeFetch blocks SSRF (remote asset URLs come from an untrusted scraped page).
    const res = await safeFetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SentezyBot/1.0)", "Accept-Language": "tr,en;q=0.8" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const ct = ((res.headers.get("content-type") ?? "").split(";")[0] ?? "").trim().toLowerCase();
    // Strict allowlist: the content-type must be one we know is safe to store + serve. This
    // rejects e.g. image/svg+xml (scriptable → stored XSS when a signed URL is opened inline).
    if (!(ct in EXT_FROM_CT)) return null;
    const expected = kind === "image" ? "image/" : "video/";
    if (!ct.startsWith(expected)) return null;

    const buf = Buffer.from(await res.arrayBuffer());
    const cap = kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
    if (buf.byteLength === 0 || buf.byteLength > cap) return null;

    const ext = EXT_FROM_CT[ct] ?? (kind === "image" ? "jpg" : "mp4");
    const key = `${kind === "image" ? "images" : "broll"}/${randomUUID()}.${ext}`;
    await uploadBuffer(key, buf, ct);
    return { ref: key, url: await signedDownloadUrl(key, 86400), kind };
  } catch {
    return null;
  }
}
