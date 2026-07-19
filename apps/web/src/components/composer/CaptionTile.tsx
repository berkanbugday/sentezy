"use client";

import { Thumbnail } from "@remotion/player";
import { CaptionOverlay } from "@sentezy/remotion";
import { useState } from "react";
import { previewWords } from "@/lib/captionPreview";
import { type CaptionPreset } from "@/lib/captionStyles";
import { LoopingPreview } from "./LoopingPreview";

// Short punchy sample shared by every tile (module-level so it's built once).
const WORDS = previewWords("büyük indirim başlıyor bugün");
const FPS = 30;
const W = 1080; // 1:1 square tile
const H = 1080;
const DUR = Math.max(1, Math.ceil((WORDS[WORDS.length - 1]!.end + 0.4) * FPS));

// A caption-preset tile: static single frame by default (cheap), self-driven looping preview on
// hover/focus or while selected — the real component, so WYSIWYG.
export function CaptionTile({ preset, selected, onSelect }: { preset: CaptionPreset; selected: boolean; onSelect: () => void }) {
  const [hover, setHover] = useState(false);
  const active = hover || selected;
  const inputProps = {
    words: WORDS,
    styleId: preset.base,
    font: preset.font,
    color: preset.color,
    position: "bottom" as const,
    avatarPosition: "right" as const,
  };
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
      <div className={`relative aspect-square overflow-hidden rounded-lg border bg-black transition ${selected ? "border-ink ring-2 ring-ink" : "border-hairline hover:border-slate"}`}>
        {active ? (
          <LoopingPreview
            component={CaptionOverlay}
            inputProps={inputProps}
            durationInFrames={DUR}
            fps={FPS}
            compositionWidth={W}
            compositionHeight={H}
            style={{ width: "100%", height: "100%" }}
          />
        ) : (
          <Thumbnail
            component={CaptionOverlay}
            inputProps={inputProps}
            durationInFrames={DUR}
            fps={FPS}
            frameToDisplay={Math.round(DUR * 0.5)}
            compositionWidth={W}
            compositionHeight={H}
            style={{ width: "100%", height: "100%" }}
          />
        )}
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
