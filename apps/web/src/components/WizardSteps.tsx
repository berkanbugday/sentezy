"use client";

import { useRef, useState } from "react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { estimateDuration, toWords } from "@/hooks/useCaptionPlayback";
import { apiFetch } from "@/lib/api";
import type { CreateReelValues } from "@/lib/schemas";

export type Voice = { id: string; label: string; gender: string | null; style: string | null; previewUrl?: string | null };
export type Presenter = { id: string; name: string; status: string; imageUrl?: string | null };

type Common = {
  register: UseFormRegister<CreateReelValues>;
  errors: FieldErrors<CreateReelValues>;
  values: CreateReelValues;
  setValue: (name: keyof CreateReelValues, value: CreateReelValues[keyof CreateReelValues], opts?: object) => void;
};

const fieldClass =
  "w-full rounded-xl border border-hairline bg-mist px-3.5 py-2.5 text-[14px] text-ink outline-none transition focus:border-signal";

const SAMPLE =
  "Yeni sezon koleksiyonumuz geldi! Bu hafta sana özel indirimleri kaçırma. Hemen mağazamıza uğra, favori parçalarını keşfet.";

/* ── 01 · Senaryo ─────────────────────────────────────────────────────── */
export function ScriptStep({ register, errors, values, setValue }: Common) {
  const chars = values.script?.length ?? 0;
  const words = toWords(values.script ?? "").length;
  const secs = estimateDuration(values.script ?? "");
  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className="mb-1.5 block text-[13px] font-medium text-ink">Başlık</label>
        <input className={fieldClass} placeholder="Örn: Kuaför tanıtımı" {...register("title")} />
        {errors.title && <p className="mt-1 text-[12.5px] text-red-600">{errors.title.message}</p>}
      </div>
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-[13px] font-medium text-ink">Senaryo</label>
          <button
            type="button"
            onClick={() => setValue("script", SAMPLE, { shouldValidate: true })}
            className="text-[12px] font-medium text-signal hover:underline"
          >
            Örnek metni dene
          </button>
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
      </div>
    </div>
  );
}

/* ── 02 · Avatar ──────────────────────────────────────────────────────── */
export function AvatarStep({
  presenters,
  selected,
  onSelect,
  onCreated,
  error,
}: {
  presenters: Presenter[];
  selected?: string;
  onSelect: (id: string) => void;
  onCreated: (p: Presenter) => void;
  error?: string;
}) {
  const [name, setName] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function addPresenter() {
    const file = fileRef.current?.files?.[0];
    if (!name.trim() || !file) return;
    setBusy(true);
    try {
      const { presenter, uploadURL, imageUrl } = await apiFetch<{ presenter: Presenter; uploadURL: string; imageUrl: string }>(
        "/presenters",
        { method: "POST", body: JSON.stringify({ name }) },
      );
      const fd = new FormData();
      fd.append("file", file);
      await fetch(uploadURL, { method: "POST", body: fd });
      onCreated({ ...presenter, imageUrl });
      setName("");
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="mb-4 text-[13px] text-slate">Videoda konuşacak sunucuyu seç ya da kendi fotoğrafını yükle.</p>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {presenters.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p.id)}
            className={`group overflow-hidden rounded-2xl border text-center transition ${
              selected === p.id ? "border-signal ring-2 ring-signal/30" : "border-hairline hover:border-signal/50"
            }`}
          >
            <div className="relative aspect-[3/4] w-full bg-mist">
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
              ) : (
                <div className="grad flex h-full w-full items-center justify-center text-[22px] font-bold text-white">
                  {p.name.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div className="truncate px-2 py-1.5 text-[12.5px] font-semibold text-ink">{p.name}</div>
          </button>
        ))}

        {/* upload tile */}
        <label className="flex aspect-[3/4] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-hairline bg-mist text-center transition hover:border-signal">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full rounded-2xl object-cover" />
          ) : (
            <>
              <span className="text-[22px] text-muted">＋</span>
              <span className="px-2 text-[11px] font-medium text-muted">Fotoğraf yükle</span>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setPreview(f ? URL.createObjectURL(f) : null);
            }}
          />
        </label>
      </div>

      {preview && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-hairline bg-mist p-2.5">
          <input
            className={`${fieldClass} flex-1`}
            placeholder="Sunucuya bir isim ver"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="button" onClick={addPresenter} disabled={busy || !name.trim()} className="btn btn-primary disabled:opacity-50">
            {busy ? "Yükleniyor…" : "Ekle"}
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-[12.5px] text-red-600">{error}</p>}
    </div>
  );
}

