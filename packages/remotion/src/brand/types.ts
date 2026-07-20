// packages/remotion/src/brand/types.ts
import type { BrandCrop } from "./crop";

/** How one end of the reel is filled: the generated card, or an uploaded clip that
 *  replaces it. `durationInFrames` for a clip is resolved by the caller (from the ms
 *  measured at upload) so the preview and the render never disagree about its length. */
export type ReelBrandEnd =
  | { kind: "card" }
  | { kind: "clip"; url: string; durationInFrames: number; crop?: BrandCrop | null };

/** The brand kit as the composition consumes it — URLs already signed, durations already
 *  in frames. Built from `options.branding.kit` by the web composer (preview) and by the
 *  worker (render); the two must produce the same object for a given video. */
export type ReelBrand = {
  /** null = this end is switched off for this video. */
  intro: ReelBrandEnd | null;
  outro: ReelBrandEnd | null;
  /** Corner logo over the body. Does not affect timing. */
  watermark: boolean;
  logoUrl: string | null;
  brandName: string | null;
  handle: string | null;
  /** Outro call-to-action line. */
  cta: string | null;
  color: string;
  font: string;
};
