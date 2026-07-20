// packages/remotion/src/brand/Watermark.tsx
import React from "react";
import { AbsoluteFill, Img, useVideoConfig } from "remotion";

/**
 * The persistent corner logo. Mounted INSIDE the body sequence so it never covers the
 * intro/outro cards — those already show the logo at full size, and stacking the two
 * looks like a bug.
 *
 * Top-right: the bottom of a 9:16 reel belongs to the captions and the avatar, and the
 * top-left is where most platforms overlay their own UI.
 */
export const Watermark: React.FC<{ url: string }> = ({ url }) => {
  const { width } = useVideoConfig();
  const size = width * 0.1;
  const inset = width * 0.045;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "flex-end" }}>
      <Img
        src={url}
        style={{
          width: size,
          maxHeight: size,
          objectFit: "contain",
          margin: inset,
          opacity: 0.6,
        }}
      />
    </AbsoluteFill>
  );
};
