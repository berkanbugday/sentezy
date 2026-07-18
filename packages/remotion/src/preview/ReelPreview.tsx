import React from "react";
import { AbsoluteFill, Img, useVideoConfig } from "remotion";
import { BrollEntrance, brollTransition, isEntrance, TransitionSeries } from "../broll/effects";
import { CaptionOverlay } from "../CaptionOverlay";
import type { CaptionOverlayProps, CaptionWord } from "../types";
import { type ResolvedSfxCue, SfxTrack } from "./SfxTrack";

/** One preview B-roll clip: an image (or video poster) URL + its incoming transition id. */
export type PreviewBrollItem = { url: string; transition: string };

export type ReelPreviewProps = {
  words: CaptionWord[];
  avatarImageUrl?: string | null;
  broll?: PreviewBrollItem[];
  captionStyle: { styleId: CaptionOverlayProps["styleId"]; font: string; color: string };
  layout: CaptionOverlayProps["layout"];
  position: CaptionOverlayProps["position"];
  avatarSide: CaptionOverlayProps["avatarSide"];
  captions: boolean;
  sfxCues: ResolvedSfxCue[];
};

const COVER: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.85)" };

/**
 * The full-frame B-roll slideshow: each uploaded clip shown in turn, joined by its chosen
 * transition — the SAME `brollTransition`/`BrollEntrance` the real reel uses, so the preview
 * shows the actual slide effects. Clips are evenly spaced across the composition duration.
 */
const BrollSlideshow: React.FC<{ broll: PreviewBrollItem[] }> = ({ broll }) => {
  const { durationInFrames, fps, width, height } = useVideoConfig();
  if (broll.length === 0) return null;
  if (broll.length === 1) return <Img src={broll[0]!.url} style={COVER} />;

  const ov = Math.round(fps * 0.4); // transition overlap
  const n = broll.length;
  // TransitionSeries total = sum(sequences) - sum(transitions); solve for even sequences.
  const seq = Math.max(ov + 2, Math.round((durationInFrames + (n - 1) * ov) / n));

  const children: React.ReactNode[] = [];
  broll.forEach((b, i) => {
    if (i > 0) {
      const tr = brollTransition(b.transition, { fps, width, height });
      children.push(<TransitionSeries.Transition key={`t${i}`} presentation={tr.presentation} timing={tr.timing} />);
    }
    const img = <Img src={b.url} style={COVER} />;
    children.push(
      <TransitionSeries.Sequence key={`s${i}`} durationInFrames={seq}>
        {isEntrance(b.transition) ? <BrollEntrance effectId={b.transition}>{img}</BrollEntrance> : img}
      </TransitionSeries.Sequence>,
    );
  });
  return <TransitionSeries>{children}</TransitionSeries>;
};

/**
 * Preview-only reel: B-roll slideshow (with the real slide transitions) + avatar still +
 * live captions + SFX audio. Renders in the web <Player> ONLY (never registerRoot / renderMedia).
 * Audio (SfxTrack) is only audible when the host <Player> actually plays (not while scrubbing).
 */
export const ReelPreview: React.FC<ReelPreviewProps> = ({
  words,
  avatarImageUrl,
  broll,
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
      <BrollSlideshow broll={broll ?? []} />
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
