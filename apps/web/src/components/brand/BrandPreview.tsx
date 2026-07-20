"use client";

import { readableInk } from "@sentezy/remotion";

/** A still 9:16 mock of the branded reel — the intro/outro card on the left half and the
 *  watermark position on the right. Deliberately plain CSS, not a Remotion <Player>: this
 *  answers "where does my logo sit and is my colour readable", which is a layout question.
 *  The real motion preview lives in the composer.
 *
 *  This is also the only place in the app chrome where the brand colour is rendered, which
 *  the monochrome design rule allows because it IS the content being edited. */
export function BrandPreview({
  color,
  font,
  brandName,
  handle,
  outroCta,
  logoUrl,
}: {
  color: string;
  font: string;
  brandName: string;
  handle: string;
  outroCta: string;
  logoUrl: string | null;
}) {
  const ink = readableInk(color);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        {/* Intro / outro card */}
        <figure className="m-0">
          <div
            className="flex aspect-[9/16] flex-col items-center justify-center gap-2 overflow-hidden rounded-[18px] border border-hairline px-4 text-center"
            style={{ backgroundColor: color }}
          >
            {logoUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={logoUrl} alt="" className="mb-1 max-h-[28%] w-[46%] object-contain" />
            )}
            {brandName && (
              <div
                className="text-[15px] font-bold leading-tight"
                style={{ color: ink, fontFamily: `"${font}", sans-serif` }}
              >
                {brandName}
              </div>
            )}
            {handle && (
              <div className="text-[10px]" style={{ color: ink, opacity: 0.7, fontFamily: `"${font}", sans-serif` }}>
                {handle}
              </div>
            )}
            {outroCta && (
              <div
                className="mt-1 rounded-full px-3 py-1 text-[9.5px] font-semibold"
                style={{ backgroundColor: ink, color, fontFamily: `"${font}", sans-serif` }}
              >
                {outroCta}
              </div>
            )}
            {!brandName && !logoUrl && (
              <div className="text-[11px]" style={{ color: ink, opacity: 0.55 }}>
                Marka adı ekle
              </div>
            )}
          </div>
          <figcaption className="mt-1.5 text-center text-[11.5px] text-muted">Giriş / Kapanış</figcaption>
        </figure>

        {/* Watermark position over a stand-in reel frame */}
        <figure className="m-0">
          <div className="relative aspect-[9/16] overflow-hidden rounded-[18px] border border-hairline bg-[#0b0b0d]">
            {logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={logoUrl} alt="" className="absolute right-[4.5%] top-[4.5%] w-[22%] object-contain opacity-60" />
            ) : (
              <div className="absolute right-[4.5%] top-[4.5%] h-[8%] w-[22%] rounded border border-dashed border-white/30" />
            )}
            <div className="absolute inset-x-3 bottom-4 space-y-1">
              <div className="h-1.5 w-4/5 rounded-full bg-white/25" />
              <div className="h-1.5 w-3/5 rounded-full bg-white/15" />
            </div>
          </div>
          <figcaption className="mt-1.5 text-center text-[11.5px] text-muted">Filigran</figcaption>
        </figure>
      </div>
      <p className="text-[12.5px] leading-relaxed text-muted">
        Yazı rengi marka rengine göre otomatik seçilir, böylece her zaman okunur kalır.
      </p>
    </div>
  );
}
