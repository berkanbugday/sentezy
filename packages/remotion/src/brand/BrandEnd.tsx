// packages/remotion/src/brand/BrandEnd.tsx
import React from "react";
import { AbsoluteFill, Img, OffthreadVideo } from "remotion";
import { isImageSrc } from "../reel/AvatarLayer";
import { BrandCard } from "./BrandCard";
import type { ReelBrand, ReelBrandEnd } from "./types";

/** Fill the 9:16 frame, cropping the overflow and centring what remains. Shared by both
 *  kinds so an image and a video of the same source ratio are framed identically. */
const FILL: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  objectPosition: "center",
};

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
 * Both kinds are scaled to FILL the 9:16 frame (`cover`), centred. Uploads arrive in every
 * aspect ratio and a reel has exactly one; letterbox bands around a 16:9 upload read as a
 * broken video rather than a deliberate frame. The trade is that a much wider or taller
 * source is cropped at the edges, so anything critical should sit near the centre.
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
          <Img src={end.url} style={FILL} />
        ) : (
          <OffthreadVideo src={end.url} muted style={FILL} />
        )}
      </AbsoluteFill>
    );
  }
  return <BrandCard brand={brand} variant={variant} durationInFrames={durationInFrames} />;
};
