import React from "react";
import { Audio, Sequence } from "remotion";

export type ResolvedSfxCue = { src: string; time: number; gain: number };

/** Plays each resolved SFX cue at its frame. Used only in the web <Player> preview. */
export const SfxTrack: React.FC<{ cues: ResolvedSfxCue[]; fps: number }> = ({ cues, fps }) => (
  <>
    {cues.map((c, i) => (
      <Sequence key={i} from={Math.max(0, Math.round(c.time * fps))}>
        <Audio src={c.src} volume={Math.max(0, Math.min(1, c.gain))} />
      </Sequence>
    ))}
  </>
);
