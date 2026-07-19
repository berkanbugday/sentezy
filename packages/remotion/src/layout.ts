import type { CSSProperties } from "react";
import type { CaptionPosition } from "./types";

/**
 * Compute the absolute box the caption block lives in. The box is anchored by its vertical
 * CENTRE (`top: N%` + translateY(-50%)) and spans the full frame width minus a 6% inset on
 * each side — big, centred captions are the deliberate look.
 *
 * `position` picks a real band, not a nudge:
 *  - "top"    → an upper band at 14%, clear of the platform chrome at the very top.
 *  - "bottom" → a lower band at 84%.
 * The bands are the same whatever the avatar does. A bottom-centred avatar used to lift the
 * bottom band to 62% to clear its head, which meant "Alt" landed in a different place for
 * one avatar position than the other two; captions over the chest is the intended look.
 */
export function captionBox(opts: {
  width: number;
  height: number;
  position: CaptionPosition;
}): CSSProperties {
  const { width, position } = opts;
  const edge = Math.round(width * 0.06);
  const centerPct = position === "top" ? 14 : 84;

  return {
    position: "absolute",
    left: edge,
    right: edge,
    top: `${centerPct}%`,
    transform: "translateY(-50%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
  };
}

/** The usable caption width in px (frame width minus the box's left+right insets) — used to
 *  auto-fit the font so the longest word never overflows or has to break mid-word. Mirrors the
 *  inset math in `captionBox`. */
export function captionBoxWidth(opts: { width: number }): number {
  // Captions are full-width now (centred), so the usable width is the frame minus both edge insets.
  return opts.width - 2 * opts.width * 0.06;
}
