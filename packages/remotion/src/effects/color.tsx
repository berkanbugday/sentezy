import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import type { CaptionPage, EffectProps } from "../types";
import { baseText, Row, stroke, useActiveIndex } from "./common";

const STOP = new Set([
  "ve", "ile", "bir", "bu", "şu", "o", "de", "da", "ki", "için", "ama", "çok", "daha", "en", "gibi",
  "the", "a", "an", "and", "or", "to", "of", "in", "on", "is", "are",
]);

/** Pick the "important" word in a page — the longest non-stopword token. */
function keywordIndex(page: CaptionPage): number {
  let best = 0;
  let bestLen = -1;
  page.tokens.forEach((t, i) => {
    const w = t.text.replace(/[^\p{L}\p{N}]/gu, "").toLocaleLowerCase("tr");
    if (!STOP.has(w) && w.length > bestLen) {
      bestLen = w.length;
      best = i;
    }
  });
  return best;
}

const PALETTE = ["#FFD54A", "#34D399", "#38BDF8", "#F472B6", "#FB923C", "#A78BFA", "#A3E635"];

/** keyword — the semantic keyword stays accent across the phrase; the spoken word pops slightly. */
export const Keyword: React.FC<EffectProps> = ({ page, font, fontSize, color }) => {
  const active = useActiveIndex(page);
  const ki = keywordIndex(page);
  return (
    <Row gap={fontSize * 0.26}>
      {page.tokens.map((t, i) => (
        <span
          key={i}
          style={{
            ...baseText(font, fontSize, 800),
            ...stroke(fontSize * 0.055),
            display: "inline-block",
            transform: i === active ? "scale(1.08)" : "scale(1)",
            color: i === ki ? color : "#fff",
          }}
        >
          {t.text}
        </span>
      ))}
    </Row>
  );
};

/** rainbow — every word wears a different palette colour (playful, ignores accent). */
export const Rainbow: React.FC<EffectProps> = ({ page, font, fontSize }) => {
  const active = useActiveIndex(page);
  return (
    <Row gap={fontSize * 0.26}>
      {page.tokens.map((t, i) => (
        <span
          key={i}
          style={{
            ...baseText(font, fontSize, 800),
            ...stroke(fontSize * 0.06),
            display: "inline-block",
            transform: i === active ? "scale(1.1)" : "scale(1)",
            color: PALETTE[i % PALETTE.length],
          }}
        >
          {t.text}
        </span>
      ))}
    </Row>
  );
};

/** gradient — the spoken word's fill is an animated accent→white→accent gradient sweep. */
export const Gradient: React.FC<EffectProps> = ({ page, font, fontSize, color }) => {
  const frame = useCurrentFrame();
  const active = useActiveIndex(page);
  return (
    <Row gap={fontSize * 0.26}>
      {page.tokens.map((t, i) => {
        const isA = i === active;
        const sweep = (((frame - t.fromFrame) * 4) % 200) - 100;
        const gradientStyle: React.CSSProperties = isA
          ? {
              backgroundImage: `linear-gradient(90deg, ${color}, #ffffff, ${color})`,
              backgroundSize: "220% 100%",
              backgroundPosition: `${sweep}% 0`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }
          : { color: "#fff" };
        return (
          <span
            key={i}
            style={{ ...baseText(font, fontSize, 800), ...stroke(fontSize * 0.05), ...gradientStyle }}
          >
            {t.text}
          </span>
        );
      })}
    </Row>
  );
};

/** glow — the spoken word gets an animated neon accent glow pulse. */
export const Glow: React.FC<EffectProps> = ({ page, font, fontSize, color }) => {
  const frame = useCurrentFrame();
  const active = useActiveIndex(page);
  return (
    <Row gap={fontSize * 0.26}>
      {page.tokens.map((t, i) => {
        const isA = i === active;
        const pulse = 0.6 + 0.4 * Math.sin((frame - t.fromFrame) * 0.4);
        const glow = isA
          ? `0 0 ${fontSize * 0.15 * pulse}px ${color}, 0 0 ${fontSize * 0.35 * pulse}px ${color}`
          : "0 2px 6px rgba(0,0,0,0.4)";
        return (
          <span
            key={i}
            style={{
              ...baseText(font, fontSize, 800),
              WebkitTextStroke: `${fontSize * 0.03}px #000`,
              paintOrder: "stroke fill",
              color: isA ? color : "#fff",
              textShadow: glow,
            }}
          >
            {t.text}
          </span>
        );
      })}
    </Row>
  );
};
