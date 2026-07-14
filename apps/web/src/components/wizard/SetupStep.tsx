"use client";

import { useState } from "react";
import { DEFAULT_TRANSITION, fieldClass, TRANSITIONS } from "./constants";
import type { BgImage, Common } from "./types";

/* ── 01 · Başlık & Arka plan — title + background media (images + video clips) ── */
export function SetupStep({
  register,
  errors,
  bgImages,
  onUpload,
  onUploadVideo,
  onRemove,
  onTransition,
}: Common & {
  bgImages: BgImage[];
  onUpload: (files: FileList) => Promise<void>;
  onUploadVideo: (files: FileList) => Promise<void>;
  onRemove: (id: string) => void;
  onTransition: (id: string, transition: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [busyVid, setBusyVid] = useState(false);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <label className="mb-1.5 block text-[13px] font-medium text-ink">Başlık</label>
        <input className={fieldClass} placeholder="Örn: Kuaför tanıtımı" {...register("title")} />
        {errors.title && <p className="mt-1 text-[12.5px] text-red-600">{errors.title.message}</p>}
      </div>

      <div>
        <label className="mb-1.5 block text-[13px] font-medium text-ink">B-roll medyası</label>
        <p className="mb-2.5 text-[12px] text-muted">Görsel veya video (ör. ekran kaydı) yükle — sunucu konuşurken otomatik olarak araya girerler. Düzenleme yok.</p>
        <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-5">
          {bgImages.map((img, i) => (
            <div key={img.id} className="flex flex-col gap-1">
              <div className="group relative aspect-[9/16] overflow-hidden rounded-xl border border-hairline">
                {img.url && img.kind === "video" ? (
                  <video src={img.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                ) : img.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-mist text-[10px] text-muted">{img.kind === "video" ? "Video" : "Görsel"}</div>
                )}
                <span className="absolute left-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-black/60 px-1 text-[9px] font-medium text-white">{i + 1}</span>
                {img.kind === "video" && (
                  <span className="absolute inset-0 grid place-items-center text-[22px] text-white/90 [text-shadow:0_1px_4px_rgba(0,0,0,0.7)]">▶</span>
                )}
                <button
                  type="button"
                  onClick={() => onRemove(img.id)}
                  aria-label="Kaldır"
                  className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-[13px] leading-none text-white transition hover:bg-black/80"
                >
                  ×
                </button>
              </div>
              {/* per-photo entrance transition (how this photo enters from the previous) */}
              <select
                value={img.transition ?? DEFAULT_TRANSITION}
                onChange={(e) => onTransition(img.id, e.target.value)}
                aria-label={`${i + 1}. görselin geçiş efekti`}
                className="w-full rounded-md border border-hairline bg-mist px-1 py-1 text-[10px] text-ink outline-none transition focus:border-signal"
              >
                {TRANSITIONS.map((g) => (
                  <optgroup key={g.group} label={g.group}>
                    {g.items.map((it) => (
                      <option key={it.value} value={it.value}>{it.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          ))}
          <label className="flex aspect-[9/16] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-hairline bg-mist text-center transition hover:border-signal">
            <span className="text-[20px] text-muted">{busy ? "…" : "＋"}</span>
            <span className="px-1 text-[10px] font-medium text-muted">Görsel ekle</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={async (e) => {
                const fs = e.target.files;
                if (!fs?.length) return;
                setBusy(true);
                try {
                  await onUpload(fs);
                } finally {
                  setBusy(false);
                  e.target.value = "";
                }
              }}
            />
          </label>
          <label className="flex aspect-[9/16] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-hairline bg-mist text-center transition hover:border-signal">
            <span className="text-[20px] text-muted">{busyVid ? "…" : "🎬"}</span>
            <span className="px-1 text-[10px] font-medium text-muted">Video ekle</span>
            <input
              type="file"
              accept="video/*"
              multiple
              className="hidden"
              onChange={async (e) => {
                const fs = e.target.files;
                if (!fs?.length) return;
                setBusyVid(true);
                try {
                  await onUploadVideo(fs);
                } finally {
                  setBusyVid(false);
                  e.target.value = "";
                }
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
