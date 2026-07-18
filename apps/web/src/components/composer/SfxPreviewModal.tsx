"use client";

import { ReelPreview } from "@sentezy/remotion";
import type { CaptionStyleId, SfxCue } from "@sentezy/types";
import { useMemo } from "react";
import { previewWords } from "@/lib/captionPreview";
import { resolvePreviewSfx } from "@/lib/sfxPreview";
import { LoopingPreview } from "./LoopingPreview";

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
  backdropUrl,
  captions,
}: {
  open: boolean;
  onClose: () => void;
  script: string;
  cues: SfxCue[];
  captionStyle: { styleId: CaptionStyleId; font: string; color: string };
  layout: { avatarLayout: "side" | "bottom"; avatarSide: "left" | "right"; captionPosition: "top" | "bottom" };
  avatarImageUrl?: string | null;
  backdropUrl?: string | null;
  captions: boolean;
}) {
  const words = useMemo(() => previewWords(script), [script]);
  const sfxCues = useMemo(() => resolvePreviewSfx(script, cues), [script, cues]);
  const durationInFrames = useMemo(() => {
    const last = words.length > 0 ? words[words.length - 1]!.end : 5;
    return Math.max(1, Math.ceil((last + 0.6) * FPS));
  }, [words]);

  if (!open) return null;
  const inputProps = {
    words,
    avatarImageUrl: avatarImageUrl ?? null,
    backdropUrl: backdropUrl ?? null,
    captionStyle: { styleId: captionStyle.styleId, font: captionStyle.font, color: captionStyle.color },
    layout: layout.avatarLayout,
    position: layout.captionPosition,
    avatarSide: layout.avatarSide,
    captions,
    sfxCues,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button type="button" aria-label="Kapat" onClick={onClose} className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-paper shadow-2xl sm:rounded-[24px]">
        <div className="flex items-center justify-between px-5 pt-5">
          <h3 className="disp text-[18px] font-semibold text-ink">Önizleme</h3>
          <button type="button" onClick={onClose} className="text-[13px] text-muted">Kapat</button>
        </div>
        <div className="flex flex-1 items-center justify-center overflow-hidden px-5 py-4">
          <div className="overflow-hidden rounded-[26px] bg-black shadow-xl" style={{ aspectRatio: "9 / 16", height: "min(64vh, 560px)" }}>
            <LoopingPreview
              component={ReelPreview}
              inputProps={inputProps}
              durationInFrames={durationInFrames}
              fps={FPS}
              compositionWidth={W}
              compositionHeight={H}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </div>
        <div className="px-5 py-3 text-[12px] text-muted">Örnek zamanlama — ses efektleri gerçek seslendirmeye göre hizalanır</div>
      </div>
    </div>
  );
}
