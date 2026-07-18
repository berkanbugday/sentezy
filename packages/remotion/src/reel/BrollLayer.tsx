// packages/remotion/src/reel/BrollLayer.tsx
import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, Sequence, useVideoConfig } from "remotion";
import { BrollEntrance, brollTransition, isEntrance, TransitionSeries } from "../broll/effects";
import { brollSegments } from "./timing";

export type ReelBrollItem = { url: string; kind?: "image" | "video"; transition: string };

const COVER: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.85)" };

const Media: React.FC<{ item: ReelBrollItem }> = ({ item }) =>
  item.kind === "video" ? <OffthreadVideo src={item.url} muted style={COVER} /> : <Img src={item.url} style={COVER} />;

/**
 * Full-frame B-roll: a full-duration blurred backdrop of the first clip (so the avatar-only
 * hook/close read as a soft scene), with the sharp cutaways slotted into the mid window as a
 * TransitionSeries joined by each clip's chosen transition. Even one clip still gets a backdrop.
 */
export const BrollLayer: React.FC<{ broll: ReelBrollItem[]; words: { start: number; end: number }[] }> = ({
  broll,
  words,
}) => {
  const { fps, width, height, durationInFrames } = useVideoConfig();
  if (broll.length === 0) return <AbsoluteFill style={{ background: "radial-gradient(120% 120% at 50% 0%, #1a1c22, #0b0b0d)" }} />;

  const seg = brollSegments(words, broll.length, fps);
  const ov = Math.round(fps * 0.4); // transition overlap

  const children: React.ReactNode[] = [];
  broll.forEach((b, i) => {
    if (i > 0) {
      const tr = brollTransition(b.transition, { fps, width, height });
      children.push(<TransitionSeries.Transition key={`t${i}`} presentation={tr.presentation} timing={tr.timing} />);
    }
    // each clip's window + the overlap it shares with its neighbours' transitions
    const base = seg.clips[i]?.durationInFrames ?? Math.round(durationInFrames / broll.length);
    const extra = (i > 0 ? ov : 0) + (i < broll.length - 1 ? ov : 0);
    const dur = Math.max(ov + 2, base + extra);
    const media = <Media item={b} />;
    children.push(
      <TransitionSeries.Sequence key={`s${i}`} durationInFrames={dur}>
        {isEntrance(b.transition) ? <BrollEntrance effectId={b.transition}>{media}</BrollEntrance> : media}
      </TransitionSeries.Sequence>,
    );
  });

  const midFrom = seg.clips.length > 0 ? seg.clips[0]!.fromFrame : 0;
  const midDur = seg.clips.length > 0 ? seg.midDurationFrames + ov : durationInFrames;

  return (
    <AbsoluteFill>
      {/* full-duration blurred backdrop */}
      <AbsoluteFill>
        <Media item={{ ...broll[0]!, transition: "fade" }} />
        <AbsoluteFill style={{ backdropFilter: "blur(24px)", background: "rgba(0,0,0,0.35)" }} />
      </AbsoluteFill>
      {/* sharp cutaways in the mid window */}
      <Sequence from={midFrom} durationInFrames={Math.max(1, midDur)}>
        <TransitionSeries>{children}</TransitionSeries>
      </Sequence>
    </AbsoluteFill>
  );
};
