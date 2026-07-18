// packages/remotion/src/reel/Reel.tsx
import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { CaptionOverlay } from "../CaptionOverlay";
import { AvatarLayer } from "./AvatarLayer";
import { BrollLayer } from "./BrollLayer";
import { SfxTrack } from "./SfxTrack";
import type { ReelProps } from "./types";

/**
 * THE reel composition. Rendered identically by the web <Player> (preview) and by
 * renderMedia in the Cloudflare renderer (the actual opaque H.264). The ONLY per-context
 * difference is avatarUrl: a still image in the browser, the matte .mov in the render
 * (AvatarLayer branches on the src). Audio is preview-only; the render is opaque + silent
 * and the worker muxes the final audio with ffmpeg.
 */
export const Reel: React.FC<ReelProps> = ({
  words,
  avatarUrl,
  broll,
  captionStyle,
  layout,
  position,
  avatarSide,
  captions,
  previewAudio,
  sfxCues,
}) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0b0d" }}>
      <BrollLayer broll={broll} words={words} />
      {avatarUrl && <AvatarLayer src={avatarUrl} avatarSide={avatarSide} avatarLayout={layout} />}
      {captions && (
        <CaptionOverlay
          words={words}
          styleId={captionStyle.styleId}
          font={captionStyle.font}
          color={captionStyle.color}
          layout={layout}
          position={position}
          avatarSide={avatarSide}
        />
      )}
      {previewAudio && <SfxTrack cues={sfxCues} fps={fps} />}
    </AbsoluteFill>
  );
};
