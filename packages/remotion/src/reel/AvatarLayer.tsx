// packages/remotion/src/reel/AvatarLayer.tsx
import React from "react";
import { AbsoluteFill, Img, OffthreadVideo } from "remotion";
import type { AvatarPosition } from "../types";

/** True when the src is a still image (data/blob URL or image extension) vs a video matte. */
export function isImageSrc(src: string): boolean {
  const s = src.split("?")[0]!.toLowerCase();
  if (s.startsWith("data:image") || s.startsWith("blob:")) return true;
  if (/\.(mov|webm|mp4|m4v)$/.test(s)) return false;
  return /\.(png|jpe?g|webp|gif|avif|svg)$/.test(s) || s.startsWith("data:");
}

/**
 * The bottom-anchored avatar. In the browser <Player> the src is a still image (<Img>);
 * in the renderer it is the ProRes-4444 matte .mov, drawn with <OffthreadVideo transparent>
 * so its alpha composites over the B-roll. Framing (scale/anchor/side) lives here — the
 * single source of avatar placement for both preview and render.
 */
export const AvatarLayer: React.FC<{
  src: string;
  avatarPosition: AvatarPosition;
}> = ({ src, avatarPosition }) => {
  const heightPct = avatarPosition === "center" ? "54%" : "48%";
  const align = avatarPosition === "center" ? "center" : avatarPosition === "left" ? "flex-start" : "flex-end";
  const media = isImageSrc(src) ? (
    <Img src={src} style={{ height: heightPct, objectFit: "contain" }} />
  ) : (
    <OffthreadVideo src={src} transparent style={{ height: heightPct, objectFit: "contain" }} />
  );
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: align }}>{media}</AbsoluteFill>
  );
};
