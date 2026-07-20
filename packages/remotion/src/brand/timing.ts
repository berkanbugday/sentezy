// packages/remotion/src/brand/timing.ts
import type { ReelBrand, ReelBrandEnd } from "./types";

/** Generated-card lengths, in seconds. A clip end overrides these with its own duration. */
export const CARD_INTRO_SECONDS = 1.5;
export const CARD_OUTRO_SECONDS = 2;

/** The card lengths at the default 30fps, exported for callers that reason in frames. */
export const CARD_INTRO_FRAMES = Math.round(CARD_INTRO_SECONDS * 30);
export const CARD_OUTRO_FRAMES = Math.round(CARD_OUTRO_SECONDS * 30);

export type ReelSegments = {
  introFrames: number;
  bodyFrames: number;
  outroFrames: number;
  totalFrames: number;
};

/** The body length: the last word's end plus a 0.3s tail. This is the rule the reel has
 *  always used — it is reproduced here unchanged so that a video with no branding comes
 *  out exactly the length it did before this feature existed. */
function bodyFrames(words: { end: number }[], fps: number): number {
  const lastEnd = words.length > 0 ? words[words.length - 1]!.end : 5;
  return Math.max(1, Math.ceil((lastEnd + 0.3) * fps));
}

function endFrames(end: ReelBrandEnd | null, cardSeconds: number, fps: number): number {
  if (!end) return 0;
  if (end.kind === "clip") return Math.max(1, Math.round(end.durationInFrames));
  return Math.round(cardSeconds * fps);
}

/**
 * THE source of truth for how long a reel is and where its parts sit.
 *
 * Four things must agree on these numbers or the render drifts from the preview:
 * `Root.tsx`'s calculateMetadata, the web `<Player>`, this composition's `<Sequence>`
 * offsets, and the worker's Python mirror (which uses `introFrames` to delay the
 * voiceover and `totalFrames` to pad it). Change the rule here and nowhere else.
 */
export function reelSegments(
  words: { end: number }[],
  brand: ReelBrand | null,
  fps: number,
): ReelSegments {
  const intro = endFrames(brand?.intro ?? null, CARD_INTRO_SECONDS, fps);
  const outro = endFrames(brand?.outro ?? null, CARD_OUTRO_SECONDS, fps);
  const body = bodyFrames(words, fps);
  return {
    introFrames: intro,
    bodyFrames: body,
    outroFrames: outro,
    totalFrames: intro + body + outro,
  };
}
