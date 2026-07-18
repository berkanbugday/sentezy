import React from "react";
import { AbsoluteFill, Img, useVideoConfig } from "remotion";
import { CaptionOverlay } from "../CaptionOverlay";
import type { CaptionOverlayProps, CaptionWord } from "../types";
import { type ResolvedSfxCue, SfxTrack } from "./SfxTrack";

export type ReelPreviewProps = {
  words: CaptionWord[];
  avatarImageUrl?: string | null;
  backdropUrl?: string | null;
  captionStyle: { styleId: CaptionOverlayProps["styleId"]; font: string; color: string };
  layout: CaptionOverlayProps["layout"];
  position: CaptionOverlayProps["position"];
  avatarSide: CaptionOverlayProps["avatarSide"];
  captions: boolean;
  sfxCues: ResolvedSfxCue[];
};

/**
 * Preview-only reel: static B-roll backdrop + avatar still + live captions + SFX audio.
 * Renders in the web <Player> only (NOT registerRoot / renderMedia). v1 shows the first
 * B-roll image as a static backdrop; slide-transition visuals are deferred (SFX audio still plays).
 */
export const ReelPreview: React.FC<ReelPreviewProps> = ({
  words,
  avatarImageUrl,
  backdropUrl,
  captionStyle,
  layout,
  position,
  avatarSide,
  captions,
  sfxCues,
}) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0b0d" }}>
      {backdropUrl && (
        <Img src={backdropUrl} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.8)" }} />
      )}
      {avatarImageUrl && (
        <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: avatarSide === "left" ? "flex-start" : "flex-end" }}>
          <Img src={avatarImageUrl} style={{ height: "58%", objectFit: "contain" }} />
        </AbsoluteFill>
      )}
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
      <SfxTrack cues={sfxCues} fps={fps} />
    </AbsoluteFill>
  );
};
