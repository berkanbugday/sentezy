// packages/remotion/src/index.ts
// Library surface for the web app (<Player>) and the Cloudflare renderer.
// NOTE: importing this does NOT call registerRoot — that lives in remotion-entry.ts.
export { CaptionOverlay } from "./CaptionOverlay";
export { EFFECTS } from "./effects/registry";
export { CAPTION_FONT_FAMILIES, ensureFontsLoaded, resolveFamily } from "./fonts";
export { buildPages } from "./timing";
export { SAMPLE_PROPS, SAMPLE_WORDS, SAMPLE_REEL_PROPS } from "./sample";
export type {
  CaptionCompositionProps,
  CaptionLayout,
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
export { SfxTrack, type ResolvedSfxCue } from "./reel/SfxTrack";
export type { ReelProps } from "./reel/types";
export type { ReelBrollItem } from "./reel/BrollLayer";
