import { normalizeCrop, type ReelBrand, type ReelBrandEnd } from "@sentezy/remotion";
import type { ComposerSettings } from "@/lib/composerSettings";
import type { BrandKit } from "@/lib/queries";

type BrandToggles = Pick<ComposerSettings, "brandIntro" | "brandOutro" | "brandWatermark">;

/** True when the kit holds anything that could be rendered. Used to decide whether the
 *  brand toggles are offered at all — a kit consisting only of an uploaded intro video is
 *  perfectly usable, even with no logo and no brand name. */
export function kitHasContent(kit: BrandKit | undefined | null): boolean {
  return Boolean(kit && (kit.logoKey || kit.brandName || kit.introClipKey || kit.outroClipKey));
}

/** Which ends this video can actually render, given what the kit holds.
 *
 *  Decided PER END rather than for the kit as a whole, because the requirements differ: an
 *  end backed by an upload needs nothing else, an end falling back to the generated card
 *  needs a logo or a name to put on it, and a watermark needs a logo to stamp. Getting this
 *  wrong in either direction is bad — too strict and a user with only an intro video gets
 *  no branding at all, too loose and the reel opens on an empty coloured screen. */
function usableEnds(settings: BrandToggles, kit: BrandKit) {
  // The generated card renders from a logo, a name, or both; with neither it is a blank
  // coloured screen and is not worth showing.
  const card = Boolean(kit.logoKey || kit.brandName);
  const introClip = Boolean(kit.introClipKey && kit.introClipMs);
  const outroClip = Boolean(kit.outroClipKey && kit.outroClipMs);
  return {
    intro: Boolean(settings.brandIntro) && (introClip || card),
    outro: Boolean(settings.brandOutro) && (outroClip || card),
    watermark: Boolean(settings.brandWatermark) && Boolean(kit.logoKey),
  };
}

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
  if (!kit) return {};
  const { intro, outro, watermark } = usableEnds(settings, kit);
  // Nothing this kit can actually render — drop the branding rather than shipping a blank
  // intro. The UI blocks most of this, but a stale toggle can still reach here.
  if (!intro && !outro && !watermark) return {};

  return {
    branding: {
      intro,
      outro,
      watermark,
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
  if (!kit) return null;
  // Same per-end rules as brandingOption, so the preview shows exactly the ends the
  // generated video will have — including "only an intro clip and nothing else".
  const { intro, outro, watermark } = usableEnds(settings, kit);
  if (!intro && !outro && !watermark) return null;

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
    watermark,
    logoUrl: kit.logoUrl,
    brandName: kit.brandName,
    handle: kit.handle,
    cta: kit.outroCta,
    color: kit.color,
    font: kit.font,
  };
}
