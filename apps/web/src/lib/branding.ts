import { normalizeCrop, type ReelBrand, type ReelBrandEnd } from "@sentezy/remotion";
import type { ComposerSettings } from "@/lib/composerSettings";
import type { BrandKit } from "@/lib/queries";

type BrandToggles = Pick<ComposerSettings, "brandIntro" | "brandOutro" | "brandWatermark">;

/** The `branding` blob written onto a video's options, or `{}` when the video is unbranded.
 *
 *  The kit is SNAPSHOTTED here, at apply time — the video stores a frozen copy rather than
 *  a reference, so editing the kit later never changes a video that has already been made.
 *
 *  Only the `*Key` fields are copied. The `*Url` fields on a BrandKit are short-lived signed
 *  URLs; persisting one would store a link that is dead within a day.
 */
export function brandingOption(
  settings: BrandToggles,
  kit: BrandKit | undefined | null,
): { branding?: Record<string, unknown> } {
  const intro = Boolean(settings.brandIntro);
  const outro = Boolean(settings.brandOutro);
  const watermark = Boolean(settings.brandWatermark);
  if (!intro && !outro && !watermark) return {};

  // Nothing worth rendering: a card with no logo and no name is an empty coloured screen,
  // and a watermark needs a logo. The UI blocks this, but a stale toggle could still reach
  // here, so drop the branding rather than shipping a blank intro.
  if (!kit || (!kit.logoKey && !kit.brandName)) return {};

  return {
    branding: {
      intro,
      outro,
      watermark: watermark && Boolean(kit.logoKey), // no logo → nothing to stamp
      kit: {
        brandName: kit.brandName,
        handle: kit.handle,
        logoImageId: kit.logoKey,
        color: kit.color,
        font: kit.font,
        outroCta: kit.outroCta,
        introClip: kit.introClipKey && kit.introClipMs
          ? { ref: kit.introClipKey, ms: kit.introClipMs, crop: normalizeCrop(kit.introClipCrop) }
          : null,
        outroClip: kit.outroClipKey && kit.outroClipMs
          ? { ref: kit.outroClipKey, ms: kit.outroClipMs, crop: normalizeCrop(kit.outroClipCrop) }
          : null,
      },
    },
  };
}

/**
 * The same kit as the <Player> preview consumes: signed URLs instead of R2 keys, and clip
 * lengths in frames instead of milliseconds.
 *
 * This mirrors the worker's `brand_props` (apps/worker/.../reel_remotion.py). The two exist
 * separately because they start from different inputs — the worker reads the frozen snapshot
 * off a saved video, this reads the live kit the user is editing — but they must produce the
 * same shape, or the preview stops predicting the render.
 */
export function previewBrand(
  settings: BrandToggles,
  kit: BrandKit | undefined | null,
  fps: number,
): ReelBrand | null {
  const intro = Boolean(settings.brandIntro);
  const outro = Boolean(settings.brandOutro);
  const watermark = Boolean(settings.brandWatermark);
  if (!intro && !outro && !watermark) return null;
  if (!kit || (!kit.logoKey && !kit.brandName)) return null;

  const end = (
    enabled: boolean,
    url: string | null,
    ms: number | null,
    crop: unknown,
  ): ReelBrandEnd | null => {
    if (!enabled) return null;
    if (url && ms) {
      return {
        kind: "clip",
        url,
        durationInFrames: Math.max(1, Math.round((ms / 1000) * fps)),
        crop: normalizeCrop(crop as never),
      };
    }
    return { kind: "card" };
  };

  return {
    intro: end(intro, kit.introClipUrl, kit.introClipMs, kit.introClipCrop),
    outro: end(outro, kit.outroClipUrl, kit.outroClipMs, kit.outroClipCrop),
    watermark: watermark && Boolean(kit.logoUrl),
    logoUrl: kit.logoUrl,
    brandName: kit.brandName,
    handle: kit.handle,
    cta: kit.outroCta,
    color: kit.color,
    font: kit.font,
  };
}
