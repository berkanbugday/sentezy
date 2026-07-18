import type { BrollEffectId } from "@sentezy/types";
import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { BrollEntrance, brollTransition, isEntrance, TransitionSeries } from "./effects";

/** A demo "clip" — a bold gradient panel with a number, so the transition between two is legible. */
const Panel: React.FC<{ n: number; from: string; to: string }> = ({ n, from, to }) => {
  const { height } = useVideoConfig();
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${from}, ${to})`,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          fontFamily: "system-ui, sans-serif",
          fontWeight: 900,
          fontSize: Math.round(height * 0.4),
          color: "rgba(255,255,255,0.92)",
          textShadow: "0 4px 18px rgba(0,0,0,0.35)",
          lineHeight: 1,
        }}
      >
        {n}
      </div>
    </AbsoluteFill>
  );
};

/**
 * Two demo clips with the given effect between them — the SAME `brollTransition`/`BrollEntrance`
 * the reel uses, so the picker preview is exactly what renders. Used by the web effect tiles via
 * `<Thumbnail>`/`<Player>`.
 */
export const BrollEffectDemo: React.FC<{ effectId: BrollEffectId }> = ({ effectId }) => {
  const { fps, width, height } = useVideoConfig();
  const tr = brollTransition(effectId, { fps, width, height });
  const entrance = isEntrance(effectId);
  const clipA = Math.round(fps * 0.7);
  const clipB = Math.round(fps * 1.0);
  const overlap = Math.round(fps * 0.4);

  const panelB = <Panel n={2} from="#7C3AED" to="#DB2777" />;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={clipA + overlap}>
          <Panel n={1} from="#0EA5A5" to="#2563EB" />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={tr.presentation} timing={tr.timing} />
        <TransitionSeries.Sequence durationInFrames={clipB}>
          {entrance ? <BrollEntrance effectId={effectId}>{panelB}</BrollEntrance> : panelB}
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};

/** Total demo duration in frames (for the web <Player>/<Thumbnail> config). */
export const brollDemoDurationInFrames = (fps: number): number => Math.round(fps * 0.7 + fps * 1.0 + fps * 0.4);
