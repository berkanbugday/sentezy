"use client";

import { estimateDuration } from "@/hooks/useCaptionPlayback";
import type { CreateReelValues } from "@/lib/schemas";
import { CAPTION_STYLES } from "./constants";

/* ── 05 · Önizle ──────────────────────────────────────────────────────── */
export function ReviewStep({
  values,
  presenterName,
  voiceLabel,
  submitError,
}: {
  values: CreateReelValues;
  presenterName: string;
  voiceLabel: string;
  submitError: string | null;
}) {
  const rows: [string, string][] = [
    ["Başlık", values.title || "—"],
    ["Sunucu", presenterName],
    ["Ses", voiceLabel],
    ["Oran", values.aspectRatio],
    ["Altyazı", values.captions ? (CAPTION_STYLES.find((s) => s.value === (values.captionStyle ?? "karaoke"))?.label ?? "Karaoke") : "Kapalı"],
    ["Süre", `~${estimateDuration(values.script ?? "").toFixed(1)}s`],
  ];
  return (
    <div className="flex flex-col gap-3 text-[14px]">
      <p className="text-[13px] text-slate">Her şey hazır. Oluşturunca videon işlenmeye başlar.</p>
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between border-b border-hairline pb-2">
          <span className="text-muted">{k}</span>
          <span className="font-semibold text-ink">{v}</span>
        </div>
      ))}
      <div className="mt-2 flex items-center justify-between rounded-xl bg-mist px-4 py-3">
        <span className="text-[13px] text-slate">Kredi maliyeti</span>
        <span className="text-[13px] font-semibold text-ink">1 kredi</span>
      </div>
      {submitError && <p className="text-[12.5px] text-red-600">{submitError}</p>}
    </div>
  );
}
