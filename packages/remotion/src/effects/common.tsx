import type { CSSProperties, ReactNode } from "react";
import React from "react";
import { useCurrentFrame } from "remotion";
import { activeTokenIndex } from "../timing";
import type { CaptionPage } from "../types";

/** Base word text style. Weight defaults to heavy (caption look). */
export const baseText = (font: string, fontSize: number, weight = 800): CSSProperties => ({
  fontFamily: `"${font}", system-ui, sans-serif`,
  fontSize,
  fontWeight: weight,
  lineHeight: 1.12,
  color: "#fff",
  margin: 0,
  padding: 0,
  letterSpacing: 0.2,
  // pre-wrap wraps between words (never mid-word) — the font is auto-fit upstream so a single
  // word always fits the column; maxWidth is a final safety bound.
  whiteSpace: "pre-wrap",
  maxWidth: "100%",
});

/** Thick TikTok-style outline + soft drop shadow. `paint-order: stroke` keeps the fill crisp. */
export const stroke = (px: number, color = "#000"): CSSProperties => ({
  WebkitTextStroke: `${px}px ${color}`,
  paintOrder: "stroke fill",
  textShadow: `0 ${Math.round(px * 0.6)}px ${Math.round(px * 1.6)}px rgba(0,0,0,0.45)`,
});

/** A centred, wrapping row of words. */
export const Row: React.FC<{ children: ReactNode; gap?: number; style?: CSSProperties }> = ({
  children,
  gap = 0,
  style,
}) => (
  <div
    style={{
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "center",
      maxWidth: "100%",
      gap,
      ...style,
    }}
  >
    {children}
  </div>
);

/** Index of the token currently being spoken (page-relative frame space). */
export function useActiveIndex(page: CaptionPage): number {
  const frame = useCurrentFrame();
  return activeTokenIndex(frame, page.tokens);
}

/** Turkish-aware uppercase (i→İ, ı→I) to match the worker's _tr_upper. */
export function trUpper(s: string): string {
  return s.replace(/i/g, "İ").replace(/ı/g, "I").toLocaleUpperCase("tr");
}

/** Readable text colour (black/white) for a given accent background. */
export function contrastText(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#000";
  const n = parseInt(m[1]!, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#111" : "#fff";
}
