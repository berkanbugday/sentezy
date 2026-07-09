"use client";

import type { ReactNode } from "react";
import { estimateDuration, toSentences, toWords, useCaptionPlayback } from "@/hooks/useCaptionPlayback";

export type ReelPreviewValues = {
  title?: string;
  script?: string;
  presenterName?: string | null;
  presenterImageUrl?: string | null;
  voiceLabel?: string | null;
  aspectRatio: "9:16" | "1:1" | "16:9";
  captions: boolean;
  // One or more background images; multiple play as a slideshow. Empty = dark.
  backgroundImageUrls?: string[];
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

/**
 * The live 9:16 (or 1:1 / 16:9) reel preview — the studio's signature element.
 * Composites background + presenter + captions from the current wizard values
 * and "plays" the captions word-by-word. Pre-generation only: no real audio or
 * HeyGen render, so it works regardless of provider credits.
 */
export function ReelPreview({ values, step }: { values: ReelPreviewValues; step: number }) {
  const { title, script = "", presenterImageUrl, presenterName, voiceLabel, aspectRatio, captions, backgroundImageUrls } = values;
  const bgUrls = backgroundImageUrls ?? [];

  // Caption words grouped by sentence — the frame shows only the current
  // sentence (a real reel never shows the whole script at once).
  const sentences = toSentences(script);
  const flat: { ci: number; li: number }[] = [];
  sentences.forEach((s, ci) => toWords(s).forEach((_, li) => flat.push({ ci, li })));
  const total = flat.length;
  const { playing, activeWord, progress, toggle } = useCaptionPlayback(total, script);
  const curIdx = activeWord < 0 ? 0 : flat[activeWord]?.ci ?? 0;
  const localActive = activeWord < 0 ? -1 : flat[activeWord]?.li ?? -1;
  const curWords = sentences.length ? toWords(sentences[curIdx]) : [];

  // Background slideshow: step through the images along the playback timeline.
  const bgUrl = bgUrls.length ? bgUrls[Math.min(bgUrls.length - 1, Math.floor(progress * bgUrls.length))] : null;

  const { w, h } = fit(RATIO[aspectRatio]);
  const seconds = estimateDuration(script);

  return (
    <div className="flex flex-col items-center">
      {/* device */}
      <div className="relative flex items-center justify-center" style={{ width: 340, height: 560 }}>
        <div
          className="relative overflow-hidden rounded-[28px] border-[6px] border-ink transition-[width,height] duration-300 ease-out"
          style={{ width: w, height: h, background: "#0b0b0d" }}
        >
          {/* background image(s) — fill the whole frame (slideshow when multiple) */}
          {bgUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bgUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )}

          {/* presenter overlays the background; inset ~92% to match the compositor */}
          {presenterImageUrl ? (
            <div className="absolute inset-[4%] overflow-hidden rounded-[10px] ring-1 ring-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={presenterImageUrl} alt={presenterName ?? ""} className="absolute inset-0 h-full w-full object-cover" />
              {playing && (
                <span className="absolute left-1/2 top-4 h-2.5 w-2.5 -translate-x-1/2 animate-ping rounded-full bg-white/90" />
              )}
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div
                className="grid h-20 w-20 place-items-center rounded-full"
                style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.25)" }}
              >
                <SilhouetteIcon className="text-white/70" />
              </div>
              <span className="text-[11px] font-medium tracking-wide text-white/70 [text-shadow:0_1px_3px_rgba(0,0,0,0.7)]">Sunucu ekle</span>
            </div>
          )}

          {/* ── reels chrome — makes the preview read like a TikTok / Instagram Reels feed ── */}
          {/* legibility scrims */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-14" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.34), transparent)" }} />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.62), transparent 72%)" }} />

          <span className="absolute right-2.5 top-2.5 rounded-full bg-black/30 px-2 py-0.5 text-[9.5px] font-medium tracking-wide text-white/85 backdrop-blur-sm">önizleme</span>

          {/* right action rail */}
          <div className="absolute bottom-16 right-1.5 flex flex-col items-center gap-3.5 text-white">
            <div className="relative mb-1">
              <div className="h-8 w-8 overflow-hidden rounded-full border-2 border-white bg-white/10">
                {presenterImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={presenterImageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <SilhouetteIcon className="h-full w-full p-1 text-white/60" />
                )}
              </div>
              <span className="absolute -bottom-1.5 left-1/2 grid h-4 w-4 -translate-x-1/2 place-items-center rounded-full bg-white text-[11px] font-bold leading-none text-black">+</span>
            </div>
            <RailAction icon={<HeartIcon />} label="1,2B" />
            <RailAction icon={<CommentIcon />} label="248" />
            <RailAction icon={<ShareIcon />} label="Paylaş" />
            <div className={`mt-0.5 grid h-8 w-8 place-items-center rounded-full border border-white/25 bg-gradient-to-br from-zinc-600 to-black ${playing ? "animate-[spin_5s_linear_infinite]" : ""} motion-reduce:animate-none`}>
              <MusicNoteIcon className="h-3.5 w-3.5 text-white" />
            </div>
          </div>

          {/* burned captions (part of the video) */}
          {captions && (
            <div className="absolute inset-x-0 bottom-[27%] flex justify-center px-3 pr-12">
              {curWords.length > 0 ? (
                <p className="text-center text-[15px] font-bold leading-snug">
                  {curWords.map((word, i) => {
                    const active = localActive === i;
                    const shown = localActive < 0 || i <= localActive;
                    return (
                      <span
                        key={i}
                        className="transition-colors duration-150"
                        style={{
                          color: active ? "#fff" : shown ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.45)",
                          textShadow: active ? "0 1px 6px rgba(0,0,0,0.7)" : "0 1px 3px rgba(0,0,0,0.7)",
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
                <p className="text-center text-[12.5px] font-medium text-white/45">Senaryo buraya gelecek</p>
              )}
            </div>
          )}

          {/* bottom-left: account, description, audio */}
          <div className="absolute inset-x-0 bottom-0 pb-4 pl-3 pr-14 text-white">
            <div className="text-[12.5px] font-semibold [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">@sentezy</div>
            <div className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-white/90 [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">
              {title?.trim() || "Açıklaman burada görünür"}
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 text-[10.5px] text-white/90">
              <MusicNoteIcon className="h-3 w-3 shrink-0" />
              <span className="truncate">Orijinal ses · {voiceLabel || "Sentezy"}</span>
            </div>
          </div>

          {/* reels-style bottom progress */}
          <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/25">
            <div className="h-full bg-white transition-[width] duration-150" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>

          {/* subtle inner screen edge for depth */}
          <div aria-hidden className="pointer-events-none absolute inset-0" style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)" }} />
        </div>
      </div>

      {/* transport */}
      <div className="mt-4 flex w-full max-w-[320px] items-center gap-3">
        <button
          onClick={toggle}
          disabled={total === 0}
          aria-label={playing ? "Duraklat" : "Oynat"}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-paper transition hover:opacity-90 disabled:opacity-40"
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <div className="flex flex-1 justify-between text-[11px] text-muted">
          <span className="mono">{aspectRatio}{voiceLabel ? ` · ${voiceLabel}` : ""}</span>
          <span className="mono">~{seconds.toFixed(1)}s</span>
        </div>
      </div>
    </div>
  );
}

function RailAction({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="flex flex-col items-center gap-0.5 [filter:drop-shadow(0_1px_2px_rgba(0,0,0,0.5))]">
      {icon}
      <span className="text-[9.5px] font-semibold">{label}</span>
    </span>
  );
}
function HeartIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.6-10-9.3C.6 8.8 2 5.5 5.2 5.5c1.9 0 3.2 1 3.8 2.1C9.6 6.5 11 5.5 12.8 5.5 16 5.5 17.4 8.8 16 11.7 13.5 16.4 12 21 12 21z"/></svg>;
}
function CommentIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.4 1.3 4.6 3.4 6.1L4.5 21l4.2-2.1c1 .3 2.1.4 3.3.4 5.5 0 10-3.6 10-8s-4.5-8-10-8z"/></svg>;
}
function ShareIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M21.7 2.3c.3.3.4.7.2 1.1l-7.5 17c-.3.7-1.3.6-1.5-.1l-2-6.2-6.2-2c-.7-.2-.8-1.2-.1-1.5l17-7.5c.4-.2.8-.1 1.1.2zM9.9 13.4l1.3 4.1 4.6-10.5-10.5 4.6 4.1 1.3z"/></svg>;
}
function MusicNoteIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="currentColor" className={className} width="14" height="14"><path d="M9 17.5a2.5 2.5 0 1 1-2-2.45V6l10-2v8.5a2.5 2.5 0 1 1-2-2.45V6.3L9 7.7v9.8z"/></svg>;
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
