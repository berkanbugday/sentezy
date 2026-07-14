"use client";

import { estimateDuration, toWords } from "@/hooks/useCaptionPlayback";
import { useEnhanceEmotion } from "@/lib/queries";
import { fieldClass } from "./constants";
import type { Common } from "./types";

const SAMPLE =
  "Yeni sezon koleksiyonumuz geldi! Bu hafta sana özel indirimleri kaçırma. Hemen mağazamıza uğra, favori parçalarını keşfet.";

/* ── 04 · Senaryo — the video's spoken script ─────────────────────────── */
export function ScriptStep({ register, errors, values, setValue }: Common) {
  const chars = values.script?.length ?? 0;
  const words = toWords(values.script ?? "").length;
  const secs = estimateDuration(values.script ?? "");
  const enhance = useEnhanceEmotion();
  const hasScript = Boolean(values.script?.trim());

  const runEnhance = () =>
    enhance.mutate(
      {
        script: values.script ?? "",
        imageIds: values.backgroundImageIds ?? [],
        tone: values.voiceEmotion ?? "",
      },
      { onSuccess: (r) => r.changed && setValue("script", r.script, { shouldValidate: true }) },
    );

  // Feedback line under the field, derived from the last enhance result.
  const note = enhance.isError
    ? { text: "Duygu ekleme başarısız oldu, tekrar dene.", cls: "text-red-600" }
    : enhance.data
      ? enhance.data.enabled === false
        ? { text: "Duygu motoru kapalı (OpenRouter anahtarı yok).", cls: "text-muted" }
        : enhance.data.changed
          ? { text: "Duygular eklendi ✓ — [excited] gibi etiketler seste duyulur, altyazıda görünmez.", cls: "text-signal" }
          : { text: "Uygun bir duygu bulunamadı, metin değişmedi.", cls: "text-muted" }
      : null;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-[13px] font-medium text-ink">Senaryo</label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={runEnhance}
              disabled={!hasScript || enhance.isPending}
              className="text-[12px] font-medium text-signal hover:underline disabled:cursor-not-allowed disabled:opacity-40"
            >
              {enhance.isPending ? "Analiz ediliyor…" : "✨ Duyguları ekle"}
            </button>
            <button
              type="button"
              onClick={() => setValue("script", SAMPLE, { shouldValidate: true })}
              className="text-[12px] font-medium text-signal hover:underline"
            >
              Örnek metni dene
            </button>
          </div>
        </div>
        <textarea
          rows={9}
          className={`${fieldClass} resize-y leading-relaxed`}
          placeholder="Videonun konuşma metnini yaz — sağdaki önizlemede anında görünsün…"
          {...register("script")}
        />
        <div className="mt-1.5 flex justify-between text-[12px] text-muted">
          <span>{errors.script && <span className="text-red-600">{errors.script.message}</span>}</span>
          <span className="mono">{words} kelime · {chars} karakter · ~{secs.toFixed(1)}s</span>
        </div>
        {note && <p className={`mt-1.5 text-[12px] ${note.cls}`}>{note.text}</p>}
        <p className="mt-2 text-[12px] leading-relaxed text-muted">
          Arka plan fotoğraflarını ve metni yapay zekâ analiz eder, cümlelere uygun duygu tonlarını
          ekler. Sesli anlatım daha insansı olur.
        </p>
      </div>
    </div>
  );
}
