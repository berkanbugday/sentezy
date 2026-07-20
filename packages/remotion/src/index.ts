// packages/remotion/src/index.ts
// Library surface for the web app (<Player>) and the Cloudflare renderer.
// NOTE: importing this does NOT call registerRoot — that lives in remotion-entry.ts.
export { CaptionOverlay } from "./CaptionOverlay";
export { EFFECTS } from "./effects/registry";
export { CAPTION_FONT_FAMILIES, ensureFontsLoaded, resolveFamily } from "./fonts";
export { buildPages } from "./timing";
export { SAMPLE_PROPS, SAMPLE_WORDS, SAMPLE_REEL_PROPS } from "./sample";
export type {
  AvatarPosition,
  CaptionCompositionProps,
  CaptionOverlayProps,
  CaptionPosition,
  CaptionWord,
  EffectProps,
} from "./types";

// B-roll effect surface — the web effect-picker previews import these.
export { BrollEffectDemo, brollDemoDurationInFrames } from "./broll/BrollEffectDemo";
export { brollTransition, BrollEntrance, isEntrance } from "./broll/effects";

// The Reel composition — rendered by the web <Player> (preview) AND renderMedia (the actual video).
export { Reel } from "./reel/Reel";
export { brollSegments } from "./reel/timing";
export { isImageSrc } from "./reel/AvatarLayer";
export { SfxTrack, type ResolvedSfxCue } from "./reel/SfxTrack";
export type { ReelProps } from "./reel/types";
export type { ReelBrollItem } from "./reel/BrollLayer";

// Brand kit. `reelSegments` is the single source of truth for reel length and segment
// offsets — the web <Player> must use it rather than computing a duration of its own.
export { BrandCard } from "./brand/BrandCard";
export { readableInk } from "./brand/contrast";
export { BrandEnd } from "./brand/BrandEnd";
export { Watermark } from "./brand/Watermark";
export {
  CARD_INTRO_FRAMES,
  CARD_INTRO_SECONDS,
  CARD_OUTRO_FRAMES,
  CARD_OUTRO_SECONDS,
  reelSegments,
  type ReelSegments,
} from "./brand/timing";
export type { ReelBrand, ReelBrandEnd } from "./brand/types";
