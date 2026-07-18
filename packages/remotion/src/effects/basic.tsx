import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import type { EffectProps } from "../types";
import { baseText, Row, stroke, useActiveIndex } from "./common";

/** clean — minimal short phrase, gentle fade in/out, no per-word emphasis. */
export const Clean: React.FC<EffectProps> = ({ page, font, fontSize }) => {
  const frame = useCurrentFrame();
  const dur = page.durationInFrames;
  const opacity = interpolate(frame, [0, 6, Math.max(7, dur - 6), dur], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <Row gap={fontSize * 0.28} style={{ opacity }}>
      {page.tokens.map((t, i) => (
        <span key={i} style={{ ...baseText(font, fontSize, 700), ...stroke(fontSize * 0.04) }}>
          {t.text}
        </span>
      ))}
    </Row>
  );
};

/** karaoke — phrase visible; each word colour-fills to the accent as the playhead crosses it. */
export const Karaoke: React.FC<EffectProps> = ({ page, font, fontSize, color }) => {
  const active = useActiveIndex(page);
  return (
    <Row gap={fontSize * 0.28}>
      {page.tokens.map((t, i) => {
        const spoken = i <= active;
        return (
          <span
            key={i}
            style={{
              ...baseText(font, fontSize, 800),
              ...stroke(fontSize * 0.05),
              color: spoken ? color : "#fff",
              opacity: spoken ? 1 : 0.55,
            }}
          >
            {t.text}
          </span>
        );
      })}
    </Row>
  );
};

/** typewriter — cumulative word reveal with a blinking caret. */
export const Typewriter: React.FC<EffectProps> = ({ page, font, fontSize }) => {
  const frame = useCurrentFrame();
  const active = useActiveIndex(page);
  const caretOn = frame % 20 < 12;
  return (
    <Row gap={fontSize * 0.28}>
      {page.tokens.slice(0, active + 1).map((t, i) => (
        <span key={i} style={{ ...baseText(font, fontSize, 700), ...stroke(fontSize * 0.045) }}>
          {t.text}
        </span>
      ))}
      <span
        style={{
          ...baseText(font, fontSize, 700),
          opacity: caretOn ? 1 : 0,
          marginLeft: fontSize * 0.05,
        }}
      >
        |
      </span>
    </Row>
  );
};
