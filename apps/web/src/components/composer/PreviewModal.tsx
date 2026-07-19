"use client";

import { Player } from "@remotion/player";
import { type ReelBrollItem, Reel } from "@sentezy/remotion";
import type { CaptionStyleId } from "@sentezy/types";
import { useMemo } from "react";
import { Icon } from "@/components/icons";
import { previewWords } from "@/lib/captionPreview";
import { slideSfxCues } from "@/lib/sfxPreview";

const FPS = 30;
const W = 1080;
const H = 1920;

// Reel always requires a captionStyle value even when captions are off (the `captions` boolean
// is what actually gates the overlay's render — see packages/remotion/src/reel/Reel.tsx). This
// placeholder is never displayed; its only job is to satisfy ReelProps' required field.
const NO_CAPTION_STYLE: { styleId: CaptionStyleId; font: string; color: string } = { styleId: "clean", font: "Inter", color: "#FFFFFF" };

export function PreviewModal({
  open,
  onClose,
  script,
  captionStyle,
  layout,
  avatarImageUrl,
  broll,
  transitionSfx,
  musicUrl = null,
  musicVolume = 0.15,
}: {
  open: boolean;
  onClose: () => void;
  script: string;
  /** No caption style selected (opt-in captions) → null, and the preview renders no captions,
   *  exactly matching what the render will produce. */
  captionStyle: { styleId: CaptionStyleId; font: string; color: string } | null;
  layout: { avatarPosition: "left" | "center" | "right"; captionPosition: "top" | "bottom" };
  avatarImageUrl?: string | null;
  broll: ReelBrollItem[];
  transitionSfx: boolean;
  musicUrl?: string | null;
  musicVolume?: number;
}) {
  const words = useMemo(() => previewWords(script), [script]);
  const durationInFrames = useMemo(() => {
    const last = words.length > 0 ? words[words.length - 1]!.end : 5;
    return Math.max(1, Math.ceil((last + 0.3) * FPS));
  }, [words]);
  // Slide-synced whooshes, audible during real playback (the render muxes them with ffmpeg).
  const sfxCues = useMemo(() => slideSfxCues(broll, script, transitionSfx), [script, broll, transitionSfx]);

  if (!open) return null;
  const inputProps = {
    words,
    avatarUrl: avatarImageUrl ?? null,
    broll,
    captionStyle: captionStyle ?? NO_CAPTION_STYLE,
    avatarPosition: layout.avatarPosition,
    position: layout.captionPosition,
    captions: captionStyle !== null,
    previewAudio: true,
    sfxCues,
    musicUrl,
    musicVolume,
    width: W,
    height: H,
    fps: FPS,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button type="button" aria-label="Kapat" onClick={onClose} className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
      <div className="sheet-in relative z-10 flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-paper shadow-2xl sm:rounded-[24px] sm:border sm:border-hairline">
        <div className="flex-none px-5 pt-5">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-hairline sm:hidden" />
          <div className="flex items-start justify-between gap-3">
            <h3 className="disp mt-0.5 text-[18px] font-semibold text-ink">Önizleme</h3>
            <button type="button" onClick={onClose} aria-label="Kapat" className="grid h-8 w-8 flex-none place-items-center rounded-full text-muted transition hover:bg-mist hover:text-ink">
              <Icon.close width={18} height={18} className="block" />
            </button>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center overflow-hidden px-5 py-4">
          <div className="overflow-hidden rounded-[26px] bg-black shadow-xl" style={{ aspectRatio: "9 / 16", height: "min(64vh, 560px)" }}>
            <Player
              component={Reel}
              inputProps={inputProps}
              durationInFrames={durationInFrames}
              fps={FPS}
              compositionWidth={W}
              compositionHeight={H}
              controls
              loop
              clickToPlay
              spaceKeyToPlayOrPause
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </div>
        <div className="px-5 py-3 text-[12px] text-muted">Sesi duymak için oynat&apos;a bas — seslendirme render sırasında eklenir</div>
      </div>
    </div>
  );
}
