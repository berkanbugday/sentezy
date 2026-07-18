import type { CaptionStyleId } from "@sentezy/types";
import type React from "react";
import type { EffectProps } from "../types";
import { Clean, Karaoke, Typewriter } from "./basic";
import { Boxed, BoxReveal, Bubble, Highlight, Highlighter } from "./box";
import { Glow, Gradient, Keyword, Rainbow } from "./color";
import { Emoji } from "./emoji";
import { BlurIn, Wave } from "./motion";
import { Beast, Bounce, Hormozi, SpringPop, TikTok } from "./pop";

export type EffectMeta = {
  /** Words shown per page (chunk size), mirroring the worker's per-style chunk. */
  perChunk: number;
  /** Font size = max(minSize, round(height × fontScale)). */
  fontScale: number;
  minSize: number;
  Component: React.FC<EffectProps>;
};

/** id → effect. Typed as a full Record so TS fails the build if any of the 20 ids is missing. */
export const EFFECTS: Record<CaptionStyleId, EffectMeta> = {
  clean: { perChunk: 5, fontScale: 0.042, minSize: 34, Component: Clean },
  karaoke: { perChunk: 3, fontScale: 0.045, minSize: 36, Component: Karaoke },
  tiktok: { perChunk: 3, fontScale: 0.05, minSize: 40, Component: TikTok },
  hormozi: { perChunk: 2, fontScale: 0.056, minSize: 44, Component: Hormozi },
  beast: { perChunk: 2, fontScale: 0.066, minSize: 50, Component: Beast },
  boxed: { perChunk: 4, fontScale: 0.044, minSize: 34, Component: Boxed },
  keyword: { perChunk: 4, fontScale: 0.05, minSize: 40, Component: Keyword },
  bubble: { perChunk: 3, fontScale: 0.046, minSize: 36, Component: Bubble },
  highlight: { perChunk: 4, fontScale: 0.048, minSize: 38, Component: Highlight },
  typewriter: { perChunk: 5, fontScale: 0.044, minSize: 34, Component: Typewriter },
  spring: { perChunk: 3, fontScale: 0.052, minSize: 40, Component: SpringPop },
  gradient: { perChunk: 3, fontScale: 0.052, minSize: 40, Component: Gradient },
  blurin: { perChunk: 3, fontScale: 0.05, minSize: 40, Component: BlurIn },
  highlighter: { perChunk: 4, fontScale: 0.048, minSize: 38, Component: Highlighter },
  boxreveal: { perChunk: 3, fontScale: 0.05, minSize: 40, Component: BoxReveal },
  rainbow: { perChunk: 3, fontScale: 0.05, minSize: 40, Component: Rainbow },
  emoji: { perChunk: 3, fontScale: 0.052, minSize: 40, Component: Emoji },
  bounce: { perChunk: 3, fontScale: 0.052, minSize: 40, Component: Bounce },
  wave: { perChunk: 3, fontScale: 0.052, minSize: 40, Component: Wave },
  glow: { perChunk: 3, fontScale: 0.052, minSize: 40, Component: Glow },
};