/* ── 03 · Ses & dil ───────────────────────────────────────────────────── */
export function VoiceStep({
  voices,
  selected,
  onSelect,
  error,
}: {
  voices: Voice[];
  selected?: string;
  onSelect: (id: string) => void;
  error?: string;
}) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function sample(v: Voice) {
    if (!v.previewUrl) return;
    const audio = audioRef.current ?? (audioRef.current = new Audio());
    if (playingId === v.id) {
      audio.pause();
      setPlayingId(null);
      return;
    }
    audio.src = v.previewUrl;
    audio.onended = () => setPlayingId(null);
    void audio.play();
    setPlayingId(v.id);
  }

  return (
    <div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {voices.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => onSelect(v.id)}
            className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition ${
              selected === v.id ? "border-signal bg-[var(--wash)]" : "border-hairline bg-paper hover:border-signal/50"
            }`}
          >
            {v.previewUrl && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); sample(v); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); sample(v); } }}
                aria-label="Sesi dinle"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-paper transition hover:opacity-90"
              >
                {playingId === v.id ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                )}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-ink">{v.label}</span>
              <span className="block truncate text-[12px] text-muted">{[v.gender, v.style].filter(Boolean).join(" · ")}</span>
            </span>
            <Waveform active={selected === v.id || playingId === v.id} />
          </button>
        ))}
        {voices.length === 0 && <p className="text-[13px] text-muted">Sesler yükleniyor…</p>}
      </div>
      {error && <p className="mt-2 text-[12.5px] text-red-600">{error}</p>}
    </div>
  );
}

function Waveform({ active }: { active: boolean }) {
  const bars = [8, 14, 6, 16, 10, 13, 7];
  return (
    <span className="flex h-5 items-center gap-[3px]">
      {bars.map((hgt, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full transition-colors"
          style={{ height: hgt, background: active ? "var(--color-signal)" : "var(--color-hairline)" }}
        />
      ))}
    </span>
  );
}

/* ── 04 · Biçim ───────────────────────────────────────────────────────── */
const RATIOS: { value: CreateReelValues["aspectRatio"]; label: string; w: number; h: number }[] = [
  { value: "9:16", label: "Reels · Story", w: 18, h: 32 },
  { value: "1:1", label: "Kare · Feed", w: 28, h: 28 },
  { value: "16:9", label: "Yatay · YouTube", w: 34, h: 19 },
];

export function FormatStep({ register, values, setValue, colors }: Common & { colors: string[] }) {
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

      <label className="flex items-center justify-between rounded-xl border border-hairline px-4 py-3">
        <span>
          <span className="block text-[14px] font-medium text-ink">Otomatik altyazı</span>
          <span className="block text-[12px] text-muted">Konuşma metni videoya işlenir</span>
        </span>
        <input type="checkbox" {...register("captions")} className="h-5 w-5 accent-[var(--color-signal)]" />
      </label>

      <div>
        <label className="mb-2.5 block text-[13px] font-medium text-ink">Arka plan</label>
        <div className="flex flex-wrap gap-2.5">
          {colors.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setValue("backgroundColor", c)}
              className={`h-10 w-10 rounded-xl border-2 transition ${values.backgroundColor === c ? "border-signal ring-2 ring-signal/30" : "border-hairline"}`}
              style={{ background: c }}
              aria-label={c}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

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
    ["Altyazı", values.captions ? "Açık" : "Kapalı"],
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
