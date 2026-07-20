// packages/remotion/src/brand/BrandEnd.tsx
import React from "react";
import { AbsoluteFill, Img, OffthreadVideo } from "remotion";
import { isImageSrc } from "../reel/AvatarLayer";
import { BrandCard } from "./BrandCard";
import type { ReelBrand, ReelBrandEnd } from "./types";

/**
 * One end of the reel — the generated card, or the user's own media in its place.
 *
 * Uploaded media plays inside the composition rather than being concatenated onto the
 * finished mp4. That keeps the worker's `-c:v copy` mux intact (a concat would force a
 * full re-encode of every reel) and keeps the <Player> preview and the render the same
 * composition, which is this package's core invariant.
 *
 * Image vs video is decided by the source extension, exactly as AvatarLayer does it —
 * `isImageSrc` ignores the query string, which matters because these are signed R2 URLs.
 * An image needs no separate stored kind: it simply holds the frame for its duration.
 *
 * `muted`: the render is opaque and silent by design — the worker attaches all audio
 * afterwards with ffmpeg. Leaving a clip audible here would play it in the preview and
 * then drop it from the final file, which is worse than consistently silent.
 */
export const BrandEnd: React.FC<{
  end: ReelBrandEnd;
  brand: ReelBrand;
  variant: "intro" | "outro";
  durationInFrames: number;
}> = ({ end, brand, variant, durationInFrames }) => {
  if (end.kind === "clip") {
    return (
      <AbsoluteFill style={{ backgroundColor: brand.color }}>
        {isImageSrc(end.url) ? (
          // contain, not cover: an end-card is usually designed to be seen whole, and the
          // brand colour behind it fills whatever the aspect ratio leaves over.
          <Img src={end.url} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        ) : (
          <OffthreadVideo src={end.url} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}
      </AbsoluteFill>
    );
  }
  return <BrandCard brand={brand} variant={variant} durationInFrames={durationInFrames} />;
};
