"use client";

import { Player } from "@remotion/player";
import { type ReelBrollItem, Reel } from "@sentezy/remotion";
import type { CaptionStyleId, SfxCue } from "@sentezy/types";
import { useMemo } from "react";
import { Icon } from "@/components/icons";
import { previewWords } from "@/lib/captionPreview";
import { resolvePreviewSfx, slideSfxCues } from "@/lib/sfxPreview";

const FPS = 30;
const W = 1080;
const H = 1920;

export function SfxPreviewModal({
  open,
  onClose,
  script,
  cues,
  captionStyle,
  layout,
  avatarImageUrl,
  broll,
  transitionSfx,
  captions,
}: {
  open: boolean;
  onClose: () => void;
  script: string;
  cues: SfxCue[];
  captionStyle: { styleId: CaptionStyleId; font: string; color: string };
  layout: { avatarLayout: "side" | "bottom"; avatarSide: "left" | "right"; captionPosition: "top" | "bottom" };
  avatarImageUrl?: string | null;
  broll: ReelBrollItem[];
  transitionSfx: boolean;
  captions: boolean;
}) {
  const words = useMemo(() => previewWords(script), [script]);
  const durationInFrames = useMemo(() => {
    const last = words.length > 0 ? words[words.length - 1]!.end : 5;
    return Math.max(1, Math.ceil((last + 0.3) * FPS));
  }, [words]);
  // AI voice-timed SFX + slide-synced whooshes, both audible during real playback.
  const sfxCues = useMemo(() => {
    return [...resolvePreviewSfx(script, cues), ...slideSfxCues(broll, script, transitionSfx)];
  }, [script, cues, broll, transitionSfx]);

  if (!open) return null;
  const inputProps = {
    words,
    avatarUrl: avatarImageUrl ?? null,
    broll,
    captionStyle: { styleId: captionStyle.styleId, font: captionStyle.font, color: captionStyle.color },
    layout: layout.avatarLayout,
    position: layout.captionPosition,
    avatarSide: layout.avatarSide,
    captions,
    previewAudio: true,
    sfxCues,
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
        <div className="px-5 py-3 text-[12px] text-muted">Sesi duymak için oynat&apos;a bas — ses efektleri gerçek seslendirmeye göre hizalanır</div>
      </div>
    </div>
  );
}
