"use client";

import { Player } from "@remotion/player";
import { type ReelBrand, type ReelBrollItem, Reel, reelSegments } from "@sentezy/remotion";
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
  brand = null,
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
  /** Brand kit for this video — null when unbranded. */
  brand?: ReelBrand | null;
}) {
  const words = useMemo(() => previewWords(script), [script]);
  // reelSegments is the shared source of truth for reel length (packages/remotion/src/
  // brand/timing.ts) — the composition, the renderer and this player must agree, or the
  // preview's scrubber ends before the outro does.
  const durationInFrames = useMemo(() => reelSegments(words, brand, FPS).totalFrames, [words, brand]);
  // Slide-synced whooshes, audible during real playback (the render muxes them with ffmpeg).
  const sfxCues = useMemo(() => slideSfxCues(broll, script, transitionSfx), [script, broll, transitionSfx]);

  // Remotion's <Player> pre-mounts a fixed pool of `numberOfSharedAudioTags` <audio> elements
  // (default 5) to dodge autoplay restrictions; every distinct <Audio> the Reel renders at once
  // must fit in that pool or it throws — see
  // https://remotion.dev/docs/player/autoplay#using-the-numberofsharedaudiotags-prop. The Reel
  // mounts one boundary whoosh per clip transition (slideSfxCues emits `broll.length - 1` cues,
  // only when transitionSfx is on and there are >= 2 clips) plus one more for the music bed
  // (Reel.tsx). Each SFX <Sequence> has no explicit duration (SfxTrack.tsx), so once it starts it
  // stays mounted for the rest of the reel — by the end all cues are mounted simultaneously. Size
  // the pool to cover that total plus headroom, floored at Remotion's own default so a tiny reel
  // is never starved.
  const numberOfSharedAudioTags = useMemo(() => {
    const boundaries = transitionSfx && broll.length >= 2 ? broll.length - 1 : 0;
    const musicTags = musicUrl ? 1 : 0;
    return Math.max(5, boundaries + musicTags + 2);
  }, [broll.length, transitionSfx, musicUrl]);

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
    brand,
    width: W,
    height: H,
    fps: FPS,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
      <div className="sheet-in relative z-10 flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-paper shadow-2xl sm:rounded-[24px] sm:border sm:border-hairline">
        <div className="flex-none px-5 pt-5">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-hairline sm:hidden" />
          <div className="flex items-start justify-between gap-3">
            <h3 className="disp mt-0.5 text-[18px] font-semibold text-ink">Preview</h3>
            <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 flex-none place-items-center rounded-full text-muted transition hover:bg-mist hover:text-ink">
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
              numberOfSharedAudioTags={numberOfSharedAudioTags}
              controls
              loop
              clickToPlay
              spaceKeyToPlayOrPause
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </div>
        <div className="px-5 py-3 text-[12px] text-muted">Press play to hear it — the voiceover is added when the video is made</div>
      </div>
    </div>
  );
}
