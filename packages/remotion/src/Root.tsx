import React from "react";
import { Composition } from "remotion";
import { CaptionOverlay } from "./CaptionOverlay";
import { SAMPLE_PROPS } from "./sample";
import type { CaptionCompositionProps } from "./types";

/** Composition wrapper: accepts the render dims as props (read by calculateMetadata) and
 *  forwards to the overlay, which reads the resolved config via useVideoConfig. */
const CaptionComposition: React.FC<CaptionCompositionProps> = (props) => <CaptionOverlay {...props} />;

/** Duration in frames from the last word's end (+0.3s tail). Shared by both compositions. */
const durationFromWords = (words: { end: number }[] | undefined, fps: number): number => {
  const lastEnd = words && words.length > 0 ? words[words.length - 1]!.end : 5;
  return Math.max(1, Math.ceil((lastEnd + 0.3) * fps));
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="CaptionOverlay"
        component={CaptionComposition}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={SAMPLE_PROPS}
        calculateMetadata={({ props }: { props: CaptionCompositionProps }) => {
          const fps = props.fps ?? 30;
          return {
            durationInFrames: durationFromWords(props.words, fps),
            fps,
            width: props.width ?? 1080,
            height: props.height ?? 1920,
          };
        }}
      />
    </>
  );
};
