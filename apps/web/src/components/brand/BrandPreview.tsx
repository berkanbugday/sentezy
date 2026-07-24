"use client";

import { type BrandCrop, cropStyle, isImageSrc, normalizeCrop, readableInk } from "@sentezy/remotion";
import { useRef } from "react";

export type PreviewMode = "intro" | "outro" | "watermark";

/** A single 9:16 phone showing one branded state at a time. One large frame beats three
 *  small ones: the card is mostly type, and type needs size to be judged.
 *
 *  This is the only place brand colour appears in the app's chrome, which the monochrome
 *  rule allows because here the colour IS the content being edited. */
export function BrandPreview({
  mode,
  color,
  font,
  brandName,
  handle,
  outroCta,
  logoUrl,
  clipUrl = null,
  crop = null,
  onCropChange,
}: {
  mode: PreviewMode;
  color: string;
  font: string;
  brandName: string;
  handle: string;
  outroCta: string;
  logoUrl: string | null;
  /** An uploaded clip for THIS end, which replaces the generated card entirely. */
  clipUrl?: string | null;
  /** How that upload is framed. Omit `onCropChange` to render it read-only. */
  crop?: BrandCrop | null;
  onCropChange?: (c: BrandCrop) => void;
}) {
  const ink = readableInk(color);
  const face = `"${font}", sans-serif`;
  const empty = !brandName && !logoUrl;
  const showClip = clipUrl && mode !== "watermark";
  const draggable = Boolean(showClip && onCropChange);
  const frameRef = useRef<HTMLDivElement>(null);

  /** Drag the media to choose which part survives the 9:16 crop. Pointer deltas are
   *  divided by the frame's own size, so a drag across the whole frame sweeps the focal
   *  point end to end regardless of how large the panel is rendered.
   *
   *  The sign is inverted on purpose: dragging the media left should reveal what is on its
   *  right, which means increasing object-position. That matches how dragging a photo in
   *  any map or crop tool behaves. */
  const onPointerDown = (e: React.PointerEvent) => {
    if (!draggable || !frameRef.current) return;
    const box = frameRef.current.getBoundingClientRect();
    const start = { px: e.clientX, py: e.clientY, ...normalizeCrop(crop) };
    e.currentTarget.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const nx = start.x - (ev.clientX - start.px) / box.width;
      const ny = start.y - (ev.clientY - start.py) / box.height;
      onCropChange?.(normalizeCrop({ x: nx, y: ny, scale: start.scale }));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      ref={frameRef}
      onPointerDown={onPointerDown}
      className={`relative aspect-[9/16] w-full overflow-hidden rounded-[26px] border border-hairline ${
        draggable ? "cursor-grab touch-none active:cursor-grabbing" : ""
      }`}
      style={{ backgroundColor: mode === "watermark" || showClip ? "#0b0b0d" : color }}
    >
      {showClip ? (
        /* The upload replaces the card outright, so the preview shows only it — overlaying
           the brand name here would promise something the render does not produce.
           Image vs video is decided by the URL extension, the same rule the composition
           uses (isImageSrc), so the two can never disagree about what a file is. */
        /* The framing comes from the SAME cropStyle the composition uses, so what is
           dragged here is exactly what renders. `draggable` is not set on the media
           itself — the browser's native image drag would fight the pointer handler. */
        isImageSrc(clipUrl) ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={clipUrl} alt="" draggable={false} style={cropStyle(crop)} />
        ) : (
          /* Muted: the render is silent, and an autoplaying soundtrack in a settings
             screen is hostile. */
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video src={clipUrl} muted loop autoPlay playsInline style={cropStyle(crop)} />
        )
      ) : mode === "watermark" ? (
        <>
          {/* Stand-in for the reel: a dim subject and caption band, so the watermark is
              judged against something rather than floating on empty black. */}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-white/[0.06] to-transparent" />
          <div className="absolute inset-x-6 bottom-8 space-y-1.5">
            <div className="h-2 w-4/5 rounded-full bg-white/25" />
            <div className="h-2 w-3/5 rounded-full bg-white/15" />
          </div>
          {logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={logoUrl} alt="" className="absolute right-[4.5%] top-[4.5%] w-[20%] object-contain opacity-60" />
          ) : (
            <div className="absolute right-[4.5%] top-[4.5%] flex h-[9%] w-[20%] items-center justify-center rounded-md border border-dashed border-white/25 text-[9px] text-white/40">
              logo
            </div>
          )}
        </>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-7 text-center">
          {logoUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={logoUrl} alt="" className="max-h-[22%] w-[44%] object-contain" />
          )}
          {brandName && (
            <div className="text-[20px] font-bold leading-tight" style={{ color: ink, fontFamily: face }}>
              {brandName}
            </div>
          )}
          {handle && (
            <div className="text-[12px] leading-none" style={{ color: ink, opacity: 0.7, fontFamily: face }}>
              {handle}
            </div>
          )}
          {mode === "outro" && outroCta && (
            <div
              className="mt-1 rounded-full px-4 py-1.5 text-[11.5px] font-semibold"
              style={{ backgroundColor: ink, color, fontFamily: face }}
            >
              {outroCta}
            </div>
          )}
          {empty && (
            <div className="text-[12px]" style={{ color: ink, opacity: 0.5 }}>
              Add a logo or a brand name
            </div>
          )}
        </div>
      )}
    </div>
  );
}
