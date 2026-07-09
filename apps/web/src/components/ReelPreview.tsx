"use client";

import { estimateDuration, toWords, useCaptionPlayback } from "@/hooks/useCaptionPlayback";

export type ReelPreviewValues = {
  title?: string;
  script?: string;
  presenterName?: string | null;
  presenterImageUrl?: string | null;
  voiceLabel?: string | null;
  aspectRatio: "9:16" | "1:1" | "16:9";
  captions: boolean;
  backgroundColor: string;
};

const RATIO: Record<ReelPreviewValues["aspectRatio"], number> = {
  "9:16": 9 / 16,
  "1:1": 1,
  "16:9": 16 / 9,
};

/** Fit the device screen into a bounding box while preserving aspect ratio. */
function fit(ratio: number, boxW = 320, boxH = 540) {
  return boxW / boxH > ratio
    ? { w: Math.round(boxH * ratio), h: boxH }
    : { w: boxW, h: Math.round(boxW / ratio) };
}

function isLight(hex: string) {
  const h = hex.replace("#", "");
  if (h.length < 6) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 150;
}

/**
 * The live 9:16 (or 1:1 / 16:9) reel preview — the studio's signature element.
 * Composites background + presenter + captions from the current wizard values
 * and "plays" the captions word-by-word. Pre-generation only: no real audio or
 * HeyGen render, so it works regardless of provider credits.
 */
export function ReelPreview({ values, step }: { values: ReelPreviewValues; step: number }) {
  const { script = "", presenterImageUrl, presenterName, voiceLabel, aspectRatio, captions, backgroundColor } = values;
  const { playing, activeWord, progress, toggle } = useCaptionPlayback(script);
  const { w, h } = fit(RATIO[aspectRatio]);
  const words = toWords(script);
  const seconds = estimateDuration(script);
  const lightBg = isLight(backgroundColor);

  return (
    <div className="flex flex-col items-center">
      {/* device + glow */}
      <div className="relative flex items-center justify-center" style={{ width: 340, height: 560 }}>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[40px] opacity-70 blur-3xl"
          style={{ background: "var(--beam)" }}
        />
        <div
          className="relative overflow-hidden rounded-[28px] border-[6px] border-ink shadow-2xl transition-[width,height] duration-300 ease-out"
          style={{ width: w, height: h, background: backgroundColor }}
        >
          {/* presenter */}
          {presenterImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={presenterImageUrl} alt={presenterName ?? ""} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="ph-stripe absolute inset-0 flex flex-col items-center justify-center gap-2">
              <SilhouetteIcon className={lightBg ? "text-ink/25" : "text-white/30"} />
              <span className={`text-[11px] font-medium ${lightBg ? "text-ink/40" : "text-white/45"}`}>
                Sunucu seç
              </span>
            </div>
          )}

          {/* speaking pulse while playing */}
          {playing && presenterImageUrl && (
            <span className="absolute left-1/2 top-6 h-2.5 w-2.5 -translate-x-1/2 animate-ping rounded-full bg-white/90" />
          )}

          {/* top chrome */}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-2.5">
            <span className="rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
              sentezy
            </span>
            <span className="rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-sm">
              önizleme
            </span>
          </div>

          {/* captions */}
          {captions && (
            <div className="absolute inset-x-0 bottom-0 px-4 pb-6 pt-16" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55), transparent)" }}>
              {words.length > 0 ? (
                <p className="text-center text-[15px] font-bold leading-snug">
                  {words.map((word, i) => {
                    const active = activeWord === i;
                    const shown = activeWord < 0 || i <= activeWord;
                    return (
                      <span
                        key={i}
                        className="transition-colors duration-150"
                        style={{
                          color: active ? "#fff" : shown ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)",
                          textShadow: active ? "0 1px 6px rgba(0,0,0,0.7)" : "0 1px 2px rgba(0,0,0,0.6)",
                          background: active ? "rgba(0,0,0,0.62)" : "transparent",
                          borderRadius: 4,
                          padding: active ? "0 3px" : "0",
                        }}
                      >
                        {word}{" "}
                      </span>
                    );
                  })}
                </p>
              ) : (
                <p className="text-center text-[13px] font-medium text-white/45">Senaryo buraya gelecek</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* transport */}
      <div className="mt-4 flex w-full max-w-[320px] items-center gap-3">
        <button
          onClick={toggle}
          disabled={words.length === 0}
          aria-label={playing ? "Duraklat" : "Oynat"}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-paper transition hover:opacity-90 disabled:opacity-40"
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <div className="flex-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-hairline">
            <div className="h-full rounded-full bg-signal transition-[width] duration-150" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-muted">
            <span className="mono">{aspectRatio}{voiceLabel ? ` · ${voiceLabel}` : ""}</span>
            <span className="mono">~{seconds.toFixed(1)}s</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SilhouetteIcon({ className }: { className?: string }) {
  return (
    <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.4 0-8 2.7-8 6v2h16v-2c0-3.3-3.6-6-8-6Z" />
    </svg>
  );
}
function PlayIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>;
}
function PauseIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>;
}
