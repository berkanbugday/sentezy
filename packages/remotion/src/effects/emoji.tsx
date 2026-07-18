import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { EffectProps } from "../types";
import { baseText, Row, stroke, useActiveIndex } from "./common";

// Keyword → emoji. Matched on the lowercased, punctuation-stripped word stem (prefix match),
// so "indirim", "indirimde" both hit. Turkish-first, with common English fallbacks.
const EMOJI: [string, string][] = [
  ["indirim", "🔥"], ["kampanya", "🎉"], ["fırsat", "✨"], ["hediye", "🎁"], ["ücretsiz", "🆓"],
  ["para", "💰"], ["kazan", "💰"], ["ücret", "💵"], ["fiyat", "🏷️"], ["yüzde", "📊"],
  ["yeni", "🆕"], ["hızlı", "⚡"], ["güç", "💪"], ["aşk", "❤️"], ["sevgi", "❤️"],
  ["mutlu", "😍"], ["harika", "🤩"], ["süper", "🚀"], ["zaman", "⏰"], ["bugün", "📅"],
  ["telefon", "📱"], ["ev", "🏠"], ["araba", "🚗"], ["yemek", "🍔"], ["kahve", "☕"],
  ["saç", "💇"], ["diş", "🦷"], ["sağlık", "🩺"], ["spor", "🏋️"], ["tatil", "🏖️"],
  ["dikkat", "👀"], ["önemli", "❗"], ["kazanç", "📈"], ["büyü", "📈"], ["takip", "👉"],
  ["sale", "🔥"], ["free", "🆓"], ["new", "🆕"], ["love", "❤️"], ["money", "💰"], ["time", "⏰"],
];

function emojiFor(word: string): string | null {
  const w = word.replace(/[^\p{L}\p{N}]/gu, "").toLocaleLowerCase("tr");
  if (w.length < 3) return null;
  for (const [stem, e] of EMOJI) if (w.startsWith(stem)) return e;
  return null;
}

/** emoji — a relevant emoji pops in above matching keywords; the spoken word turns accent. */
export const Emoji: React.FC<EffectProps> = ({ page, font, fontSize, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const active = useActiveIndex(page);
  return (
    <Row gap={fontSize * 0.26} style={{ alignItems: "flex-end" }}>
      {page.tokens.map((t, i) => {
        const e = emojiFor(t.text);
        const pop = spring({ frame: frame - t.fromFrame, fps, config: { damping: 10, stiffness: 180, mass: 0.5 } });
        return (
          <span key={i} style={{ display: "inline-flex", flexDirection: "column", alignItems: "center" }}>
            {e && (
              <span
                style={{
                  fontSize: fontSize * 0.72,
                  lineHeight: 1,
                  marginBottom: fontSize * 0.04,
                  transform: `scale(${frame >= t.fromFrame ? pop : 0})`,
                }}
              >
                {e}
              </span>
            )}
            <span
              style={{
                ...baseText(font, fontSize, 800),
                ...stroke(fontSize * 0.06),
                color: i === active ? color : "#fff",
              }}
            >
              {t.text}
            </span>
          </span>
        );
      })}
    </Row>
  );
};
