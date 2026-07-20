// packages/remotion/src/brand/BrandCard.tsx
import React from "react";
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { resolveFamily } from "../fonts";
import { readableInk } from "./contrast";
import type { ReelBrand } from "./types";

/**
 * The generated intro/outro card: logo over the brand name, handle beneath, plus the CTA
 * on the outro. Rendered identically in the <Player> preview and the final mp4.
 *
 * Motion is a single spring on the whole stack with a fade at the tail. Remotion renders
 * frame-by-frame with no access to the viewer's motion preference, and a preference read
 * at render time would bake one user's setting into a shared file — so the animation is
 * kept deliberately small (a short rise and fade, no spin or slide) rather than gated.
 */
export const BrandCard: React.FC<{
  brand: ReelBrand;
  variant: "intro" | "outro";
  durationInFrames: number;
}> = ({ brand, variant, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  const rise = spring({ frame, fps, config: { damping: 200 }, durationInFrames: Math.min(20, durationInFrames) });
  // Fade the last 8 frames so the cut into (or out of) the body is not abrupt.
  const fade = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const ink = readableInk(brand.color);
  const font = resolveFamily(brand.font);
  const scale = width / 1080; // all sizes below are authored against the 1080-wide frame

  return (
    <AbsoluteFill
      style={{
        backgroundColor: brand.color,
        justifyContent: "center",
        alignItems: "center",
        opacity: fade,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24 * scale,
          transform: `translateY(${interpolate(rise, [0, 1], [28, 0]) * scale}px)`,
          opacity: rise,
          padding: 80 * scale,
          textAlign: "center",
        }}
      >
        {brand.logoUrl && (
          <Img
            src={brand.logoUrl}
            style={{ width: 420 * scale, maxHeight: 420 * scale, objectFit: "contain" }}
          />
        )}
        {brand.brandName && (
          <div
            style={{
              fontFamily: font,
              fontWeight: 700,
              fontSize: 84 * scale,
              lineHeight: 1.05,
              color: ink,
            }}
          >
            {brand.brandName}
          </div>
        )}
        {brand.handle && (
          <div style={{ fontFamily: font, fontWeight: 500, fontSize: 40 * scale, color: ink, opacity: 0.7 }}>
            {brand.handle}
          </div>
        )}
        {variant === "outro" && brand.cta && (
          <div
            style={{
              marginTop: 16 * scale,
              fontFamily: font,
              fontWeight: 600,
              fontSize: 46 * scale,
              color: brand.color,
              backgroundColor: ink,
              padding: `${20 * scale}px ${44 * scale}px`,
              borderRadius: 999,
            }}
          >
            {brand.cta}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
