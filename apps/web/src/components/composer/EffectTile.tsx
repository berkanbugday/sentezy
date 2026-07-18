"use client";

import { BrollEffectDemo, brollDemoDurationInFrames } from "@sentezy/remotion";
import type { BrollEffectId } from "@sentezy/types";
import { LoopingPreview } from "./LoopingPreview";

const FPS = 30;
const W = 640; // 16:9 tile
const H = 360;
const DUR = brollDemoDurationInFrames(FPS);

// A B-roll effect tile: a LIVE, looping Remotion preview of the actual `BrollEffectDemo` (two
// clips with the real transition/entrance), self-driven so it always animates. WYSIWYG.
export function EffectTile({ value, label, selected, onSelect }: { value: string; label: string; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} className="text-left">
      <div className={`relative aspect-video overflow-hidden rounded-lg border bg-black transition ${selected ? "border-ink ring-2 ring-ink" : "border-hairline hover:border-slate"}`}>
        <LoopingPreview
          component={BrollEffectDemo}
          inputProps={{ effectId: value as BrollEffectId }}
          durationInFrames={DUR}
          fps={FPS}
          compositionWidth={W}
          compositionHeight={H}
          style={{ width: "100%", height: "100%" }}
        />
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
