// Which R2 objects belong to a user, so account deletion can purge them. Pure and typed
// against the minimal row shapes it needs, so it is unit-testable without a database.

type VideoRow = {
  outputKey: string | null;
  thumbnailImageId: string | null;
  options: unknown; // the stored options JSON — B-roll uploads live in here
};
type AvatarRow = { sourceImageId: string | null; previewImageId: string | null };
type BrandKitRow = {
  logoKey: string | null;
  introClipKey: string | null;
  outroClipKey: string | null;
} | null;

/** B-roll image/video keys a video uploaded. Reads the same `options.background.media[].ref`
 *  the composer writes, plus the legacy `images[]`/`value` shapes older drafts used. Defensive
 *  throughout — options is opaque JSON and a malformed blob must not throw mid-deletion. */
function brollKeys(options: unknown): string[] {
  const bg = (options as { background?: unknown } | null)?.background as Record<string, unknown> | undefined;
  if (!bg || typeof bg !== "object") return [];
  const keys: string[] = [];
  const media = bg.media;
  if (Array.isArray(media)) {
    for (const m of media) {
      const ref = (m as { ref?: unknown })?.ref;
      if (typeof ref === "string") keys.push(ref);
    }
  }
  if (Array.isArray(bg.images)) {
    for (const k of bg.images) if (typeof k === "string") keys.push(k);
  }
  // `value` is the first image key when type === "image"; a hex colour otherwise, which is
  // filtered out because it is not an R2 key.
  if (bg.type === "image" && typeof bg.value === "string") keys.push(bg.value);
  return keys;
}

/**
 * Every R2 key owned by one user, deduped. Intermediate render artifacts (TTS audio, the
 * avatar cutout, the opaque reel) are already freed at the end of each render, so they are
 * not listed here — only the durable objects: finished videos, thumbnails, uploaded B-roll,
 * avatar source/preview images, and the brand kit's logo and clips.
 *
 * Known gap: an uploaded B-roll key is only recoverable if it is still referenced in a
 * video's options. A draft the user deleted, or an upload they never attached, leaves an
 * orphan — R2 keys are UUID-named, not user-prefixed, so they cannot be enumerated by owner.
 */
export function collectUserR2Keys(input: {
  videos: VideoRow[];
  avatars: AvatarRow[];
  brandKit: BrandKitRow;
}): string[] {
  const keys: string[] = [];
  for (const v of input.videos) {
    if (v.outputKey) keys.push(v.outputKey);
    if (v.thumbnailImageId) keys.push(v.thumbnailImageId);
    keys.push(...brollKeys(v.options));
  }
  for (const a of input.avatars) {
    if (a.sourceImageId) keys.push(a.sourceImageId);
    if (a.previewImageId) keys.push(a.previewImageId);
  }
  if (input.brandKit) {
    if (input.brandKit.logoKey) keys.push(input.brandKit.logoKey);
    if (input.brandKit.introClipKey) keys.push(input.brandKit.introClipKey);
    if (input.brandKit.outroClipKey) keys.push(input.brandKit.outroClipKey);
  }
  return [...new Set(keys.filter(Boolean))];
}
