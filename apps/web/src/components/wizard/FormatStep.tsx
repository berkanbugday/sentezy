"use client";

import { useRef, useState } from "react";
import type { MusicTrack } from "@/lib/queries";
import { CAPTION_STYLES, chipClass, RATIOS, VOICE_EMOTIONS } from "./constants";
import type { Common } from "./types";

// Caption fonts bundled in the worker image (family names — must match fc-list).
const CAPTION_FONTS = [
  "General Sans", "Anton", "Bebas Neue", "Oswald", "Montserrat", "Poppins",
  "Archivo Black", "Rubik", "Sora", "Inter", "Fredoka", "Kanit", "Teko",
] as const;
// Highlight/accent colours for the caption.
const CAPTION_COLORS = ["#FFD54A", "#FFFFFF", "#FF5A5A", "#4ADE80", "#5AA9FF", "#FF6BD5", "#FF9A3D"] as const;

/* ── 04 · Biçim ───────────────────────────────────────────────────────── */
export function FormatStep({ register, values, setValue, music }: Common & { music: MusicTrack[] }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  function sample(t: MusicTrack) {
    const audio = audioRef.current ?? (audioRef.current = new Audio());
    if (playingKey === t.key) {
      audio.pause();
      setPlayingKey(null);
      return;
    }
    audio.src = t.previewUrl;
    audio.onended = () => setPlayingKey(null);
    void audio.play();
    setPlayingKey(t.key);
  }
  return (
    <div className="flex flex-col gap-6">
      <div>
        <label className="mb-2.5 block text-[13px] font-medium text-ink">Oran</label>
        <div className="grid grid-cols-3 gap-3">
          {RATIOS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setValue("aspectRatio", r.value)}
              className={`flex flex-col items-center gap-2 rounded-2xl border px-3 py-4 transition ${
                values.aspectRatio === r.value ? "border-signal bg-[var(--wash)]" : "border-hairline hover:border-signal/50"
              }`}
            >
              <span
                className="rounded-[4px] border-2"
                style={{
                  width: r.w,
                  height: r.h,
                  borderColor: values.aspectRatio === r.value ? "var(--color-signal)" : "var(--color-muted)",
                }}
              />
              <span className="mono text-[12px] font-semibold text-ink">{r.value}</span>
              <span className="text-[11px] text-muted">{r.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="flex items-center justify-between rounded-xl border border-hairline px-4 py-3">
          <span>
            <span className="block text-[14px] font-medium text-ink">Otomatik altyazı</span>
            <span className="block text-[12px] text-muted">Konuşma metni videoya işlenir</span>
          </span>
          <input type="checkbox" {...register("captions")} className="h-5 w-5 accent-[var(--color-signal)]" />
        </label>
        {values.captions && (
          <div className="mt-3 flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2">
            {CAPTION_STYLES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setValue("captionStyle", s.value)}
                className={`rounded-xl border px-2 py-2.5 text-center transition ${
                  (values.captionStyle ?? "karaoke") === s.value ? "border-signal bg-[var(--wash)]" : "border-hairline hover:border-signal/50"
                }`}
              >
                <span className="block rounded-lg bg-[#0b0b0d] px-1 py-2 leading-none">
                  {s.value === "karaoke" && (
                    <span className="text-[10px] font-bold"><span className="text-white">Yeni </span><span className="text-white/45">sezon</span></span>
                  )}
                  {s.value === "tiktok" && (
                    <span className="text-[10px] font-bold"><span className="text-[#FFD54A]">Yeni </span><span className="text-white">sezon</span></span>
                  )}
                  {s.value === "beast" && (
                    <span className="text-[11px] font-extrabold tracking-tight text-[#FFD54A]">YENİ</span>
                  )}
                  {s.value === "hormozi" && (
                    <span className="text-[10px] font-extrabold tracking-tight"><span className="text-[#FFD54A]">YENİ </span><span className="text-white">SEZON</span></span>
                  )}
                  {s.value === "boxed" && (
                    <span className="rounded bg-black px-1.5 py-0.5 text-[10px] font-bold text-white ring-1 ring-white/15">Yeni sezon</span>
                  )}
                  {s.value === "clean" && <span className="text-[10px] font-medium text-white">Yeni sezon</span>}
                </span>
                <span className="mt-1.5 block text-[12px] font-semibold text-ink">{s.label}</span>
                <span className="block text-[10px] text-muted">{s.hint}</span>
              </button>
            ))}
            </div>
            {/* font + accent colour */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
              <label className="flex items-center gap-2 text-[12px] text-muted">
                Yazı tipi
                <select
                  value={values.captionFont ?? "General Sans"}
                  onChange={(e) => setValue("captionFont", e.target.value)}
                  className="rounded-lg border border-hairline bg-mist px-2.5 py-1.5 text-[12.5px] text-ink outline-none transition focus:border-signal"
                >
                  {CAPTION_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] text-muted">Renk</span>
                {CAPTION_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setValue("captionColor", c)}
                    aria-label={`Renk ${c}`}
                    className={`h-6 w-6 rounded-full border-2 transition ${(values.captionColor ?? "#FFD54A") === c ? "border-ink scale-110" : "border-transparent hover:border-hairline"}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="mb-2.5 block text-[13px] font-medium text-ink">Yerleşim</label>
        <div className="mb-3">
          <span className="mb-1.5 block text-[12px] text-muted">Sunucu düzeni</span>
          <div className="flex gap-2">
            {([
              { v: "side", label: "◨ Yanda", hint: "B-roll tam ekran, sunucu yanda" },
              { v: "bottom", label: "⬓ Altta", hint: "B-roll üstte, sunucu ortada altta" },
            ] as const).map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setValue("presenterLayout", o.v)}
                title={o.hint}
                className={chipClass((values.presenterLayout ?? "side") === o.v)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className={(values.presenterLayout ?? "side") === "bottom" ? "opacity-40" : ""}>
            <span className="mb-1.5 block text-[12px] text-muted">Sunucu tarafı</span>
            <div className="flex gap-2">
              {(["left", "right"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={(values.presenterLayout ?? "side") === "bottom"}
                  onClick={() => setValue("avatarSide", s)}
                  className={`${chipClass(values.avatarSide === s)} disabled:cursor-not-allowed`}
                >
                  {s === "left" ? "◧ Sol" : "Sağ ◨"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="mb-1.5 block text-[12px] text-muted">Altyazı</span>
            <div className="flex gap-2">
              {(["top", "bottom"] as const).map((p) => (
                <button key={p} type="button" onClick={() => setValue("captionPosition", p)} className={chipClass(values.captionPosition === p)}>
                  {p === "top" ? "Üst" : "Alt"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div>
        <label className="mb-2.5 block text-[13px] font-medium text-ink">Ses tonu</label>
        <p className="mb-2 text-[12px] text-muted">Sesin duygusu — sunucunun yüz ifadesine de yansır (v3).</p>
        <div className="flex flex-wrap gap-2">
          {VOICE_EMOTIONS.map((e) => (
            <button key={e.value} type="button" onClick={() => setValue("voiceEmotion", e.value)} className={chipClass((values.voiceEmotion ?? "") === e.value)}>
              {e.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-2.5 block text-[13px] font-medium text-ink">Efektler</label>
        <div className="flex flex-col gap-2">
          <label className="flex items-center justify-between rounded-xl border border-hairline px-4 py-3">
            <span>
              <span className="block text-[14px] font-medium text-ink">Geçiş sesi</span>
              <span className="block text-[12px] text-muted">Fotoğraf geçişlerinde whoosh ses efekti</span>
            </span>
            <input type="checkbox" {...register("transitionSfx")} className="h-5 w-5 accent-[var(--color-signal)]" />
          </label>
        </div>
      </div>

      <div>
        <label className="mb-2.5 block text-[13px] font-medium text-ink">Müzik</label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setValue("musicTrackKey", undefined)}
            className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition ${
              !values.musicTrackKey ? "border-signal bg-[var(--wash)] text-signal" : "border-hairline text-ink hover:border-signal/50"
            }`}
          >
            Yok
          </button>
          {music.map((t) => {
            const active = values.musicTrackKey === t.key;
            return (
              <div
                key={t.key}
                className={`flex items-center gap-2 rounded-full border py-1 pl-3.5 pr-1 transition ${
                  active ? "border-signal bg-[var(--wash)]" : "border-hairline hover:border-signal/50"
                }`}
              >
                <button type="button" onClick={() => setValue("musicTrackKey", t.key)} className="text-[13px] font-medium text-ink">
                  {t.name}
                </button>
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Dinle"
                  onClick={() => sample(t)}
                  onKeyDown={(e) => e.key === "Enter" && sample(t)}
                  className="grid h-7 w-7 cursor-pointer place-items-center rounded-full bg-ink text-paper transition hover:opacity-90"
                >
                  {playingKey === t.key ? (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
                  ) : (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                  )}
                </span>
              </div>
            );
          })}
        </div>
        {values.musicTrackKey && (
          <div className="mt-3 flex items-center gap-3">
            <span className="whitespace-nowrap text-[12px] text-muted">Müzik seviyesi</span>
            <input
              type="range"
              min={0.05}
              max={0.4}
              step={0.05}
              value={values.musicVolume ?? 0.15}
              onChange={(e) => setValue("musicVolume", e.target.valueAsNumber)}
              aria-label="Müzik seviyesi"
              className="flex-1 accent-[var(--color-signal)]"
            />
            <span className="mono w-10 text-right text-[11px] text-muted">
              %{Math.round(((values.musicVolume ?? 0.15) / 0.4) * 100)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
