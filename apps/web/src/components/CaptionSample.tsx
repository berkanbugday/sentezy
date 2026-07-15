"use client";

import { Fragment, useEffect, useState } from "react";

// One place owns the on-frame caption look, shared by the caption-style picker
// tiles so what you preview is what the worker burns in. The
// per-kind rendering mirrors apps/worker/sentezy_worker/compose.py `_CAPTION_STYLES`
// (approximated in CSS, as the burn does in ASS).

export type CaptionEngine =
  | "karaoke" | "tiktok" | "beast" | "hormozi" | "boxed" | "clean" | "keyword"
  | "bubble" | "highlight" | "typewriter";

// Common Turkish/English function words — skipped when picking a phrase's accent keyword.
const STOPWORDS = new Set([
  "ve", "ile", "bir", "bu", "şu", "o", "da", "de", "ki", "mi", "mı", "mu", "mü", "için",
  "ama", "çok", "en", "gibi", "ya", "ne", "her", "daha", "kadar", "sonra", "artık",
  "the", "a", "an", "to", "of", "is", "are", "and", "or", "in", "on", "it", "you", "your",
]);

/** Pick a phrase's accent keyword — the longest non-stopword — mirroring the worker. */
export function keywordIndex(words: string[]): number {
  let best = -1, bestLen = -1, fallback = 0, fbLen = -1;
  words.forEach((w, i) => {
    const t = w.replace(/[.,!?…:;"'()]/g, "").toLocaleLowerCase("tr");
    if (t.length > fbLen) { fbLen = t.length; fallback = i; }
    if (STOPWORDS.has(t)) return;
    if (t.length > bestLen) { bestLen = t.length; best = i; }
  });
  return best >= 0 ? best : fallback;
}

const SHADOW_STRONG = "0 0 4px rgba(0,0,0,0.95), 0 2px 3px rgba(0,0,0,0.9)";
const SHADOW_SOFT = "0 0 3px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.85)";

/**
 * Render a caption phrase in a given style. `activeIndex` is the currently-spoken
 * word (drives the karaoke sweep / word pop / typewriter reveal); pass -1 for a
 * static sample (the whole phrase shown, last word treated as active).
 */
export function CaptionSample({ base, font, color, words, activeIndex }: {
  base: CaptionEngine;
  font: string;
  color: string;
  words: string[];
  activeIndex: number;
}) {
  if (words.length === 0) return null;
  const family = `"${font}", sans-serif`;
  const upper = base === "hormozi" || base === "beast";
  const wordAccent = base === "hormozi" || base === "tiktok" || base === "beast";
  const keyword = base === "keyword";
  const kwIndex = keyword ? keywordIndex(words) : -1;
  const active = activeIndex < 0 ? words.length - 1 : activeIndex; // static = last word active
  const sizeClass =
    base === "beast" ? "text-[22px] font-extrabold tracking-tight" :
    base === "hormozi" ? "text-[19px] font-extrabold tracking-tight" :
    base === "clean" || base === "typewriter" ? "text-[14px] font-semibold" :
    "text-[15px] font-bold";

  // box styles: ONE filled container behind the whole sentence (boxed = black/white,
  // bubble = accent/dark). The words live inside it and pop on the active word while
  // playing, so the fill stays sentence-wide but the caption still animates.
  if (base === "boxed" || base === "bubble") {
    const isBubble = base === "bubble";
    return (
      <p className={`text-center leading-relaxed ${sizeClass}`} style={{ fontFamily: family }}>
        <span style={{ display: "inline-block", maxWidth: "100%", color: isBubble ? "#111" : "#fff", background: isBubble ? color : "rgba(0,0,0,0.85)", padding: isBubble ? "4px 12px" : "3px 10px", borderRadius: isBubble ? 12 : 8, fontWeight: isBubble ? 800 : undefined }}>
          {words.map((word, i) => {
            const isActive = activeIndex >= 0 && i === active;
            return (
              <Fragment key={i}>
                <span className="inline-block transition-transform duration-150" style={{ transform: isActive ? "scale(1.16)" : undefined }}>{word}</span>
                {i < words.length - 1 ? " " : ""}
              </Fragment>
            );
          })}
        </span>
      </p>
    );
  }

  // typewriter: cumulative reveal up to the active word.
  if (base === "typewriter") {
    return (
      <p className={`text-center leading-snug ${sizeClass}`} style={{ fontFamily: family }}>
        <span style={{ color: "#fff", textShadow: SHADOW_SOFT }}>{words.slice(0, active + 1).join(" ")}</span>
      </p>
    );
  }

  return (
    <p className={`text-center leading-snug ${sizeClass}`} style={{ fontFamily: family }}>
      {words.map((word, i) => {
        const shown = activeIndex < 0 || i <= active;
        const isActive = i === active;

        // highlight: plain white phrase; only the spoken word gets an accent marker.
        if (base === "highlight") {
          return (
            <span key={i} className="mx-0.5 inline-block rounded px-1 align-middle" style={{ background: isActive ? color : "transparent", color: isActive ? "#111" : "#fff", fontWeight: isActive ? 800 : undefined, textShadow: isActive ? undefined : SHADOW_SOFT }}>
              {word}
            </span>
          );
        }

        const clr = keyword
          ? i === kwIndex ? color : "#fff"
          : wordAccent
            ? isActive ? color : "#fff"
            : base === "clean"
              ? "#fff"
              : shown ? "#fff" : "rgba(255,255,255,0.5)"; // karaoke: upcoming dimmed
        // clean has no colour emphasis, so give it a scale pop while playing so it animates too.
        const pop = isActive && (wordAccent || keyword || (base === "clean" && activeIndex >= 0));
        return (
          <span
            key={i}
            className="inline-block transition-transform duration-150"
            style={{
              color: clr,
              textShadow: wordAccent || keyword ? SHADOW_STRONG : SHADOW_SOFT,
              transform: pop ? "scale(1.07)" : undefined,
            }}
          >
            {upper ? word.toLocaleUpperCase("tr") : word}&nbsp;
          </span>
        );
      })}
    </p>
  );
}

/**
 * A `CaptionSample` that sweeps word-by-word while `play` is true (picker tile
 * hover/selected), and sits static (`activeIndex = -1`) otherwise. Kept cheap: only
 * the hovered/selected tile runs an interval at any moment.
 */
export function CaptionAnimated({ base, font, color, words, play }: {
  base: CaptionEngine;
  font: string;
  color: string;
  words: string[];
  play: boolean;
}) {
  const [active, setActive] = useState(-1);
  useEffect(() => {
    if (!play || words.length === 0) { setActive(-1); return; }
    let i = 0;
    setActive(0);
    const id = setInterval(() => { i = (i + 1) % words.length; setActive(i); }, 360);
    return () => clearInterval(id);
  }, [play, words.length]);
  return <CaptionSample base={base} font={font} color={color} words={words} activeIndex={play ? active : -1} />;
}
