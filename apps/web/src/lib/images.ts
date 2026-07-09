// Cloudflare Images delivery URL. The account hash is public (it appears in
// every delivery URL), so it's safe to expose to the browser via NEXT_PUBLIC.
export function cfImageUrl(id: string): string {
  const hash = process.env.NEXT_PUBLIC_CF_IMAGES_HASH;
  return hash ? `https://imagedelivery.net/${hash}/${id}/public` : "";
}
