// packages/remotion/src/reel/BrollLayer.tsx
import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, useVideoConfig } from "remotion";
import { BrollEntrance, brollTransition, isEntrance, TransitionSeries } from "../broll/effects";
import { brollSegments } from "./timing";

export type ReelBrollItem = { url: string; kind?: "image" | "video"; transition: string };

const COVER: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.85)" };

const Media: React.FC<{ item: ReelBrollItem }> = ({ item }) =>
  item.kind === "video" ? <OffthreadVideo src={item.url} muted style={COVER} /> : <Img src={item.url} style={COVER} />;

/**
 * Full-frame B-roll that fills the ENTIRE reel behind the avatar — the first clip is held through
 * the opening beat, the cutaways transition through the middle, and the last clip is held through
 * the close. There is NO separate backdrop (no gradient / blur / solid) at the start or end: the
 * avatar always sits over real footage.
 *
 * Each cutaway's sequence is sized `base + Tin` (its even window plus its incoming transition), and
 * the first/last clips get extra head/tail padding, so the TransitionSeries spans frame 0 →
 * durationInFrames AND lands every slide exactly on its even boundary (seg.clips[i].fromFrame) —
 * which is where the worker/preview time the transition-whoosh SFX.
 */
export const BrollLayer: React.FC<{ broll: ReelBrollItem[]; words: { start: number; end: number }[] }> = ({
  broll,
  words,
}) => {
  const { fps, width, height, durationInFrames } = useVideoConfig();
  if (broll.length === 0) return null; // no footage → the Reel's own base fill shows (no backdrop treatment)

  const seg = brollSegments(words, broll.length, fps);
  const ov = Math.round(fps * 0.4); // max transition length, used as the sequence floor

  const children: React.ReactNode[] = [];
  broll.forEach((b, i) => {
    if (i > 0) {
      const tr = brollTransition(b.transition, { fps, width, height });
      children.push(<TransitionSeries.Transition key={`t${i}`} presentation={tr.presentation} timing={tr.timing} />);
    }
    const base = seg.clips[i]?.durationInFrames ?? Math.round(durationInFrames / broll.length);
    const from = seg.clips[i]?.fromFrame ?? 0;
    // Tin = this clip's incoming transition frames; adding it makes the TransitionSeries (which
    // pulls each clip earlier by the overlap) land the slide back on its even boundary. Mirrors
    // brollTransition()'s timing: fps*0.4 for real transitions, fps*0.12 for entrance ids.
    const Tin = i > 0 ? Math.max(3, Math.round(fps * (isEntrance(b.transition) ? 0.12 : 0.4))) : 0;
    // First clip extends back over the opening (its fromFrame = the hook length); last clip extends
    // forward to the very end (close + tail). Together the series covers frame 0 → durationInFrames.
    const headPad = i === 0 ? from : 0;
    const tailPad = i === broll.length - 1 ? Math.max(0, durationInFrames - (from + base)) : 0;
    const dur = Math.max(base, ov) + Tin + headPad + tailPad;
    const media = <Media item={b} />;
    children.push(
      <TransitionSeries.Sequence key={`s${i}`} durationInFrames={dur}>
        {isEntrance(b.transition) ? <BrollEntrance effectId={b.transition}>{media}</BrollEntrance> : media}
      </TransitionSeries.Sequence>,
    );
  });

  // Runs from frame 0 (no wrapper Sequence) so the first clip is on screen from the very first frame.
  return (
    <AbsoluteFill>
      <TransitionSeries>{children}</TransitionSeries>
    </AbsoluteFill>
  );
};
