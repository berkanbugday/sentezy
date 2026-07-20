// packages/remotion/src/reel/Reel.tsx
import React from "react";
import { AbsoluteFill, Audio, Sequence, useVideoConfig } from "remotion";
import { CaptionOverlay } from "../CaptionOverlay";
import { BrandEnd } from "../brand/BrandEnd";
import { reelSegments } from "../brand/timing";
import { Watermark } from "../brand/Watermark";
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
 *
 * Brand kit: an optional intro and outro bracket the body. The body keeps its own clock —
 * everything inside it is timed from the word clock, where frame 0 is the first word, and
 * a <Sequence from={introFrames}> rebases frame 0 for its children. That is what lets the
 * B-roll windows and caption timings carry on working untouched when an intro is added.
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
  brand = null,
}) => {
  const { fps } = useVideoConfig();
  const { introFrames, bodyFrames, outroFrames } = reelSegments(words, brand, fps);
  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0b0d" }}>
      {brand?.intro && (
        <Sequence durationInFrames={introFrames} name="Brand intro">
          <BrandEnd end={brand.intro} brand={brand} variant="intro" durationInFrames={introFrames} />
        </Sequence>
      )}

      <Sequence from={introFrames} durationInFrames={bodyFrames} name="Body">
        <BrollLayer broll={broll} words={words} />
        {avatarUrl && <AvatarLayer src={avatarUrl} avatarPosition={avatarPosition} />}
        {captions && (
          <CaptionOverlay
            words={words}
            styleId={captionStyle.styleId}
            font={captionStyle.font}
            color={captionStyle.color}
            position={position}
          />
        )}
        {/* Body only — the cards already show the logo full-size. */}
        {brand?.watermark && brand.logoUrl && <Watermark url={brand.logoUrl} />}
        {/* SFX cues are timed against the word clock, so they belong to the body's
            rebased frame 0 — unlike the music bed, which spans the whole reel. */}
        {previewAudio && <SfxTrack cues={sfxCues} fps={fps} />}
      </Sequence>

      {brand?.outro && (
        <Sequence from={introFrames + bodyFrames} durationInFrames={outroFrames} name="Brand outro">
          <BrandEnd end={brand.outro} brand={brand} variant="outro" durationInFrames={outroFrames} />
        </Sequence>
      )}

      {/* Root level, not inside the body: the bed runs under the intro and outro too,
          matching the worker's mux, which loops it across the whole file. */}
      {previewAudio && musicUrl && <Audio src={musicUrl} volume={musicVolume} loop />}
    </AbsoluteFill>
  );
};
