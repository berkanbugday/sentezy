import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import type { EffectProps } from "../types";
import { baseText, Row, stroke, useActiveIndex } from "./common";

/** blurin — each word resolves from a blur + fade as it's spoken; active word accent. */
export const BlurIn: React.FC<EffectProps> = ({ page, font, fontSize, color }) => {
  const frame = useCurrentFrame();
  const active = useActiveIndex(page);
  return (
    <Row gap={fontSize * 0.26}>
      {page.tokens.map((t, i) => {
        const local = frame - t.fromFrame;
        const seen = local >= 0;
        const blur = interpolate(local, [0, 8], [18, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const opacity = interpolate(local, [0, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <span
            key={i}
            style={{
              ...baseText(font, fontSize, 800),
              ...stroke(fontSize * 0.05),
              display: "inline-block",
              filter: `blur(${seen ? blur : 18}px)`,
              opacity: seen ? opacity : 0,
              color: i === active ? color : "#fff",
            }}
          >
            {t.text}
          </span>
        );
      })}
    </Row>
  );
};

/** wave — the spoken word's letters ripple with a staggered vertical bob; active word accent. */
export const Wave: React.FC<EffectProps> = ({ page, font, fontSize, color }) => {
  const frame = useCurrentFrame();
  const active = useActiveIndex(page);
  const amp = fontSize * 0.16;
  return (
    <Row gap={fontSize * 0.26}>
      {page.tokens.map((t, i) => {
        const isA = i === active;
        if (!isA) {
          return (
            <span key={i} style={{ ...baseText(font, fontSize, 800), ...stroke(fontSize * 0.05), color: "#fff" }}>
              {t.text}
            </span>
          );
        }
        const letters = Array.from(t.text);
        return (
          <span key={i} style={{ display: "inline-flex", color }}>
            {letters.map((ch, j) => {
              const y = Math.sin((frame - t.fromFrame) * 0.45 - j * 0.6) * amp;
              return (
                <span
                  key={j}
                  style={{
                    ...baseText(font, fontSize, 800),
                    ...stroke(fontSize * 0.05),
                    color,
                    display: "inline-block",
                    transform: `translateY(${y}px)`,
                    whiteSpace: "pre",
                  }}
                >
                  {ch}
                </span>
              );
            })}
          </span>
        );
      })}
    </Row>
  );
};
