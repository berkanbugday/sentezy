import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { EffectProps } from "../types";
import { baseText, contrastText, Row, stroke, useActiveIndex } from "./common";

function hexToRgba(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return `rgba(0,0,0,${a})`;
  const n = parseInt(m[1]!, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** boxed — the whole phrase inside one opaque rounded box (CapCut bubble). White text. */
export const Boxed: React.FC<EffectProps> = ({ page, font, fontSize }) => (
  <div
    style={{
      background: "rgba(0,0,0,0.72)",
      borderRadius: fontSize * 0.35,
      padding: `${fontSize * 0.22}px ${fontSize * 0.42}px`,
    }}
  >
    <Row gap={fontSize * 0.26}>
      {page.tokens.map((t, i) => (
        <span key={i} style={{ ...baseText(font, fontSize, 700), color: "#fff" }}>
          {t.text}
        </span>
      ))}
    </Row>
  </div>
);

/** bubble — the whole phrase on one accent sticker pill, dark text. */
export const Bubble: React.FC<EffectProps> = ({ page, font, fontSize, color }) => (
  <div
    style={{
      background: color,
      borderRadius: fontSize * 0.45,
      padding: `${fontSize * 0.2}px ${fontSize * 0.44}px`,
      boxShadow: "0 6px 20px rgba(0,0,0,0.3)",
    }}
  >
    <Row gap={fontSize * 0.24}>
      {page.tokens.map((t, i) => (
        <span key={i} style={{ ...baseText(font, fontSize, 800), color: contrastText(color) }}>
          {t.text}
        </span>
      ))}
    </Row>
  </div>
);

/** highlight — white phrase; the spoken word rides a filled accent marker. */
export const Highlight: React.FC<EffectProps> = ({ page, font, fontSize, color }) => {
  const active = useActiveIndex(page);
  return (
    <Row gap={fontSize * 0.24}>
      {page.tokens.map((t, i) => {
        const isA = i === active;
        return (
          <span
            key={i}
            style={{
              ...baseText(font, fontSize, 800),
              ...(isA ? {} : stroke(fontSize * 0.05)),
              padding: isA ? `${fontSize * 0.06}px ${fontSize * 0.16}px` : 0,
              borderRadius: fontSize * 0.22,
              background: isA ? color : "transparent",
              color: isA ? contrastText(color) : "#fff",
            }}
          >
            {t.text}
          </span>
        );
      })}
    </Row>
  );
};

/** highlighter — a translucent accent marker wipes left→right behind the spoken word. */
export const Highlighter: React.FC<EffectProps> = ({ page, font, fontSize, color }) => {
  const frame = useCurrentFrame();
  const active = useActiveIndex(page);
  return (
    <Row gap={fontSize * 0.24}>
      {page.tokens.map((t, i) => {
        const isA = i === active;
        const p = isA
          ? interpolate(frame, [t.fromFrame, t.fromFrame + 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
          : 0;
        return (
          <span
            key={i}
            style={{
              ...baseText(font, fontSize, 800),
              ...stroke(fontSize * 0.045),
              padding: `${fontSize * 0.04}px ${fontSize * 0.12}px`,
              borderRadius: fontSize * 0.1,
              backgroundImage: isA ? `linear-gradient(${hexToRgba(color, 0.55)}, ${hexToRgba(color, 0.55)})` : "none",
              backgroundRepeat: "no-repeat",
              backgroundSize: `${p * 100}% 100%`,
              color: "#fff",
            }}
          >
            {t.text}
          </span>
        );
      })}
    </Row>
  );
};

/** boxreveal — a rounded accent box springs in behind the spoken word and jumps word-to-word. */
export const BoxReveal: React.FC<EffectProps> = ({ page, font, fontSize, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const active = useActiveIndex(page);
  return (
    <Row gap={fontSize * 0.24}>
      {page.tokens.map((t, i) => {
        const isA = i === active;
        const pop = isA ? spring({ frame: frame - t.fromFrame, fps, config: { damping: 12, stiffness: 200, mass: 0.5 } }) : 0;
        return (
          <span
            key={i}
            style={{
              ...baseText(font, fontSize, 800),
              ...(isA ? {} : stroke(fontSize * 0.05)),
              display: "inline-block",
              padding: isA ? `${fontSize * 0.06}px ${fontSize * 0.16}px` : 0,
              borderRadius: fontSize * 0.22,
              background: isA ? color : "transparent",
              transform: isA ? `scale(${interpolate(pop, [0, 1], [0.7, 1])})` : "scale(1)",
              color: isA ? contrastText(color) : "#fff",
            }}
          >
            {t.text}
          </span>
        );
      })}
    </Row>
  );
};
