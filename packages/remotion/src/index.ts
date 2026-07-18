// Library surface for the web app (<Player>) and the Cloudflare renderer.
// NOTE: importing this does NOT call registerRoot — that lives in remotion-entry.ts,
// the CLI/bundle entry — so the web app can import components without the Remotion runtime.
export { CaptionOverlay } from "./CaptionOverlay";
export { EFFECTS } from "./effects/registry";
export { CAPTION_FONT_FAMILIES, ensureFontsLoaded, resolveFamily } from "./fonts";
export { buildPages } from "./timing";
export { SAMPLE_PROPS, SAMPLE_WORDS } from "./sample";
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

// Preview-only surface — renders in the web <Player> only, never registered in Root.tsx.
export { ReelPreview } from "./preview/ReelPreview";
export type { ReelPreviewProps } from "./preview/ReelPreview";
export { SfxTrack, type ResolvedSfxCue } from "./preview/SfxTrack";
