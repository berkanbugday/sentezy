import { env } from "../env";

const BASE = `https://api.cloudflare.com/client/v4/accounts/${env.R2_ACCOUNT_ID}/images`;

interface DirectUpload {
  id: string;
  uploadURL: string;
}

/** One-time direct-upload URL so the client uploads the image straight to Cloudflare. */
export async function createDirectUpload(): Promise<DirectUpload> {
  const res = await fetch(`${BASE}/v2/direct_upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.CF_IMAGES_API_TOKEN}` },
  });
  const json = (await res.json()) as {
    success: boolean;
    result?: DirectUpload;
    errors?: unknown;
  };
  if (!res.ok || !json.success || !json.result) {
    throw new Error(`cloudflare_images_direct_upload_failed: ${res.status} ${JSON.stringify(json.errors ?? json)}`);
  }
  return json.result;
}

/** Delivery URL for a stored image id + variant. */
export function imageUrl(id: string, variant = "public"): string {
  return `https://imagedelivery.net/${env.CF_IMAGES_ACCOUNT_HASH}/${id}/${variant}`;
}
