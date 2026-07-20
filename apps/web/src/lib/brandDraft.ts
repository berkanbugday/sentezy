import { type BrandCrop, normalizeCrop } from "@sentezy/remotion";
import type { BrandKit } from "@/lib/queries";

/** An uploaded end as the editor holds it: the stored key, its measured length, a signed
 *  URL to preview it, and how it is framed. */
export type BrandDraftClip = { key: string; ms: number; url: string | null; crop: BrandCrop } | null;

/** The Marka Kiti form's working copy. */
export type BrandDraft = {
  brandName: string;
  handle: string;
  outroCta: string;
  color: string;
  font: string;
  logoKey: string | null;
  logoUrl: string | null;
  introClip: BrandDraftClip;
  outroClip: BrandDraftClip;
};

/** Server kit → editable draft. Nulls become empty strings so the inputs stay controlled. */
export function toBrandDraft(k: BrandKit): BrandDraft {
  return {
    brandName: k.brandName ?? "",
    handle: k.handle ?? "",
    outroCta: k.outroCta ?? "",
    color: k.color,
    font: k.font,
    logoKey: k.logoKey,
    logoUrl: k.logoUrl,
    introClip: k.introClipKey && k.introClipMs
      ? { key: k.introClipKey, ms: k.introClipMs, url: k.introClipUrl, crop: normalizeCrop(k.introClipCrop) }
      : null,
    outroClip: k.outroClipKey && k.outroClipMs
      ? { key: k.outroClipKey, ms: k.outroClipMs, url: k.outroClipUrl, crop: normalizeCrop(k.outroClipCrop) }
      : null,
  };
}

/**
 * What "unsaved changes" compares.
 *
 * Deliberately EXCLUDES the signed preview URLs. The API mints a fresh signature on every
 * response, so comparing whole objects would see the kit as modified the instant it was
 * saved — leaving Kaydet enabled forever and "Kaydedildi" never appearing. Only values
 * that actually get persisted count.
 *
 * Text is trimmed here because it is trimmed on save too: typing a trailing space is not
 * a change, and without this the button would arm for an edit that saves as a no-op.
 */
export function brandFingerprint(d: BrandDraft): string {
  const clip = (c: BrandDraftClip) => (c ? { key: c.key, ms: c.ms, crop: c.crop } : null);
  return JSON.stringify({
    brandName: d.brandName.trim(),
    handle: d.handle.trim(),
    outroCta: d.outroCta.trim(),
    color: d.color,
    font: d.font,
    logoKey: d.logoKey,
    introClip: clip(d.introClip),
    outroClip: clip(d.outroClip),
  });
}
