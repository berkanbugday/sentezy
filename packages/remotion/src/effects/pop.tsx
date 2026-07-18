import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { EffectProps } from "../types";
import { baseText, Row, stroke, trUpper, useActiveIndex } from "./common";

/** tiktok — chunk stays white; the spoken word pops up in the accent colour. */
export const TikTok: React.FC<EffectProps> = ({ page, font, fontSize, color, fps }) => {
  const frame = useCurrentFrame();
  const active = useActiveIndex(page);
  return (
    <Row gap={fontSize * 0.26}>
      {page.tokens.map((t, i) => {
        const isA = i === active;
        const pop = isA ? spring({ frame: frame - t.fromFrame, fps, config: { damping: 12, stiffness: 200, mass: 0.5 } }) : 1;
        const scale = isA ? interpolate(pop, [0, 1], [1.3, 1]) : 1;
        return (
          <span
            key={i}
            style={{
              ...baseText(font, fontSize, 800),
              ...stroke(fontSize * 0.06),
              display: "inline-block",
              transform: `scale(${scale})`,
              color: isA ? color : "#fff",
            }}
          >
            {t.text}
          </span>
        );
      })}
    </Row>
  );
};

/** hormozi — big bold UPPERCASE 2-word chunks; the spoken word turns accent. */
export const Hormozi: React.FC<EffectProps> = ({ page, font, fontSize, color }) => {
  const active = useActiveIndex(page);
  return (
    <Row gap={fontSize * 0.24}>
      {page.tokens.map((t, i) => (
        <span
          key={i}
          style={{
            ...baseText(font, fontSize, 900),
            ...stroke(fontSize * 0.08),
            color: i === active ? color : "#fff",
          }}
        >
          {trUpper(t.text)}
        </span>
      ))}
    </Row>
  );
};

/** beast — huge UPPERCASE 1–2 words with a hard scale punch on the active word. */
export const Beast: React.FC<EffectProps> = ({ page, font, fontSize, color, fps }) => {
  const frame = useCurrentFrame();
  const active = useActiveIndex(page);
  return (
    <Row gap={fontSize * 0.2}>
      {page.tokens.map((t, i) => {
        const isA = i === active;
        const punch = isA ? spring({ frame: frame - t.fromFrame, fps, config: { damping: 14, stiffness: 260, mass: 0.5 } }) : 1;
        const scale = isA ? interpolate(punch, [0, 1], [1.45, 1]) : 1;
        return (
          <span
            key={i}
            style={{
              ...baseText(font, fontSize, 900),
              ...stroke(fontSize * 0.1),
              display: "inline-block",
              transform: `scale(${scale})`,
              color: isA ? color : "#fff",
            }}
          >
            {trUpper(t.text)}
          </span>
        );
      })}
    </Row>
  );
};

/** spring — each word springs in (scale overshoot) as it's spoken; active word accent. */
export const SpringPop: React.FC<EffectProps> = ({ page, font, fontSize, color, fps }) => {
  const frame = useCurrentFrame();
  const active = useActiveIndex(page);
  return (
    <Row gap={fontSize * 0.26}>
      {page.tokens.map((t, i) => {
        const seen = frame >= t.fromFrame;
        const enter = spring({ frame: frame - t.fromFrame, fps, config: { damping: 9, stiffness: 130, mass: 0.8 } });
        return (
          <span
            key={i}
            style={{
              ...baseText(font, fontSize, 800),
              ...stroke(fontSize * 0.06),
              display: "inline-block",
              transform: `scale(${seen ? enter : 0})`,
              opacity: seen ? 1 : 0,
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

/** bounce — the spoken word drops in with a springy vertical bounce; active word accent. */
export const Bounce: React.FC<EffectProps> = ({ page, font, fontSize, color, fps }) => {
  const frame = useCurrentFrame();
  const active = useActiveIndex(page);
  return (
    <Row gap={fontSize * 0.26}>
      {page.tokens.map((t, i) => {
        const isA = i === active;
        const b = spring({ frame: frame - t.fromFrame, fps, config: { damping: 6, stiffness: 170, mass: 0.9 } });
        const y = isA ? interpolate(b, [0, 1], [-fontSize * 0.55, 0]) : 0;
        return (
          <span
            key={i}
            style={{
              ...baseText(font, fontSize, 800),
              ...stroke(fontSize * 0.06),
              display: "inline-block",
              transform: `translateY(${y}px)`,
              color: isA ? color : "#fff",
            }}
          >
            {t.text}
          </span>
        );
      })}
    </Row>
  );
};
