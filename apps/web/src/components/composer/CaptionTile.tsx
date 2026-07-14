"use client";

import { useState } from "react";
import { CaptionAnimated } from "@/components/CaptionSample";
import { type CaptionPreset } from "@/lib/captionStyles";

// A caption-preset tile: static styled sample that sweeps word-by-word on hover/focus
// (or while selected), mirroring how the caption plays in the reel.
export function CaptionTile({ preset, words, selected, onSelect }: { preset: CaptionPreset; words: string[]; selected: boolean; onSelect: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      className="text-left"
    >
      <div className={`relative grid aspect-video place-items-center overflow-hidden rounded-lg border bg-black px-2 transition ${selected ? "border-ink ring-2 ring-ink" : "border-hairline hover:border-slate"}`}>
        <CaptionAnimated base={preset.base} font={preset.font} color={preset.color} words={words} play={hover || selected} />
        {selected && (
          <span className="absolute right-1 top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-ink text-paper">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 7" /></svg>
          </span>
        )}
      </div>
      <div className={`mt-1.5 truncate px-0.5 text-[11px] font-medium ${selected ? "text-ink" : "text-slate"}`}>{preset.family} · {preset.font}</div>
    </button>
  );
}
