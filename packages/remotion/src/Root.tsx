// packages/remotion/src/Root.tsx
import React from "react";
import { Composition } from "remotion";
import { reelSegments } from "./brand/timing";
import { Reel } from "./reel/Reel";
import type { ReelProps } from "./reel/types";
import { SAMPLE_REEL_PROPS } from "./sample";

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
          // reelSegments is the one place reel length is decided — see brand/timing.ts.
          durationInFrames: reelSegments(props.words ?? [], props.brand ?? null, fps).totalFrames,
          fps,
          width: props.width ?? 1080,
          height: props.height ?? 1920,
        };
      }}
    />
  );
};
