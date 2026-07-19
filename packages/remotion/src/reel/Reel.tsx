// packages/remotion/src/reel/Reel.tsx
import React from "react";
import { AbsoluteFill, Audio, useVideoConfig } from "remotion";
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
  avatarPosition,
  position,
  captions,
  previewAudio,
  sfxCues,
  musicUrl,
  musicVolume,
}) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0b0d" }}>
      <BrollLayer broll={broll} words={words} />
      {avatarUrl && <AvatarLayer src={avatarUrl} avatarPosition={avatarPosition} />}
      {captions && (
        <CaptionOverlay
          words={words}
          styleId={captionStyle.styleId}
          font={captionStyle.font}
          color={captionStyle.color}
          avatarPosition={avatarPosition}
          position={position}
        />
      )}
      {previewAudio && musicUrl && <Audio src={musicUrl} volume={musicVolume} loop />}
      {previewAudio && <SfxTrack cues={sfxCues} fps={fps} />}
    </AbsoluteFill>
  );
};
