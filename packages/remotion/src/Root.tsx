// packages/remotion/src/Root.tsx
import React from "react";
import { Composition } from "remotion";
import { Reel } from "./reel/Reel";
import type { ReelProps } from "./reel/types";
import { SAMPLE_REEL_PROPS } from "./sample";

/** Duration in frames from the last word's end (+0.3s tail). */
const durationFromWords = (words: { end: number }[] | undefined, fps: number): number => {
  const lastEnd = words && words.length > 0 ? words[words.length - 1]!.end : 5;
  return Math.max(1, Math.ceil((lastEnd + 0.3) * fps));
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Reel"
      component={Reel}
      durationInFrames={150}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={SAMPLE_REEL_PROPS}
      calculateMetadata={({ props }: { props: ReelProps }) => {
        const fps = props.fps ?? 30;
        return {
          durationInFrames: durationFromWords(props.words, fps),
          fps,
          width: props.width ?? 1080,
          height: props.height ?? 1920,
        };
      }}
    />
  );
};
