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
    // A sequence must be at least as long as the transitions touching it (up to 2×ov for an
    // interior clip) or Remotion throws; otherwise use the clip's own window length.
    const dur = Math.max(ov * 2 + 2, base);
    const media = <Media item={b} />;
    children.push(
      <TransitionSeries.Sequence key={`s${i}`} durationInFrames={dur}>
        {isEntrance(b.transition) ? <BrollEntrance effectId={b.transition}>{media}</BrollEntrance> : media}
      </TransitionSeries.Sequence>,
    );
  });

  // Start the cutaways at the first clip's frame and let the TransitionSeries render its natural
  // length (sum of sequences minus transition overlaps, which is ≤ the mid window). No outer
  // durationInFrames cap — capping truncates the tail mid-transition for 3+ clips; the
  // full-duration backdrop fills any small gap before the avatar-only close, reading smoothly.
  const midFrom = seg.clips.length > 0 ? seg.clips[0]!.fromFrame : 0;

  return (
    <AbsoluteFill>
      {/* full-duration blurred backdrop */}
      <AbsoluteFill>
        <Media item={broll[0]!} />
        <AbsoluteFill style={{ backdropFilter: "blur(24px)", background: "rgba(0,0,0,0.35)" }} />
      </AbsoluteFill>
      {/* sharp cutaways starting at the mid window */}
      <Sequence from={midFrom}>
        <TransitionSeries>{children}</TransitionSeries>
      </Sequence>
    </AbsoluteFill>
  );
};
