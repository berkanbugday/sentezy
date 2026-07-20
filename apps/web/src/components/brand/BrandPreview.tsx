"use client";

import { readableInk } from "@sentezy/remotion";

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
}: {
  mode: PreviewMode;
  color: string;
  font: string;
  brandName: string;
  handle: string;
  outroCta: string;
  logoUrl: string | null;
}) {
  const ink = readableInk(color);
  const face = `"${font}", sans-serif`;
  const empty = !brandName && !logoUrl;

  return (
    <div
      className="relative aspect-[9/16] w-full overflow-hidden rounded-[26px] border border-hairline"
      style={{ backgroundColor: mode === "watermark" ? "#0b0b0d" : color }}
    >
      {mode === "watermark" ? (
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
              Logo ya da marka adı ekle
            </div>
          )}
        </div>
      )}
    </div>
  );
}
