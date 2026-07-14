"use client";

import { useState } from "react";
import { EffectPreview } from "@/components/TransitionPreview";

// A transition-effect tile: static preview that plays only on hover/focus (or while
// selected), mirroring CaptionTile so the effect grid isn't a wall of motion.
export function EffectTile({ value, label, selected, onSelect }: { value: string; label: string; selected: boolean; onSelect: () => void }) {
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
      <div className={`relative aspect-video overflow-hidden rounded-lg border transition ${selected ? "border-ink ring-2 ring-ink" : "border-hairline hover:border-slate"}`}>
        <EffectPreview value={value} play={hover || selected} />
        {selected && (
          <span className="absolute right-1 top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-ink text-paper">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 7" /></svg>
          </span>
        )}
      </div>
      <div className={`mt-1.5 truncate px-0.5 text-[11px] font-medium ${selected ? "text-ink" : "text-slate"}`}>{label}</div>
    </button>
  );
}
