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
 * Full-frame B-roll: a clean dark backdrop behind the avatar-only hook/close beats (NO blur —
 * a blurred still read as a smeary intro/outro), with the sharp cutaways slotted into the mid
 * window as a TransitionSeries joined by each clip's chosen transition.
 *
 * Each cutaway's sequence is sized `base + Tin` (its even window plus its incoming transition),
 * so the TransitionSeries lays every slide down exactly on its even boundary. That keeps the
 * visible slide aligned with the transition-whoosh SFX, which the worker/preview time off the
 * same `brollSegments` boundaries.
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
    // Size the sequence as its even window (base) + its incoming transition frames (Tin), so the
    // TransitionSeries — which pulls each clip earlier by the transition overlap — lands every
    // slide back on its even boundary (seg.clips[i].fromFrame). `max(base, ov)` floors it so the
    // sequence is always ≥ the transitions touching it (Remotion throws otherwise). Mirrors
    // brollTransition()'s timing: fps*0.4 for real transitions, fps*0.12 for entrance ids.
    const base = seg.clips[i]?.durationInFrames ?? Math.round(durationInFrames / broll.length);
    const Tin = i > 0 ? Math.max(3, Math.round(fps * (isEntrance(b.transition) ? 0.12 : 0.4))) : 0;
    const dur = Math.max(base, ov) + Tin;
    const media = <Media item={b} />;
    children.push(
      <TransitionSeries.Sequence key={`s${i}`} durationInFrames={dur}>
        {isEntrance(b.transition) ? <BrollEntrance effectId={b.transition}>{media}</BrollEntrance> : media}
      </TransitionSeries.Sequence>,
    );
  });

  // Start the cutaways at the first clip's frame; the sized sequences make the series span exactly
  // the mid window, so it ends right as the avatar-only close begins (no cap needed).
  const midFrom = seg.clips.length > 0 ? seg.clips[0]!.fromFrame : 0;

  return (
    <AbsoluteFill>
      {/* clean dark backdrop for the avatar-only hook/close — no blur */}
      <AbsoluteFill style={{ background: "radial-gradient(120% 120% at 50% 0%, #1a1c22, #0b0b0d)" }} />
      {/* sharp cutaways starting at the mid window */}
      <Sequence from={midFrom}>
        <TransitionSeries>{children}</TransitionSeries>
      </Sequence>
    </AbsoluteFill>
  );
};
