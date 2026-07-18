import type { CSSProperties } from "react";
import type { AvatarSide, CaptionLayout, CaptionPosition } from "./types";

/**
 * Compute the absolute box the caption block lives in, mirroring the worker's ASS
 * margin logic (build_captions_ass, compose.py:232-248) so Remotion captions land in
 * the same clear area:
 *  - "bottom" layout: avatar is bottom-centred, B-roll fills a top band → captions span
 *    full width, anchored high (top) or mid (bottom position).
 *  - "side" layout: avatar occupies one half → captions centre in the clear opposite half.
 */
export function captionBox(opts: {
  width: number;
  height: number;
  layout: CaptionLayout;
  position: CaptionPosition;
  avatarSide: AvatarSide;
}): CSSProperties {
  const { width, position } = opts;
  const edge = Math.round(width * 0.06);

  // Big, centred captions: full width, sitting around the vertical middle (a touch above true
  // centre so the small bottom-anchored avatar has room). `position` nudges it up (top) or down.
  const centerPct = position === "top" ? 26 : 40;

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
export function captionBoxWidth(opts: { width: number; layout: CaptionLayout }): number {
  // Captions are full-width now (centred), so the usable width is the frame minus both edge insets.
  return opts.width - 2 * opts.width * 0.06;
}
