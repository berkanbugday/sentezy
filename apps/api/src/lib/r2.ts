import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../env";

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
